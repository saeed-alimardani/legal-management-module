import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../types/authenticated-user.type';

export interface OwnedResource {
  ownerId: string;
  assigneeId?: string | null;
}

export interface TaskResource extends OwnedResource {
  createdById: string;
}

export interface DocumentResource {
  ownerId: string;
  uploadedById: string;
}

@Injectable()
export class AccessControlService {
  isAdminOrManager(user: AuthenticatedUser): boolean {
    return (
      user.role === UserRole.LEGAL_ADMIN || user.role === UserRole.LEGAL_MANAGER
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
      return resource.ownerId === user.id || resource.assigneeId === user.id;
    }

    return false;
  }

  canEdit(
    user: AuthenticatedUser,
    resource: Pick<OwnedResource, 'ownerId'>,
  ): boolean {
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
      throw new ForbiddenException(
        'You do not have permission to edit this resource',
      );
    }
  }

  assertCanMutate(user: AuthenticatedUser): void {
    if (!this.canMutate(user)) {
      throw new ForbiddenException('Read-only users cannot modify data');
    }
  }

  assertCanReassign(user: AuthenticatedUser): void {
    if (!this.canReassign(user)) {
      throw new ForbiddenException(
        'You do not have permission to reassign ownership',
      );
    }
  }

  /** List filter for owner-based entities (cases, contracts, notices). */
  buildOwnerListFilter(user: AuthenticatedUser): { ownerId?: string } {
    if (user.role === UserRole.LEGAL_COUNSEL) {
      return { ownerId: user.id };
    }

    return {};
  }

  /**
   * Counsel may see deadlines they own via parent matter or are assigned to.
   * Admin/Manager/Viewer → no extra filter (full read scope).
   */
  buildDeadlineListFilter(user: AuthenticatedUser): {
    counselUserId?: string;
  } {
    if (user.role === UserRole.LEGAL_COUNSEL) {
      return { counselUserId: user.id };
    }

    return {};
  }

  /** Parent owner or assignee may update; Viewer never. */
  canEditDeadline(user: AuthenticatedUser, resource: OwnedResource): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return resource.ownerId === user.id || resource.assigneeId === user.id;
    }

    return false;
  }

  assertCanEditDeadline(
    user: AuthenticatedUser,
    resource: OwnedResource,
  ): void {
    if (!this.canEditDeadline(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to edit this deadline',
      );
    }
  }

  /** Cancel requires parent ownership (or admin/manager). */
  assertCanCancelDeadline(
    user: AuthenticatedUser,
    resource: Pick<OwnedResource, 'ownerId'>,
  ): void {
    this.assertCanEdit(user, resource);
  }

  /**
   * Counsel may see tasks on matters they own or tasks assigned to them.
   * Admin/Manager/Viewer → no extra filter (full read scope).
   */
  buildTaskListFilter(user: AuthenticatedUser): {
    counselUserId?: string;
  } {
    if (user.role === UserRole.LEGAL_COUNSEL) {
      return { counselUserId: user.id };
    }

    return {};
  }

  /** Admin/Manager, parent owner, assignee, or creator may update. */
  canEditTask(user: AuthenticatedUser, resource: TaskResource): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return (
        resource.ownerId === user.id ||
        resource.assigneeId === user.id ||
        resource.createdById === user.id
      );
    }

    return false;
  }

  assertCanEditTask(user: AuthenticatedUser, resource: TaskResource): void {
    if (!this.canEditTask(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to edit this task',
      );
    }
  }

  /** Cancel requires admin/manager or creator. */
  canCancelTask(
    user: AuthenticatedUser,
    resource: Pick<TaskResource, 'createdById'>,
  ): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return resource.createdById === user.id;
    }

    return false;
  }

  assertCanCancelTask(
    user: AuthenticatedUser,
    resource: Pick<TaskResource, 'createdById'>,
  ): void {
    if (!this.canCancelTask(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to cancel this task',
      );
    }
  }

  /**
   * Counsel may see documents on matters they own.
   * Admin/Manager/Viewer → no extra filter.
   */
  buildDocumentListFilter(user: AuthenticatedUser): {
    counselUserId?: string;
  } {
    if (user.role === UserRole.LEGAL_COUNSEL) {
      return { counselUserId: user.id };
    }

    return {};
  }

  /** Soft-delete: admin/manager or uploader. */
  canDeleteDocument(
    user: AuthenticatedUser,
    resource: Pick<DocumentResource, 'uploadedById'>,
  ): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return resource.uploadedById === user.id;
    }

    return false;
  }

  assertCanDeleteDocument(
    user: AuthenticatedUser,
    resource: Pick<DocumentResource, 'uploadedById'>,
  ): void {
    if (!this.canDeleteDocument(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to delete this document',
      );
    }
  }
}
