import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthUserResponse, JwtPayload, LoginResult } from '../domain/auth.types';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';

export interface LoginCommand {
  email: string;
  password: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: PrismaUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: LoginCommand) {
    const user = await this.userRepository.findByEmail(command.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const passwordMatches = await bcrypt.compare(
      command.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const result: LoginResult = {
      accessToken,
      user: this.toAuthUser(user),
    };

    return buildSingleResponse(result);
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    fullName: string;
    role: AuthUserResponse['role'];
  }): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
