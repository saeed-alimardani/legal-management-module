import { DocumentType } from '@prisma/client';
import {
  countParentRefs,
  normalizeOptionalUuid,
  normalizeParentRef,
  resolveParentOwnerId,
  toDocumentResponse,
} from '../../../src/modules/documents/application/document.helpers';
import { DocumentWithParent } from '../../../src/modules/documents/domain/document.types';

describe('document.helpers', () => {
  const uploadedAt = new Date('2026-07-14T10:00:00.000Z');

  const baseDocument: DocumentWithParent = {
    id: 'doc-1',
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    fileSize: 2048,
    storageKey: 'uploads/uuid-1.pdf',
    documentType: DocumentType.CONTRACT,
    description: 'A contract',
    uploadedById: 'user-1',
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    deletedAt: null,
    uploadedAt,
    legalCase: { ownerId: 'user-1', deletedAt: null },
    contract: null,
    notice: null,
  };

  // ─── toDocumentResponse ───────────────────────────────────────────────────

  describe('toDocumentResponse', () => {
    it('maps all fields from DocumentEntity', () => {
      const response = toDocumentResponse(baseDocument);

      expect(response).toEqual({
        id: 'doc-1',
        fileName: 'contract.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storageKey: 'uploads/uuid-1.pdf',
        documentType: DocumentType.CONTRACT,
        description: 'A contract',
        uploadedById: 'user-1',
        caseId: 'case-1',
        contractId: null,
        noticeId: null,
        uploadedAt,
        uploadedAtPersian: '1405/04/23 13:30:00',
      });
    });

    it('omits deletedAt from the response', () => {
      const response = toDocumentResponse(baseDocument);

      expect(response).not.toHaveProperty('deletedAt');
    });

    it('omits parent relation objects (legalCase, contract, notice)', () => {
      const response = toDocumentResponse(baseDocument);

      expect(response).not.toHaveProperty('legalCase');
      expect(response).not.toHaveProperty('contract');
      expect(response).not.toHaveProperty('notice');
    });

    it('handles null description correctly', () => {
      const response = toDocumentResponse({
        ...baseDocument,
        description: null,
      });

      expect(response.description).toBeNull();
    });
  });

  // ─── resolveParentOwnerId ─────────────────────────────────────────────────

  describe('resolveParentOwnerId', () => {
    it('returns legalCase ownerId when legalCase is active', () => {
      const result = resolveParentOwnerId({
        legalCase: { ownerId: 'case-owner', deletedAt: null },
        contract: null,
        notice: null,
      });

      expect(result).toBe('case-owner');
    });

    it('returns contract ownerId when legalCase is null', () => {
      const result = resolveParentOwnerId({
        legalCase: null,
        contract: { ownerId: 'contract-owner', deletedAt: null },
        notice: null,
      });

      expect(result).toBe('contract-owner');
    });

    it('returns notice ownerId when legalCase and contract are null', () => {
      const result = resolveParentOwnerId({
        legalCase: null,
        contract: null,
        notice: { ownerId: 'notice-owner', deletedAt: null },
      });

      expect(result).toBe('notice-owner');
    });

    it('returns null when legalCase is soft-deleted', () => {
      const result = resolveParentOwnerId({
        legalCase: { ownerId: 'case-owner', deletedAt: new Date() },
        contract: null,
        notice: null,
      });

      expect(result).toBeNull();
    });

    it('returns null when contract is soft-deleted and legalCase is null', () => {
      const result = resolveParentOwnerId({
        legalCase: null,
        contract: { ownerId: 'contract-owner', deletedAt: new Date() },
        notice: null,
      });

      expect(result).toBeNull();
    });

    it('returns null when all parents are null', () => {
      const result = resolveParentOwnerId({
        legalCase: null,
        contract: null,
        notice: null,
      });

      expect(result).toBeNull();
    });

    it('skips soft-deleted legalCase and falls through to active contract', () => {
      const result = resolveParentOwnerId({
        legalCase: { ownerId: 'case-owner', deletedAt: new Date() },
        contract: { ownerId: 'contract-owner', deletedAt: null },
        notice: null,
      });

      expect(result).toBe('contract-owner');
    });

    it('skips soft-deleted contract and falls through to active notice', () => {
      const result = resolveParentOwnerId({
        legalCase: null,
        contract: { ownerId: 'contract-owner', deletedAt: new Date() },
        notice: { ownerId: 'notice-owner', deletedAt: null },
      });

      expect(result).toBe('notice-owner');
    });
  });

  // ─── countParentRefs ──────────────────────────────────────────────────────

  describe('countParentRefs', () => {
    it('returns 0 when no parent FK is set', () => {
      expect(countParentRefs({})).toBe(0);
    });

    it('returns 0 when all FKs are null', () => {
      expect(
        countParentRefs({ caseId: null, contractId: null, noticeId: null }),
      ).toBe(0);
    });

    it('returns 0 when all FKs are empty strings', () => {
      expect(
        countParentRefs({ caseId: '', contractId: '', noticeId: '' }),
      ).toBe(0);
    });

    it('returns 1 for caseId only', () => {
      expect(countParentRefs({ caseId: 'case-1' })).toBe(1);
    });

    it('returns 1 for contractId only', () => {
      expect(countParentRefs({ contractId: 'contract-1' })).toBe(1);
    });

    it('returns 1 for noticeId only', () => {
      expect(countParentRefs({ noticeId: 'notice-1' })).toBe(1);
    });

    it('returns 2 for caseId and contractId', () => {
      expect(
        countParentRefs({ caseId: 'case-1', contractId: 'contract-1' }),
      ).toBe(2);
    });

    it('returns 3 for all three FKs set', () => {
      expect(
        countParentRefs({
          caseId: 'case-1',
          contractId: 'contract-1',
          noticeId: 'notice-1',
        }),
      ).toBe(3);
    });
  });

  describe('normalizeOptionalUuid', () => {
    it('returns null for empty string', () => {
      expect(normalizeOptionalUuid('')).toBeNull();
    });

    it('returns null for null and undefined', () => {
      expect(normalizeOptionalUuid(null)).toBeNull();
      expect(normalizeOptionalUuid(undefined)).toBeNull();
    });

    it('returns the UUID when provided', () => {
      expect(normalizeOptionalUuid('case-1')).toBe('case-1');
    });
  });

  describe('normalizeParentRef', () => {
    it('converts empty sibling FKs to null', () => {
      expect(
        normalizeParentRef({
          caseId: 'case-1',
          contractId: '',
          noticeId: '',
        }),
      ).toEqual({
        caseId: 'case-1',
        contractId: null,
        noticeId: null,
      });
    });
  });
});
