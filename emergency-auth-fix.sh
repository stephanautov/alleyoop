#!/bin/bash
# emergency-auth-fix.sh
# Run with: bash emergency-auth-fix.sh

echo "🚨 Emergency NextAuth Fix for App Router"
echo "========================================"

# Step 1: Create providers.tsx
echo "1️⃣ Creating client providers component..."
mkdir -p src/app/_components

cat > src/app/_components/providers.tsx << 'EOF'
"use client";

import { SessionProvider } from "next-auth/react";
import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/components/theme-provider";
import { SocketProvider } from "~/components/providers/socket-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TRPCReactProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </TRPCReactProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
EOF

echo "✅ providers.tsx created"

# Step 2: Fix the database
echo ""
echo "2️⃣ Adding role column to database..."
npx prisma db push --skip-generate

echo ""
echo "3️⃣ Regenerating Prisma client..."
npx prisma generate

echo ""
echo "✅ Fix complete!"
echo ""
echo "📝 Next steps:"
echo "1. Manually update your layout.tsx to import and use Providers from '~/app/_components/providers'"
echo "2. Update auth files as shown in the artifacts"
echo "3. Restart your dev server"
echo ""
echo "Need the exact code? Check the artifacts in the chat!"