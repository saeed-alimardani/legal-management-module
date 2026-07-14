import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import {
  toPersianDateString,
  toPersianDateTimeString,
} from '../../../shared/utils/persian-date.util';
import { DocumentEntity, DocumentResponse } from '../domain/document.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveDocumentResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function toDocumentResponse(
  document: DocumentEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): DocumentResponse {
  const zone = resolveDocumentResponseTimeZone(timeZone);

  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    storageKey: document.storageKey,
    documentType: document.documentType,
    description: document.description,
    uploadedById: document.uploadedById,
    caseId: document.caseId,
    contractId: document.contractId,
    noticeId: document.noticeId,
    uploadedAt: document.uploadedAt,
    uploadedAtPersian: toPersianDateTimeString(document.uploadedAt, zone),
  };
}

export function getDocumentResponseTimeZone(
  configService: ConfigService,
): string {
  return (
    configService.get<string>(CONFIG_KEYS.APP_TIMEZONE) ?? DEFAULT_TIMEZONE
  );
}

export function resolveParentOwnerId(document: {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
  notice?: { ownerId: string; deletedAt: Date | null } | null;
}): string | null {
  if (document.legalCase && document.legalCase.deletedAt === null) {
    return document.legalCase.ownerId;
  }

  if (document.contract && document.contract.deletedAt === null) {
    return document.contract.ownerId;
  }

  if (document.notice && document.notice.deletedAt === null) {
    return document.notice.ownerId;
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

export function normalizeOptionalUuid(
  value?: string | null,
): string | null | undefined {
  if (value == null || value === '') {
    return null;
  }

  return value;
}

export function normalizeParentRef(parent: {
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}): {
  caseId: string | null;
  contractId: string | null;
  noticeId: string | null;
} {
  return {
    caseId: normalizeOptionalUuid(parent.caseId) ?? null,
    contractId: normalizeOptionalUuid(parent.contractId) ?? null,
    noticeId: normalizeOptionalUuid(parent.noticeId) ?? null,
  };
}
