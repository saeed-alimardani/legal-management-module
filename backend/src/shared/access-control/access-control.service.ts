import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
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

export interface DiscussionResource {
  authorId: string;
}

export interface FinancialRecordResource {
  createdById: string;
}

export interface CreatedResource {
  createdById: string;
}

@Injectable()
export class AccessControlService {
  private isScopedReader(user: AuthenticatedUser): boolean {
    return (
      user.role === UserRole.LEGAL_COUNSEL || user.role === UserRole.VIEWER
    );
  }

  isAdmin(user: AuthenticatedUser): boolean {
    return user.role === UserRole.LEGAL_ADMIN;
  }

  isAdminOrManager(user: AuthenticatedUser): boolean {
    return (
      user.role === UserRole.LEGAL_ADMIN || user.role === UserRole.LEGAL_MANAGER
    );
  }

  isViewer(user: AuthenticatedUser): boolean {
    return user.role === UserRole.VIEWER;
  }

  hasScopedReadAccess(user: AuthenticatedUser): boolean {
    return this.isScopedReader(user);
  }

  canManageCoreEntities(user: AuthenticatedUser): boolean {
    return this.isAdminOrManager(user);
  }

  canCreateMatterContent(user: AuthenticatedUser): boolean {
    return user.role !== UserRole.VIEWER;
  }

  canManageUsers(user: AuthenticatedUser): boolean {
    return this.isAdmin(user);
  }

  canMutate(user: AuthenticatedUser): boolean {
    return this.canManageCoreEntities(user);
  }

  canViewAll(user: AuthenticatedUser): boolean {
    return this.isAdminOrManager(user);
  }

  canView(user: AuthenticatedUser, resource: OwnedResource): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (this.isScopedReader(user)) {
      return (
        resource.ownerId === user.id || resource.assigneeId === user.id
      );
    }

    return false;
  }

  canEdit(
    user: AuthenticatedUser,
    resource: Pick<OwnedResource, 'ownerId'>,
  ): boolean {
    return this.isAdminOrManager(user);
  }

  canReassign(user: AuthenticatedUser): boolean {
    return this.isAdminOrManager(user);
  }

  assertCanManageCoreEntities(user: AuthenticatedUser): void {
    if (!this.canManageCoreEntities(user)) {
      throw new ForbiddenException(
        'You do not have permission to manage this resource',
      );
    }
  }

  assertCanCreateMatterContent(user: AuthenticatedUser): void {
    if (!this.canCreateMatterContent(user)) {
      throw new ForbiddenException('Read-only users cannot modify data');
    }
  }

  assertCanManageUsers(user: AuthenticatedUser): void {
    if (!this.canManageUsers(user)) {
      throw new ForbiddenException('Insufficient permissions');
    }
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
    this.assertCanManageCoreEntities(user);
  }

  assertCanReassign(user: AuthenticatedUser): void {
    if (!this.canReassign(user)) {
      throw new ForbiddenException(
        'You do not have permission to reassign ownership',
      );
    }
  }

  assertCanViewMatter(
    user: AuthenticatedUser,
    ownerId: string,
    involved: boolean,
  ): void {
    if (this.canView(user, { ownerId })) {
      return;
    }

    if (this.isScopedReader(user) && involved) {
      return;
    }

    throw new ForbiddenException('You do not have access to this resource');
  }

  assertCanContributeToMatter(
    user: AuthenticatedUser,
    ownerId: string,
    involved: boolean,
  ): void {
    this.assertCanCreateMatterContent(user);
    this.assertCanViewMatter(user, ownerId, involved);
  }

  buildOwnerListFilter(user: AuthenticatedUser): { counselUserId?: string } {
    if (this.isScopedReader(user)) {
      return { counselUserId: user.id };
    }

    return {};
  }

  /** Admin/manager: all matters. Counsel/viewer: owned matters only. */
  buildCaseListScope(user: AuthenticatedUser): Prisma.LegalCaseWhereInput {
    if (this.isScopedReader(user)) {
      return { ownerId: user.id };
    }

    return {};
  }

  buildContractListScope(user: AuthenticatedUser): Prisma.ContractWhereInput {
    if (this.isScopedReader(user)) {
      return { ownerId: user.id };
    }

    return {};
  }

  buildNoticeListScope(user: AuthenticatedUser): Prisma.LegalNoticeWhereInput {
    if (this.isScopedReader(user)) {
      return { ownerId: user.id };
    }

    return {};
  }

  buildFinancialRecordListFilter(user: AuthenticatedUser): {
    counselUserId?: string;
  } {
    if (this.isScopedReader(user)) {
      return { counselUserId: user.id };
    }

    return {};
  }

  buildDeadlineListFilter(user: AuthenticatedUser): {
    counselUserId?: string;
  } {
    if (this.isScopedReader(user)) {
      return { counselUserId: user.id };
    }

    return {};
  }

  canEditDeadline(user: AuthenticatedUser, resource: CreatedResource): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return resource.createdById === user.id;
    }

    return false;
  }

  assertCanEditDeadline(
    user: AuthenticatedUser,
    resource: CreatedResource,
  ): void {
    if (!this.canEditDeadline(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to edit this deadline',
      );
    }
  }

  canCancelDeadline(user: AuthenticatedUser, resource: CreatedResource): boolean {
    return this.canEditDeadline(user, resource);
  }

  assertCanCancelDeadline(
    user: AuthenticatedUser,
    resource: CreatedResource,
  ): void {
    if (!this.canCancelDeadline(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to cancel this deadline',
      );
    }
  }

  canEditReminder(user: AuthenticatedUser, resource: CreatedResource): boolean {
    return this.canEditDeadline(user, resource);
  }

  assertCanEditReminder(
    user: AuthenticatedUser,
    resource: CreatedResource,
  ): void {
    if (!this.canEditReminder(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to edit this reminder',
      );
    }
  }

  assertCanViewActivityLogs(user: AuthenticatedUser): void {
    this.assertCanManageUsers(user);
  }

  buildTaskListFilter(user: AuthenticatedUser): {
    counselUserId?: string;
  } {
    if (this.isScopedReader(user)) {
      return { counselUserId: user.id };
    }

    return {};
  }

  canEditTask(user: AuthenticatedUser, resource: TaskResource): boolean {
    return this.isAdminOrManager(user);
  }

  assertCanEditTask(user: AuthenticatedUser, resource: TaskResource): void {
    if (!this.canEditTask(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to edit this task',
      );
    }
  }

  canCancelTask(
    user: AuthenticatedUser,
    resource: Pick<TaskResource, 'createdById'>,
  ): boolean {
    return this.isAdminOrManager(user);
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

  buildDocumentListFilter(user: AuthenticatedUser): {
    counselUserId?: string;
  } {
    if (this.isScopedReader(user)) {
      return { counselUserId: user.id };
    }

    return {};
  }

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

  buildDiscussionListFilter(user: AuthenticatedUser): {
    counselUserId?: string;
  } {
    if (this.isScopedReader(user)) {
      return { counselUserId: user.id };
    }

    return {};
  }

  canEditDiscussion(
    user: AuthenticatedUser,
    resource: Pick<DiscussionResource, 'authorId'>,
  ): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return resource.authorId === user.id;
    }

    return false;
  }

  assertCanEditDiscussion(
    user: AuthenticatedUser,
    resource: Pick<DiscussionResource, 'authorId'>,
  ): void {
    if (!this.canEditDiscussion(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to edit this discussion',
      );
    }
  }

  canEditFinancialRecord(
    user: AuthenticatedUser,
    resource: Pick<FinancialRecordResource, 'createdById'>,
  ): boolean {
    if (this.isAdminOrManager(user)) {
      return true;
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return resource.createdById === user.id;
    }

    return false;
  }

  assertCanEditFinancialRecord(
    user: AuthenticatedUser,
    resource: Pick<FinancialRecordResource, 'createdById'>,
  ): void {
    if (!this.canEditFinancialRecord(user, resource)) {
      throw new ForbiddenException(
        'You do not have permission to edit this financial record',
      );
    }
  }
}
