import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { LoginUseCase } from '../../../src/modules/auth/application/login.use-case';
import { PrismaUserRepository } from '../../../src/modules/auth/infrastructure/prisma-user.repository';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<Pick<PrismaUserRepository, 'findByEmail'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const activeUser = {
    id: 'user-1',
    email: 'counsel@legal.local',
    passwordHash: '',
    fullName: 'Legal Counsel',
    role: UserRole.LEGAL_COUNSEL,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    activeUser.passwordHash = await bcrypt.hash('Password123!', 10);

    userRepository = {
      findByEmail: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
    };

    useCase = new LoginUseCase(
      userRepository as unknown as PrismaUserRepository,
      jwtService as unknown as JwtService,
    );
  });

  it('returns access token and user on valid credentials', async () => {
    userRepository.findByEmail.mockResolvedValue(activeUser);

    const result = await useCase.execute({
      email: 'counsel@legal.local',
      password: 'Password123!',
    });

    expect(result.data.accessToken).toBe('signed-jwt-token');
    expect(result.data.user).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      fullName: activeUser.fullName,
      role: activeUser.role,
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
    });
  });

  it('throws when user is not found', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: 'missing@legal.local',
        password: 'Password123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when password is invalid', async () => {
    userRepository.findByEmail.mockResolvedValue(activeUser);

    await expect(
      useCase.execute({ email: activeUser.email, password: 'WrongPassword!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when user is inactive', async () => {
    userRepository.findByEmail.mockResolvedValue({
      ...activeUser,
      isActive: false,
    });

    await expect(
      useCase.execute({ email: activeUser.email, password: 'Password123!' }),
    ).rejects.toThrow('User account is inactive');
  });

  it('does not expose password hash in response', async () => {
    userRepository.findByEmail.mockResolvedValue(activeUser);

    const result = await useCase.execute({
      email: activeUser.email,
      password: 'Password123!',
    });

    expect(result.data.user).not.toHaveProperty('passwordHash');
  });
});
