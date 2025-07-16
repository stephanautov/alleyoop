//src/server/auth-compat.ts

/**
 * Compatibility wrapper for NextAuth v5
 * Provides functions expected by DocuForge code
 */

import { auth } from "~/server/auth";

/**
 * Get the current user's session
 * Compatible with both server components and API routes
 */
export const getServerAuthSession = async () => {
    return await auth();
};

// For legacy code that expects the old getServerSession name
export const getServerSession = getServerAuthSession;

// Re-export auth functions for easy access
export { auth, signIn, signOut } from "~/server/auth";

// Re-export types
export type { DefaultSession } from "next-auth";