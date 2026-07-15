import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TEST_PASSWORD } from './db.helper';

export async function loginAs(
  app: INestApplication,
  email: string,
): Promise<{ token: string; userId: string }> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  return {
    token: response.body.data.accessToken,
    userId: response.body.data.user.id,
  };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
