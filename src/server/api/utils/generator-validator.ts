// src/server/api/utils/generator-validator.ts

import fs from "fs/promises";
import path from "path";

export interface ValidationResult {
  valid: boolean;
  conflicts: string[];
  warnings: string[];
  suggestions: string[];
}

export async function validateGeneration(
  type: string,
  name: string,
  options: Record<string, any>,
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    conflicts: [],
    warnings: [],
    suggestions: [],
  };

  // Validate name format
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
    result.valid = false;
    result.warnings.push(
      "Name should start with a letter and contain only alphanumeric characters",
    );
  }

  // Check reserved words
  const reservedWords = [
    "class",
    "function",
    "const",
    "let",
    "var",
    "return",
    "export",
    "import",
  ];
  if (reservedWords.includes(name.toLowerCase())) {
    result.valid = false;
    result.warnings.push(`"${name}" is a reserved word`);
  }

  // Type-specific validation
  switch (type) {
    case "router":
      await validateRouter(name, options, result);
      break;
    case "component":
      await validateComponent(name, options, result);
      break;
    case "feature":
      await validateFeature(name, options, result);
      break;
  }

  return result;
}

async function validateRouter(
  name: string,
  options: Record<string, any>,
  result: ValidationResult,
): Promise<void> {
  const routerPath = path.join(
    process.cwd(),
    "src/server/api/routers",
    `${name}.ts`,
  );

  // Check if router already exists
  if (await fileExists(routerPath)) {
    result.conflicts.push(`Router already exists: ${routerPath}`);
    result.valid = false;
  }

  // Check if model exists in Prisma schema
  if (options.model) {
    const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
    try {
      const schema = await fs.readFile(schemaPath, "utf-8");
      if (!schema.includes(`model ${options.model}`)) {
        result.warnings.push(
          `Model "${options.model}" not found in Prisma schema`,
        );
        result.suggestions.push(
          `Run "npm run db:push" after creating the model`,
        );
      }
    } catch {
      result.warnings.push("Could not read Prisma schema");
    }
  }

  // Suggest naming conventions
  if (name.includes("_") || name.includes("-")) {
    result.suggestions.push(
      "Use camelCase for router names (e.g., userProfile instead of user_profile)",
    );
  }
}

async function validateComponent(
  name: string,
  options: Record<string, any>,
  result: ValidationResult,
): Promise<void> {
  // Check naming conventions
  const firstChar = name.charAt(0);
  if (firstChar && firstChar !== firstChar.toUpperCase()) {
    result.warnings.push("Component names should start with uppercase letter");
    result.suggestions.push(
      `Consider renaming to ${firstChar.toUpperCase() + name.slice(1)}`,
    );
  }

  // Check if component directory already exists
  const baseDir = options.type === "page" ? "src/app" : "src/components";
  const componentDir = path.join(
    process.cwd(),
    baseDir,
    options.dir || "",
    name,
  );

  if (await fileExists(componentDir)) {
    const files = await fs.readdir(componentDir);
    if (files.length > 0) {
      result.conflicts.push(
        `Component directory already exists with ${files.length} files`,
      );
      result.valid = false;
    }
  }
}

async function validateFeature(
  name: string,
  options: Record<string, any>,
  result: ValidationResult,
): Promise<void> {
  const featureDir = path.join(process.cwd(), "src/features", name);

  if (await fileExists(featureDir)) {
    result.conflicts.push(`Feature directory already exists: ${featureDir}`);
    result.valid = false;
  }

  // Check dependencies
  if (options.includeApi && !options.model) {
    result.suggestions.push(
      "Consider specifying a Prisma model for API generation",
    );
  }

  if (options.includeTests) {
    // Check if testing dependencies are installed
    try {
      await import("@testing-library/react");
    } catch {
      result.warnings.push(
        "Testing library not found. Run: npm install -D @testing-library/react",
      );
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
