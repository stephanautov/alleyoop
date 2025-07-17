import fs from "fs/promises";
import path from "path";
import { generateRouter } from "./router";
import { generateComponent } from "./component";
import { generateTest } from "./test";
import { pascalCase, camelCase, kebabCase } from "../utils";

interface FeatureOptions {
  includeApi?: boolean;
  includeUi?: boolean;
  includeTests?: boolean;
  model?: string;
}

export async function generateFeature(name: string, options: FeatureOptions) {
  const featureName = pascalCase(name);
  const camelName = camelCase(name);
  const kebabName = kebabCase(name);
  const modelName = options.model || camelName;

  console.log(`🚀 Generating complete feature: ${featureName}`);

  // Create feature directory structure
  const featureRoot = path.join(process.cwd(), "src", "features", kebabName);
  await createFeatureStructure(featureRoot);

  // 1. Generate API routes
  if (options.includeApi) {
    console.log("\n📡 Generating API routes...");
    await generateRouter(camelName, { model: modelName, crud: true });
    await createApiTypes(featureRoot, featureName, modelName);
    await createApiHooks(featureRoot, camelName);
  }

  // 2. Generate UI components
  if (options.includeUi) {
    console.log("\n🎨 Generating UI components...");
    
    // List component
    await generateComponent(`${featureName}List`, {
      type: "component",
      dir: `features/${kebabName}/components`
    });
    
    // Form component
    await generateComponent(`${featureName}Form`, {
      type: "form",
      dir: `features/${kebabName}/components`
    });
    
    // Detail/Card component
    await generateComponent(`${featureName}Card`, {
      type: "component",
      dir: `features/${kebabName}/components`
    });
    
    // Page components
    await createFeaturePages(featureRoot, featureName, camelName);
  }

  // 3. Generate tests
  if (options.includeTests) {
    console.log("\n🧪 Generating tests...");
    
    if (options.includeApi) {
      await generateTest(`src/server/api/routers/${camelName}.ts`, { type: "unit" });
    }
    
    if (options.includeUi) {
      await generateTest(`src/features/${kebabName}/components/${kebabName}-list.tsx`, { type: "unit" });
      await generateTest(`src/features/${kebabName}/components/${kebabName}-form.tsx`, { type: "unit" });
      await generateTest(`src/app/${kebabName}/page.tsx`, { type: "integration" });
    }
  }

  // 4. Create feature index file
  await createFeatureIndex(featureRoot, featureName, options);

  // 5. Create README for the feature
  await createFeatureReadme(featureRoot, featureName, options);

  console.log(`\n✅ Feature ${featureName} generated successfully!`);
  console.log(`\n📁 Feature location: ${featureRoot}`);
  console.log(`\n📝 Next steps:`);
  console.log(`1. Review generated files in src/features/${kebabName}/`);
  console.log(`2. Customize the components and logic as needed`);
  console.log(`3. Run 'npm run db:push' if you added new models`);
  console.log(`4. Add navigation links to your new pages`);
  if (options.includeTests) {
    console.log(`5. Run 'npm test' to verify all tests pass`);
  }
}

async function createFeatureStructure(featureRoot: string) {
  const directories = [
    "components",
    "hooks",
    "types",
    "utils",
    "__tests__",
    "pages"
  ];

  for (const dir of directories) {
    await fs.mkdir(path.join(featureRoot, dir), { recursive: true });
  }
}

async function createApiTypes(featureRoot: string, featureName: string, modelName: string) {
  const typesContent = `import { z } from "zod";
import type { ${pascalCase(modelName)} } from "@prisma/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";

// Router output types
type RouterOutput = inferRouterOutputs<AppRouter>;
export type ${featureName}Output = RouterOutput["${camelCase(modelName)}"];

// Input schemas
export const create${featureName}Schema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  // Add more fields as needed
});

export const update${featureName}Schema = create${featureName}Schema.partial();

// Filter schema for list queries
export const ${camelCase(featureName)}FilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(["createdAt", "name", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Types
export type Create${featureName}Input = z.infer<typeof create${featureName}Schema>;
export type Update${featureName}Input = z.infer<typeof update${featureName}Schema>;
export type ${featureName}Filter = z.infer<typeof ${camelCase(featureName)}FilterSchema>;

// Extended types
export type ${featureName}WithRelations = ${pascalCase(modelName)} & {
  // Add relations here
  _count?: {
    // Add count fields
  };
};
`;

  await fs.writeFile(
    path.join(featureRoot, "types", "index.ts"),
    typesContent
  );
}

async function createApiHooks(featureRoot: string, camelName: string) {
  const hooksContent = `import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { Create${pascalCase(camelName)}Input, Update${pascalCase(camelName)}Input } from "../types";

// Custom hooks for ${camelName} feature
export function use${pascalCase(camelName)}List(filters?: any) {
  return api.${camelName}.list.useQuery({ filters });
}

export function use${pascalCase(camelName)}(id: string) {
  return api.${camelName}.getById.useQuery(
    { id },
    { enabled: !!id }
  );
}

export function useCreate${pascalCase(camelName)}() {
  const utils = api.useContext();
  
  return api.${camelName}.create.useMutation({
    onSuccess: () => {
      toast.success("Created successfully!");
      utils.${camelName}.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create");
    },
  });
}

export function useUpdate${pascalCase(camelName)}() {
  const utils = api.useContext();
  
  return api.${camelName}.update.useMutation({
    onSuccess: () => {
      toast.success("Updated successfully!");
      utils.${camelName}.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update");
    },
  });
}

export function useDelete${pascalCase(camelName)}() {
  const utils = api.useContext();
  
  return api.${camelName}.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted successfully!");
      utils.${camelName}.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete");
    },
  });
}
`;

  await fs.writeFile(
    path.join(featureRoot, "hooks", "index.ts"),
    hooksContent
  );
}

async function createFeaturePages(featureRoot: string, featureName: string, camelName: string) {
  const kebabName = kebabCase(featureName);
  
  // Create app directory pages
  const appPagesDir = path.join(process.cwd(), "src", "app", kebabName);
  await fs.mkdir(appPagesDir, { recursive: true });
  
  // List page
  const listPageContent = `import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { ${featureName}List } from "~/features/${kebabName}/components/${kebabName}-list";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function ${featureName}Page() {
  const session = await getServerAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">${featureName}</h1>
          <p className="text-muted-foreground">
            Manage your ${camelName} items
          </p>
        </div>
        <Link href="/${kebabName}/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add ${featureName}
          </Button>
        </Link>
      </div>

      <${featureName}List />
    </div>
  );
}
`;

  await fs.writeFile(
    path.join(appPagesDir, "page.tsx"),
    listPageContent
  );
  
  // Create new/edit page directory
  const newPageDir = path.join(appPagesDir, "new");
  await fs.mkdir(newPageDir, { recursive: true });
  
  // New/Create page
  const newPageContent = `import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { ${featureName}Form } from "~/features/${kebabName}/components/${kebabName}-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function New${featureName}Page() {
  const session = await getServerAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/${kebabName}">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New ${featureName}</CardTitle>
        </CardHeader>
        <CardContent>
          <${featureName}Form />
        </CardContent>
      </Card>
    </div>
  );
}
`;

  await fs.writeFile(
    path.join(newPageDir, "page.tsx"),
    newPageContent
  );
  
  // Detail/Edit page directory
  const detailPageDir = path.join(appPagesDir, "[id]");
  await fs.mkdir(detailPageDir, { recursive: true });
  
  // Detail page
  const detailPageContent = `import { notFound, redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Edit } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function ${featureName}DetailPage({ params }: PageProps) {
  const session = await getServerAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  let item;
  try {
    item = await api.${camelName}.getById.query({ id: params.id });
  } catch (error) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/${kebabName}">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <Link href="/${kebabName}/${item.id}/edit">
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{item.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre>{JSON.stringify(item, null, 2)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
`;

  await fs.writeFile(
    path.join(detailPageDir, "page.tsx"),
    detailPageContent
  );
}

async function createFeatureIndex(featureRoot: string, featureName: string, options: FeatureOptions) {
  const exports: string[] = [];
  
  if (options.includeUi) {
    exports.push(`export * from "./components";`);
  }
  
  if (options.includeApi) {
    exports.push(`export * from "./hooks";`);
    exports.push(`export * from "./types";`);
  }
  
  exports.push(`export * from "./utils";`);
  
  const indexContent = `// ${featureName} Feature
${exports.join("\n")}

// Feature metadata
export const ${camelCase(featureName)}Feature = {
  name: "${featureName}",
  path: "/${kebabCase(featureName)}",
  icon: "FileText", // Change this to appropriate icon
  description: "Manage ${featureName}",
};
`;

  await fs.writeFile(
    path.join(featureRoot, "index.ts"),
    indexContent
  );
}

async function createFeatureReadme(featureRoot: string, featureName: string, options: FeatureOptions) {
  const kebabName = kebabCase(featureName);
  const readmeContent = `# ${featureName} Feature

This feature provides functionality for managing ${featureName}.

## Structure

\`\`\`
${kebabName}/
├── components/       # UI components
│   ├── ${kebabName}-list.tsx
│   ├── ${kebabName}-form.tsx
│   └── ${kebabName}-card.tsx
├── hooks/           # Custom React hooks
├── types/           # TypeScript types
├── utils/           # Utility functions
├── __tests__/       # Test files
└── pages/           # Next.js pages
\`\`\`

## Usage

### Components

\`\`\`tsx
import { ${featureName}List } from "~/features/${kebabName}";

<${featureName}List />
\`\`\`

### Hooks

\`\`\`tsx
import { use${featureName}List, useCreate${featureName} } from "~/features/${kebabName}";

const { data, isLoading } = use${featureName}List();
const createMutation = useCreate${featureName}();
\`\`\`

### Pages

- \`/${kebabName}\` - List all items
- \`/${kebabName}/new\` - Create new item
- \`/${kebabName}/[id]\` - View item details
- \`/${kebabName}/[id]/edit\` - Edit item

## API Endpoints

${options.includeApi ? `
- \`${featureName.toLowerCase()}.create\` - Create a new item
- \`${featureName.toLowerCase()}.list\` - List all items
- \`${featureName.toLowerCase()}.getById\` - Get single item
- \`${featureName.toLowerCase()}.update\` - Update an item
- \`${featureName.toLowerCase()}.delete\` - Delete an item
` : 'No API endpoints generated for this feature.'}

## Development

To extend this feature:

1. Add new fields to the schema in \`types/index.ts\`
2. Update the form in \`components/${kebabName}-form.tsx\`
3. Modify the list display in \`components/${kebabName}-list.tsx\`
4. Add business logic to the API router

## Testing

Run tests with:
\`\`\`bash
npm test -- ${kebabName}
\`\`\`
`;

  await fs.writeFile(
    path.join(featureRoot, "README.md"),
    readmeContent
  );
}

// Utility to create barrel export for components
async function createComponentsIndex(featureRoot: string, featureName: string) {
  const kebabName = kebabCase(featureName);
  const componentsIndexContent = `export * from "./${kebabName}-list";
export * from "./${kebabName}-form";
export * from "./${kebabName}-card";
`;

  await fs.writeFile(
    path.join(featureRoot, "components", "index.ts"),
    componentsIndexContent
  );
}