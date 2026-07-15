import { toPersianDateTimeString } from '../../../shared/utils/persian-date.util';
import {
  DiscussionEntity,
  DiscussionResponse,
} from '../domain/discussion.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function toDiscussionResponse(
  discussion: DiscussionEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): DiscussionResponse {
  const zone = resolveResponseTimeZone(timeZone);

  return {
    id: discussion.id,
    content: discussion.content,
    authorId: discussion.authorId,
    caseId: discussion.caseId,
    contractId: discussion.contractId,
    noticeId: discussion.noticeId,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
    createdAtPersian: toPersianDateTimeString(discussion.createdAt, zone),
    updatedAtPersian: toPersianDateTimeString(discussion.updatedAt, zone),
  };
}

export function resolveParentOwnerId(discussion: {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
  notice?: { ownerId: string; deletedAt: Date | null } | null;
}): string | null {
  if (discussion.legalCase && discussion.legalCase.deletedAt === null) {
    return discussion.legalCase.ownerId;
  }

  if (discussion.contract && discussion.contract.deletedAt === null) {
    return discussion.contract.ownerId;
  }

  if (discussion.notice && discussion.notice.deletedAt === null) {
    return discussion.notice.ownerId;
  }

  return null;
}

export function countParentRefs(parent: {
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}): number {
  return [parent.caseId, parent.contractId, parent.noticeId].filter(
    (id) => id != null && id !== '',
  ).length;
}
