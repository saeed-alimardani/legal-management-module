export const REFERENCE_CODE_PREFIX = {
  CASE: 'CASE',
  CONTRACT: 'CTR',
  NOTICE: 'NTC',
} as const;

export type ReferenceCodePrefix =
  (typeof REFERENCE_CODE_PREFIX)[keyof typeof REFERENCE_CODE_PREFIX];

export function formatReferenceCode(
  prefix: ReferenceCodePrefix,
  sequence: number,
  year = new Date().getFullYear(),
): string {
  const padded = String(sequence).padStart(5, '0');
  return `${prefix}-${year}-${padded}`;
}

export function parseReferenceCodeSequence(
  referenceCode: string,
  prefix: ReferenceCodePrefix,
  year: number,
): number | null {
  const pattern = new RegExp(`^${prefix}-${year}-(\\d{5})$`);
  const match = referenceCode.match(pattern);

  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

export function getNextReferenceSequence(
  latestCode: string | null | undefined,
  prefix: ReferenceCodePrefix,
  year = new Date().getFullYear(),
): number {
  if (!latestCode) {
    return 1;
  }

  const current = parseReferenceCodeSequence(latestCode, prefix, year);
  return current === null ? 1 : current + 1;
}
