// scripts/generate/generators/router.ts

import fs from "fs/promises";
import path from "path";
import { formatCode, camelCase, pascalCase } from "../utils";

interface RouterOptions {
  model?: string;
  crud?: boolean;
  dryRun?: boolean;
}

interface FileToGenerate {
  path: string;
  content: string;
}

export async function generateRouter(name: string, options: RouterOptions) {
  const routerName = camelCase(name);
  const modelName = options.model || pascalCase(name);
  const ModelName = pascalCase(modelName);

  const routerPath = path.join(
    process.cwd(),
    "src",
    "server",
    "api",
    "routers",
    `${routerName}.ts`,
  );

  // Check if file exists (only in non-dry-run mode)
  if (!options.dryRun) {
    try {
      await fs.access(routerPath);
      throw new Error(`Router ${routerName} already exists at ${routerPath}`);
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  // Generate all files in memory first
  const filesToGenerate: FileToGenerate[] = [];

  // Generate router content
  let routerContent: string;
  if (options.crud && options.model) {
    routerContent = generateCrudRouter(routerName, modelName);
  } else {
    routerContent = generateBasicRouter(routerName);
  }

  routerContent = await formatCode(routerContent);
  filesToGenerate.push({ path: routerPath, content: routerContent });

  // Generate test file
  const testPath = path.join(
    path.dirname(routerPath),
    "__tests__",
    `${routerName}.test.ts`,
  );
  const testContent = await formatCode(
    generateRouterTest(routerName, modelName, options),
  );
  filesToGenerate.push({ path: testPath, content: testContent });

  // Generate types if model is provided
  if (options.model) {
    const typesPath = path.join(
      process.cwd(),
      "src",
      "types",
      `${modelName}.ts`,
    );
    const typesContent = await formatCode(generateTypes(modelName));
    filesToGenerate.push({ path: typesPath, content: typesContent });
  }

  // In dry-run mode, just output what would be created
  if (options.dryRun) {
    for (const file of filesToGenerate) {
      console.log(`Would create: ${file.path}`);
      console.log(`File size: ${file.content.length} bytes`);

      // Emit the file content for preview
      process.stdout.write(
        JSON.stringify({
          type: "preview-file",
          path: file.path,
          content: file.content,
        }) + "\n",
      );
    }

    // Also show what would be added to root router
    console.log(`\nWould update: src/server/api/root.ts`);
    console.log(
      `Would add import: import { ${routerName}Router } from "./routers/${routerName}";`,
    );
    console.log(`Would add router: ${routerName}: ${routerName}Router,`);

    return;
  }

  // Create all files
  for (const file of filesToGenerate) {
    const dir = path.dirname(file.path);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file.path, file.content);
    console.log(`✅ Created: ${file.path}`);
  }

  // Update root router
  await updateRootRouter(routerName);
}

function generateCrudRouter(routerName: string, modelName: string): string {
  const ModelName = pascalCase(modelName);
  const camelModelName = camelCase(modelName);

  return `import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createCRUDRouter } from "~/server/api/generators/crud";
import { TRPCError } from "@trpc/server";

// Define schemas for ${modelName}
const create${ModelName}Schema = z.object({
  // TODO: Add your fields here
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const update${ModelName}Schema = create${ModelName}Schema.partial();

// Generate base CRUD router
const baseCrudRouter = createCRUDRouter({
  modelName: "${camelModelName}",
  createSchema: create${ModelName}Schema,
  updateSchema: update${ModelName}Schema,
  defaultOrderBy: { createdAt: "desc" },
  includeRelations: {
    // Add any relations to include
  },
  beforeCreate: async (data, ctx) => {
    // Add any preprocessing before creation
    return data;
  },
  afterCreate: async (created, ctx) => {
    // Add any post-processing after creation
    console.log(\`${ModelName} created: \${created.id}\`);
  },
});

// Extend with custom procedures
export const ${routerName}Router = createTRPCRouter({
  // Include all CRUD operations
  ...baseCrudRouter,

  // Add custom procedures here
  getByName: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.${camelModelName}.findFirst({
        where: {
          name: input.name,
          userId: ctx.session.user.id,
        },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "${ModelName} not found",
        });
      }

      return item;
    }),

  // Example aggregation
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [total, recent] = await Promise.all([
      ctx.db.${camelModelName}.count({
        where: { userId: ctx.session.user.id },
      }),
      ctx.db.${camelModelName}.count({
        where: {
          userId: ctx.session.user.id,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    return {
      total,
      recent,
      growth: total > 0 ? (recent / total) * 100 : 0,
    };
  }),
});`;
}

function generateBasicRouter(routerName: string): string {
  return `import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";

export const ${routerName}Router = createTRPCRouter({
  // Public procedure - accessible without authentication
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: \`Hello \${input.text}\`,
      };
    }),

  // Protected procedure - requires authentication
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // TODO: Implement your logic here
    return [];
  }),

  // Create procedure
  create: protectedProcedure
    .input(
      z.object({
        // TODO: Define your input schema
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement creation logic
      console.log("Creating with input:", input);
      return { success: true };
    }),

  // Update procedure
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        // TODO: Define update fields
        name: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement update logic
      console.log("Updating:", input.id);
      return { success: true };
    }),

  // Delete procedure
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement deletion logic
      console.log("Deleting:", input.id);
      return { success: true };
    }),
});`;
}

function generateRouterTest(
  routerName: string,
  modelName: string,
  options: RouterOptions,
): string {
  const ModelName = pascalCase(modelName);
  const hasModel = !!options.model;

  return `import { ${routerName}Router } from "../${routerName}";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { type Session } from "next-auth";

describe("${routerName}Router", () => {
  const mockSession: Session = {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };

  const ctx = createInnerTRPCContext({ session: mockSession });
  const caller = ${routerName}Router.createCaller(ctx);

  ${
    hasModel
      ? `
  describe("CRUD operations", () => {
    it("creates a new ${modelName}", async () => {
      const input = {
        name: "Test ${ModelName}",
        description: "Test description",
      };

      const result = await caller.create(input);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it("lists all ${modelName}s", async () => {
      const result = await caller.list({});
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
    });

    it("gets a ${modelName} by ID", async () => {
      const result = await caller.getById({ id: "test-id" });
      expect(result).toBeDefined();
    });

    it("updates a ${modelName}", async () => {
      const result = await caller.update({
        id: "test-id",
        name: "Updated Name",
      });
      expect(result).toBeDefined();
    });

    it("deletes a ${modelName}", async () => {
      const result = await caller.delete({ id: "test-id" });
      expect(result.success).toBe(true);
    });
  });`
      : `
  it("returns a greeting", async () => {
    const result = await caller.hello({ text: "world" });
    expect(result.greeting).toBe("Hello world");
  });

  it("creates an item", async () => {
    const result = await caller.create({ name: "Test Item" });
    expect(result.success).toBe(true);
  });`
  }
});`;
}

function generateTypes(modelName: string): string {
  const ModelName = pascalCase(modelName);

  return `import { z } from "zod";
import type { ${ModelName} } from "@prisma/client";

// Input validation schemas
export const create${ModelName}Input = z.object({
  // TODO: Define your input fields
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const update${ModelName}Input = create${ModelName}Input.partial();

// Types
export type Create${ModelName}Input = z.infer<typeof create${ModelName}Input>;
export type Update${ModelName}Input = z.infer<typeof update${ModelName}Input>;

// Extended types with relations
export type ${ModelName}WithRelations = ${ModelName} & {
  // TODO: Add any relations
  // user?: User;
};`;
}

async function updateRootRouter(routerName: string) {
  const rootRouterPath = path.join(
    process.cwd(),
    "src",
    "server",
    "api",
    "root.ts",
  );

  try {
    let content = await fs.readFile(rootRouterPath, "utf-8");

    // Check if router already exists
    if (content.includes(`${routerName}Router`)) {
      console.log(`✓ Router ${routerName} already exists in root router`);
      return;
    }

    // Add import
    const importStatement = `import { ${routerName}Router } from "./routers/${routerName}";`;
    const lastImportIndex = content.lastIndexOf("import");
    const nextLineIndex = content.indexOf("\n", lastImportIndex);
    content =
      content.slice(0, nextLineIndex + 1) +
      importStatement +
      "\n" +
      content.slice(nextLineIndex + 1);

    // Add to router
    const routerRegex =
      /export const appRouter = createTRPCRouter\({([^}]*)}\);/s;
    const match = content.match(routerRegex);

    if (match) {
      const existingRouters = match[1];
      const lines = existingRouters.split("\n").filter((line) => line.trim());

      // Remove trailing comma from last router if exists
      const lastLine = lines[lines.length - 1];
      if (lastLine && !lastLine.trim().endsWith(",")) {
        lines[lines.length - 1] = lastLine + ",";
      }

      // Add new router
      lines.push(`  ${routerName}: ${routerName}Router,`);

      const updatedRouters = "\n" + lines.join("\n") + "\n";
      content = content.replace(
        routerRegex,
        `export const appRouter = createTRPCRouter({${updatedRouters}});`,
      );
    }

    await fs.writeFile(rootRouterPath, await formatCode(content));
    console.log(`✅ Updated root router with ${routerName}Router`);
  } catch (error) {
    console.warn(
      "Could not update root router automatically. Please add it manually.",
    );
    console.log(`Add to src/server/api/root.ts:`);
    console.log(
      `  import { ${routerName}Router } from "./routers/${routerName}";`,
    );
    console.log(`  ${routerName}: ${routerName}Router,`);
  }
}
