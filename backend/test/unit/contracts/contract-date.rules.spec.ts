import { isValidContractDateRange } from '../../../src/modules/contracts/domain/contract-date.rules';

describe('isValidContractDateRange', () => {
  it('returns true when either date is missing', () => {
    expect(isValidContractDateRange(null, null)).toBe(true);
    expect(isValidContractDateRange(new Date('2026-01-01'), null)).toBe(true);
    expect(isValidContractDateRange(null, new Date('2026-01-01'))).toBe(true);
    expect(isValidContractDateRange(undefined, undefined)).toBe(true);
  });

  it('returns true when expiration is on or after effective', () => {
    expect(
      isValidContractDateRange(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(true);

    expect(
      isValidContractDateRange(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-12-31T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('returns false when expiration is before effective', () => {
    expect(
      isValidContractDateRange(
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
