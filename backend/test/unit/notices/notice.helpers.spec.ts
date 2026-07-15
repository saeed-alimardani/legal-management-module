import { toNoticeResponse } from '../../../src/modules/notices/application/notice.helpers';
import { NoticeStatus } from '@prisma/client';

describe('toNoticeResponse', () => {
  const notice = {
    id: 'notice-1',
    referenceCode: 'NTC-2026-00001',
    title: 'Demand Letter',
    sender: 'Vendor X',
    receivedDate: new Date('2026-07-01T15:00:00.000Z'),
    responseDeadline: new Date('2026-07-15T22:00:00.000Z'),
    status: NoticeStatus.RECEIVED,
    ownerId: 'owner-1',
    description: null,
    relatedCaseId: null,
    relatedContractId: null,
    deletedAt: null,
    createdAt: new Date('2026-07-01T12:00:00.000Z'),
    updatedAt: new Date('2026-07-01T12:00:00.000Z'),
  };

  it('adds Persian date fields and normalizes date-only fields to UTC midnight', () => {
    const response = toNoticeResponse(notice, 'Asia/Tehran');

    expect(response.receivedDate).toEqual(new Date('2026-07-01T00:00:00.000Z'));
    expect(response.responseDeadline).toEqual(
      new Date('2026-07-15T00:00:00.000Z'),
    );
    expect(response.receivedDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(response.responseDeadlinePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(response.createdAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
    expect(response.updatedAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });
});
