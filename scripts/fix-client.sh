#!/bin/bash

echo "🔧 Fixing client component errors..."

# List of files that need 'use client' directive
CLIENT_FILES=(
    "src/components/providers/socket-provider.tsx"
    "src/hooks/use-socket.ts"
    "src/components/documents/generation-progress.tsx"
    "src/components/documents/generation-progress-mobile.tsx"
    "src/components/cache/cache-status.tsx"
)

# Add 'use client' to files that need it
for file in "${CLIENT_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check if 'use client' already exists
        if ! grep -q "^'use client'" "$file" && ! grep -q '^"use client"' "$file"; then
            # Add 'use client' at the top
            echo "'use client';" > temp_file
            echo "" >> temp_file
            cat "$file" >> temp_file
            mv temp_file "$file"
            echo "✅ Added 'use client' to $file"
        else
            echo "✓  $file already has 'use client'"
        fi
    else
        echo "⚠️  File not found: $file"
    fi
done

# Fix any provider components in the app directory
find src/app -name "*.tsx" -type f | while read file; do
    # Check if file uses createContext, useState, useEffect, etc.
    if grep -qE "(createContext|useState|useEffect|useContext)" "$file"; then
        if ! grep -q "^'use client'" "$file" && ! grep -q '^"use client"' "$file"; then
            # Skip layout.tsx and page.tsx in root app directory as they might be server components
            if [[ ! "$file" =~ "src/app/layout.tsx" ]] && [[ ! "$file" =~ "src/app/page.tsx" ]]; then
                echo "'use client';" > temp_file
                echo "" >> temp_file
                cat "$file" >> temp_file
                mv temp_file "$file"
                echo "✅ Added 'use client' to $file"
            fi
        fi
    fi
done

echo ""
echo "✅ Client component fixes applied!"
echo ""
echo "🚀 Try running 'npm run dev:all' again"