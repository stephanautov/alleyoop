#!/bin/bash
# DocuForge Project Setup Script - Fixed for current directory
# This script initializes the entire project in the current directory

set -e

echo "🚀 Setting up DocuForge in current directory..."

# Create T3 app in current directory with updated syntax
echo "📦 Creating Next.js project with T3 Stack..."

# First, let's check if package.json already exists
if [ -f "package.json" ]; then
    echo "⚠️  package.json already exists. Backing it up..."
    mv package.json package.json.backup
fi

# Use the correct create-t3-app syntax for the latest version
npx create-t3-app@latest . --noGit --typescript --tailwind --trpc --nextAuth --prisma --appRouter --noInstall

# Alternative approach if the above doesn't work
# npm init -y
# npx create-t3-app@latest . --defaults

echo "📚 Installing dependencies..."

# Install all dependencies at once
npm install \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-label \
  @radix-ui/react-select \
  @radix-ui/react-slot \
  @radix-ui/react-toast \
  @radix-ui/react-tabs \
  @radix-ui/react-popover \
  @radix-ui/react-separator \
  @radix-ui/react-switch \
  @radix-ui/react-alert-dialog \
  @hookform/resolvers \
  react-hook-form \
  lucide-react \
  class-variance-authority \
  clsx \
  tailwind-merge \
  sonner \
  @react-pdf/renderer \
  docx \
  gray-matter \
  remark \
  archiver \
  bullmq \
  ioredis \
  openai \
  @anthropic-ai/sdk \
  date-fns \
  recharts \
  @types/archiver \
  next-themes

# Install dev dependencies
npm install --save-dev \
  @faker-js/faker \
  @types/node \
  tsx \
  dotenv-cli

# Setup shadcn/ui
echo "🎨 Setting up shadcn/ui..."
npx shadcn-ui@latest init -y

# Add shadcn components
echo "📦 Adding shadcn/ui components..."
npx shadcn-ui@latest add button card dialog form input label select textarea toast dropdown-menu progress skeleton table tabs badge alert calendar popover separator switch alert-dialog --yes

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p src/server/queue/workers
mkdir -p src/lib/{ai,export,utils}
mkdir -p src/components/{documents,forms}
mkdir -p src/config
mkdir -p src/app/auth/{signin,signout,error,verify-request}
mkdir -p src/app/dashboard
mkdir -p src/app/documents/{new,\[id\]}
mkdir -p scripts/generate
mkdir -p tests/{unit,e2e}
mkdir -p public/templates

# Create Docker compose for local development
echo "🐳 Creating Docker configuration..."
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: alleyoop
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
EOF

# Create environment file template
echo "🔐 Creating environment file..."
cat > .env.local << 'EOF'
# When adding additional environment variables, the schema in "/src/env.js"
# should be updated accordingly.

# Prisma
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alleyoop"

# Next Auth
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"

# Next Auth Provider
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Redis
REDIS_URL="redis://localhost:6379"

# OpenAI
OPENAI_API_KEY=""

# Anthropic (optional)
ANTHROPIC_API_KEY=""

# Email (using Resend)
RESEND_API_KEY=""
FROM_EMAIL="noreply@localhost"

# Feature Flags
ENABLE_BIOGRAPHY="true"
ENABLE_CASE_SUMMARY="true"
ENABLE_BUSINESS_PLAN="true"
ENABLE_MEDICAL_REPORT="true"
ENABLE_GRANT_PROPOSAL="true"
EOF

# Generate a NextAuth secret
echo "🔑 Generating NextAuth secret..."
NEXTAUTH_SECRET=$(openssl rand -base64 32)
sed -i "s/NEXTAUTH_SECRET=\"\"/NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"/" .env.local

# Update package.json scripts
echo "📝 Updating package.json scripts..."
npm pkg set scripts.setup="docker-compose up -d && npm run db:push && npm run db:seed"
npm pkg set scripts.dev:db="docker-compose up -d"
npm pkg set scripts.dev:all="npm-run-all --parallel dev dev:queue"
npm pkg set scripts.dev:queue="tsx watch src/server/queue/processor.ts"
npm pkg set scripts.generate="tsx scripts/generate/index.ts"
npm pkg set scripts.db:seed="tsx scripts/seed.ts"
npm pkg set scripts.db:push="prisma db push"
npm pkg set scripts.db:studio="prisma studio"
npm pkg set scripts.test:unit="jest"
npm pkg set scripts.test:e2e="playwright test"
npm pkg set scripts.check="npm-run-all --parallel type-check lint"
npm pkg set scripts.type-check="tsc --noEmit"

# Create VS Code settings
echo "⚙️ Creating VS Code configuration..."
mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
EOF

# Update .gitignore
echo "📄 Updating .gitignore..."
cat >> .gitignore << 'EOF'

# DocuForge specific
/public/exports
/tmp
.env.local
.env.production

# IDE
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Run database migrations
echo "🗄️ Setting up database..."
npm run db:push || echo "⚠️  Database push failed - you may need to run 'npm run db:push' manually"

echo "✅ DocuForge setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your API keys"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000"
echo ""
echo "Useful commands:"
echo "- npm run dev:all    # Start all services"
echo "- npm run generate   # Generate new components"
echo "- npm run db:studio  # Open Prisma Studio"
echo "- npm run check      # Run type checking and linting"