import { ForbiddenException } from '@nestjs/common';
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

  it('allows counsel to edit task when assignee or creator', () => {
    expect(
      service.canEditTask(counsel, {
        ownerId: 'other-id',
        assigneeId: counsel.id,
        createdById: 'creator-id',
      }),
    ).toBe(true);

    expect(
      service.canEditTask(counsel, {
        ownerId: 'other-id',
        assigneeId: 'other-assignee',
        createdById: counsel.id,
      }),
    ).toBe(true);
  });

  it('allows counsel to cancel only own created tasks', () => {
    expect(service.canCancelTask(counsel, { createdById: counsel.id })).toBe(
      true,
    );
    expect(service.canCancelTask(counsel, { createdById: 'other-id' })).toBe(
      false,
    );
  });

  it('allows counsel to delete own uploaded documents', () => {
    expect(
      service.canDeleteDocument(counsel, { uploadedById: counsel.id }),
    ).toBe(true);
    expect(
      service.canDeleteDocument(counsel, { uploadedById: 'other-id' }),
    ).toBe(false);
  });

  // --- buildTaskListFilter ---

  describe('buildTaskListFilter', () => {
    it('scopes counsel task list to counselUserId', () => {
      expect(service.buildTaskListFilter(counsel)).toEqual({
        counselUserId: counsel.id,
      });
    });

    it('does not scope admin task list', () => {
      expect(service.buildTaskListFilter(admin)).toEqual({});
    });

    it('does not scope manager task list', () => {
      expect(service.buildTaskListFilter(manager)).toEqual({});
    });

    it('does not scope viewer task list', () => {
      expect(service.buildTaskListFilter(viewer)).toEqual({});
    });
  });

  // --- buildFinancialRecordListFilter ---

  describe('buildFinancialRecordListFilter', () => {
    it('scopes counsel financial record list to ownerId', () => {
      expect(service.buildFinancialRecordListFilter(counsel)).toEqual({
        ownerId: counsel.id,
      });
    });

    it('does not scope admin financial record list', () => {
      expect(service.buildFinancialRecordListFilter(admin)).toEqual({});
    });

    it('does not scope viewer financial record list', () => {
      expect(service.buildFinancialRecordListFilter(viewer)).toEqual({});
    });
  });

  // --- buildDocumentListFilter ---

  describe('buildDocumentListFilter', () => {
    it('scopes counsel document list to counselUserId', () => {
      expect(service.buildDocumentListFilter(counsel)).toEqual({
        counselUserId: counsel.id,
      });
    });

    it('does not scope admin document list', () => {
      expect(service.buildDocumentListFilter(admin)).toEqual({});
    });

    it('does not scope viewer document list', () => {
      expect(service.buildDocumentListFilter(viewer)).toEqual({});
    });
  });

  // --- canEditTask ---

  describe('canEditTask', () => {
    it('denies counsel who is not owner, assignee, or creator', () => {
      expect(
        service.canEditTask(counsel, {
          ownerId: 'other-owner',
          assigneeId: 'other-assignee',
          createdById: 'other-creator',
        }),
      ).toBe(false);
    });

    it('allows counsel who is the parent owner', () => {
      expect(
        service.canEditTask(counsel, {
          ownerId: counsel.id,
          assigneeId: 'other-assignee',
          createdById: 'other-creator',
        }),
      ).toBe(true);
    });

    it('allows admin to edit any task', () => {
      expect(
        service.canEditTask(admin, {
          ownerId: 'other-owner',
          assigneeId: 'other-assignee',
          createdById: 'other-creator',
        }),
      ).toBe(true);
    });

    it('denies viewer to edit any task', () => {
      expect(
        service.canEditTask(viewer, {
          ownerId: 'other-owner',
          assigneeId: viewer.id,
          createdById: viewer.id,
        }),
      ).toBe(false);
    });
  });

  // --- canCancelTask ---

  describe('canCancelTask', () => {
    it('allows admin to cancel any task', () => {
      expect(service.canCancelTask(admin, { createdById: 'other-id' })).toBe(
        true,
      );
    });

    it('allows manager to cancel any task', () => {
      expect(service.canCancelTask(manager, { createdById: 'other-id' })).toBe(
        true,
      );
    });

    it('denies viewer to cancel tasks', () => {
      expect(service.canCancelTask(viewer, { createdById: viewer.id })).toBe(
        false,
      );
    });
  });

  // --- canDeleteDocument ---

  describe('canDeleteDocument', () => {
    it('allows manager to delete any document', () => {
      expect(
        service.canDeleteDocument(manager, { uploadedById: 'other-id' }),
      ).toBe(true);
    });

    it('allows admin to delete any document', () => {
      expect(
        service.canDeleteDocument(admin, { uploadedById: 'other-id' }),
      ).toBe(true);
    });

    it('denies viewer to delete documents', () => {
      expect(
        service.canDeleteDocument(viewer, { uploadedById: viewer.id }),
      ).toBe(false);
    });
  });

  // --- buildDiscussionListFilter ---

  describe('buildDiscussionListFilter', () => {
    it('scopes counsel discussion list to counselUserId', () => {
      expect(service.buildDiscussionListFilter(counsel)).toEqual({
        counselUserId: counsel.id,
      });
    });

    it('does not scope admin discussion list', () => {
      expect(service.buildDiscussionListFilter(admin)).toEqual({});
    });

    it('does not scope viewer discussion list', () => {
      expect(service.buildDiscussionListFilter(viewer)).toEqual({});
    });
  });

  // --- canEditDiscussion ---

  describe('canEditDiscussion', () => {
    it('allows manager to edit any discussion', () => {
      expect(
        service.canEditDiscussion(manager, { authorId: 'other-id' }),
      ).toBe(true);
    });

    it('allows admin to edit any discussion', () => {
      expect(
        service.canEditDiscussion(admin, { authorId: 'other-id' }),
      ).toBe(true);
    });

    it('allows counsel to edit own discussion', () => {
      expect(
        service.canEditDiscussion(counsel, { authorId: counsel.id }),
      ).toBe(true);
    });

    it('denies counsel to edit another authors discussion', () => {
      expect(
        service.canEditDiscussion(counsel, { authorId: 'other-id' }),
      ).toBe(false);
    });

    it('denies viewer to edit discussions', () => {
      expect(
        service.canEditDiscussion(viewer, { authorId: viewer.id }),
      ).toBe(false);
    });
  });

  // --- assertCanEditTask ---

  describe('assertCanEditTask', () => {
    it('throws ForbiddenException when counsel has no access', () => {
      expect(() =>
        service.assertCanEditTask(counsel, {
          ownerId: 'other-owner',
          assigneeId: 'other-assignee',
          createdById: 'other-creator',
        }),
      ).toThrow(ForbiddenException);
    });

    it('does not throw when counsel is the creator', () => {
      expect(() =>
        service.assertCanEditTask(counsel, {
          ownerId: 'other-owner',
          assigneeId: 'other-assignee',
          createdById: counsel.id,
        }),
      ).not.toThrow();
    });
  });

  // --- assertCanCancelTask ---

  describe('assertCanCancelTask', () => {
    it('throws ForbiddenException when counsel is not the creator', () => {
      expect(() =>
        service.assertCanCancelTask(counsel, { createdById: 'other-creator' }),
      ).toThrow(ForbiddenException);
    });

    it('does not throw when admin cancels a task', () => {
      expect(() =>
        service.assertCanCancelTask(admin, { createdById: 'other-creator' }),
      ).not.toThrow();
    });

    it('does not throw when counsel cancels own task', () => {
      expect(() =>
        service.assertCanCancelTask(counsel, { createdById: counsel.id }),
      ).not.toThrow();
    });
  });

  // --- assertCanDeleteDocument ---

  describe('assertCanDeleteDocument', () => {
    it('throws ForbiddenException when counsel tries to delete another users document', () => {
      expect(() =>
        service.assertCanDeleteDocument(counsel, { uploadedById: 'other-id' }),
      ).toThrow(ForbiddenException);
    });

    it('does not throw when counsel deletes own document', () => {
      expect(() =>
        service.assertCanDeleteDocument(counsel, { uploadedById: counsel.id }),
      ).not.toThrow();
    });

    it('does not throw when manager deletes any document', () => {
      expect(() =>
        service.assertCanDeleteDocument(manager, { uploadedById: 'other-id' }),
      ).not.toThrow();
    });

    it('throws ForbiddenException for viewer', () => {
      expect(() =>
        service.assertCanDeleteDocument(viewer, { uploadedById: viewer.id }),
      ).toThrow(ForbiddenException);
    });
  });
});
