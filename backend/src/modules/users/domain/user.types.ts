import { UserRole } from '@prisma/client';

export { UserRole } from '@prisma/client';

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
}

export interface UpdateUserInput {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface ListUsersFilters {
  role?: UserRole;
  isActive?: boolean;
  page: number;
  limit: number;
}

export interface UserDirectoryEntry {
  id: string;
  fullName: string;
}
