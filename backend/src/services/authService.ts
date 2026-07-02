import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db';
import { config } from '../config';

const MIN_PASSWORD_LENGTH = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface PasswordValidation {
  ok: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > 200) errors.push('Password is too long.');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter.');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a digit.');
  return { ok: errors.length === 0, errors };
}

export async function register(email: string, password: string, name: string) {
  const validation = validatePassword(password);
  if (!validation.ok) {
    throw Object.assign(new Error(validation.errors.join(' ')), { statusCode: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
    [normalizedEmail, passwordHash, name]
  );

  const user = result.rows[0];
  const token = generateToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return { user: { id: user.id, email: user.email, name: user.name }, token, refreshToken };
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await query(
    `SELECT id, email, name, password_hash, failed_login_attempts, locked_until
     FROM users WHERE email = $1`,
    [normalizedEmail]
  );
  if (result.rows.length === 0) {
    // Same message as bad password to avoid user enumeration.
    throw new AuthError('Invalid email or password', 401);
  }

  const user = result.rows[0];

  // P1-1: account lockout enforcement
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remainingMs = new Date(user.locked_until).getTime() - Date.now();
    const mins = Math.ceil(remainingMs / 60000);
    throw new AuthError(`Account locked. Try again in ${mins} minute(s).`, 423);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const newCount = (user.failed_login_attempts || 0) + 1;
    if (newCount >= MAX_FAILED_ATTEMPTS) {
      await query(
        `UPDATE users SET failed_login_attempts = $1,
           locked_until = NOW() + ($2 * INTERVAL '1 minute')
         WHERE id = $3`,
        [newCount, LOCKOUT_MINUTES, user.id]
      );
      throw new AuthError(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`, 423);
    }
    await query(
      'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
      [newCount, user.id]
    );
    throw new AuthError('Invalid email or password', 401);
  }

  // Reset on success.
  await query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1`,
    [user.id]
  );

  const token = generateToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return { user: { id: user.id, email: user.email, name: user.name }, token, refreshToken };
}

export async function getUser(id: string) {
  const result = await query(
    'SELECT id, email, name, created_at, email_verified, last_login_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const validation = validatePassword(newPassword);
  if (!validation.ok) {
    throw Object.assign(new Error(validation.errors.join(' ')), { statusCode: 400 });
  }
  const row = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (row.rows.length === 0) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const ok = await bcrypt.compare(oldPassword, row.rows[0].password_hash);
  if (!ok) throw new AuthError('Current password is incorrect', 401);
  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
  // Invalidate refresh tokens
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  return true;
}

function generateToken(user: { id: string; email: string }) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as SignOptions
  );
}

async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
    [userId, hash]
  );
  return raw;
}

export async function refreshSession(rawRefreshToken: string) {
  const hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const result = await query(
    `SELECT rt.id AS rt_id, rt.user_id, u.email, u.name
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND rt.revoked_at IS NULL`,
    [hash]
  );
  if (result.rows.length === 0) throw new AuthError('Invalid or expired refresh token', 401);
  const row = result.rows[0];

  // Rotate: revoke the old token and issue a new one.
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [row.rt_id]);
  const newRefresh = await issueRefreshToken(row.user_id);
  const token = generateToken({ id: row.user_id, email: row.email });
  return {
    user: { id: row.user_id, email: row.email, name: row.name },
    token,
    refreshToken: newRefresh,
  };
}

export async function logout(rawRefreshToken: string) {
  if (!rawRefreshToken) return;
  const hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hash]
  );
}
