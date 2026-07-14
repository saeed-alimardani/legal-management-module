import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { CONFIG_KEYS } from '../../../config/constants';
import {
  toPersianDateString,
  toPersianDateTimeString,
} from '../../../shared/utils/persian-date.util';
import { ContractEntity, ContractResponse } from '../domain/contract.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveContractResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function getContractResponseTimeZone(configService: {
  get: (key: string) => string | undefined;
}): string {
  return resolveContractResponseTimeZone(
    configService.get(CONFIG_KEYS.APP_TIMEZONE),
  );
}

export function toContractResponse(
  contract: ContractEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): ContractResponse {
  const zone = resolveContractResponseTimeZone(timeZone);
  const effectiveDate = contract.effectiveDate
    ? toUtcDateOnly(contract.effectiveDate)
    : null;
  const expirationDate = contract.expirationDate
    ? toUtcDateOnly(contract.expirationDate)
    : null;
  const renewalDate = contract.renewalDate
    ? toUtcDateOnly(contract.renewalDate)
    : null;

  return {
    id: contract.id,
    referenceCode: contract.referenceCode,
    title: contract.title,
    type: contract.type,
    status: contract.status,
    ownerId: contract.ownerId,
    counterpartyName: contract.counterpartyName,
    effectiveDate,
    expirationDate,
    renewalDate,
    keyTerms: contract.keyTerms,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
    effectiveDatePersian: effectiveDate
      ? toPersianDateString(effectiveDate)
      : null,
    expirationDatePersian: expirationDate
      ? toPersianDateString(expirationDate)
      : null,
    renewalDatePersian: renewalDate ? toPersianDateString(renewalDate) : null,
    createdAtPersian: toPersianDateTimeString(contract.createdAt, zone),
    updatedAtPersian: toPersianDateTimeString(contract.updatedAt, zone),
  };
}
