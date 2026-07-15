import { UserRole } from '@prisma/client';
import { MatterInvolvementService } from '../../src/shared/access-control/matter-involvement.service';
import { AuthenticatedUser } from '../../src/shared/types/authenticated-user.type';

export const manager: AuthenticatedUser = {
  id: 'manager-id',
  email: 'manager@legal.local',
  fullName: 'Manager',
  role: UserRole.LEGAL_MANAGER,
};

export const counsel: AuthenticatedUser = {
  id: 'counsel-id',
  email: 'counsel@legal.local',
  fullName: 'Counsel',
  role: UserRole.LEGAL_COUNSEL,
};

export const admin: AuthenticatedUser = {
  id: 'admin-id',
  email: 'admin@legal.local',
  fullName: 'Admin',
  role: UserRole.LEGAL_ADMIN,
};

export function createMockMatterInvolvement(): jest.Mocked<
  Pick<MatterInvolvementService, 'isUserInvolvedInParent'>
> {
  return {
    isUserInvolvedInParent: jest.fn().mockResolvedValue(true),
  };
}
