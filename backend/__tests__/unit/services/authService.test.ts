jest.mock('../../../src/db', () => require('./../../unit/__mocks__/db'));
jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (s: string) => `hashed::${s}`),
  compare: jest.fn(async (raw: string, hashed: string) => hashed === `hashed::${raw}`),
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed.jwt.token'),
}));

import * as authService from '../../../src/services/authService';
import { queryMock } from './../../unit/__mocks__/db';

describe('authService.validatePassword', () => {
  it('rejects passwords shorter than 10 chars', () => {
    const r = authService.validatePassword('short1A');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/at least 10/i);
  });

  it('requires upper, lower, and digit', () => {
    expect(authService.validatePassword('alllowercase1').ok).toBe(false);
    expect(authService.validatePassword('ALLUPPERCASE1').ok).toBe(false);
    expect(authService.validatePassword('NoDigitsAtAll').ok).toBe(false);
    expect(authService.validatePassword('Valid1Pass!!').ok).toBe(true);
  });

  it('rejects extremely long passwords', () => {
    expect(authService.validatePassword('a'.repeat(300)).ok).toBe(false);
  });
});

describe('authService.register', () => {
  beforeEach(() => queryMock.mockReset());

  it('hashes password, persists the user, and returns tokens', async () => {
    queryMock
      // existing email lookup → none
      .mockResolvedValueOnce({ rows: [] })
      // INSERT users
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@b.co', name: 'A', created_at: 'now' }] })
      // INSERT refresh_tokens
      .mockResolvedValueOnce({ rows: [] });

    const result = await authService.register('a@b.co', 'StrongPass1', 'A');
    expect(result.user.email).toBe('a@b.co');
    expect(result.token).toBe('signed.jwt.token');
    expect(result.refreshToken).toMatch(/^[a-f0-9]{96}$/);
  });

  it('rejects duplicate emails with 409', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'u1' }] });
    await expect(authService.register('a@b.co', 'StrongPass1', 'A'))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects weak passwords with 400', async () => {
    await expect(authService.register('a@b.co', 'weak', 'A'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('normalises emails to lower case', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@b.co', name: 'A' }] })
      .mockResolvedValueOnce({ rows: [] });

    await authService.register('  A@B.CO  ', 'StrongPass1', 'A');
    expect(queryMock.mock.calls[0][1][0]).toBe('a@b.co');
  });
});

describe('authService.login', () => {
  beforeEach(() => queryMock.mockReset());

  it('rejects unknown emails with 401 (and same message as bad password to avoid enumeration)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await expect(authService.login('nope@x.co', 'StrongPass1'))
      .rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
  });

  it('rejects bad passwords with 401', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'a@b.co', name: 'A', password_hash: 'hashed::other', failed_login_attempts: 0, locked_until: null }],
    });
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE failed_login_attempts

    await expect(authService.login('a@b.co', 'StrongPass1'))
      .rejects.toMatchObject({ statusCode: 401 });
    expect(queryMock.mock.calls[1][0]).toMatch(/UPDATE users SET failed_login_attempts/);
  });

  it('locks account after 5 failed attempts', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'a@b.co', name: 'A', password_hash: 'hashed::other', failed_login_attempts: 4, locked_until: null }],
    });
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE locked_until

    await expect(authService.login('a@b.co', 'WrongPass!!'))
      .rejects.toMatchObject({ statusCode: 423 });
    expect(queryMock.mock.calls[1][0]).toMatch(/locked_until/);
  });

  it('refuses login while account is locked', async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'a@b.co', name: 'A', password_hash: 'hashed::StrongPass1', failed_login_attempts: 5, locked_until: future }],
    });
    await expect(authService.login('a@b.co', 'StrongPass1'))
      .rejects.toMatchObject({ statusCode: 423 });
  });

  it('on success: resets counters, issues access + refresh tokens', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'a@b.co', name: 'A', password_hash: 'hashed::StrongPass1', failed_login_attempts: 0, locked_until: null }],
    });
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE reset counters
    queryMock.mockResolvedValueOnce({ rows: [] }); // INSERT refresh_tokens

    const r = await authService.login('a@b.co', 'StrongPass1');
    expect(r.user.id).toBe('u1');
    expect(r.token).toBe('signed.jwt.token');
    expect(typeof r.refreshToken).toBe('string');
  });
});

describe('authService.refreshSession', () => {
  beforeEach(() => queryMock.mockReset());

  it('rejects invalid refresh tokens', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await expect(authService.refreshSession('badtoken'))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('rotates the refresh token on success', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ rt_id: 'rt1', user_id: 'u1', email: 'a@b.co', name: 'A' }],
    });
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE revoke
    queryMock.mockResolvedValueOnce({ rows: [] }); // INSERT new
    const r = await authService.refreshSession('rawtoken');
    expect(r.user.id).toBe('u1');
    expect(r.refreshToken).toMatch(/^[a-f0-9]{96}$/);
    expect(queryMock.mock.calls[1][0]).toMatch(/SET revoked_at/);
  });
});
