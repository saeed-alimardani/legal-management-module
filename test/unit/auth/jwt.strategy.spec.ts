import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { JwtStrategy } from '../../../src/modules/auth/infrastructure/jwt.strategy';
import { PrismaUserRepository } from '../../../src/modules/auth/infrastructure/prisma-user.repository';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userRepository: jest.Mocked<Pick<PrismaUserRepository, 'findActiveById'>>;

  beforeEach(() => {
    userRepository = {
      findActiveById: jest.fn(),
    };

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-jwt-secret-key-123'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(
      configService,
      userRepository as unknown as PrismaUserRepository,
    );
  });

  it('maps active user payload to authenticated user', async () => {
    userRepository.findActiveById.mockResolvedValue({
      id: 'user-1',
      email: 'counsel@legal.local',
      fullName: 'Legal Counsel',
      role: UserRole.LEGAL_COUNSEL,
      isActive: true,
    });

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'counsel@legal.local',
      role: UserRole.LEGAL_COUNSEL,
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'counsel@legal.local',
      fullName: 'Legal Counsel',
      role: UserRole.LEGAL_COUNSEL,
    });
  });

  it('rejects inactive or missing users', async () => {
    userRepository.findActiveById.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'inactive-user',
        email: 'inactive@legal.local',
        role: UserRole.VIEWER,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
