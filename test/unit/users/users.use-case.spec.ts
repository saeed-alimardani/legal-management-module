import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { CreateUserUseCase } from '../../../src/modules/users/application/create-user.use-case';
import { GetUserUseCase } from '../../../src/modules/users/application/get-user.use-case';
import { ListUsersUseCase } from '../../../src/modules/users/application/list-users.use-case';
import { UpdateUserUseCase } from '../../../src/modules/users/application/update-user.use-case';
import { PrismaUserRepository } from '../../../src/modules/users/infrastructure/prisma-user.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepository: jest.Mocked<
    Pick<PrismaUserRepository, 'findByEmail' | 'create'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const manager: AuthenticatedUser = {
    id: 'manager-id',
    email: 'manager@legal.local',
    fullName: 'Manager',
    role: UserRole.LEGAL_MANAGER,
  };

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const createdUser = {
    id: 'user-1',
    email: 'new@legal.local',
    fullName: 'New User',
    role: UserRole.LEGAL_COUNSEL,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(createdUser),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateUserUseCase(
      userRepository as unknown as PrismaUserRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('creates user and logs activity for admin', async () => {
    const result = await useCase.execute(admin, {
      email: 'new@legal.local',
      password: 'password123',
      fullName: 'New User',
      role: UserRole.LEGAL_COUNSEL,
    });

    expect(result.data).toEqual(createdUser);
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@legal.local',
        fullName: 'New User',
        role: UserRole.LEGAL_COUNSEL,
      }),
    );
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATED,
        entityType: EntityType.USER,
        entityId: createdUser.id,
        actorId: admin.id,
      }),
    );
  });

  it('allows manager to create user', async () => {
    const result = await useCase.execute(manager, {
      email: 'new@legal.local',
      password: 'password123',
      fullName: 'New User',
      role: UserRole.LEGAL_COUNSEL,
    });

    expect(result.data).toEqual(createdUser);
  });

  it('throws forbidden for counsel', async () => {
    await expect(
      useCase.execute(counsel, {
        email: 'new@legal.local',
        password: 'password123',
        fullName: 'New User',
        role: UserRole.LEGAL_COUNSEL,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws forbidden for viewer', async () => {
    await expect(
      useCase.execute(viewer, {
        email: 'new@legal.local',
        password: 'password123',
        fullName: 'New User',
        role: UserRole.LEGAL_COUNSEL,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws conflict when email already exists', async () => {
    userRepository.findByEmail.mockResolvedValue(createdUser);

    await expect(
      useCase.execute(admin, {
        email: 'new@legal.local',
        password: 'password123',
        fullName: 'New User',
        role: UserRole.LEGAL_COUNSEL,
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('GetUserUseCase', () => {
  let useCase: GetUserUseCase;
  let userRepository: jest.Mocked<Pick<PrismaUserRepository, 'findById'>>;

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const targetUser = {
    id: 'user-1',
    email: 'user@legal.local',
    fullName: 'User',
    role: UserRole.LEGAL_COUNSEL,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    userRepository = {
      findById: jest.fn().mockResolvedValue(targetUser),
    };

    useCase = new GetUserUseCase(
      userRepository as unknown as PrismaUserRepository,
      new AccessControlService(),
    );
  });

  it('returns user for admin', async () => {
    const result = await useCase.execute(admin, targetUser.id);

    expect(result.data).toEqual(targetUser);
  });

  it('throws forbidden for counsel', async () => {
    await expect(useCase.execute(counsel, targetUser.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when user not found', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(admin, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ListUsersUseCase', () => {
  let useCase: ListUsersUseCase;
  let userRepository: jest.Mocked<Pick<PrismaUserRepository, 'list'>>;

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const users = [
    {
      id: 'user-1',
      email: 'user@legal.local',
      fullName: 'User',
      role: UserRole.LEGAL_COUNSEL,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    userRepository = {
      list: jest.fn().mockResolvedValue({ items: users, total: 1 }),
    };

    useCase = new ListUsersUseCase(
      userRepository as unknown as PrismaUserRepository,
      new AccessControlService(),
    );
  });

  it('returns paginated users for admin', async () => {
    const result = await useCase.execute(admin, {
      page: 1,
      limit: 20,
    });

    expect(result.data).toEqual(users);
    expect(result.meta.total).toBe(1);
    expect(userRepository.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      role: undefined,
      isActive: undefined,
    });
  });

  it('throws forbidden for counsel', async () => {
    await expect(
      useCase.execute(counsel, { page: 1, limit: 20 }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;
  let userRepository: jest.Mocked<
    Pick<PrismaUserRepository, 'findById' | 'update'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const existingUser = {
    id: 'user-1',
    email: 'user@legal.local',
    fullName: 'User',
    role: UserRole.LEGAL_COUNSEL,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    userRepository = {
      findById: jest.fn().mockResolvedValue(existingUser),
      update: jest.fn().mockResolvedValue({
        ...existingUser,
        fullName: 'Updated User',
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateUserUseCase(
      userRepository as unknown as PrismaUserRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('updates user and logs activity for admin', async () => {
    const result = await useCase.execute(admin, existingUser.id, {
      fullName: 'Updated User',
    });

    expect(result.data.fullName).toBe('Updated User');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATED,
        entityType: EntityType.USER,
        entityId: existingUser.id,
        metadata: { fields: ['fullName'] },
      }),
    );
  });

  it('throws forbidden for counsel', async () => {
    await expect(
      useCase.execute(counsel, existingUser.id, { fullName: 'Updated User' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when user not found', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(admin, 'missing', { fullName: 'Updated User' }),
    ).rejects.toThrow(NotFoundException);
  });
});
