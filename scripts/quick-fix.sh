#!/bin/bash
# scripts/quick-fix.sh
# Run with: chmod +x scripts/quick-fix.sh && ./scripts/quick-fix.sh

echo "🚀 DocuForge Quick Fix Script"
echo "============================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🗄️  Creating database fix script..."
cat > scripts/fix-database.ts << 'EOF'
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
EOF

echo ""
echo "🔧 Running database fixes..."
npx tsx scripts/fix-database.ts

echo ""
echo "📁 Creating LLM service directories..."
mkdir -p src/server/services/llm/providers
mkdir -p src/server/services/llm/prompts
mkdir -p src/server/services/llm/chains
mkdir -p src/server/services/llm/utils
mkdir -p src/config/schemas

echo ""
echo "📝 Creating document schema files..."
# Create base schema
cat > src/config/schemas/base.ts << 'EOF'
import { z } from "zod";

export const baseDocumentSchema = z.object({
    title: z.string().min(1).max(200).default(''),
    outputLength: z.enum(["short", "medium", "long"]).default("medium"),
    language: z.enum(["en", "es", "fr", "de"]).default("en"),
});
EOF

# Create schema index
cat > src/config/schemas/index.ts << 'EOF'
export * from './base';
// Export document-specific schemas as they're created
EOF

echo ""
echo "🔍 Checking environment variables..."
if [ ! -f ".env.local" ] && [ -f ".env" ]; then
    echo "Creating .env.local from .env..."
    cp .env .env.local
fi

# Add NEXT_PUBLIC prefix to feature flags
if [ -f ".env.local" ]; then
    sed -i.bak 's/ENABLE_/NEXT_PUBLIC_ENABLE_/g' .env.local
    echo "✓ Updated feature flags with NEXT_PUBLIC_ prefix"
fi

echo ""
echo "🎉 Quick fixes completed!"
echo ""
echo "📋 Next steps:"
echo "1. Add your OpenAI API key to .env.local:"
echo "   OPENAI_API_KEY=sk-..."
echo ""
echo "2. Start the development server:"
echo "   npm run dev:all"
echo ""
echo "3. Access the application at:"
echo "   http://localhost:3000"
echo ""
echo "4. If you're still seeing TypeScript errors, restart VS Code"
echo ""
echo "Happy coding! 🚀"