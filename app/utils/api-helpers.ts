/**
 * Common API helper functions and patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { ValidationError } from './errors';

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Parse pagination parameters from URL
 */
export function parsePaginationParams(request: NextRequest): PaginationParams {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Standard search parameters
 */
export interface SearchParams {
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Parse search parameters from URL
 */
export function parseSearchParams(request: NextRequest): SearchParams {
  const { searchParams } = new URL(request.url);
  
  return {
    search: searchParams.get('search') || undefined,
    category: searchParams.get('category') || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
  };
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(body: any, fields: string[]): void {
  for (const field of fields) {
    if (!body[field]) {
      throw new ValidationError(`${field} is required`);
    }
  }
}

/**
 * Build dynamic where clause for text search
 */
export function buildSearchWhereClause(
  searchTerm: string,
  searchFields: string[]
): { OR: any[] } {
  return {
    OR: searchFields.map(field => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive' as const
      }
    }))
  };
}

/**
 * Standard paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit)
    }
  };
}

/**
 * Check if resource exists
 */
export async function checkResourceExists(
  model: keyof typeof prisma,
  id: string,
  resourceName: string
): Promise<void> {
  const resource = await (prisma[model] as any).findUnique({
    where: { id }
  });
  
  if (!resource) {
    throw new ValidationError(`${resourceName} not found`);
  }
}

/**
 * Validate JSON request body
 */
export async function validateJsonBody(request: NextRequest): Promise<any> {
  try {
    return await request.json();
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }
}