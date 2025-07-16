#!/bin/bash
# DocuForge Project Setup Script
# This script initializes the entire project with a single command

set -e

echo "🚀 Setting up DocuForge..."

# Create project with T3 Stack
echo "📦 Creating Next.js project with T3 Stack..."
npm create t3-app@latest docuforge -- \
  --noGit false \
  --noInstall false \
  --typescript \
  --tailwind \
  --trpc \
  --nextAuth \
  --prisma \
  --appRouter \
  --CI

cd docuforge

# Install additional dependencies
echo "📚 Installing additional dependencies..."
npm install --save \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-label \
  @radix-ui/react-select \
  @radix-ui/react-slot \
  @radix-ui/react-toast \
  @hookform/resolvers \
  react-hook-form \
  lucide-react \
  class-variance-authority \
  clsx \
  tailwind-merge \
  sonner \
  @react-pdf/renderer \
  docx \
  markdown-pdf \
  gray-matter \
  remark \
  bullmq \
  ioredis \
  openai \
  @anthropic-ai/sdk \
  date-fns \
  recharts

# Install dev dependencies
npm install --save-dev \
  @faker-js/faker \
  @types/node \
  tsx \
  dotenv-cli \
  npm-run-all

# Setup shadcn/ui
echo "🎨 Setting up shadcn/ui..."
npx shadcn-ui@latest init -y

# Add commonly used shadcn components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add alert

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p src/server/queue/workers
mkdir -p src/lib/{ai,export,utils}
mkdir -p src/components/{documents,forms}
mkdir -p src/config
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
      POSTGRES_DB: docuforge
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
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docuforge"

# Next Auth
NEXTAUTH_SECRET="your-secret-here-generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Next Auth Provider
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Redis
REDIS_URL="redis://localhost:6379"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# Anthropic (optional)
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Email (using Resend)
RESEND_API_KEY="your-resend-api-key"
FROM_EMAIL="noreply@yourdomain.com"

# Feature Flags
ENABLE_BIOGRAPHY="true"
ENABLE_CASE_SUMMARY="false"
ENABLE_BUSINESS_PLAN="false"
ENABLE_MEDICAL_REPORT="false"
ENABLE_GRANT_PROPOSAL="false"
EOF

# Update package.json scripts
echo "📝 Updating package.json scripts..."
npm pkg set scripts.setup="docker-compose up -d && npm run db:push && npm run db:seed"
npm pkg set scripts.dev:db="docker-compose up -d"
npm pkg set scripts.dev:all="npm-run-all --parallel dev dev:queue"
npm pkg set scripts.dev:queue="tsx watch src/server/queue/processor.ts"
npm pkg set scripts.generate="tsx scripts/generate/index.ts"
npm pkg set scripts.db:seed="tsx scripts/seed.ts"
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

# Create .gitignore additions
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

# Initialize git if not already initialized
if [ ! -d .git ]; then
  git init
  git add .
  git commit -m "Initial commit: DocuForge project setup"
fi

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Run database migrations
echo "🗄️ Setting up database..."
npm run db:push

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