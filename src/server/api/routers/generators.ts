// src/server/api/routers/generators.ts

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import crypto from "crypto";
import { db } from "~/server/db";

// Event emitter for streaming output
const generatorEvents = new EventEmitter();

// Store for generated files tracking
const generatedFilesStore = new Map<string, GeneratedFileInfo[]>();

interface GeneratedFileInfo {
  path: string;
  content: string;
  timestamp: Date;
  generator: string;
  sessionId: string;
}

interface GeneratorOutput {
  type: "log" | "error" | "file" | "complete";
  message?: string;
  file?: string;
  content?: string;
  progress?: number;
}

// Helper to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper to read file content
async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

// Helper to track generated files
async function trackGeneratedFile(
  sessionId: string,
  generator: string,
  filePath: string,
  content: string
) {
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

  // Also save to database for persistence
  await db.generatorHistory.create({
    data: {
      sessionId,
      generator,
      filePath,
      content,
      userId: "current-user-id", // Get from context
    }
  });
}

// Enhanced generator runner with streaming
async function runGeneratorWithStream(
  command: string,
  args: string[],
  sessionId: string,
  preview: boolean = false
): Promise<void> {
  const scriptPath = path.join(process.cwd(), "scripts", "generate", "index.ts");
  const child = spawn("tsx", [scriptPath, command, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "development" },
    shell: true
  });

  const generatedFiles: string[] = [];

  child.stdout.on("data", async (data) => {
    const output = data.toString();

    // Emit log output
    generatorEvents.emit(sessionId, {
      type: "log",
      message: output,
      progress: calculateProgress(output)
    });

    // Parse generated file paths
    const fileMatches = output.match(/✅.*?generated.*?:\s*(.+)/gi) || [];
    for (const match of fileMatches) {
      const filePath = match.split(":").pop()?.trim();
      if (filePath) {
        generatedFiles.push(filePath);

        // Read file content for preview
        const absolutePath = path.join(process.cwd(), filePath);
        const content = await readFileContent(absolutePath);

        generatorEvents.emit(sessionId, {
          type: "file",
          file: filePath,
          content: preview ? content : undefined
        });

        if (!preview) {
          await trackGeneratedFile(sessionId, command, filePath, content);
        }
      }
    }
  });

  child.stderr.on("data", (data) => {
    generatorEvents.emit(sessionId, {
      type: "error",
      message: data.toString()
    });
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code !== 0) {
        generatorEvents.emit(sessionId, {
          type: "error",
          message: "Generator failed"
        });
        reject(new Error("Generator failed"));
      } else {
        generatorEvents.emit(sessionId, {
          type: "complete",
          message: "Generation complete"
        });
        resolve();
      }
    });
  });
}

// Calculate progress based on output
function calculateProgress(output: string): number {
  if (output.includes("✅")) return 100;
  if (output.includes("Creating")) return 25;
  if (output.includes("Writing")) return 50;
  if (output.includes("Formatting")) return 75;
  return 10;
}

export const generatorsRouter = createTRPCRouter({
  // Stream generator output
  streamGeneration: protectedProcedure
    .input(z.object({
      sessionId: z.string()
    }))
    .subscription(({ input }) => {
      return observable<GeneratorOutput>((emit) => {
        const handler = (data: GeneratorOutput) => {
          emit.next(data);
        };

        generatorEvents.on(input.sessionId, handler);

        return () => {
          generatorEvents.off(input.sessionId, handler);
        };
      });
    }),

  // Generate with preview
  generateRouterWithPreview: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      model: z.string().optional(),
      crud: z.boolean().default(true),
      preview: z.boolean().default(false)
    }))
    .mutation(async ({ input, ctx }) => {
      const sessionId = crypto.randomUUID();

      try {
        // Validate files don't exist
        const routerPath = path.join(process.cwd(), "src/server/api/routers", `${input.name}.ts`);
        if (await fileExists(routerPath) && !input.preview) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Router ${input.name} already exists`
          });
        }

        const args = ["router", input.name];
        if (input.model) args.push("-m", input.model);
        if (!input.crud) args.push("--no-crud");
        if (input.preview) args.push("--dry-run");

        await runGeneratorWithStream("router", args, sessionId, input.preview);

        return {
          success: true,
          sessionId,
          files: generatedFilesStore.get(sessionId)?.map(f => f.path) || []
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate router"
        });
      }
    }),

  // Get generated files for preview
  getGeneratedFiles: protectedProcedure
    .input(z.object({
      sessionId: z.string()
    }))
    .query(async ({ input }) => {
      const files = generatedFilesStore.get(input.sessionId) || [];
      return files.map(f => ({
        path: f.path,
        content: f.content,
        language: getLanguageFromPath(f.path)
      }));
    }),

  // Undo generation
  undoGeneration: adminProcedure
    .input(z.object({
      sessionId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const files = generatedFilesStore.get(input.sessionId) || [];
      const errors: string[] = [];
      const deleted: string[] = [];

      for (const file of files) {
        try {
          const absolutePath = path.join(process.cwd(), file.path);

          // Check if file still has the same content
          const currentContent = await readFileContent(absolutePath);
          if (currentContent === file.content) {
            await fs.unlink(absolutePath);
            deleted.push(file.path);
          } else {
            errors.push(`${file.path} has been modified since generation`);
          }
        } catch (error) {
          errors.push(`Failed to delete ${file.path}`);
        }
      }

      // Clean up empty directories
      for (const file of deleted) {
        try {
          const dir = path.dirname(path.join(process.cwd(), file));
          const files = await fs.readdir(dir);
          if (files.length === 0) {
            await fs.rmdir(dir);
          }
        } catch {
          // Directory not empty or doesn't exist
        }
      }

      // Update database
      await db.generatorHistory.updateMany({
        where: { sessionId: input.sessionId },
        data: { deletedAt: new Date() }
      });

      generatedFilesStore.delete(input.sessionId);

      return {
        success: errors.length === 0,
        deleted,
        errors
      };
    }),

  // Save template
  saveTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      generator: z.string(),
      config: z.record(z.any())
    }))
    .mutation(async ({ input, ctx }) => {
      const template = await db.generatorTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          generator: input.generator,
          config: input.config,
          userId: ctx.session.user.id
        }
      });

      return template;
    }),

  // List templates
  listTemplates: protectedProcedure
    .input(z.object({
      generator: z.string().optional()
    }))
    .query(async ({ input, ctx }) => {
      const templates = await db.generatorTemplate.findMany({
        where: {
          userId: ctx.session.user.id,
          generator: input.generator
        },
        orderBy: { createdAt: "desc" }
      });

      return templates;
    }),

  // Get generation history
  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().default(10)
    }))
    .query(async ({ input, ctx }) => {
      const history = await db.generatorHistory.findMany({
        where: {
          userId: ctx.session.user.id,
          deletedAt: null
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          sessionId: true,
          generator: true,
          filePath: true,
          createdAt: true
        }
      });

      // Group by session
      const sessions = history.reduce((acc, item) => {
        if (!acc[item.sessionId]) {
          acc[item.sessionId] = {
            sessionId: item.sessionId,
            generator: item.generator,
            createdAt: item.createdAt,
            files: []
          };
        }
        acc[item.sessionId].files.push(item.filePath);
        return acc;
      }, {} as Record<string, any>);

      return Object.values(sessions);
    }),

  // Check permissions
  checkPermissions: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { role: true }
      });

      return {
        canGenerate: user?.role === "ADMIN" || user?.role === "DEVELOPER",
        canUseTemplates: true,
        canUndo: user?.role === "ADMIN"
      };
    })
});

// Helper to determine language from file path
function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath);
  const langMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".css": "css",
    ".scss": "scss",
    ".html": "html"
  };
  return langMap[ext] || "text";
}