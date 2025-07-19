#!/bin/bash
# fix-prisma-types.sh
# Run this script if you get TypeScript errors about missing fields on Prisma models

echo "🔧 Fixing Prisma type issues..."

# Step 1: Clean Prisma generated files
echo "📦 Cleaning Prisma generated files..."
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client

# Step 2: Clean npm cache
echo "🧹 Cleaning npm cache..."
npm cache clean --force

# Step 3: Reinstall Prisma packages
echo "📥 Reinstalling Prisma packages..."
npm uninstall @prisma/client prisma
npm install @prisma/client --legacy-peer-deps
npm install --save-dev prisma --legacy-peer-deps

# Step 4: Generate Prisma client
echo "🏗️ Generating Prisma client..."
npx prisma generate

# Step 5: Optional - Push schema to database
echo "❓ Do you want to push schema changes to database? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "🚀 Pushing schema to database..."
    npx prisma db push
fi

echo "✅ Done! Please restart your TypeScript server in VS Code:"
echo "   1. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac)"
echo "   2. Type 'TypeScript: Restart TS Server'"
echo "   3. Press Enter"
echo ""
echo "If errors persist, try closing and reopening VS Code."