// src/server/api/middleware/rate-limit.ts

import { TRPCError } from "@trpc/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize rate limiter (you can also use in-memory store for development)
const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
    analytics: true,
});

export async function rateLimitMiddleware(
    userId: string,
    action: string = "generate"
) {
    const identifier = `${userId}:${action}`;
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

    if (!success) {
        throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Rate limit exceeded. Try again in ${Math.ceil((reset - Date.now()) / 1000)} seconds.`,
        });
    }

    return { limit, remaining };
}