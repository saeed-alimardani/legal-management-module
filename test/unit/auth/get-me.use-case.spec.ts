import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GetMeUseCase } from '../../../src/modules/auth/application/get-me.use-case';
import { PrismaUserRepository } from '../../../src/modules/auth/infrastructure/prisma-user.repository';

describe('GetMeUseCase', () => {
  let useCase: GetMeUseCase;
  let userRepository: jest.Mocked<Pick<PrismaUserRepository, 'findActiveById'>>;

  beforeEach(() => {
    userRepository = {
      findActiveById: jest.fn(),
    };

    useCase = new GetMeUseCase(
      userRepository as unknown as PrismaUserRepository,
    );
  });

  it('returns active user profile', async () => {
    userRepository.findActiveById.mockResolvedValue({
      id: 'user-1',
      email: 'admin@legal.local',
      fullName: 'Legal Admin',
      role: UserRole.LEGAL_ADMIN,
      isActive: true,
    });

    const result = await useCase.execute('user-1');

    expect(result.data).toEqual({
      id: 'user-1',
      email: 'admin@legal.local',
      fullName: 'Legal Admin',
      role: UserRole.LEGAL_ADMIN,
    });
  });

  it('throws when active user is not found', async () => {
    userRepository.findActiveById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('does not return isActive flag in response', async () => {
    userRepository.findActiveById.mockResolvedValue({
      id: 'user-1',
      email: 'viewer@legal.local',
      fullName: 'Viewer',
      role: UserRole.VIEWER,
      isActive: true,
    });

    const result = await useCase.execute('user-1');

    expect(result.data).not.toHaveProperty('isActive');
  });
});
