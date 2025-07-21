//src/server/auth/config.ts

import { PrismaAdapter } from "@auth/prisma-adapter";
import {
  type DefaultSession,
  type NextAuthOptions,
  type Session,
  type User,
} from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";

import { env } from "~/env";
import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    // Only include Discord if credentials are provided
    // ...(env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET
    //   ? [DiscordProvider]
    //   : []),
    // Add Google provider
    ...(env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_CLIENT_ID.length > 0 &&
      env.GOOGLE_CLIENT_SECRET.length > 0
      ? [
        GoogleProvider({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          authorization: {
            params: {
              prompt: "consent",
              access_type: "offline",
              response_type: "code",
            },
          },
        }),
      ]
      : []),
  ],
  adapter: PrismaAdapter(db),
  callbacks: {
    session: ({ session, user }: { session: Session; user: User }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        role: user.role,
      },
    }),
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
}
