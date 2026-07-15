import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  APP_TIMEZONE: Joi.string().default('Asia/Tehran'),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),
  UPLOAD_DIR: Joi.string().default('./uploads'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3001'),
});
