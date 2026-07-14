import { UserRole } from '@prisma/client';
import { AccessControlService } from '../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../src/shared/types/authenticated-user.type';

describe('AccessControlService', () => {
  let service: AccessControlService;

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

  beforeEach(() => {
    service = new AccessControlService();
  });

  it('allows counsel to edit own resource', () => {
    expect(service.canEdit(counsel, { ownerId: counsel.id })).toBe(true);
  });

  it('denies counsel editing another users resource', () => {
    expect(service.canEdit(counsel, { ownerId: 'other-id' })).toBe(false);
  });

  it('allows manager to edit any resource', () => {
    expect(service.canEdit(manager, { ownerId: 'other-id' })).toBe(true);
  });

  it('denies viewer mutations', () => {
    expect(service.canMutate(viewer)).toBe(false);
  });

  it('allows counsel to view assigned resource', () => {
    expect(
      service.canView(counsel, { ownerId: 'other-id', assigneeId: counsel.id }),
    ).toBe(true);
  });

  it('scopes counsel list filter to own records', () => {
    expect(service.buildOwnerListFilter(counsel)).toEqual({
      ownerId: counsel.id,
    });
  });

  it('does not scope admin list filter', () => {
    expect(service.buildOwnerListFilter(admin)).toEqual({});
  });

  it('scopes counsel deadline list to counsel user id', () => {
    expect(service.buildDeadlineListFilter(counsel)).toEqual({
      counselUserId: counsel.id,
    });
  });

  it('does not scope admin deadline list', () => {
    expect(service.buildDeadlineListFilter(admin)).toEqual({});
  });

  it('allows counsel to edit deadline when assigned', () => {
    expect(
      service.canEditDeadline(counsel, {
        ownerId: 'other-id',
        assigneeId: counsel.id,
      }),
    ).toBe(true);
  });

  it('denies counsel cancel when not parent owner', () => {
    expect(service.canEdit(counsel, { ownerId: 'other-id' })).toBe(false);
  });
});
