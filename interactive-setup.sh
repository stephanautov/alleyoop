#!/bin/bash
# DocuForge/Alleyoop Project Setup Script
# Works with latest create-t3-app interactive mode

set -e

echo "🚀 Setting up Alleyoop project..."
echo ""
echo "⚠️  IMPORTANT: This will create a T3 app in the current directory"
echo "You'll need to answer some questions interactively."
echo ""
echo "Press Enter to continue..."
read

# Create T3 app in interactive mode
echo "📦 Creating Next.js project with T3 Stack..."
echo ""
echo "Please answer the following prompts:"
echo "- TypeScript: Yes"
echo "- ESLint: Yes" 
echo "- Tailwind CSS: Yes"
echo "- src/ directory: Yes"
echo "- App Router: Yes"
echo "- Import alias: No (use default)"
echo "- Database ORM: Prisma"
echo "- Next-Auth: Yes"
echo "- tRPC: Yes"
echo "- Git repository: No"
echo "- Install dependencies: Yes"
echo ""

npx create-t3-app@latest .

# Check if the T3 app was created successfully
if [ ! -f "package.json" ]; then
    echo "❌ T3 app creation failed. Please try running 'npx create-t3-app@latest .' manually"
    exit 1
fi

echo ""
echo "✅ T3 app created successfully!"
echo ""
echo "📚 Installing additional dependencies..."

# Install additional dependencies
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
  next-themes

# Install dev dependencies
npm install --save-dev \
  @faker-js/faker \
  @types/node \
  tsx \
  dotenv-cli \
  @types/archiver

# Setup shadcn/ui
echo ""
echo "🎨 Setting up shadcn/ui..."
echo "Please use these answers for shadcn/ui setup:"
echo "- TypeScript: Yes"
echo "- Style: Default"
echo "- Base color: Slate"
echo "- CSS variables: Yes"
echo ""

npx shadcn-ui@latest init

# Add shadcn components
echo "📦 Adding shadcn/ui components..."
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
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add alert-dialog

# Create directory structure
echo ""
echo "📁 Creating directory structure..."
mkdir -p src/server/queue/workers
mkdir -p src/lib/ai
mkdir -p src/lib/export  
mkdir -p src/lib/utils
mkdir -p src/components/documents
mkdir -p src/components/forms
mkdir -p src/config
mkdir -p src/app/auth/signin
mkdir -p src/app/dashboard
mkdir -p src/app/documents/new
mkdir -p "src/app/documents/[id]"
mkdir -p scripts/generate
mkdir -p scripts
mkdir -p public/templates

# Create Docker compose
echo ""
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

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo ""
    echo "🔐 Creating environment file..."
    
    # Generate NextAuth secret
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    cat > .env.local << EOF
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alleyoop"

# Next Auth
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="http://localhost:3000"

# Redis
REDIS_URL="redis://localhost:6379"

# OpenAI (add your key)
OPENAI_API_KEY=""

# Anthropic (optional)
ANTHROPIC_API_KEY=""

# Feature Flags
ENABLE_BIOGRAPHY="true"
ENABLE_CASE_SUMMARY="true"
ENABLE_BUSINESS_PLAN="true"
ENABLE_MEDICAL_REPORT="true"
ENABLE_GRANT_PROPOSAL="true"
EOF
fi

# Update package.json scripts
echo ""
echo "📝 Updating package.json scripts..."
npm pkg set scripts.dev:db="docker-compose up -d"
npm pkg set scripts.db:push="prisma db push"
npm pkg set scripts.db:studio="prisma studio"
npm pkg set scripts.setup="docker-compose up -d && npm run db:push"

# Create VS Code settings
echo ""
echo "⚙️ Creating VS Code configuration..."
mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
EOF

# Start Docker containers
echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add your OpenAI API key to .env.local"
echo "2. Run 'npm run db:push' to create database tables"
echo "3. Copy the provided source files to their respective locations"
echo "4. Run 'npm run dev' to start the development server"
echo ""
echo "🛠️ Useful commands:"
echo "- npm run dev        # Start development server"
echo "- npm run db:studio  # Open Prisma Studio"
echo "- docker-compose ps  # Check Docker containers"
echo ""