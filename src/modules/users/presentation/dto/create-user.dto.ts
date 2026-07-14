import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../domain/user.types';

export class CreateUserDto {
  @ApiProperty({ example: 'counsel@legal.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Jane Counsel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.LEGAL_COUNSEL })
  @IsEnum(UserRole)
  role!: UserRole;
}
