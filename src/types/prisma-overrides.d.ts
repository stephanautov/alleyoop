// src/types/prisma-overrides.d.ts
// Temporary type overrides for Prisma models
// Remove this file once Prisma types are properly generated

import { Prisma } from '@prisma/client';

declare module '@prisma/client' {
    interface Document {
        provider?: string | null;
        model?: string | null;
        temperature?: number;
        maxTokens?: number | null;
    }
}