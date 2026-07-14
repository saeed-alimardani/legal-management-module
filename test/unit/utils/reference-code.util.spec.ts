import {
  formatReferenceCode,
  getNextReferenceSequence,
  parseReferenceCodeSequence,
  REFERENCE_CODE_PREFIX,
} from '../../../src/shared/utils/reference-code.util';

describe('reference-code.util', () => {
  describe('formatReferenceCode', () => {
    it('formats sequence with zero padding', () => {
      expect(formatReferenceCode(REFERENCE_CODE_PREFIX.CASE, 1, 2026)).toBe(
        'CASE-2026-00001',
      );
      expect(formatReferenceCode(REFERENCE_CODE_PREFIX.CASE, 42, 2026)).toBe(
        'CASE-2026-00042',
      );
      expect(formatReferenceCode(REFERENCE_CODE_PREFIX.CONTRACT, 99999, 2026)).toBe(
        'CTR-2026-99999',
      );
    });

    it('uses current year by default', () => {
      const year = new Date().getFullYear();
      expect(formatReferenceCode(REFERENCE_CODE_PREFIX.NOTICE, 7)).toBe(
        `NTC-${year}-00007`,
      );
    });
  });

  describe('parseReferenceCodeSequence', () => {
    it('parses valid reference codes', () => {
      expect(
        parseReferenceCodeSequence('CASE-2026-00001', REFERENCE_CODE_PREFIX.CASE, 2026),
      ).toBe(1);
      expect(
        parseReferenceCodeSequence('CASE-2026-12345', REFERENCE_CODE_PREFIX.CASE, 2026),
      ).toBe(12345);
    });

    it('returns null for mismatched prefix or year', () => {
      expect(
        parseReferenceCodeSequence('CTR-2026-00001', REFERENCE_CODE_PREFIX.CASE, 2026),
      ).toBeNull();
      expect(
        parseReferenceCodeSequence('CASE-2025-00001', REFERENCE_CODE_PREFIX.CASE, 2026),
      ).toBeNull();
      expect(
        parseReferenceCodeSequence('invalid', REFERENCE_CODE_PREFIX.CASE, 2026),
      ).toBeNull();
    });
  });

  describe('getNextReferenceSequence', () => {
    it('starts at 1 when no prior code exists', () => {
      expect(
        getNextReferenceSequence(null, REFERENCE_CODE_PREFIX.CASE, 2026),
      ).toBe(1);
      expect(
        getNextReferenceSequence(undefined, REFERENCE_CODE_PREFIX.CASE, 2026),
      ).toBe(1);
    });

    it('increments from the latest valid code', () => {
      expect(
        getNextReferenceSequence(
          'CASE-2026-00003',
          REFERENCE_CODE_PREFIX.CASE,
          2026,
        ),
      ).toBe(4);
    });

    it('resets to 1 when latest code is from a different year', () => {
      expect(
        getNextReferenceSequence(
          'CASE-2025-00099',
          REFERENCE_CODE_PREFIX.CASE,
          2026,
        ),
      ).toBe(1);
    });
  });
});
