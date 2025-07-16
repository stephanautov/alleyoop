//src/server/api/trpc.ts

/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { type Session } from "next-auth";
import superjson from "superjson";
import { ZodError } from "zod";

import { getServerAuthSession } from "~/server/auth-compat";
import { db } from "~/server/db";
import { Redis } from "ioredis";
import { env } from "~/env";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */

// Initialize Redis client
const redis = new Redis(env.REDIS_URL);

interface CreateContextOptions {
  session: Session | null;
}

/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so we don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where we don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-serverapitrpcts
 */
export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    db,
    redis,
  };
};

/**
 * This is the actual context you will use in your router. It will be used to process every request
 * that goes through your tRPC endpoint.
 *
 * @see https://trpc.io/docs/context
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts;

  // Get the session from the server using the getServerSession wrapper function
  const session = await getServerAuthSession();

  return createInnerTRPCContext({
    session,
  });
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

// Helper to merge routers into a single flat namespace
export const mergeRouters = t.mergeRouters;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Rate limited procedure
 *
 * This procedure adds rate limiting to prevent abuse
 */
export const rateLimitedProcedure = protectedProcedure.use(
  async ({ ctx, next, path }) => {
    const userId = ctx.session.user.id;
    const key = `rate-limit:${userId}:${path}`;

    const current = await ctx.redis.incr(key);

    if (current === 1) {
      // First request, set expiry
      await ctx.redis.expire(key, env.RATE_LIMIT_WINDOW);
    }

    if (current > env.RATE_LIMIT_MAX) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${env.RATE_LIMIT_WINDOW} seconds.`,
      });
    }

    return next();
  }
);

/**
 * Admin procedure
 *
 * This procedure ensures only admin users can access certain endpoints
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  // You can add your admin check logic here
  // For now, we'll check if email ends with your domain
  const isAdmin = ctx.session.user.email?.endsWith("@yourdomain.com");

  if (!isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next();
});

/**
 * Cached procedure
 *
 * This procedure caches the result for a specified duration
 */
export const createCachedProcedure = (ttl = 300) => {
  return publicProcedure.use(async ({ ctx, next, path, input }) => {
    const cacheKey = `cache:${path}:${JSON.stringify(input)}`;

    const cached = await ctx.redis.get(cacheKey);
    if (cached) {
      return { ok: true, data: JSON.parse(cached) } as any;
    }

    const result = await next();

    if (result.ok) {
      await ctx.redis.setex(cacheKey, ttl, JSON.stringify(result.data));
    }

    return result;
  });
};

/**
 * Logged procedure
 *
 * This procedure logs all requests for auditing
 */
export const loggedProcedure = protectedProcedure.use(
  async ({ ctx, next, path, input }) => {
    const startTime = Date.now();

    try {
      const result = await next();

      // Log successful request
      console.log({
        type: "API_REQUEST",
        path,
        userId: ctx.session.user.id,
        duration: Date.now() - startTime,
        status: "success",
      });

      return result;
    } catch (error) {
      // Log failed request
      console.error({
        type: "API_REQUEST",
        path,
        userId: ctx.session.user.id,
        duration: Date.now() - startTime,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }
);

// Export types
export type Context = Awaited<ReturnType<typeof createTRPCContext>>;