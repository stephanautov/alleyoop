// scripts/generate/generators/feature.ts

import fs from "fs/promises";
import path from "path";
import { formatCode, pascalCase, camelCase, kebabCase } from "../utils";
import { generateRouter } from "./router";
import { generateComponent } from "./component";
import { generateTest } from "./test";

interface FeatureOptions {
  includeApi?: boolean;
  includeUi?: boolean;
  includeTests?: boolean;
  model?: string;
  dryRun?: boolean;
}

interface FileToGenerate {
  path: string;
  content: string;
}

export async function generateFeature(name: string, options: FeatureOptions) {
  const featureName = pascalCase(name);
  const camelName = camelCase(name);
  const kebabName = kebabCase(name);
  const modelName = options.model || camelName;

  console.log(`🚀 Generating complete feature: ${featureName}`);

  // Feature root directory
  const featureRoot = path.join(process.cwd(), "src", "features", kebabName);

  // Collect all files that this generator will create directly
  const filesToGenerate: FileToGenerate[] = [];

  // Check if feature directory exists (only in non-dry-run mode)
  if (!options.dryRun) {
    try {
      await fs.access(featureRoot);
      const files = await fs.readdir(featureRoot);
      if (files.length > 0) {
        throw new Error(`Feature directory already exists with ${files.length} files: ${featureRoot}`);
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  // 1. Generate API routes (delegate to router generator)
  if (options.includeApi) {
    console.log("\n📡 Generating API routes...");

    // Call router generator with dry-run flag
    await generateRouter(camelName, {
      model: modelName,
      crud: true,
      dryRun: options.dryRun
    });

    // Generate API types
    const typesPath = path.join(featureRoot, "types", "index.ts");
    const typesContent = await formatCode(createApiTypes(featureName, modelName));
    filesToGenerate.push({ path: typesPath, content: typesContent });

    // Generate API hooks
    const hooksPath = path.join(featureRoot, "hooks", "index.ts");
    const hooksContent = await formatCode(createApiHooks(camelName, featureName));
    filesToGenerate.push({ path: hooksPath, content: hooksContent });
  }

  // 2. Generate UI components (delegate to component generator)
  if (options.includeUi) {
    console.log("\n🎨 Generating UI components...");

    // Generate components using component generator
    await generateComponent(`${featureName}List`, {
      type: "component",
      dir: `features/${kebabName}/components`,
      dryRun: options.dryRun
    });

    await generateComponent(`${featureName}Form`, {
      type: "form",
      dir: `features/${kebabName}/components`,
      dryRun: options.dryRun
    });

    await generateComponent(`${featureName}Card`, {
      type: "component",
      dir: `features/${kebabName}/components`,
      dryRun: options.dryRun
    });

    // Generate page files
    const pages = await createFeaturePages(featureName, camelName, kebabName, options.dryRun);
    filesToGenerate.push(...pages);

    // Create components index
    const componentsIndexPath = path.join(featureRoot, "components", "index.ts");
    const componentsIndexContent = createComponentsIndex(kebabName);
    filesToGenerate.push({ path: componentsIndexPath, content: componentsIndexContent });
  }

  // 3. Generate tests (delegate to test generator)
  if (options.includeTests) {
    console.log("\n🧪 Generating tests...");

    if (options.includeApi) {
      await generateTest(`src/server/api/routers/${camelName}.ts`, {
        type: "unit",
        dryRun: options.dryRun
      });
    }

    if (options.includeUi) {
      await generateTest(`src/features/${kebabName}/components/${kebabName}-list.tsx`, {
        type: "unit",
        dryRun: options.dryRun
      });

      await generateTest(`src/features/${kebabName}/components/${kebabName}-form.tsx`, {
        type: "unit",
        dryRun: options.dryRun
      });

      await generateTest(`src/app/${kebabName}/page.tsx`, {
        type: "integration",
        dryRun: options.dryRun
      });
    }
  }

  // 4. Create feature-specific files
  // Feature index file
  const indexPath = path.join(featureRoot, "index.ts");
  const indexContent = createFeatureIndex(featureName, camelName, kebabName, options);
  filesToGenerate.push({ path: indexPath, content: indexContent });

  // Feature README
  const readmePath = path.join(featureRoot, "README.md");
  const readmeContent = createFeatureReadme(featureName, camelName, kebabName, options);
  filesToGenerate.push({ path: readmePath, content: readmeContent });

  // Utils index (empty placeholder)
  const utilsPath = path.join(featureRoot, "utils", "index.ts");
  const utilsContent = `// Utility functions for ${featureName} feature\n\nexport {};\n`;
  filesToGenerate.push({ path: utilsPath, content: utilsContent });

  // Handle dry-run mode
  if (options.dryRun) {
    console.log(`\n📁 Would create feature directory: ${featureRoot}`);
    console.log(`Would create subdirectories: components, hooks, types, utils, __tests__, pages`);

    // Output files that this generator creates directly
    for (const file of filesToGenerate) {
      console.log(`Would create: ${file.path}`);
      console.log(`File size: ${file.content.length} bytes`);

      // Emit preview data
      process.stdout.write(JSON.stringify({
        type: "preview-file",
        path: file.path,
        content: file.content
      }) + "\n");
    }

    console.log(`\n📝 Next steps after generation:`);
    console.log(`1. Review generated files in src/features/${kebabName}/`);
    console.log(`2. Customize the components and logic as needed`);
    console.log(`3. Run 'npm run db:push' if you added new models`);
    console.log(`4. Add navigation links to your new pages`);
    if (options.includeTests) {
      console.log(`5. Run 'npm test' to verify all tests pass`);
    }

    return;
  }

  // Create feature directory structure
  await createFeatureStructure(featureRoot);

  // Actually create all files
  for (const file of filesToGenerate) {
    const dir = path.dirname(file.path);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file.path, file.content);
    console.log(`✅ Created: ${file.path}`);
  }

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

function createApiTypes(featureName: string, modelName: string): string {
  const ModelName = pascalCase(modelName);
  const camelModelName = camelCase(modelName);
  const camelFeatureName = camelCase(featureName);

  return `import { z } from "zod";
import type { ${ModelName} } from "@prisma/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";

// Router output types
type RouterOutput = inferRouterOutputs<AppRouter>;
export type ${featureName}Output = RouterOutput["${camelModelName}"];

// Input schemas
export const create${featureName}Schema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  // Add more fields as needed
});

export const update${featureName}Schema = create${featureName}Schema.partial();

// Filter schema for list queries
export const ${camelFeatureName}FilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(["createdAt", "name", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Types
export type Create${featureName}Input = z.infer<typeof create${featureName}Schema>;
export type Update${featureName}Input = z.infer<typeof update${featureName}Schema>;
export type ${featureName}Filter = z.infer<typeof ${camelFeatureName}FilterSchema>;

// Extended types
export type ${featureName}WithRelations = ${ModelName} & {
  // Add relations here
  _count?: {
    // Add count fields
  };
};`;
}

function createApiHooks(camelName: string, featureName: string): string {
  const PascalName = pascalCase(camelName);

  return `import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { Create${PascalName}Input, Update${PascalName}Input } from "../types";

// Custom hooks for ${camelName} feature
export function use${PascalName}List(filters?: any) {
  return api.${camelName}.list.useQuery({ filters });
}

export function use${PascalName}(id: string) {
  return api.${camelName}.getById.useQuery(
    { id },
    { enabled: !!id }
  );
}

export function useCreate${PascalName}() {
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

export function useUpdate${PascalName}() {
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

export function useDelete${PascalName}() {
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
}`;
}

async function createFeaturePages(
  featureName: string,
  camelName: string,
  kebabName: string,
  dryRun: boolean
): Promise<FileToGenerate[]> {
  const pages: FileToGenerate[] = [];
  const appPagesDir = path.join(process.cwd(), "src", "app", kebabName);

  // List page
  const listPagePath = path.join(appPagesDir, "page.tsx");
  const listPageContent = await formatCode(`import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth-compat";
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
}`);
  pages.push({ path: listPagePath, content: listPageContent });

  // New/Create page
  const newPagePath = path.join(appPagesDir, "new", "page.tsx");
  const newPageContent = await formatCode(`import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth-compat";
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
}`);
  pages.push({ path: newPagePath, content: newPageContent });

  // Detail page
  const detailPagePath = path.join(appPagesDir, "[id]", "page.tsx");
  const detailPageContent = await formatCode(`import { notFound, redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth-compat";
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
        <Link href="/${kebabName}/\${item.id}/edit">
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
}`);
  pages.push({ path: detailPagePath, content: detailPageContent });

  // Edit page
  const editPagePath = path.join(appPagesDir, "[id]", "edit", "page.tsx");
  const editPageContent = await formatCode(`import { notFound, redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth-compat";
import { api } from "~/trpc/server";
import { ${featureName}Form } from "~/features/${kebabName}/components/${kebabName}-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function Edit${featureName}Page({ params }: PageProps) {
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
      <div className="flex items-center gap-4">
        <Link href="/${kebabName}/\${params.id}">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit ${featureName}</CardTitle>
        </CardHeader>
        <CardContent>
          <${featureName}Form defaultValues={item} />
        </CardContent>
      </Card>
    </div>
  );
}`);
  pages.push({ path: editPagePath, content: editPageContent });

  return pages;
}

function createFeatureIndex(
  featureName: string,
  camelName: string,
  kebabName: string,
  options: FeatureOptions
): string {
  const exports: string[] = [];

  if (options.includeUi) {
    exports.push(`export * from "./components";`);
  }

  if (options.includeApi) {
    exports.push(`export * from "./hooks";`);
    exports.push(`export * from "./types";`);
  }

  exports.push(`export * from "./utils";`);

  return `// ${featureName} Feature
${exports.join("\n")}

// Feature metadata
export const ${camelName}Feature = {
  name: "${featureName}",
  path: "/${kebabName}",
  icon: "FileText", // Change this to appropriate icon
  description: "Manage ${featureName}",
};`;
}

function createFeatureReadme(
  featureName: string,
  camelName: string,
  kebabName: string,
  options: FeatureOptions
): string {
  return `# ${featureName} Feature

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

${options.includeApi ? `- \`${camelName}.create\` - Create a new item
- \`${camelName}.list\` - List all items
- \`${camelName}.getById\` - Get single item
- \`${camelName}.update\` - Update an item
- \`${camelName}.delete\` - Delete an item` : 'No API endpoints generated for this feature.'}

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
\`\`\``;
}

function createComponentsIndex(kebabName: string): string {
  return `export * from "./${kebabName}-list";
export * from "./${kebabName}-form";
export * from "./${kebabName}-card";`;
}