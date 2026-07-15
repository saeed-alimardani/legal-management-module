import { usersApi } from './services';
import type { Contract, LegalCase, LegalNotice, User, UserDirectoryEntry } from './types';

export type ParentType = 'case' | 'contract' | 'notice';

export interface MatterMaps {
  cases: Map<string, Pick<LegalCase, 'referenceCode' | 'title'>>;
  contracts: Map<string, Pick<Contract, 'referenceCode' | 'title'>>;
  notices: Map<string, Pick<LegalNotice, 'referenceCode' | 'title'>>;
}

export function matterLabel(referenceCode: string, title: string): string {
  return `${referenceCode} — ${title}`;
}

export function buildUserNameMap(
  users: Array<Pick<User, 'id' | 'fullName'> | UserDirectoryEntry>,
): Map<string, string> {
  return new Map(users.map((u) => [u.id, u.fullName]));
}

export async function loadUserDirectory(): Promise<UserDirectoryEntry[]> {
  const res = await usersApi.directory();
  return res.data;
}

export function userName(
  map: Map<string, string>,
  userId?: string | null,
): string {
  if (!userId) return '—';
  return map.get(userId) ?? '—';
}

export function buildMatterMaps(
  cases: LegalCase[],
  contracts: Contract[],
  notices: LegalNotice[],
): MatterMaps {
  return {
    cases: new Map(
      cases.map((c) => [c.id, { referenceCode: c.referenceCode, title: c.title }]),
    ),
    contracts: new Map(
      contracts.map((c) => [c.id, { referenceCode: c.referenceCode, title: c.title }]),
    ),
    notices: new Map(
      notices.map((n) => [n.id, { referenceCode: n.referenceCode, title: n.title }]),
    ),
  };
}

export function parentMatterLabel(
  maps: MatterMaps,
  parent: {
    caseId?: string | null;
    contractId?: string | null;
    noticeId?: string | null;
  },
): string {
  if (parent.caseId) {
    const c = maps.cases.get(parent.caseId);
    return c ? `Case: ${matterLabel(c.referenceCode, c.title)}` : 'Case';
  }
  if (parent.contractId) {
    const c = maps.contracts.get(parent.contractId);
    return c ? `Contract: ${matterLabel(c.referenceCode, c.title)}` : 'Contract';
  }
  if (parent.noticeId) {
    const n = maps.notices.get(parent.noticeId);
    return n ? `Notice: ${matterLabel(n.referenceCode, n.title)}` : 'Notice';
  }
  return '—';
}
