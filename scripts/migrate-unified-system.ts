#!/usr/bin/env node
// scripts/migrate-unified-system.ts
// Run with: npx tsx scripts/migrate-unified-system.ts

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import chalk from 'chalk';

const prisma = new PrismaClient();

interface MigrationStep {
    name: string;
    check: () => Promise<boolean>;
    migrate: () => Promise<void>;
    verify: () => Promise<boolean>;
}

async function main() {
    console.log(chalk.blue('🚀 DocuForge Unified System Migration\n'));

    const steps: MigrationStep[] = [
        {
            name: 'User Preferences System',
            check: async () => {
                const result = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'UserPreferences'
          );
        `;
                return result[0]?.exists || false;
            },
            migrate: async () => {
                console.log(chalk.yellow('Creating UserPreferences table...'));

                // First, ensure the schema is up to date
                execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

                // Get users without preferences
                // Since the relation might not exist yet, we'll check differently
                const users = await prisma.user.findMany({
                    select: { id: true }
                });

                console.log(chalk.gray(`Checking preferences for ${users.length} users...`));

                for (const user of users) {
                    // Check if preferences already exist
                    const existingPrefs = await prisma.$queryRaw<any[]>`
            SELECT EXISTS (
              SELECT 1 FROM "UserPreferences" 
              WHERE "userId" = ${user.id}
            );
          `;

                    if (!existingPrefs[0]?.exists) {
                        // Create preferences using raw SQL to avoid relation issues
                        await prisma.$executeRaw`
              INSERT INTO "UserPreferences" (
                id, "userId", "defaultProvider", "providerModels", 
                temperature, "systemPromptStyle", "costAlertEmail", 
                "allowFallback", "cacheEnabled", "preferSpeed",
                "ragEnabled", "autoRAGThreshold", "preferredStorage",
                "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${user.id}, 'openai', '{}',
                0.7, 'professional', true,
                true, true, false,
                false, 0.7, 'local',
                NOW(), NOW()
              );
            `;
                    }
                }
            },
            verify: async () => {
                const userCount = await prisma.user.count();
                const prefsCount = await prisma.$queryRaw<any[]>`
          SELECT COUNT(*) as count FROM "UserPreferences";
        `;
                return Number(prefsCount[0]?.count) === userCount;
            }
        },
        {
            name: 'RAG System Tables',
            check: async () => {
                const result = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'KnowledgeSource'
          );
        `;
                return result[0]?.exists || false;
            },
            migrate: async () => {
                console.log(chalk.yellow('Creating RAG system tables...'));

                // Create KnowledgeSource table
                await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "KnowledgeSource" (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL DEFAULT 'DOCUMENT',
            "mimeType" TEXT,
            "originalName" TEXT,
            "fileSize" INTEGER,
            url TEXT,
            "storageKey" TEXT UNIQUE,
            content TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING',
            error TEXT,
            "processedAt" TIMESTAMP,
            metadata JSONB,
            tags TEXT[] DEFAULT '{}',
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;

                // Create indexes for KnowledgeSource
                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "KnowledgeSource_userId_idx" ON "KnowledgeSource"("userId");
        `;

                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "KnowledgeSource_status_idx" ON "KnowledgeSource"(status);
        `;

                // Create Embedding table
                await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Embedding" (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            "sourceId" TEXT NOT NULL REFERENCES "KnowledgeSource"(id) ON DELETE CASCADE,
            "chunkIndex" INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding JSONB NOT NULL,
            metadata JSONB,
            "tokenCount" INTEGER,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("sourceId", "chunkIndex")
          );
        `;

                // Create index for Embedding
                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "Embedding_sourceId_idx" ON "Embedding"("sourceId");
        `;

                // Create relationship table
                await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "_DocumentKnowledgeSources" (
            "A" TEXT NOT NULL REFERENCES "Document"(id) ON DELETE CASCADE,
            "B" TEXT NOT NULL REFERENCES "KnowledgeSource"(id) ON DELETE CASCADE,
            UNIQUE("A", "B")
          );
        `;

                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "_DocumentKnowledgeSources_B_idx" ON "_DocumentKnowledgeSources"("B");
        `;
            },
            verify: async () => {
                const tables = await prisma.$queryRaw<any[]>`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('KnowledgeSource', 'Embedding', '_DocumentKnowledgeSources');
        `;
                return tables.length === 3;
            }
        },
        {
            name: 'Cache System Tables',
            check: async () => {
                const result = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'CacheEntry'
          );
        `;
                return result[0]?.exists || false;
            },
            migrate: async () => {
                console.log(chalk.yellow('Creating cache system tables...'));

                // Create CacheEntry table
                await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "CacheEntry" (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            key TEXT UNIQUE NOT NULL,
            value JSONB NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            hits INTEGER DEFAULT 0,
            "userId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
            "documentType" TEXT,
            "expiresAt" TIMESTAMP NOT NULL,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB
          );
        `;

                // Create indexes separately
                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "CacheEntry_expiresAt_idx" ON "CacheEntry"("expiresAt");
        `;

                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "CacheEntry_provider_model_idx" ON "CacheEntry"(provider, model);
        `;

                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "CacheEntry_userId_idx" ON "CacheEntry"("userId");
        `;
            },
            verify: async () => {
                const exists = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'CacheEntry'
          );
        `;
                return exists[0]?.exists || false;
            }
        },
        {
            name: 'Storage Objects Table',
            check: async () => {
                const result = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'storage_objects'
          );
        `;
                return result[0]?.exists || false;
            },
            migrate: async () => {
                console.log(chalk.yellow('Creating storage_objects table for PostgreSQL storage...'));

                await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "storage_objects" (
            key TEXT PRIMARY KEY,
            data BYTEA NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;

                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "storage_objects_created_at_idx" ON "storage_objects"(created_at);
        `;
            },
            verify: async () => {
                const exists = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'storage_objects'
          );
        `;
                return exists[0]?.exists || false;
            }
        },
        {
            name: 'Document Schema Updates',
            check: async () => {
                const result = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'Document' 
            AND column_name = 'ragContext'
          );
        `;
                return result[0]?.exists || false;
            },
            migrate: async () => {
                console.log(chalk.yellow('Updating Document schema...'));

                // Add ragContext column if it doesn't exist
                const ragContextExists = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'Document' 
            AND column_name = 'ragContext'
          );
        `;

                if (!ragContextExists[0]?.exists) {
                    await prisma.$executeRaw`
            ALTER TABLE "Document" 
            ADD COLUMN IF NOT EXISTS "ragContext" JSONB;
          `;
                }
            },
            verify: async () => {
                const exists = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'Document' 
            AND column_name = 'ragContext'
          );
        `;
                return exists[0]?.exists || false;
            }
        },
        {
            name: 'Progress Tracking Updates',
            check: async () => {
                // Check if we have the necessary Redis setup
                return true; // Progress tracking is in Redis, not PostgreSQL
            },
            migrate: async () => {
                console.log(chalk.yellow('Adding progress tracking fields...'));
                // Progress tracking is handled via Redis, no database changes needed
            },
            verify: async () => {
                return true;
            }
        },
        {
            name: 'Indexes for Performance',
            check: async () => {
                const result = await prisma.$queryRaw<any[]>`
          SELECT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'LLMCall' 
            AND indexname = 'LLMCall_createdAt_provider_idx'
          );
        `;
                return result[0]?.exists || false;
            },
            migrate: async () => {
                console.log(chalk.yellow('Creating performance indexes...'));

                // Add indexes one by one
                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "LLMCall_createdAt_provider_idx" 
          ON "LLMCall"("createdAt", provider);
        `;

                await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "Document_status_userId_idx" 
          ON "Document"(status, "userId");
        `;
            },
            verify: async () => {
                const indexes = await prisma.$queryRaw<any[]>`
          SELECT COUNT(*) as count 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname IN ('LLMCall_createdAt_provider_idx', 'Document_status_userId_idx');
        `;
                return Number(indexes[0]?.count) >= 2;
            }
        },
    ];

    // Run migrations
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const step of steps) {
        console.log(chalk.blue(`📋 ${step.name}`));

        try {
            const exists = await step.check();

            if (exists) {
                console.log(chalk.gray('  ⏩ Already exists, skipping...'));
                skipCount++;
                continue;
            }

            await step.migrate();

            const verified = await step.verify();
            if (verified) {
                console.log(chalk.green('  ✅ Success!'));
                successCount++;
            } else {
                console.log(chalk.red('  ❌ Verification failed'));
                errorCount++;
            }
        } catch (error: any) {
            console.error(chalk.red(`  ❌ Error: ${error.message}`));
            errorCount++;
        }
    }

    console.log(chalk.blue('\n📊 Migration Summary:'));
    console.log(chalk.green(`  ✅ Successful: ${successCount}`));
    console.log(chalk.gray(`  ⏩ Skipped: ${skipCount}`));
    console.log(chalk.red(`  ❌ Errors: ${errorCount}`));

    if (errorCount > 0) {
        console.log(chalk.red('\n⚠️  Some migrations failed. Please check the errors above.'));
        process.exit(1);
    } else {
        console.log(chalk.green('\n🎉 All migrations completed successfully!'));

        // Final setup instructions
        console.log(chalk.yellow('\n📝 Next Steps:'));
        console.log('  1. Run: npm run db:generate');
        console.log('  2. Restart your development server');
        console.log('  3. Test the unified system');
    }
}

main()
    .catch((error) => {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });