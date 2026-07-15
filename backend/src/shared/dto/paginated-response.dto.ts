export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export function buildPaginatedResponse<T>(
  items: T[],
  meta: PaginationMeta,
): { data: T[]; meta: PaginationMeta } {
  return { data: items, meta };
}

export function buildSingleResponse<T>(data: T): { data: T } {
  return { data };
}
