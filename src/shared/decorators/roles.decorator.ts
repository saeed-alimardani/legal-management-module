import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../constants/metadata-keys';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
