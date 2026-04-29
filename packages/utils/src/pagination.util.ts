/**
 * Shared pagination helper — standardizes offset computation.
 */

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export function computePagination(
  input: PaginationInput = {},
): PaginationResult {
  const page = input.page ?? DEFAULT_PAGE;
  const limit = input.limit ?? DEFAULT_LIMIT;
  return {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
  };
}
