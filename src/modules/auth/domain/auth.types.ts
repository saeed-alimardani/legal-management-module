import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUserResponse;
}
