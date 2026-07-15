export const APP_CONSTANTS = {
  API_PREFIX: 'api/v1',
  SWAGGER_PATH: 'api/docs',
  MAX_UPLOAD_SIZE_BYTES: 20 * 1024 * 1024,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ] as const,
} as const;

export const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

export const CONFIG_KEYS = {
  PORT: 'PORT',
  NODE_ENV: 'NODE_ENV',
  APP_TIMEZONE: 'APP_TIMEZONE',
  DATABASE_URL: 'DATABASE_URL',
  JWT_SECRET: 'JWT_SECRET',
  JWT_EXPIRES_IN: 'JWT_EXPIRES_IN',
  UPLOAD_DIR: 'UPLOAD_DIR',
  FRONTEND_URL: 'FRONTEND_URL',
} as const;
