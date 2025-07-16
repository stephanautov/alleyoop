//scripts/generate/generators/router.ts

import fs from "fs/promises";
import path from "path";
import { formatCode } from "../utils";

interface RouterOptions {
  model?: string;
  crud?: boolean;
}

export async function generateRouter(name: string, options: RouterOptions) {
  const routerName = name.toLowerCase();
  const modelName = options.model || name;
  const ModelName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

  const routerPath = path.join(
    process.cwd(),
    "src",
    "server",
    "api",
    "routers",
    `${routerName}.ts`
  );

  let routerContent: string;

  if (options.crud && options.model) {
    // Generate CRUD router using the generator
    routerContent = generateCrudRouter(routerName, modelName);
  } else {
    // Generate basic router
    routerContent = generateBasicRouter(routerName);
  }

  // Ensure directory exists
  await fs.mkdir(path.dirname(routerPath), { recursive: true });

  // Write router file
  await fs.writeFile(routerPath, await formatCode(routerContent));

  // Update root router
  await updateRootRouter(routerName);

  // Generate types if model is provided
  if (options.model) {
    await generateTypes(modelName);
  }
}

function generateCrudRouter(routerName: string, modelName: string): string {
  const ModelName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

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
  modelName: "${modelName}",
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
      const item = await ctx.db.${modelName}.findFirst({
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
      ctx.db.${modelName}.count({
        where: { userId: ctx.session.user.id },
      }),
      ctx.db.${modelName}.count({
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
});
`;
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
});
`;
}

async function updateRootRouter(routerName: string) {
  const rootRouterPath = path.join(
    process.cwd(),
    "src",
    "server",
    "api",
    "root.ts"
  );

  try {
    let content = await fs.readFile(rootRouterPath, "utf-8");

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
    const routerRegex = /export const appRouter = createTRPCRouter\({([^}]*)}\);/;
    const match = content.match(routerRegex);

    if (match) {
      const existingRouters = match[1];
      const newRouter = `  ${routerName}: ${routerName}Router,\n`;
      const updatedRouters = (existingRouters?.trimEnd() ?? "") + ",\n" + newRouter;
      content = content.replace(
        routerRegex,
        `export const appRouter = createTRPCRouter({${updatedRouters}});`
      );
    }

    await fs.writeFile(rootRouterPath, await formatCode(content));
  } catch (error) {
    console.warn("Could not update root router automatically. Please add it manually.");
  }
}

async function generateTypes(modelName: string) {
  const ModelName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  const typesPath = path.join(
    process.cwd(),
    "src",
    "types",
    `${modelName}.ts`
  );

  const typesContent = `import { z } from "zod";
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
};
`;

  await fs.mkdir(path.dirname(typesPath), { recursive: true });
  await fs.writeFile(typesPath, await formatCode(typesContent));
}