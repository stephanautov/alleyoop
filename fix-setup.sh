#!/bin/bash
# Quick fix script for DocuForge/Alleyoop setup issues

echo "🔧 Fixing DocuForge setup issues..."

# 1. Add missing npm scripts
echo "📝 Adding missing npm scripts..."
npm pkg set scripts.db:seed="tsx scripts/seed.ts"
npm pkg set scripts.dev:queue="tsx watch src/server/queue/processor.ts"
npm pkg set scripts.dev:all="npm-run-all --parallel dev dev:queue"
npm pkg set scripts.generate="tsx scripts/generate/index.ts"

# 2. Install missing dependencies
echo "📦 Installing missing dependencies..."
npm install --save-dev npm-run-all @types/archiver
npm install @radix-ui/react-tabs @radix-ui/react-popover @radix-ui/react-separator @radix-ui/react-switch @radix-ui/react-alert-dialog next-themes

# 3. Create missing directories
echo "📁 Creating missing directories..."
mkdir -p src/server/api/generators
mkdir -p src/types
mkdir -p src/styles
mkdir -p scripts
mkdir -p public/exports
mkdir -p uploads/exports

# 4. Create type definitions file
echo "🔤 Creating type definitions..."
cat > src/types/global.d.ts << 'EOF'
declare global {
  interface Window {
    fs: {
      readFile: (path: string, options?: { encoding?: string }) => Promise<Uint8Array | string>;
    };
  }
}

export {};
EOF

# 5. Update environment variables
echo "🔐 Updating environment variables..."
# Add UPLOAD_DIR to .env
grep -q "UPLOAD_DIR" .env || echo 'UPLOAD_DIR="./uploads"' >> .env

# Add missing rate limit vars
grep -q "RATE_LIMIT_MAX" .env || echo 'RATE_LIMIT_MAX="10"' >> .env
grep -q "RATE_LIMIT_WINDOW" .env || echo 'RATE_LIMIT_WINDOW="60"' >> .env

# Copy NextAuth secret from .env to match NEXTAUTH_SECRET if needed
if grep -q "AUTH_SECRET" .env && ! grep -q "NEXTAUTH_SECRET" .env; then
  AUTH_SECRET=$(grep "AUTH_SECRET" .env | cut -d'"' -f2)
  echo "NEXTAUTH_SECRET=\"$AUTH_SECRET\"" >> .env
fi

# 6. Push schema and generate client
echo "🗄️ Updating database schema..."
npx prisma db push
npx prisma generate

echo "✅ Fixes applied!"
echo ""
echo "📋 Next steps:"
echo "1. Check if errors are reduced in VS Code"
echo "2. If auth errors persist, update imports from 'next-auth' to '@auth/nextjs'"
echo "3. Run 'npm run db:seed' to seed the database"
echo "4. Run 'npm run dev' to start the development server"