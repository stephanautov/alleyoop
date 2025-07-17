//scripts/generate/utils.ts

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Format code using Prettier
 */
export async function formatCode(code: string): Promise<string> {
  try {
    // Try to use project's prettier
    const { stdout } = await execAsync(
      `echo '${code.replace(/'/g, "\\'")}' | npx prettier --stdin-filepath file.ts`,
    );
    return stdout;
  } catch (error) {
    // If prettier fails, return unformatted code
    console.warn("Failed to format code with Prettier:", error);
    return code;
  }
}

/**
 * Convert string to kebab-case
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Convert string to PascalCase
 */
export function pascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toUpperCase() : word.toUpperCase();
    })
    .replace(/[\s-_]+/g, "");
}

/**
 * Convert string to camelCase
 */
export function camelCase(str: string): string {
  const pascal = pascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert string to CONSTANT_CASE
 */
export function constantCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

/**
 * Humanize a string (e.g., "myVariableName" -> "My Variable Name")
 */
export function humanize(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim();
}

/**
 * Generate import statements from a list of imports
 */
export function generateImports(
  imports: Array<{ from: string; items: string[] }>,
): string {
  return imports
    .map(({ from, items }) => {
      if (items.length === 1 && items[0]?.startsWith("* as ")) {
        return `import ${items[0]} from "${from}";`;
      }
      return `import { ${items.join(", ")} } from "${from}";`;
    })
    .join("\n");
}

/**
 * Check if a string is a valid TypeScript identifier
 */
export function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * Escape a string for use in a template literal
 */
export function escapeTemplate(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

/**
 * Generate a TypeScript interface from a simple object
 */
export function generateInterface(
  name: string,
  obj: Record<string, any>,
): string {
  const props = Object.entries(obj)
    .map(([key, value]) => {
      let type = "any";
      if (typeof value === "string") type = "string";
      else if (typeof value === "number") type = "number";
      else if (typeof value === "boolean") type = "boolean";
      else if (Array.isArray(value)) type = "any[]";
      else if (value === null) type = "null";
      else if (typeof value === "object") type = "Record<string, any>";

      return `  ${key}: ${type};`;
    })
    .join("\n");

  return `export interface ${name} {\n${props}\n}`;
}

/**
 * Create a file header comment
 */
export function createFileHeader(description?: string): string {
  const header = [
    "/**",
    " * @generated",
    ` * Generated on ${new Date().toISOString()}`,
  ];

  if (description) {
    header.push(" *", ` * ${description}`);
  }

  header.push(" */");

  return header.join("\n");
}

/**
 * Ensure a string ends with a specific suffix
 */
export function ensureSuffix(str: string, suffix: string): string {
  if (!str.endsWith(suffix)) {
    return str + suffix;
  }
  return str;
}

/**
 * Ensure a string starts with a specific prefix
 */
export function ensurePrefix(str: string, prefix: string): string {
  if (!str.startsWith(prefix)) {
    return prefix + str;
  }
  return str;
}

/**
 * Create a barrel export file content
 */
export function createBarrelExport(exports: string[]): string {
  return exports.map((exp) => `export * from "./${exp}";`).join("\n");
}

/**
 * Parse a Zod schema to extract field information
 * This is a simplified version - you might want to expand this
 */
export function parseZodSchema(
  schemaString: string,
): Array<{ name: string; type: string; optional: boolean }> {
  const fields: Array<{ name: string; type: string; optional: boolean }> = [];

  // Simple regex-based parsing (not comprehensive)
  const fieldRegex = /(\w+):\s*z\.(\w+)\(\)([^,}]*)/g;
  let match;

  while ((match = fieldRegex.exec(schemaString)) !== null) {
    const [, name, type, modifiers] = match;
    fields.push({
      name: name ?? "",
      type: type ?? "",
      optional: (modifiers ?? "").includes(".optional()"),
    });
  }

  return fields;
}

/**
 * Generate a sample value for a given type
 */
export function generateSampleValue(type: string): any {
  switch (type) {
    case "string":
      return "example";
    case "number":
      return 42;
    case "boolean":
      return true;
    case "date":
      return new Date().toISOString();
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Log with color in terminal
 */
export const log = {
  info: (message: string) => console.log(`\x1b[36m${message}\x1b[0m`),
  success: (message: string) => console.log(`\x1b[32m${message}\x1b[0m`),
  warning: (message: string) => console.log(`\x1b[33m${message}\x1b[0m`),
  error: (message: string) => console.log(`\x1b[31m${message}\x1b[0m`),
};
