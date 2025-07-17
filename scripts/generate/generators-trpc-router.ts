// src/server/api/routers/generators.ts

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { spawn } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(spawn);

// Helper function to run generator scripts
async function runGenerator(command: string, args: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const generatedFiles: string[] = [];
    const scriptPath = path.join(process.cwd(), "scripts", "generate", "index.ts");
    
    const child = spawn("tsx", [scriptPath, command, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "development" },
      shell: true
    });

    let errorOutput = "";

    child.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(output);
      
      // Parse generated file paths from output
      const fileMatches = output.match(/✅.*?generated.*?:\s*(.+)/gi) || [];
      fileMatches.forEach((match: string) => {
        const filePath = match.split(":").pop()?.trim();
        if (filePath) generatedFiles.push(filePath);
      });
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Generator failed: ${errorOutput}`));
      } else {
        resolve(generatedFiles);
      }
    });
  });
}

export const generatorsRouter = createTRPCRouter({
  // Generate tRPC Router
  generateRouter: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      model: z.string().optional(),
      crud: z.boolean().default(true)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const args = ["router", input.name];
        if (input.model) args.push("-m", input.model);
        if (!input.crud) args.push("--no-crud");

        const files = await runGenerator("router", args);
        
        // Add expected file paths if not captured from output
        if (files.length === 0) {
          files.push(
            `src/server/api/routers/${input.name}.ts`,
            `src/server/api/routers/__tests__/${input.name}.test.ts`
          );
        }

        return { success: true, files };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate router"
        });
      }
    }),

  // Generate React Component
  generateComponent: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["component", "page", "form"]).default("component"),
      dir: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const args = ["component", input.name];
        args.push("-t", input.type);
        if (input.dir) args.push("-d", input.dir);

        const files = await runGenerator("component", args);
        
        // Add expected file paths if not captured
        if (files.length === 0) {
          const kebabName = input.name
            .replace(/([a-z])([A-Z])/g, "$1-$2")
            .toLowerCase();
          
          const baseDir = input.type === "page" ? "src/app" : "src/components";
          const componentDir = input.dir 
            ? path.join(baseDir, input.dir, kebabName)
            : path.join(baseDir, kebabName);

          files.push(
            path.join(componentDir, input.type === "page" ? "page.tsx" : `${kebabName}.tsx`),
            path.join(componentDir, `${kebabName}.test.tsx`),
            path.join(componentDir, "index.ts")
          );
          
          if (input.type === "component") {
            files.push(path.join(componentDir, `${kebabName}.stories.tsx`));
          }
        }

        return { success: true, files };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate component"
        });
      }
    }),

  // Generate Document Type
  generateDocumentType: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string(),
      sections: z.array(z.string()),
      exportFormats: z.array(z.string())
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // For document type, we need to use interactive mode with answers
        // So we'll create a temporary answers file
        const answersJson = JSON.stringify({
          description: input.description,
          sections: input.sections,
          exportFormats: input.exportFormats
        });

        const args = ["document-type", input.name, "--answers", answersJson];
        const files = await runGenerator("document-type", args);

        // Add expected file paths
        if (files.length === 0) {
          const kebabName = input.name
            .replace(/([a-z])([A-Z])/g, "$1-$2")
            .toLowerCase();

          files.push(
            `src/config/schemas/${kebabName}.ts`,
            `src/lib/ai/prompts/${kebabName}/outline.md`,
            `src/lib/ai/prompts/${kebabName}/section.md`,
            `src/config/forms/${kebabName}.ts`
          );
        }

        return { success: true, files };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate document type"
        });
      }
    }),

  // Generate Tests
  generateTest: protectedProcedure
    .input(z.object({
      path: z.string().min(1),
      type: z.enum(["unit", "integration", "e2e"]).default("unit")
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const args = ["test", input.path, "-t", input.type];
        const files = await runGenerator("test", args);

        // Add expected file paths based on test type
        if (files.length === 0) {
          const fileName = path.basename(input.path, path.extname(input.path));
          
          switch (input.type) {
            case "unit":
              files.push(path.join(
                path.dirname(input.path),
                "__tests__",
                `${fileName}.test.ts`
              ));
              break;
            case "integration":
              files.push(path.join(
                "tests",
                "integration",
                `${fileName}.integration.test.ts`
              ));
              break;
            case "e2e":
              files.push(path.join(
                "tests",
                "e2e",
                `${fileName}.spec.ts`
              ));
              break;
          }
        }

        return { success: true, files };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate tests"
        });
      }
    }),

  // Generate Complete Feature
  generateFeature: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      model: z.string().optional(),
      includeApi: z.boolean().default(true),
      includeUi: z.boolean().default(true),
      includeTests: z.boolean().default(true)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Create answers for interactive prompts
        const answersJson = JSON.stringify({
          includeApi: input.includeApi,
          includeUi: input.includeUi,
          includeTests: input.includeTests,
          model: input.model || ""
        });

        const args = ["feature", input.name, "--answers", answersJson];
        const files = await runGenerator("feature", args);

        // Add expected file paths
        if (files.length === 0) {
          const kebabName = input.name
            .replace(/([a-z])([A-Z])/g, "$1-$2")
            .toLowerCase();
          const camelName = input.name.charAt(0).toLowerCase() + input.name.slice(1);

          const featureRoot = `src/features/${kebabName}`;

          if (input.includeApi) {
            files.push(
              `src/server/api/routers/${camelName}.ts`,
              `${featureRoot}/types/index.ts`,
              `${featureRoot}/hooks/index.ts`
            );
          }

          if (input.includeUi) {
            files.push(
              `${featureRoot}/components/${kebabName}-list.tsx`,
              `${featureRoot}/components/${kebabName}-form.tsx`,
              `${featureRoot}/components/${kebabName}-card.tsx`,
              `${featureRoot}/pages/index.tsx`
            );
          }

          if (input.includeTests) {
            files.push(
              `${featureRoot}/__tests__/${kebabName}.test.tsx`,
              `tests/integration/${kebabName}.integration.test.ts`
            );
          }

          files.push(
            `${featureRoot}/index.ts`,
            `${featureRoot}/README.md`
          );
        }

        return { success: true, files };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate feature"
        });
      }
    }),

  // List available generators
  listGenerators: protectedProcedure
    .query(async () => {
      return {
        generators: [
          {
            name: "router",
            description: "Generate a new tRPC router with CRUD operations",
            icon: "Code2"
          },
          {
            name: "component",
            description: "Generate a new React component with tests and stories",
            icon: "Component"
          },
          {
            name: "document-type",
            description: "Generate a complete document type with all infrastructure",
            icon: "FileText"
          },
          {
            name: "test",
            description: "Generate tests for a component or function",
            icon: "TestTube"
          },
          {
            name: "feature",
            description: "Generate a complete feature with API, UI, and tests",
            icon: "Rocket"
          }
        ]
      };
    })
});