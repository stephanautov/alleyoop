#!/bin/bash
# simple-prisma-fix.sh
# A simpler script that doesn't reinstall packages

echo "🔧 Fixing Prisma type issues (simple version)..."

# Step 1: Clean only Prisma generated files
echo "📦 Cleaning Prisma generated files..."
rm -rf node_modules/.prisma

# Step 2: Generate Prisma client
echo "🏗️ Generating Prisma client..."
npx prisma generate

# Step 3: Clear TypeScript cache
echo "🧹 Clearing TypeScript cache..."
rm -rf node_modules/.cache
rm -rf .next

echo "✅ Done! Now:"
echo "1. Restart VS Code completely (close and reopen)"
echo "2. Or restart TypeScript server (Ctrl+Shift+P -> 'TypeScript: Restart TS Server')"
echo ""
echo "If errors still persist, check that your tsconfig.json includes:"
echo '  "compilerOptions": {'
echo '    "skipLibCheck": true'
echo '  }'