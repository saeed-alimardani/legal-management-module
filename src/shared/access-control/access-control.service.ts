import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../types/authenticated-user.type';

export interface OwnedResource {
  ownerId: string;
  assigneeId?: string | null;
}

@Injectable()
export class AccessControlService {
  isAdminOrManager(user: AuthenticatedUser): boolean {
    return (
      user.role === UserRole.LEGAL_ADMIN ||
      user.role === UserRole.LEGAL_MANAGER
    );
  }

  isViewer(user: AuthenticatedUser): boolean {
    return user.role === UserRole.VIEWER;
  }

  canMutate(user: AuthenticatedUser): boolean {
    return user.role !== UserRole.VIEWER;
  }

  canView(user: AuthenticatedUser, resource: OwnedResource): boolean {
    if (this.isAdminOrManager(user) || this.isViewer(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return (
        resource.ownerId === user.id ||
        resource.assigneeId === user.id
      );
    }

    return false;
  }

  canEdit(user: AuthenticatedUser, resource: Pick<OwnedResource, 'ownerId'>): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return resource.ownerId === user.id;
    }

    return false;
  }

  canReassign(user: AuthenticatedUser): boolean {
    return this.isAdminOrManager(user);
  }

  assertCanView(user: AuthenticatedUser, resource: OwnedResource): void {
    if (!this.canView(user, resource)) {
      throw new ForbiddenException('You do not have access to this resource');
    }
  }

  assertCanEdit(
    user: AuthenticatedUser,
    resource: Pick<OwnedResource, 'ownerId'>,
  ): void {
    if (!this.canEdit(user, resource)) {
      throw new ForbiddenException('You do not have permission to edit this resource');
    }
  }

  assertCanMutate(user: AuthenticatedUser): void {
    if (!this.canMutate(user)) {
      throw new ForbiddenException('Read-only users cannot modify data');
    }
  }

  assertCanReassign(user: AuthenticatedUser): void {
    if (!this.canReassign(user)) {
      throw new ForbiddenException('You do not have permission to reassign ownership');
    }
  }

  /** List filter for owner-based entities (cases, contracts, notices). */
  buildOwnerListFilter(user: AuthenticatedUser): { ownerId?: string } {
    if (user.role === UserRole.LEGAL_COUNSEL) {
      return { ownerId: user.id };
    }

    return {};
  }
}
