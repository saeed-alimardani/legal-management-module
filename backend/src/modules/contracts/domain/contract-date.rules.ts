/**
 * Business rule: expirationDate must be on or after effectiveDate when both are set.
 */
export function isValidContractDateRange(
  effectiveDate: Date | null | undefined,
  expirationDate: Date | null | undefined,
): boolean {
  if (!effectiveDate || !expirationDate) {
    return true;
  }

  return expirationDate.getTime() >= effectiveDate.getTime();
}
