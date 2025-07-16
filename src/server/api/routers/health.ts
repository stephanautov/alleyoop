//src/server/api/routers/health.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "~/env";

export const healthRouter = createTRPCRouter({
    // Basic health check
    check: publicProcedure.query(async ({ ctx }) => {
        return {
            status: "ok",
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version ?? "unknown",
        };
    }),

    // Detailed system status
    status: publicProcedure.query(async ({ ctx }) => {
        const checks = {
            database: false,
            redis: false,
            openai: false,
        };

        // Check database
        try {
            await ctx.db.$queryRaw`SELECT 1`;
            checks.database = true;
        } catch (error) {
            console.error("Database health check failed:", error);
        }

        // Check Redis
        try {
            await ctx.redis.ping();
            checks.redis = true;
        } catch (error) {
            console.error("Redis health check failed:", error);
        }

        // Check OpenAI (optional, only in development)
        if (env.NODE_ENV === "development") {
            try {
                // We don't actually call OpenAI to avoid costs
                // Just check if API key is configured
                checks.openai = !!env.OPENAI_API_KEY;
            } catch (error) {
                console.error("OpenAI health check failed:", error);
            }
        }

        const allHealthy = Object.values(checks).every((check) => check);

        return {
            status: allHealthy ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            services: checks,
            environment: env.NODE_ENV,
        };
    }),

    // Get system metrics (protected in production)
    metrics: publicProcedure.query(async ({ ctx }) => {
        // In production, you might want to protect this endpoint
        if (env.NODE_ENV === "production") {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Metrics not available in production",
            });
        }

        const [
            userCount,
            documentCount,
            exportCount,
            recentDocuments,
            activeJobs,
        ] = await Promise.all([
            ctx.db.user.count(),
            ctx.db.document.count(),
            ctx.db.export.count(),
            ctx.db.document.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                    },
                },
            }),
            // Get active job count from Redis
            (async () => {
                try {
                    const queues = ["document-generation", "export-processing"];
                    let total = 0;
                    for (const queueName of queues) {
                        const active = await ctx.redis.llen(`bull:${queueName}:active`);
                        const waiting = await ctx.redis.llen(`bull:${queueName}:wait`);
                        total += active + waiting;
                    }
                    return total;
                } catch {
                    return 0;
                }
            })(),
        ]);

        // Get memory usage
        const memoryUsage = process.memoryUsage();

        return {
            database: {
                users: userCount,
                documents: documentCount,
                exports: exportCount,
                recentDocuments,
            },
            queues: {
                activeJobs,
            },
            system: {
                memory: {
                    used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                    total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
                },
                uptime: Math.round(process.uptime()), // seconds
                nodeVersion: process.version,
            },
        };
    }),

    // Readiness check for container orchestration
    ready: publicProcedure.query(async ({ ctx }) => {
        // Check if all required services are ready
        try {
            // Database check
            await ctx.db.$queryRaw`SELECT 1`;

            // Redis check
            await ctx.redis.ping();

            return {
                ready: true,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Service not ready",
            });
        }
    }),

    // Liveness check for container orchestration
    live: publicProcedure.query(() => {
        // Simple check that the process is responsive
        return {
            alive: true,
            timestamp: new Date().toISOString(),
            pid: process.pid,
        };
    }),
});