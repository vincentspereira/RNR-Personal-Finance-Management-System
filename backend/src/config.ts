import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const KNOWN_WEAK_SECRETS = new Set([
  'dev-secret-change-in-production',
  'pfms-local-secret-change-me',
  'change-this-to-a-random-secret',
  'changeme',
  'secret',
  'jwt-secret',
]);

function resolveJwtSecret(): string {
  const raw = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!raw || raw.trim().length === 0) {
    if (isProd) {
      throw new Error(
        'JWT_SECRET is required in production. Generate one with: openssl rand -hex 64'
      );
    }
    return 'dev-secret-change-in-production';
  }

  const secret = raw.trim();
  if (isProd) {
    if (KNOWN_WEAK_SECRETS.has(secret)) {
      throw new Error(
        'JWT_SECRET matches a known weak/default value. Generate one with: openssl rand -hex 64'
      );
    }
    if (secret.length < 32) {
      throw new Error(
        `JWT_SECRET must be at least 32 characters in production (current length: ${secret.length}). ` +
        'Generate one with: openssl rand -hex 64'
      );
    }
  }
  return secret;
}

function resolveCorsOrigin(): string | string[] {
  const raw = process.env.CORS_ORIGIN || 'http://localhost:5173';
  if (raw.includes(',')) {
    return raw.split(',').map(o => o.trim()).filter(Boolean);
  }
  return raw;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://pfms:pfms_password@localhost:5432/pfms',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  zaiApiKey: process.env.ZAI_API_KEY || '',
  visionProvider: (process.env.VISION_PROVIDER || 'zai') as 'zai' | 'anthropic',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '20', 10),
  corsOrigin: resolveCorsOrigin(),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  // Vision/scan quotas
  scansPerUserPerDay: parseInt(process.env.SCANS_PER_USER_PER_DAY || '50', 10),
  // Logging
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // Object storage / signed urls (optional, for future P0-8 enhancement)
  signedUrlTtlSeconds: parseInt(process.env.SIGNED_URL_TTL_SECONDS || '300', 10),
};

export type AppConfig = typeof config;
