import { TaskStatus } from '@prisma/client';
import {
  countParentRefs,
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toTaskResponse,
} from '../../../src/modules/tasks/application/task.helpers';
import { TaskWithParent } from '../../../src/modules/tasks/domain/task.types';

describe('task.helpers', () => {
  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const buildTask = (
    overrides: Partial<TaskWithParent> = {},
  ): TaskWithParent => ({
    id: 'task-1',
    title: 'Review',
    description: null,
    status: TaskStatus.TODO,
    assigneeId: 'user-1',
    dueDate: null,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    createdById: 'user-1',
    completedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: 'user-1', deletedAt: null },
    contract: null,
    notice: null,
    ...overrides,
  });

  // -----------------------------------------------------------------------
  describe('toTaskResponse', () => {
    it('formats Persian date and datetime strings', () => {
      const response = toTaskResponse(buildTask(), 'Asia/Tehran');

      expect(response.createdAtPersian).toMatch(
        /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
      );
      expect(response.updatedAtPersian).toMatch(
        /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it('returns dueDatePersian as YYYY/MM/DD when dueDate is set', () => {
      const task = buildTask({ dueDate: new Date('2026-07-20T00:00:00.000Z') });
      const response = toTaskResponse(task, 'Asia/Tehran');

      expect(response.dueDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });

    it('returns null dueDatePersian when dueDate is null', () => {
      const response = toTaskResponse(
        buildTask({ dueDate: null }),
        'Asia/Tehran',
      );

      expect(response.dueDatePersian).toBeNull();
    });

    it('returns completedAtPersian when completedAt is set', () => {
      const task = buildTask({
        completedAt: new Date('2026-07-15T12:00:00.000Z'),
      });
      const response = toTaskResponse(task, 'Asia/Tehran');

      expect(response.completedAtPersian).toMatch(
        /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it('returns null completedAtPersian when completedAt is null', () => {
      const response = toTaskResponse(buildTask(), 'Asia/Tehran');

      expect(response.completedAtPersian).toBeNull();
    });

    it('includes all scalar fields in the response', () => {
      const task = buildTask();
      const response = toTaskResponse(task, 'Asia/Tehran');

      expect(response.id).toBe(task.id);
      expect(response.title).toBe(task.title);
      expect(response.status).toBe(task.status);
      expect(response.assigneeId).toBe(task.assigneeId);
      expect(response.caseId).toBe(task.caseId);
      expect(response.createdById).toBe(task.createdById);
    });

    it('uses default timezone when not provided', () => {
      const response = toTaskResponse(buildTask());

      expect(response.createdAtPersian).toMatch(
        /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });
  });

  // -----------------------------------------------------------------------
  describe('resolveParentOwnerId', () => {
    it('returns ownerId from legalCase when legalCase is active', () => {
      const task = buildTask({
        legalCase: { ownerId: 'owner-1', deletedAt: null },
        contract: null,
        notice: null,
      });

      expect(resolveParentOwnerId(task)).toBe('owner-1');
    });

    it('returns ownerId from contract when legalCase is null', () => {
      const task = buildTask({
        legalCase: null,
        contract: { ownerId: 'owner-2', deletedAt: null },
        notice: null,
      });

      expect(resolveParentOwnerId(task)).toBe('owner-2');
    });

    it('returns ownerId from notice when legalCase and contract are null', () => {
      const task = buildTask({
        legalCase: null,
        contract: null,
        notice: { ownerId: 'owner-3', deletedAt: null },
      });

      expect(resolveParentOwnerId(task)).toBe('owner-3');
    });

    it('returns null when legalCase is deleted', () => {
      const task = buildTask({
        legalCase: { ownerId: 'owner-1', deletedAt: new Date() },
        contract: null,
        notice: null,
      });

      expect(resolveParentOwnerId(task)).toBeNull();
    });

    it('returns null when contract is deleted and no other parent', () => {
      const task = buildTask({
        legalCase: null,
        contract: { ownerId: 'owner-2', deletedAt: new Date() },
        notice: null,
      });

      expect(resolveParentOwnerId(task)).toBeNull();
    });

    it('returns null when all parents are deleted', () => {
      const deletedAt = new Date();
      const task = buildTask({
        legalCase: { ownerId: 'o1', deletedAt },
        contract: { ownerId: 'o2', deletedAt },
        notice: { ownerId: 'o3', deletedAt },
      });

      expect(resolveParentOwnerId(task)).toBeNull();
    });

    it('returns null when no parent is attached', () => {
      const task = buildTask({
        legalCase: null,
        contract: null,
        notice: null,
      });

      expect(resolveParentOwnerId(task)).toBeNull();
    });

    it('skips deleted legalCase and returns contract ownerId', () => {
      const task = buildTask({
        legalCase: { ownerId: 'o1', deletedAt: new Date() },
        contract: { ownerId: 'o2', deletedAt: null },
        notice: null,
      });

      expect(resolveParentOwnerId(task)).toBe('o2');
    });
  });

  // -----------------------------------------------------------------------
  describe('countParentRefs', () => {
    it('returns 0 when no parent FKs are provided', () => {
      expect(countParentRefs({})).toBe(0);
    });

    it('returns 0 when all parent FKs are null', () => {
      expect(
        countParentRefs({ caseId: null, contractId: null, noticeId: null }),
      ).toBe(0);
    });

    it('returns 0 when all parent FKs are empty strings', () => {
      expect(
        countParentRefs({ caseId: '', contractId: '', noticeId: '' }),
      ).toBe(0);
    });

    it('returns 1 when only caseId is provided', () => {
      expect(countParentRefs({ caseId: 'case-1' })).toBe(1);
    });

    it('returns 1 when only contractId is provided', () => {
      expect(countParentRefs({ contractId: 'contract-1' })).toBe(1);
    });

    it('returns 1 when only noticeId is provided', () => {
      expect(countParentRefs({ noticeId: 'notice-1' })).toBe(1);
    });

    it('returns 2 when caseId and contractId are provided', () => {
      expect(
        countParentRefs({ caseId: 'case-1', contractId: 'contract-1' }),
      ).toBe(2);
    });

    it('returns 3 when all three parent FKs are provided', () => {
      expect(
        countParentRefs({
          caseId: 'case-1',
          contractId: 'contract-1',
          noticeId: 'notice-1',
        }),
      ).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  describe('resolveResponseTimeZone', () => {
    it('returns the provided timezone', () => {
      expect(resolveResponseTimeZone('UTC')).toBe('UTC');
    });

    it('returns Asia/Tehran when undefined is passed', () => {
      expect(resolveResponseTimeZone(undefined)).toBe('Asia/Tehran');
    });

    it('returns Asia/Tehran when empty string is passed', () => {
      expect(resolveResponseTimeZone('')).toBe('Asia/Tehran');
    });
  });
});
