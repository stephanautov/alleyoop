#!/usr/bin/env node
<<<<<<< HEAD
// scripts/fix-database.ts
// Run with: npx tsx scripts/fix-database.ts

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
=======
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e

const prisma = new PrismaClient();

async function main() {
<<<<<<< HEAD
  console.log('🔧 Starting DocuForge database fixes...\n');

  try {
    // Step 1: Update Prisma Schema
    console.log('📝 Updating Prisma schema...');
    await updatePrismaSchema();

    // Step 2: Generate Prisma Client
    console.log('\n🏗️  Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Step 3: Push schema changes to database
    console.log('\n🚀 Pushing schema changes to database...');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });

    // Step 4: Run SQL migrations for any custom changes
    console.log('\n🔄 Running custom SQL migrations...');
    await runCustomMigrations();

    // Step 5: Seed initial data if needed
    console.log('\n🌱 Checking for initial data...');
    await seedInitialData();

    console.log('\n✅ Database fixes completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Restart your development server');
    console.log('2. Run "npm run dev:all" to start all services');
    console.log('3. Check that all TypeScript errors are resolved');

  } catch (error) {
    console.error('❌ Error during database fixes:', error);
=======
  console.log("🔧 Starting DocuForge database fixes...\n");

  try {
    // Update Prisma Schema
    console.log("📝 Updating Prisma schema...");
    await updatePrismaSchema();

    // Generate Prisma Client
    console.log("\n🏗️  Generating Prisma client...");
    execSync("npx prisma generate", { stdio: "inherit" });

    // Push schema changes
    console.log("\n🚀 Pushing schema changes to database...");
    execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

    // Run custom migrations
    console.log("\n🔄 Running custom SQL migrations...");
    await runCustomMigrations();

    console.log("\n✅ Database fixes completed successfully!");
  } catch (error) {
    console.error("❌ Error during database fixes:", error);
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function updatePrismaSchema() {
<<<<<<< HEAD
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  let content = await fs.readFile(schemaPath, 'utf-8');

  // Add role field to User model if not exists
  if (!content.includes('role') || !content.match(/role\s+String\s+@default\("USER"\)/)) {
    content = content.replace(
      /model User \{([^}]+)\}/s,
      (match, modelContent) => {
        if (!modelContent.includes('role')) {
          const lines = modelContent.split('\n');
          const lastFieldIndex = lines.findIndex(line => line.includes('updatedAt'));
          lines.splice(lastFieldIndex + 1, 0, '  role          String     @default("USER") // USER, DEVELOPER, ADMIN');
          return `model User {${lines.join('\n')}}`;
        }
        return match;
      }
    );
  }

  // Add LLM-related fields to Document model
  if (!content.includes('provider') || !content.match(/provider\s+String\?/)) {
    content = content.replace(
      /model Document \{([^}]+)\}/s,
      (match, modelContent) => {
        const additions = `
  // LLM-specific fields
  provider        String?      // "openai" | "anthropic"
  model           String?      // "gpt-4" | "claude-3"
  temperature     Float        @default(0.7)
  maxTokens       Int?
  
  // Generation metadata
  llmCalls        LLMCall[]`;

        if (!modelContent.includes('provider')) {
          const lines = modelContent.split('\n');
          const relationIndex = lines.findIndex(line => line.includes('// Relations'));
          if (relationIndex > -1) {
            lines.splice(relationIndex, 0, additions);
          } else {
            lines.push(additions);
          }
          return `model Document {${lines.join('\n')}}`;
        }
        return match;
      }
    );
  }

  // Add new models if they don't exist
  const newModels = [
=======
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  let content = await fs.readFile(schemaPath, "utf-8");

  // Add role to User model
  if (!content.includes('role          String     @default("USER")')) {
    content = content.replace(
      /updatedAt     DateTime   @updatedAt/,
      'updatedAt     DateTime   @updatedAt\n  role          String     @default("USER")',
    );
  }

  // Add missing models
  const modelsToAdd = [
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e
    `
model GeneratorMetrics {
  id              String       @id @default(cuid())
  generator       String
  userId          String
  success         Boolean      @default(true)
  duration        Int
  filesGenerated  Int          @default(0)
  error           String?
  createdAt       DateTime     @default(now())
  
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([generator])
}`,
    `
model GeneratorError {
  id              String       @id @default(cuid())
  generator       String
  userId          String
  error           String       @db.Text
  stack           String?      @db.Text
  context         Json?
  createdAt       DateTime     @default(now())
  
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([generator])
}`,
<<<<<<< HEAD
    `
model LLMCall {
  id              String       @id @default(cuid())
  documentId      String
  document        Document     @relation(fields: [documentId], references: [id], onDelete: Cascade)
  
  provider        String
  model           String
  prompt          String       @db.Text
  response        String       @db.Text
  
  promptTokens    Int
  completionTokens Int
  totalTokens     Int
  cost            Float
  
  createdAt       DateTime     @default(now())
  duration        Int          // milliseconds
  
  @@index([documentId])
  @@index([createdAt])
}`,
    `
model KnowledgeSource {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  name            String
  type            SourceType   // DOCUMENT, WEBSITE, API
  url             String?
  content         String       @db.Text
  
  embeddings      Embedding[]
  lastSynced      DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  @@index([userId])
}`,
    `
model Embedding {
  id              String           @id @default(cuid())
  sourceId        String?
  source          KnowledgeSource? @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  documentId      String?
  document        Document?        @relation(fields: [documentId], references: [id], onDelete: Cascade)
  
  content         String           @db.Text
  embedding       Json             // Store as JSON for now, can migrate to pgvector later
  metadata        Json
  
  createdAt       DateTime         @default(now())
  
  @@index([sourceId])
  @@index([documentId])
}`
  ];

  // Add new enums if they don't exist
  if (!content.includes('enum SourceType')) {
    content = content + '\n\nenum SourceType {\n  DOCUMENT\n  WEBSITE\n  API\n}';
  }

  // Add models that don't exist
  for (const model of newModels) {
    const modelName = model.match(/model (\w+)/)?.[1];
    if (modelName && !content.includes(`model ${modelName}`)) {
      content = content + '\n' + model;
    }
  }

  // Update User model relations if needed
  content = content.replace(
    /model User \{([^}]+)\}/s,
    (match, modelContent) => {
      const newRelations = [
        'generatorMetrics  GeneratorMetrics[]',
        'generatorErrors   GeneratorError[]',
        'knowledgeSources  KnowledgeSource[]'
      ];

      let updatedContent = modelContent;
      for (const relation of newRelations) {
        const relationName = relation.split(/\s+/)[0];
        if (!modelContent.includes(relationName)) {
          const lines = updatedContent.split('\n');
          const lastRelationIndex = lines.findIndex(line => line.includes('@@index'));
          if (lastRelationIndex > -1) {
            lines.splice(lastRelationIndex, 0, '  ' + relation);
          } else {
            lines.push('  ' + relation);
          }
          updatedContent = lines.join('\n');
        }
      }

      return `model User {${updatedContent}}`;
    }
  );

  await fs.writeFile(schemaPath, content);
  console.log('✓ Prisma schema updated');
}

async function runCustomMigrations() {
  // These migrations handle any edge cases that Prisma might miss
  const migrations = [
    // Ensure role column has proper default
    `UPDATE "User" SET "role" = 'USER' WHERE "role" IS NULL;`,

    // Create indexes that might be missing
    `CREATE INDEX IF NOT EXISTS "Document_provider_idx" ON "Document"("provider");`,
    `CREATE INDEX IF NOT EXISTS "LLMCall_provider_idx" ON "LLMCall"("provider");`,
    `CREATE INDEX IF NOT EXISTS "GeneratorHistory_sessionId_idx" ON "GeneratorHistory"("sessionId");`,
=======
  ];

  for (const model of modelsToAdd) {
    const modelName = model.match(/model (\w+)/)?.[1];
    if (modelName && !content.includes(`model ${modelName}`)) {
      content += "\n" + model;
    }
  }

  // Update User relations
  if (!content.includes("generatorMetrics  GeneratorMetrics[]")) {
    content = content.replace(
      /generatorTemplates GeneratorTemplate\[\]/,
      "generatorTemplates GeneratorTemplate[]\n  generatorMetrics  GeneratorMetrics[]\n  generatorErrors   GeneratorError[]",
    );
  }

  await fs.writeFile(schemaPath, content);
  console.log("✓ Prisma schema updated");
}

async function runCustomMigrations() {
  const migrations = [
    `UPDATE "User" SET "role" = 'USER' WHERE "role" IS NULL;`,
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e
  ];

  for (const migration of migrations) {
    try {
      await prisma.$executeRawUnsafe(migration);
<<<<<<< HEAD
      console.log(`✓ Migration executed: ${migration.substring(0, 50)}...`);
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
=======
      console.log(`✓ Migration executed`);
    } catch (error: any) {
      if (!error.message.includes("already exists")) {
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e
        console.warn(`⚠️  Migration warning: ${error.message}`);
      }
    }
  }
}

<<<<<<< HEAD
async function seedInitialData() {
  // Check if we need to add any initial admin user or data
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    console.log('No users found. Run "npm run db:seed" after setting up authentication.');
  } else {
    // Update the first user to be an admin for testing
    const firstUser = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' }
    });

    if (firstUser && firstUser.role === 'USER') {
      await prisma.user.update({
        where: { id: firstUser.id },
        data: { role: 'DEVELOPER' } // Give developer access for generators
      });
      console.log(`✓ Updated ${firstUser.email} to DEVELOPER role`);
    }
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
=======
main().catch(console.error);
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e
