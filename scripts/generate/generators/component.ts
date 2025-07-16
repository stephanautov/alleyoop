import fs from "fs/promises";
import path from "path";
import { formatCode } from "../utils";

interface ComponentOptions {
    type?: "component" | "page" | "form";
    dir?: string;
}

export async function generateComponent(name: string, options: ComponentOptions) {
    const componentName = name.charAt(0).toUpperCase() + name.slice(1);
    const componentType = options.type || "component";

    // Determine the directory
    let baseDir = path.join(process.cwd(), "src");
    if (componentType === "page") {
        baseDir = path.join(baseDir, "app");
    } else {
        baseDir = path.join(baseDir, "components");
    }

    if (options.dir) {
        baseDir = path.join(baseDir, options.dir);
    }

    // Create component directory
    const componentDir = path.join(baseDir, kebabCase(name));
    await fs.mkdir(componentDir, { recursive: true });

    // Generate component content based on type
    let componentContent: string;
    let componentPath: string;

    switch (componentType) {
        case "page":
            componentContent = generatePageComponent(componentName);
            componentPath = path.join(componentDir, "page.tsx");
            break;
        case "form":
            componentContent = generateFormComponent(componentName);
            componentPath = path.join(componentDir, `${kebabCase(name)}-form.tsx`);
            break;
        default:
            componentContent = generateDefaultComponent(componentName);
            componentPath = path.join(componentDir, `${kebabCase(name)}.tsx`);
    }

    // Write component file
    await fs.writeFile(componentPath, await formatCode(componentContent));

    // Generate test file
    const testContent = generateComponentTest(componentName, componentType);
    const testPath = path.join(componentDir, `${kebabCase(name)}.test.tsx`);
    await fs.writeFile(testPath, await formatCode(testContent));

    // Generate stories file (for components only)
    if (componentType === "component") {
        const storiesContent = generateComponentStories(componentName);
        const storiesPath = path.join(componentDir, `${kebabCase(name)}.stories.tsx`);
        await fs.writeFile(storiesPath, await formatCode(storiesContent));
    }

    // Create index file for easier imports
    const indexContent = `export * from "./${kebabCase(name)}";`;
    const indexPath = path.join(componentDir, "index.ts");
    await fs.writeFile(indexPath, indexContent);
}

function generateDefaultComponent(name: string): string {
    return `import { cn } from "~/lib/utils";

export interface ${name}Props {
  className?: string;
  children?: React.ReactNode;
}

export function ${name}({ className, children, ...props }: ${name}Props) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}
`;
}

function generatePageComponent(name: string): string {
    return `import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export default async function ${name}Page() {
  const session = await getServerAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  // Fetch data using tRPC
  // const data = await api.example.getAll.query();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">${humanize(name)}</h1>
        <p className="text-muted-foreground">
          Page description goes here
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Your content here</p>
        </CardContent>
      </Card>
    </div>
  );
}
`;
}

function generateFormComponent(name: string): string {
    const formName = name.replace(/Form$/, "");

    return `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";

// Define your schema
const ${formName.toLowerCase()}Schema = z.object({
  name: z.string().min(1, "Name is required"),
  // Add more fields as needed
});

type ${formName}FormData = z.infer<typeof ${formName.toLowerCase()}Schema>;

export interface ${name}Props {
  onSuccess?: (data: ${formName}FormData) => void;
  defaultValues?: Partial<${formName}FormData>;
}

export function ${name}({ onSuccess, defaultValues }: ${name}Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<${formName}FormData>({
    resolver: zodResolver(${formName.toLowerCase()}Schema),
    defaultValues: defaultValues || {
      name: "",
    },
  });

  // Example mutation
  // const createMutation = api.example.create.useMutation({
  //   onSuccess: (data) => {
  //     toast.success("Created successfully!");
  //     onSuccess?.(data);
  //     router.refresh();
  //   },
  //   onError: (error) => {
  //     toast.error(error.message || "Something went wrong");
  //   },
  // });

  const onSubmit = async (data: ${formName}FormData) => {
    setIsSubmitting(true);
    try {
      // await createMutation.mutateAsync(data);
      console.log("Form data:", data);
      toast.success("Success!");
      onSuccess?.(data);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter name" {...field} />
              </FormControl>
              <FormDescription>
                This is the name that will be displayed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
`;
}

function generateComponentTest(name: string, type: string): string {
    const testName = type === "page" ? `${name}Page` : name;

    return `import { render, screen } from "@testing-library/react";
import { ${testName} } from "./${kebabCase(name)}";

describe("${testName}", () => {
  it("renders without crashing", () => {
    render(<${testName} />);
    // Add specific assertions based on your component
  });

  // Add more tests as needed
});
`;
}

function generateComponentStories(name: string): string {
    return `import type { Meta, StoryObj } from "@storybook/react";
import { ${name} } from "./${kebabCase(name)}";

const meta = {
  title: "Components/${name}",
  component: ${name},
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    // Define your argTypes here
  },
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Default props
  },
};

export const WithCustomClass: Story = {
  args: {
    className: "bg-gray-100 p-4 rounded",
  },
};
`;
}

// Utility functions
function kebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
}

function humanize(str: string): string {
    return str
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
}