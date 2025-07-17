// File: src/server/services/generators/index.ts
// ============================================

import { exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

export interface GeneratorOptions {
    type: "router" | "component" | "document-type" | "feature" | "test";
    name: string;
    options?: Record<string, any>;
    dryRun?: boolean;
    sessionId?: string;
}

export interface GeneratorResult {
    success: boolean;
    files: Array<{
        path: string;
        content: string;
        language: string;
    }>;
    error?: string;
    sessionId: string;
}

class GeneratorService extends EventEmitter {
    private scriptPath = path.join(process.cwd(), "scripts", "generate", "index.ts");

    async generate(options: GeneratorOptions): Promise<GeneratorResult> {
        const sessionId = options.sessionId || crypto.randomUUID();

        try {
            // Build command arguments
            const args = [options.type, options.name];

            if (options.dryRun) {
                args.push("--dry-run");
            }

            // Add type-specific options
            if (options.options) {
                Object.entries(options.options).forEach(([key, value]) => {
                    if (typeof value === "boolean" && value) {
                        args.push(`--${key}`);
                    } else if (typeof value === "string" && value) {
                        args.push(`--${key}`, value);
                    }
                });
            }

            // Execute generator script
            const command = `npx tsx ${this.scriptPath} ${args.join(" ")}`;

            this.emit("log", { sessionId, message: `Executing: ${command}` });

            const { stdout, stderr } = await execAsync(command);

            if (stderr) {
                this.emit("error", { sessionId, message: stderr });
            }

            // Parse output
            const files: GeneratorResult["files"] = [];
            const lines = stdout.split("\n");

            for (const line of lines) {
                if (line.startsWith("{") && line.includes("preview-file")) {
                    try {
                        const data = JSON.parse(line);
                        if (data.type === "preview-file") {
                            files.push({
                                path: data.path,
                                content: data.content,
                                language: this.getLanguageFromPath(data.path)
                            });
                            this.emit("file", { sessionId, file: data.path });
                        }
                    } catch (e) {
                        // Not JSON, regular log output
                        this.emit("log", { sessionId, message: line });
                    }
                } else if (line.trim()) {
                    this.emit("log", { sessionId, message: line });
                }
            }

            this.emit("complete", { sessionId });

            return {
                success: true,
                files,
                sessionId
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            this.emit("error", { sessionId, message: errorMessage });

            return {
                success: false,
                files: [],
                error: errorMessage,
                sessionId
            };
        }
    }

    private getLanguageFromPath(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
            ".ts": "typescript",
            ".tsx": "typescript",
            ".js": "javascript",
            ".jsx": "javascript",
            ".json": "json",
            ".md": "markdown",
            ".css": "css",
            ".scss": "scss",
            ".html": "html",
            ".yml": "yaml",
            ".yaml": "yaml"
        };

        return languageMap[ext] || "text";
    }
}

export const generatorService = new GeneratorService();