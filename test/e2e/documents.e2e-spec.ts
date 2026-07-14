import { INestApplication } from '@nestjs/common';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  ContractType,
  DocumentType,
  EntityType,
  Priority,
} from '@prisma/client';
import request from 'supertest';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDocuments,
  cleanupTestNotices,
  disconnectTestPrisma,
  getTestPrisma,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Documents (e2e)', () => {
  let app: INestApplication;
  let counselToken: string;
  let counsel2Token: string;
  let managerToken: string;
  let viewerToken: string;

  async function refreshAuthContext(): Promise<void> {
    await seedTestUsers();
    counselToken = (await loginAs(app, 'counsel@legal.local')).token;
    counsel2Token = (await loginAs(app, 'counsel2@legal.local')).token;
    managerToken = (await loginAs(app, 'manager@legal.local')).token;
    viewerToken = (await loginAs(app, 'viewer@legal.local')).token;
  }

  beforeAll(async () => {
    await seedTestUsers();
    app = await createTestApp();
    await refreshAuthContext();
  });

  beforeEach(async () => {
    await cleanupTestDocuments();
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestDocuments();
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await app.close();
    await disconnectTestPrisma();
  });

  async function createCaseViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/cases')
      .set(authHeader(token))
      .send({
        title: 'Document Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  async function createContractViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contracts')
      .set(authHeader(token))
      .send({
        title: 'Document Parent Contract',
        type: ContractType.MSA,
        counterpartyName: 'Acme Corp',
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  async function createNoticeViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notices')
      .set(authHeader(token))
      .send({
        title: 'Document Parent Notice',
        sender: 'Vendor X',
        receivedDate: '2026-07-01',
        responseDeadline: '2026-07-15',
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  const PDF_BYTES = Buffer.from('%PDF-1.4 e2e-doc');

  async function uploadDocViaApi(
    token: string,
    parentField: 'caseId' | 'contractId' | 'noticeId',
    parentId: string,
    overrides: {
      documentType?: DocumentType;
      contentType?: string;
      filename?: string;
      fileContent?: Buffer;
    } = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set(authHeader(token))
      .field('documentType', overrides.documentType ?? DocumentType.EVIDENCE)
      .field(parentField, parentId)
      .attach('file', overrides.fileContent ?? PDF_BYTES, {
        filename: overrides.filename ?? 'doc.pdf',
        contentType: overrides.contentType ?? 'application/pdf',
      })
      .expect(201);
    return res.body.data;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Auth and RBAC
  // ──────────────────────────────────────────────────────────────────────────
  describe('Auth and RBAC', () => {
    it('returns 401 for unauthenticated upload attempt', async () => {
      await request(app.getHttpServer()).post('/api/v1/documents').expect(401);
    });

    it('returns 403 when viewer tries to upload a document', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(viewerToken))
        .field('documentType', DocumentType.EVIDENCE)
        .field('caseId', legalCase.id)
        .attach('file', PDF_BYTES, {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        })
        .expect(403);
    });

    it('allows counsel to upload a document (201)', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'caseId', legalCase.id);
      expect(doc.fileName).toBe('doc.pdf');
      expect(doc.mimeType).toBe('application/pdf');
      expect(doc.caseId).toBe(legalCase.id);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Validation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Validation', () => {
    it('returns 400 when no file is attached', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(counselToken))
        .field('documentType', DocumentType.EVIDENCE)
        .field('caseId', legalCase.id)
        .expect(400);
    });

    it('returns 400 for unsupported MIME type (text/plain)', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(counselToken))
        .field('documentType', DocumentType.EVIDENCE)
        .field('caseId', legalCase.id)
        .attach('file', Buffer.from('plain text content'), {
          filename: 'bad.txt',
          contentType: 'text/plain',
        })
        .expect(400);
    });

    it('uploads when optional sibling parent fields are empty strings (Swagger UI)', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(counselToken))
        .field('documentType', DocumentType.EVIDENCE)
        .field('caseId', legalCase.id)
        .field('contractId', '')
        .field('noticeId', '')
        .attach('file', PDF_BYTES, {
          filename: 'swagger-upload.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body.data.caseId).toBe(legalCase.id);
      expect(res.body.data.contractId).toBeNull();
      expect(res.body.data.noticeId).toBeNull();
    });

    it('returns 400 when listing with no parent', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set(authHeader(counselToken))
        .expect(400);
    });

    it('returns 400 when listing with two parents', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const contract = await createContractViaApi(counselToken);
      await request(app.getHttpServer())
        .get('/api/v1/documents')
        .query({ caseId: legalCase.id, contractId: contract.id })
        .set(authHeader(counselToken))
        .expect(400);
    });

    it('returns 400 for invalid UUID in GET path', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/documents/not-a-uuid')
        .set(authHeader(counselToken))
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Document lifecycle
  // ──────────────────────────────────────────────────────────────────────────
  describe('Document lifecycle', () => {
    it('upload → list → get metadata → download bytes match → soft delete → GET 404 → download 404', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const fileContent = Buffer.from('%PDF-1.4 lifecycle-bytes');

      // Upload
      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(counselToken))
        .field('documentType', DocumentType.CONTRACT)
        .field('caseId', legalCase.id)
        .field('description', 'Lifecycle upload')
        .attach('file', fileContent, {
          filename: 'lifecycle.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const docId = uploadRes.body.data.id;
      expect(uploadRes.body.data.fileName).toBe('lifecycle.pdf');

      // List
      const listed = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .query({ caseId: legalCase.id })
        .set(authHeader(counselToken))
        .expect(200);
      expect(listed.body.data).toHaveLength(1);

      // Get metadata
      const metadata = await request(app.getHttpServer())
        .get(`/api/v1/documents/${docId}`)
        .set(authHeader(counselToken))
        .expect(200);
      expect(metadata.body.data.description).toBe('Lifecycle upload');

      // Download — bytes match
      const downloaded = await request(app.getHttpServer())
        .get(`/api/v1/documents/${docId}/download`)
        .set(authHeader(counselToken))
        .expect(200);
      expect(Buffer.from(downloaded.body).toString()).toContain('lifecycle-bytes');

      // Soft delete
      await request(app.getHttpServer())
        .delete(`/api/v1/documents/${docId}`)
        .set(authHeader(counselToken))
        .expect(200)
        .expect({ data: { success: true } });

      // GET after delete → 404
      await request(app.getHttpServer())
        .get(`/api/v1/documents/${docId}`)
        .set(authHeader(counselToken))
        .expect(404);

      // Download after delete → 404
      await request(app.getHttpServer())
        .get(`/api/v1/documents/${docId}/download`)
        .set(authHeader(counselToken))
        .expect(404);
    });

    it('generates DOCUMENT_UPLOADED and DELETED activity logs', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'caseId', legalCase.id);

      await request(app.getHttpServer())
        .delete(`/api/v1/documents/${doc.id}`)
        .set(authHeader(counselToken))
        .expect(200);

      const logs = await getTestPrisma().activityLog.findMany({
        where: { entityType: EntityType.DOCUMENT, entityId: doc.id },
      });

      expect(logs.some((l) => l.action === AuditAction.DOCUMENT_UPLOADED)).toBe(true);
      expect(logs.some((l) => l.action === AuditAction.DELETED)).toBe(true);
    });

    it('soft-deleted document is excluded from list', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'caseId', legalCase.id);

      await request(app.getHttpServer())
        .delete(`/api/v1/documents/${doc.id}`)
        .set(authHeader(counselToken))
        .expect(200);

      const listed = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .query({ caseId: legalCase.id })
        .set(authHeader(counselToken))
        .expect(200);

      expect(listed.body.data).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Parent types
  // ──────────────────────────────────────────────────────────────────────────
  describe('Parent types', () => {
    it('uploads a document on a contract', async () => {
      const contract = await createContractViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'contractId', contract.id);
      expect(doc.contractId).toBe(contract.id);
      expect(doc.caseId).toBeNull();
    });

    it('uploads a document on a notice', async () => {
      const notice = await createNoticeViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'noticeId', notice.id);
      expect(doc.noticeId).toBe(notice.id);
      expect(doc.caseId).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Permissions
  // ──────────────────────────────────────────────────────────────────────────
  describe('Permissions', () => {
    it('manager can upload on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(managerToken))
        .field('documentType', DocumentType.FILING)
        .field('caseId', legalCase.id)
        .attach('file', PDF_BYTES, { filename: 'mgr-upload.pdf', contentType: 'application/pdf' })
        .expect(201);
      expect(res.body.data.caseId).toBe(legalCase.id);
    });

    it('manager can delete a document uploaded by counsel', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'caseId', legalCase.id);

      await request(app.getHttpServer())
        .delete(`/api/v1/documents/${doc.id}`)
        .set(authHeader(managerToken))
        .expect(200)
        .expect({ data: { success: true } });
    });

    it('counsel (parent-owner) cannot delete a document uploaded by manager', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      // Manager uploads on counsel's case
      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(managerToken))
        .field('documentType', DocumentType.OTHER)
        .field('caseId', legalCase.id)
        .attach('file', PDF_BYTES, { filename: 'mgr.pdf', contentType: 'application/pdf' })
        .expect(201);

      // Counsel (parent-owner but not uploader) cannot delete
      await request(app.getHttpServer())
        .delete(`/api/v1/documents/${uploadRes.body.data.id}`)
        .set(authHeader(counselToken))
        .expect(403);
    });

    it('counsel2 cannot GET a document from counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'caseId', legalCase.id);

      await request(app.getHttpServer())
        .get(`/api/v1/documents/${doc.id}`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('counsel2 cannot download a document from counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'caseId', legalCase.id);

      await request(app.getHttpServer())
        .get(`/api/v1/documents/${doc.id}/download`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('viewer can GET document metadata', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const doc = await uploadDocViaApi(counselToken, 'caseId', legalCase.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${doc.id}`)
        .set(authHeader(viewerToken))
        .expect(200);
      expect(res.body.data.id).toBe(doc.id);
    });

    it('viewer can download a document', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const fileContent = Buffer.from('%PDF-1.4 viewer-download');

      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(counselToken))
        .field('documentType', DocumentType.EVIDENCE)
        .field('caseId', legalCase.id)
        .attach('file', fileContent, {
          filename: 'viewer.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const downloaded = await request(app.getHttpServer())
        .get(`/api/v1/documents/${uploadRes.body.data.id}/download`)
        .set(authHeader(viewerToken))
        .expect(200);

      expect(Buffer.from(downloaded.body).toString()).toContain('viewer-download');
    });
  });
});
