// src/server/api/routers/generators-enhanced.ts
// Enhanced generator router with validation and rate limiting

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { db } from "~/server/db";

// Types
interface GeneratedFileInfo {
    path: string;
    content: string;
    timestamp: Date;
    generator: string;
    sessionId: string;
}

interface GeneratorMetrics {
    userId: string;
    generator: string;
    name: string;
    preview: boolean;
    failed?: boolean;
}

interface ValidationResult {
    valid: boolean;
    conflicts: string[];
    warnings: string[];
    suggestions: string[];
}

// Store for generated files tracking (in-memory for now)
const generatedFilesStore = new Map<string, GeneratedFileInfo[]>();

// Rate limiting middleware
async function rateLimitMiddleware(userId: string, action: string) {
    // Simple in-memory rate limiting (you can replace with Redis-based solution)
    const key = `${userId}:${action}`;
    const limit = 10; // 10 requests per minute
    const window = 60 * 1000; // 1 minute

    // In production, use Redis or similar
    // For now, just return mock data
    return {
        success: true,
        limit,
        remaining: 9,
        reset: Date.now() + window
    };
}

// Validation function
async function validateGeneration(
    type: string,
    name: string,
    options: Record<string, any>
): Promise<ValidationResult> {
    const result: ValidationResult = {
        valid: true,
        conflicts: [],
        warnings: [],
        suggestions: []
    };

    // Validate name format
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
        result.valid = false;
        result.warnings.push("Name should start with a letter and contain only alphanumeric characters");
    }

    // Check reserved words
    const reservedWords = ["class", "function", "const", "let", "var", "return", "export", "import"];
    if (reservedWords.includes(name.toLowerCase())) {
        result.valid = false;
        result.warnings.push(`"${name}" is a reserved word`);
    }

    // Type-specific validation
    switch (type) {
        case "router":
            // Check if router already exists
            const routerPath = path.join(process.cwd(), "src/server/api/routers", `${name}.ts`);
            try {
                await fs.access(routerPath);
                result.conflicts.push(`Router already exists: ${routerPath}`);
                result.valid = false;
            } catch {
                // File doesn't exist, which is good
            }
            break;

        case "component":
            // Add component-specific validation
            if (name[0] !== name[0].toUpperCase()) {
                result.warnings.push("Component names should start with uppercase letter");
            }
            break;

        case "test":
            // Add test-specific validation
            break;
    }

    return result;
}

// Track generator metrics
async function trackGeneratorMetrics(metrics: GeneratorMetrics): Promise<void> {
    try {
        await db.generatorMetrics.create({
            data: {
                userId: metrics.userId,
                generator: metrics.generator,
                name: metrics.name,
                preview: metrics.preview,
                failed: metrics.failed || false,
                createdAt: new Date()
            }
        });
    } catch (error) {
        console.error("Failed to track metrics:", error);
    }
}

// Run generator with streaming
async function runGeneratorWithStream(
    command: string,
    args: string[],
    sessionId: string,
    preview: boolean = false
): Promise<void> {
    const scriptPath = path.join(process.cwd(), "scripts", "generate", "index.ts");

    return new Promise((resolve, reject) => {
        const child = spawn("tsx", [scriptPath, command, ...args], {
            cwd: process.cwd(),
            env: { ...process.env, NODE_ENV: "development" },
            shell: true
        });

        child.stdout.on("data", async (data) => {
            const output = data.toString();
            console.log(output);

            // Parse preview files if in preview mode
            if (preview) {
                const lines = output.split('\n');
                for (const line of lines) {
                    if (line.startsWith('{') && line.includes('"type":"preview-file"')) {
                        try {
                            const fileData = JSON.parse(line);
                            if (fileData.type === "preview-file") {
                                await trackGeneratedFile(sessionId, command, fileData.path, fileData.content);
                            }
                        } catch {
                            // Not JSON, skip
                        }
                    }
                }
            }
        });

        child.stderr.on("data", (data) => {
            console.error(data.toString());
        });

        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`Generator failed with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

// Track generated files
async function trackGeneratedFile(
    sessionId: string,
    generator: string,
    filePath: string,
    content: string
): Promise<void> {
    const info: GeneratedFileInfo = {
        path: filePath,
        content,
        timestamp: new Date(),
        generator,
        sessionId
    };

    if (!generatedFilesStore.has(sessionId)) {
        generatedFilesStore.set(sessionId, []);
    }
    generatedFilesStore.get(sessionId)!.push(info);
}

export const enhancedGeneratorsRouter = createTRPCRouter({
    generateRouterWithValidation: adminProcedure
        .input(z.object({
            name: z.string().min(1).max(50),
            model: z.string().optional(),
            crud: z.boolean().default(true),
            preview: z.boolean().default(false),
            force: z.boolean().default(false) // Skip validation
        }))
        .mutation(async ({ input, ctx }) => {
            // Rate limiting
            const { remaining } = await rateLimitMiddleware(ctx.session.user.id, "generate:router");

            // Validation
            if (!input.force) {
                const validation = await validateGeneration("router", input.name, input);

                if (!validation.valid) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Validation failed",
                        cause: validation
                    });
                }

                // Return validation results for user confirmation if there are warnings
                if (validation.warnings.length > 0 || validation.suggestions.length > 0) {
                    return {
                        needsConfirmation: true,
                        validation,
                        remaining
                    };
                }
            }

            const sessionId = crypto.randomUUID();

            try {
                // Track metrics
                await trackGeneratorMetrics({
                    userId: ctx.session.user.id,
                    generator: "router",
                    name: input.name,
                    preview: input.preview
                });

                // Run generator
                const args = ["router", input.name];
                if (input.model) args.push("-m", input.model);
                if (!input.crud) args.push("--no-crud");
                if (input.preview) args.push("--dry-run");

                await runGeneratorWithStream("router", args, sessionId, input.preview);

                return {
                    success: true,
                    sessionId,
                    remaining,
                    files: generatedFilesStore.get(sessionId)?.map((f: GeneratedFileInfo) => f.path) || []
                };
            } catch (error) {
                // Log error for debugging
                console.error("Generator error:", error);

                // Track failed generation
                await trackGeneratorMetrics({
                    userId: ctx.session.user.id,
                    generator: "router",
                    name: input.name,
                    preview: input.preview,
                    failed: true
                });

                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error instanceof Error ? error.message : "Failed to generate router",
                    cause: error
                });
            }
        }),

    // Bulk operations
    bulkGenerate: adminProcedure
        .input(z.object({
            operations: z.array(z.object({
                type: z.enum(["router", "component", "test"]),
                name: z.string(),
                options: z.record(z.any())
            })).max(10) // Limit bulk operations
        }))
        .mutation(async ({ input, ctx }) => {
            const results = [];

            for (const op of input.operations) {
                try {
                    // Validate each operation
                    const validation = await validateGeneration(op.type, op.name, op.options);

                    if (!validation.valid) {
                        results.push({
                            name: op.name,
                            type: op.type,
                            success: false,
                            error: "Validation failed",
                            validation
                        });
                        continue;
                    }

                    // Generate
                    const sessionId = crypto.randomUUID();
                    await runGeneratorWithStream(op.type, [op.name], sessionId, false);

                    results.push({
                        name: op.name,
                        type: op.type,
                        success: true,
                        sessionId
                    });
                } catch (error) {
                    results.push({
                        name: op.name,
                        type: op.type,
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            }

            return { results };
        }),

    // Get generator metrics
    getMetrics: adminProcedure
        .query(async ({ ctx }) => {
            const metrics = await db.generatorMetrics.findMany({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                },
                select: {
                    generator: true,
                    preview: true,
                    failed: true,
                    createdAt: true
                }
            });

            // Aggregate metrics
            const summary = metrics.reduce((acc: Record<string, any>, metric: any) => {
                const key = metric.generator;
                if (!acc[key]) {
                    acc[key] = {
                        total: 0,
                        previews: 0,
                        generated: 0,
                        failed: 0
                    };
                }

                acc[key].total++;
                if (metric.preview) acc[key].previews++;
                else if (!metric.failed) acc[key].generated++;
                if (metric.failed) acc[key].failed++;

                return acc;
            }, {} as Record<string, any>);

            return {
                summary,
                totalGenerations: metrics.length,
                successRate: metrics.length > 0 ? metrics.filter((m: any) => !m.failed).length / metrics.length : 0
            };
        })
});

// Error recovery utility
export async function recoverFromGeneratorError(
    sessionId: string,
    error: Error
): Promise<void> {
    // Clean up any partial files
    const files = generatedFilesStore.get(sessionId) || [];

    for (const file of files) {
        try {
            const filePath = path.join(process.cwd(), file.path);
            // Only delete if file was just created (within last minute)
            const stats = await fs.stat(filePath);
            if (Date.now() - stats.birthtimeMs < 60000) {
                await fs.unlink(filePath);
                console.log(`Cleaned up partial file: ${file.path}`);
            }
        } catch {
            // File might not exist or already deleted
        }
    }

    // Clear session data
    generatedFilesStore.delete(sessionId);

    // Log error for investigation
    await db.generatorError.create({
        data: {
            sessionId,
            error: error.message,
            stack: error.stack || "",
            timestamp: new Date()
        }
    });
}