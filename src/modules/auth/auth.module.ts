import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CONFIG_KEYS } from '../../config/constants';
import { GetMeUseCase } from './application/get-me.use-case';
import { LoginUseCase } from './application/login.use-case';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>(CONFIG_KEYS.JWT_SECRET),
        signOptions: {
          expiresIn: configService.get<string>(
            CONFIG_KEYS.JWT_EXPIRES_IN,
            '8h',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    PrismaUserRepository,
    LoginUseCase,
    GetMeUseCase,
    JwtStrategy,
  ],
  exports: [JwtModule, PassportModule, PrismaUserRepository],
})
export class AuthModule {}
