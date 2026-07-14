import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { CreateDiscussionUseCase } from '../../../src/modules/discussions/application/create-discussion.use-case';
import { DeleteDiscussionUseCase } from '../../../src/modules/discussions/application/delete-discussion.use-case';
import { GetDiscussionUseCase } from '../../../src/modules/discussions/application/get-discussion.use-case';
import { ListDiscussionsUseCase } from '../../../src/modules/discussions/application/list-discussions.use-case';
import { UpdateDiscussionUseCase } from '../../../src/modules/discussions/application/update-discussion.use-case';
import { DiscussionWithParent } from '../../../src/modules/discussions/domain/discussion.types';
import { PrismaDiscussionRepository } from '../../../src/modules/discussions/infrastructure/prisma-discussion.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';
import { createMockConfigService } from '../../helpers/config.helper';

describe('CreateDiscussionUseCase', () => {
  let useCase: CreateDiscussionUseCase;
  let discussionRepository: jest.Mocked<
    Pick<PrismaDiscussionRepository, 'findParentOwner' | 'create'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const buildDiscussion = (): DiscussionWithParent => ({
    id: 'disc-1',
    content: 'Test discussion',
    authorId: counsel.id,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  });

  beforeEach(() => {
    discussionRepository = {
      findParentOwner: jest.fn().mockResolvedValue({ ownerId: counsel.id }),
      create: jest.fn().mockResolvedValue(buildDiscussion()),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateDiscussionUseCase(
      discussionRepository as unknown as PrismaDiscussionRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('creates discussion on owned case and logs activity', async () => {
    const result = await useCase.execute(counsel, {
      content: 'Test discussion',
      caseId: 'case-1',
    });

    expect(result.data.content).toBe('Test discussion');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATED,
        entityType: EntityType.DISCUSSION,
        entityId: 'disc-1',
        actorId: counsel.id,
      }),
    );
  });

  it('throws 400 when no parent FK is provided', async () => {
    await expect(
      useCase.execute(counsel, { content: 'Test' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 404 when parent matter not found', async () => {
    discussionRepository.findParentOwner.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, { content: 'Test', caseId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 403 when counsel creates on another counsels case', async () => {
    discussionRepository.findParentOwner.mockResolvedValue({
      ownerId: otherCounsel.id,
    });

    await expect(
      useCase.execute(counsel, { content: 'Test', caseId: 'case-2' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when viewer tries to create', async () => {
    await expect(
      useCase.execute(viewer, { content: 'Test', caseId: 'case-1' }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('GetDiscussionUseCase', () => {
  let useCase: GetDiscussionUseCase;
  let discussionRepository: jest.Mocked<
    Pick<PrismaDiscussionRepository, 'findById'>
  >;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const discussion: DiscussionWithParent = {
    id: 'disc-1',
    content: 'Test discussion',
    authorId: counsel.id,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  beforeEach(() => {
    discussionRepository = {
      findById: jest.fn().mockResolvedValue(discussion),
    };

    useCase = new GetDiscussionUseCase(
      discussionRepository as unknown as PrismaDiscussionRepository,
      new AccessControlService(),
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('returns discussion for authorized user', async () => {
    const result = await useCase.execute(counsel, discussion.id);

    expect(result.data.id).toBe(discussion.id);
    expect(result.data.createdAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('denies unauthorized counsel', async () => {
    await expect(
      useCase.execute(otherCounsel, discussion.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when discussion not found', async () => {
    discussionRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ListDiscussionsUseCase', () => {
  let useCase: ListDiscussionsUseCase;
  let discussionRepository: jest.Mocked<
    Pick<PrismaDiscussionRepository, 'list'>
  >;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const discussions: DiscussionWithParent[] = [
    {
      id: 'disc-1',
      content: 'Test discussion',
      authorId: counsel.id,
      caseId: 'case-1',
      contractId: null,
      noticeId: null,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
      legalCase: { ownerId: counsel.id, deletedAt: null },
      contract: null,
      notice: null,
    },
  ];

  beforeEach(() => {
    discussionRepository = {
      list: jest.fn().mockResolvedValue({ items: discussions, total: 1 }),
    };

    useCase = new ListDiscussionsUseCase(
      discussionRepository as unknown as PrismaDiscussionRepository,
      new AccessControlService(),
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('returns paginated discussions with counsel scope', async () => {
    const result = await useCase.execute(counsel, {
      caseId: 'case-1',
      page: 1,
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(discussionRepository.list).toHaveBeenCalledWith(
      {
        caseId: 'case-1',
        contractId: undefined,
        noticeId: undefined,
        page: 1,
        limit: 20,
      },
      { counselUserId: counsel.id },
    );
  });
});

describe('UpdateDiscussionUseCase', () => {
  let useCase: UpdateDiscussionUseCase;
  let discussionRepository: jest.Mocked<
    Pick<PrismaDiscussionRepository, 'findById' | 'update'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const discussion: DiscussionWithParent = {
    id: 'disc-1',
    content: 'Original content',
    authorId: counsel.id,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  beforeEach(() => {
    discussionRepository = {
      findById: jest.fn().mockResolvedValue(discussion),
      update: jest.fn().mockResolvedValue({
        ...discussion,
        content: 'Updated content',
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateDiscussionUseCase(
      discussionRepository as unknown as PrismaDiscussionRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('updates discussion and logs activity for author', async () => {
    const result = await useCase.execute(counsel, discussion.id, {
      content: 'Updated content',
    });

    expect(result.data.content).toBe('Updated content');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATED,
        entityType: EntityType.DISCUSSION,
        entityId: discussion.id,
        metadata: { fields: ['content'] },
      }),
    );
  });

  it('denies non-author counsel', async () => {
    await expect(
      useCase.execute(otherCounsel, discussion.id, {
        content: 'Updated content',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when discussion not found', async () => {
    discussionRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing', { content: 'Updated' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeleteDiscussionUseCase', () => {
  let useCase: DeleteDiscussionUseCase;
  let discussionRepository: jest.Mocked<
    Pick<PrismaDiscussionRepository, 'findById' | 'softDelete'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const discussion: DiscussionWithParent = {
    id: 'disc-1',
    content: 'Test discussion',
    authorId: counsel.id,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  beforeEach(() => {
    discussionRepository = {
      findById: jest.fn().mockResolvedValue(discussion),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteDiscussionUseCase(
      discussionRepository as unknown as PrismaDiscussionRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('soft-deletes discussion and logs activity for author', async () => {
    const result = await useCase.execute(counsel, discussion.id);

    expect(result.data).toEqual({ success: true });
    expect(discussionRepository.softDelete).toHaveBeenCalledWith(discussion.id);
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETED,
        entityType: EntityType.DISCUSSION,
        entityId: discussion.id,
      }),
    );
  });

  it('denies non-author counsel', async () => {
    await expect(
      useCase.execute(otherCounsel, discussion.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when discussion not found', async () => {
    discussionRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
