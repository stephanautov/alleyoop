// src/server/services/cache/schema-adapter.ts
// This file adapts the cache service to work with your existing schema

import { DocumentType } from '@prisma/client';
import type { CacheEntry as PrismaCacheEntry } from '@prisma/client';

// Extend the Prisma CacheEntry type for internal use
export interface CacheEntryInternal extends PrismaCacheEntry {
  type: 'outline' | 'section' | 'embedding' | 'generic';
  inputHash: string;
  lastHit: Date | null;
  costSaved: number;
}

// Convert DocumentType enum to string for storage
export function documentTypeToString(type: DocumentType): string {
  return type;
}

// Convert string back to DocumentType enum
export function stringToDocumentType(type: string): DocumentType | null {
  if (Object.values(DocumentType).includes(type as DocumentType)) {
    return type as DocumentType;
  }
  return null;
}

// Update the cache service save method to use the existing schema
export async function saveCacheEntryAdapter(
  db: any,
  entry: {
    key: string;
    type: string;
    provider: string;
    model: string;
    value: any;
    inputHash: string;
    documentType?: DocumentType;
    userId?: string;
    documentId?: string;
    expiresAt: Date;
    metadata?: any;
  }
) {
  return db.cacheEntry.create({
    data: {
      key: entry.key,
      type: entry.type,
      value: entry.value,
      provider: entry.provider,
      model: entry.model,
      inputHash: entry.inputHash,
      hits: 0,
      lastHit: null,
      costSaved: 0,
      userId: entry.userId,
      documentType: entry.documentType ? documentTypeToString(entry.documentType) : null,
      documentId: entry.documentId,
      expiresAt: entry.expiresAt,
      metadata: entry.metadata,
    },
  });
}

// Update cache hit tracking
export async function trackCacheHitAdapter(
  db: any,
  key: string,
  costSaved: number
) {
  return db.cacheEntry.update({
    where: { key },
    data: {
      hits: { increment: 1 },
      lastHit: new Date(),
      costSaved: { increment: costSaved },
    },
  });
}

// Get cache stats with the existing schema
export async function getCacheStatsAdapter(db: any) {
  const stats = await db.cacheEntry.aggregate({
    _sum: {
      hits: true,
      costSaved: true,
    },
    _count: {
      _all: true,
    },
  });

  // Calculate hit rate
  const totalEntries = await db.cacheEntry.count();
  const entriesWithHits = await db.cacheEntry.count({
    where: {
      hits: { gt: 0 },
    },
  });

  const hitRate = totalEntries > 0 ? entriesWithHits / totalEntries : 0;

  return {
    totalHits: stats._sum.hits || 0,
    costSaved: stats._sum.costSaved || 0,
    hitRate,
    totalEntries,
  };
}