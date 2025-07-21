//src/server/auth-compat.ts

/**
 * Compatibility wrapper for NextAuth v4 in both Pages and App Router.
 * Provides a single helper to retrieve the current session in Server Components.
 */

import { getServerSession as _getServerSession } from "next-auth";
import { authConfig } from "~/server/auth/config";

/**
 * Retrieve the current session inside a Server Component / Route Handler.
 * Abstracts away the requirement to pass Request/Response objects.
 */
export async function getServerAuthSession() {
    return await _getServerSession(authConfig);
}

// Alias kept for older imports
export { getServerAuthSession as getServerSession };

// Re-export the config and anything else callers may need
export { authConfig as authOptions };

// Re-export types for convenience
export type { DefaultSession } from "next-auth";