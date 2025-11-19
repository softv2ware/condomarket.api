import { ApiProperty } from '@nestjs/swagger';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items' })
  data: T[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta: PaginationMeta;

  constructor(data: T[], meta: PaginationMeta) {
    this.data = data;
    this.meta = meta;
  }
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponseDto<T> {
  const totalPages = Math.ceil(total / limit);

  return new PaginatedResponseDto(data, {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  });
}

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export function getPaginationParams(
  page: number = 1,
  limit: number = 10,
): PaginationParams {
  const skip = (page - 1) * limit;
  return {
    skip,
    take: limit,
    page,
    limit,
  };
}
