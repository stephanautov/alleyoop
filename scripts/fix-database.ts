#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting DocuForge database fixes...\n');

  try {
    // Update Prisma Schema
    console.log('📝 Updating Prisma schema...');
    await updatePrismaSchema();

    // Generate Prisma Client
    console.log('\n🏗️  Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Push schema changes
    console.log('\n🚀 Pushing schema changes to database...');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });

    // Run custom migrations
    console.log('\n🔄 Running custom SQL migrations...');
    await runCustomMigrations();

    console.log('\n✅ Database fixes completed successfully!');

  } catch (error) {
    console.error('❌ Error during database fixes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function updatePrismaSchema() {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  let content = await fs.readFile(schemaPath, 'utf-8');

  // Add role to User model
  if (!content.includes('role          String     @default("USER")')) {
    content = content.replace(
      /updatedAt     DateTime   @updatedAt/,
      'updatedAt     DateTime   @updatedAt\n  role          String     @default("USER")'
    );
  }

  // Add missing models
  const modelsToAdd = [
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
}`
  ];

  for (const model of modelsToAdd) {
    const modelName = model.match(/model (\w+)/)?.[1];
    if (modelName && !content.includes(`model ${modelName}`)) {
      content += '\n' + model;
    }
  }

  // Update User relations
  if (!content.includes('generatorMetrics  GeneratorMetrics[]')) {
    content = content.replace(
      /generatorTemplates GeneratorTemplate\[\]/,
      'generatorTemplates GeneratorTemplate[]\n  generatorMetrics  GeneratorMetrics[]\n  generatorErrors   GeneratorError[]'
    );
  }

  await fs.writeFile(schemaPath, content);
  console.log('✓ Prisma schema updated');
}

async function runCustomMigrations() {
  const migrations = [
    `UPDATE "User" SET "role" = 'USER' WHERE "role" IS NULL;`,
  ];

  for (const migration of migrations) {
    try {
      await prisma.$executeRawUnsafe(migration);
      console.log(`✓ Migration executed`);
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.warn(`⚠️  Migration warning: ${error.message}`);
      }
    }
  }
}

main().catch(console.error);
