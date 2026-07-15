import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateUserInput,
  ListUsersFilters,
  SafeUser,
  UpdateUserInput,
  UserDirectoryEntry,
} from '../domain/user.types';

const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class PrismaUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  }

  create(input: CreateUserInput): Promise<SafeUser> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        role: input.role,
      },
      select: safeUserSelect,
    });
  }

  update(id: string, input: UpdateUserInput): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: safeUserSelect,
    });
  }

  async list(
    filters: ListUsersFilters,
  ): Promise<{ items: SafeUser[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    };

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
        select: safeUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  listDirectory(): Promise<UserDirectoryEntry[]> {
    return this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
      },
    });
  }
}
