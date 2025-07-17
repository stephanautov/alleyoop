// scripts/generate/generators/document-type.ts

import fs from "fs/promises";
import path from "path";
import { formatCode, constantCase, pascalCase, camelCase, kebabCase } from "../utils";

interface DocumentTypeOptions {
  description: string;
  sections: string[];
  exportFormats: string[];
  dryRun?: boolean;
}

interface FileToGenerate {
  path: string;
  content: string;
}

export async function generateDocumentType(name: string, options: DocumentTypeOptions) {
  const typeName = constantCase(name);
  const pascalName = pascalCase(name);
  const camelName = camelCase(name);
  const kebabName = kebabCase(name);

  console.log(`📄 Generating document type: ${typeName}`);

  // Collect all files to generate
  const filesToGenerate: FileToGenerate[] = [];

  // 1. Document schema file
  const schemaPath = path.join(
    process.cwd(),
    "src",
    "config",
    "schemas",
    `${kebabName}.ts`
  );
  const schemaContent = await formatCode(createDocumentSchema(camelName, pascalName, options));
  filesToGenerate.push({ path: schemaPath, content: schemaContent });

  // 2. Prompt templates
  const promptDir = path.join(process.cwd(), "src", "lib", "ai", "prompts", kebabName);

  // Outline prompt
  const outlinePromptPath = path.join(promptDir, "outline.md");
  const outlinePromptContent = createOutlinePrompt(pascalName, options);
  filesToGenerate.push({ path: outlinePromptPath, content: outlinePromptContent });

  // Section prompt
  const sectionPromptPath = path.join(promptDir, "section.md");
  const sectionPromptContent = createSectionPrompt(pascalName, options);
  filesToGenerate.push({ path: sectionPromptPath, content: sectionPromptContent });

  // 3. Form configuration
  const formConfigPath = path.join(
    process.cwd(),
    "src",
    "config",
    "forms",
    `${kebabName}.ts`
  );
  const formConfigContent = await formatCode(createFormConfig(camelName, pascalName));
  filesToGenerate.push({ path: formConfigPath, content: formConfigContent });

  // 4. AI service update instructions
  const instructionsPath = path.join(promptDir, "UPDATE_AI_SERVICE.md");
  const instructionsContent = createAIServiceInstructions(typeName, pascalName);
  filesToGenerate.push({ path: instructionsPath, content: instructionsContent });

  // Handle dry-run mode
  if (options.dryRun) {
    // Output what would be created
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

    // Show what would be updated
    console.log(`\nWould update: prisma/schema.prisma`);
    console.log(`Would add to DocumentType enum: ${typeName}`);

    console.log(`\nWould update: src/config/documents.ts`);
    console.log(`Would import: ${camelName}Schema from "./schemas/${kebabName}"`);
    console.log(`Would add config entry: [DocumentType.${typeName}]: { ... }`);

    console.log(`\nWould update: .env.example`);
    console.log(`Would add: ENABLE_${typeName}="false"`);

    console.log(`\nWould update: .env.local (if exists)`);
    console.log(`Would add: ENABLE_${typeName}="false"`);

    console.log(`\n📝 Next steps after generation:`);
    console.log(`1. Run 'npm run db:push' to update the database`);
    console.log(`2. Set ENABLE_${typeName}="true" in your .env file`);
    console.log(`3. Add ENABLE_${typeName} to src/env.js schema`);
    console.log(`4. Customize the prompt templates in src/lib/ai/prompts/${kebabName}/`);
    console.log(`5. Test the new document type in the UI`);

    return;
  }

  // Actually create files
  for (const file of filesToGenerate) {
    const dir = path.dirname(file.path);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file.path, file.content);
    console.log(`✓ Created: ${file.path}`);
  }

  // Update existing files
  await updatePrismaSchema(typeName, options);
  await updateDocumentConfig(typeName, pascalName, camelName, options);
  await addEnvironmentVariable(typeName, options);

  console.log(`✅ Document type ${name} generated successfully!`);
  console.log(`\n📝 Next steps:`);
  console.log(`1. Run 'npm run db:push' to update the database`);
  console.log(`2. Set ENABLE_${typeName}="true" in your .env file`);
  console.log(`3. Add ENABLE_${typeName} to src/env.js schema`);
  console.log(`4. Customize the prompt templates in src/lib/ai/prompts/${kebabName}/`);
  console.log(`5. Test the new document type in the UI`);
}

async function updatePrismaSchema(typeName: string, options: { dryRun?: boolean }) {
  if (options.dryRun) return; // Skip in dry-run mode

  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

  try {
    let content = await fs.readFile(schemaPath, "utf-8");

    // Find the DocumentType enum
    const enumRegex = /enum DocumentType\s*{([^}]*)}/;
    const match = content.match(enumRegex);

    if (match) {
      const existingTypes = match[1];
      if (!existingTypes.includes(typeName)) {
        const updatedTypes = existingTypes.trimEnd() + `\n  ${typeName}`;
        content = content.replace(enumRegex, `enum DocumentType {${updatedTypes}\n}`);
        await fs.writeFile(schemaPath, content);
        console.log(`✓ Updated Prisma schema with ${typeName}`);
      }
    }
  } catch (error) {
    console.warn("Could not update Prisma schema automatically. Please add the type manually.");
  }
}

async function updateDocumentConfig(
  typeName: string,
  pascalName: string,
  camelName: string,
  options: DocumentTypeOptions & { dryRun?: boolean }
) {
  if (options.dryRun) return; // Skip in dry-run mode

  const configPath = path.join(process.cwd(), "src", "config", "documents.ts");

  try {
    let content = await fs.readFile(configPath, "utf-8");

    // Add import for the new schema
    const schemaImport = `${camelName}Schema`;
    if (!content.includes(schemaImport)) {
      const lastImportIndex = content.lastIndexOf("} from");
      const importLine = content.substring(0, content.indexOf("\n", lastImportIndex));
      const updatedImport = importLine.replace("}", `, ${schemaImport} }`);
      content = content.replace(importLine, updatedImport);
    }

    // Add document configuration
    const configEntry = `  [DocumentType.${typeName}]: {
    schema: ${schemaImport},
    name: "${pascalName.replace(/([A-Z])/g, ' $1').trim()}",
    description: "${options.description}",
    icon: "FileText",
    enabled: env.ENABLE_${typeName},
    sections: [
${options.sections.map((section, index) =>
      `      { id: "${kebabCase(section)}", name: "${section}", order: ${index + 1} },`
    ).join('\n')}
    ],
    exportFormats: [${options.exportFormats.map(f => `"${f}"`).join(", ")}],
    estimatedTokens: {
      short: 2000,
      medium: 4000,
      long: 8000,
    },
  },`;

    // Find the DOCUMENT_CONFIGS object
    const configRegex = /export const DOCUMENT_CONFIGS = {([^}]+)}\s*as const;/s;
    const configMatch = content.match(configRegex);

    if (configMatch) {
      const existingConfigs = configMatch[1];
      const updatedConfigs = existingConfigs.trimEnd() + '\n' + configEntry;
      content = content.replace(configRegex, `export const DOCUMENT_CONFIGS = {${updatedConfigs}\n} as const;`);
      await fs.writeFile(configPath, await formatCode(content));
      console.log(`✓ Updated document configuration`);
    }
  } catch (error) {
    console.warn("Could not update document config automatically. Please add it manually.");
  }
}

async function addEnvironmentVariable(typeName: string, options: { dryRun?: boolean }) {
  if (options.dryRun) return; // Skip in dry-run mode

  const envExamplePath = path.join(process.cwd(), ".env.example");
  const envLocalPath = path.join(process.cwd(), ".env.local");
  const envLine = `ENABLE_${typeName}="false"\n`;

  try {
    // Update .env.example
    if (await fs.access(envExamplePath).then(() => true).catch(() => false)) {
      const content = await fs.readFile(envExamplePath, "utf-8");
      if (!content.includes(`ENABLE_${typeName}`)) {
        await fs.appendFile(envExamplePath, envLine);
        console.log(`✓ Added ENABLE_${typeName} to .env.example`);
      }
    }

    // Update .env.local
    if (await fs.access(envLocalPath).then(() => true).catch(() => false)) {
      const content = await fs.readFile(envLocalPath, "utf-8");
      if (!content.includes(`ENABLE_${typeName}`)) {
        await fs.appendFile(envLocalPath, envLine);
        console.log(`✓ Added ENABLE_${typeName} to .env.local`);
      }
    }
  } catch (error) {
    console.warn("Could not update environment files automatically.");
  }

  console.log(`📝 Remember to add ENABLE_${typeName} to src/env.js schema`);
}

// Content generation functions
function createDocumentSchema(camelName: string, pascalName: string, options: DocumentTypeOptions): string {
  return `import { z } from "zod";
import { baseDocumentSchema } from "./base";

export const ${camelName}Schema = baseDocumentSchema.extend({
  // Document-specific fields
  subject: z.object({
    name: z.string().min(1),
    // Add more subject fields as needed
  }),
  
  // Sections to include
  sections: z.array(z.enum([
${options.sections.map(section => `    "${kebabCase(section)}",`).join('\n')}
  ])).default([${options.sections.map(section => `"${kebabCase(section)}"`).join(", ")}]),
  
  // Document-specific options
  format: z.enum(["standard", "detailed", "summary"]).default("standard"),
  includeReferences: z.boolean().default(true),
  
  // Add more fields specific to ${pascalName} documents
});

export type ${pascalName}Input = z.infer<typeof ${camelName}Schema>;`;
}

function createOutlinePrompt(pascalName: string, options: DocumentTypeOptions): string {
  return `# ${pascalName} Document Outline Prompt

You are an expert at creating comprehensive ${pascalName.toLowerCase()} documents. 
Generate a detailed outline for a ${pascalName.toLowerCase()} with the following sections:

${options.sections.map(section => `- ${section}`).join('\n')}

## Input Details:
{{input}}

## Requirements:
1. Create a clear, logical structure
2. Ensure all sections flow naturally
3. Include key points for each section
4. Estimate word count for each section based on the requested length
5. Maintain professional tone and structure

## Output Format:
Return a JSON object with the following structure:
{
  "sections": [
    {
      "id": "section-id",
      "title": "Section Title",
      "description": "Brief description of section content",
      "keyPoints": ["Key point 1", "Key point 2"],
      "estimatedWords": 500
    }
  ]
}`;
}

function createSectionPrompt(pascalName: string, options: DocumentTypeOptions): string {
  return `# ${pascalName} Section Generation Prompt

Generate the "{{sectionName}}" section for a ${pascalName.toLowerCase()} document.

## Document Context:
{{outline}}

## Current Section:
{{currentSection}}

## Input Details:
{{input}}

## Requirements:
1. Write approximately {{targetWords}} words
2. Follow the outline structure
3. Include all key points mentioned
4. Maintain consistent tone and style
5. Use appropriate formatting (paragraphs, lists where suitable)
6. Ensure smooth transitions

Write the complete section content:`;
}

function createFormConfig(camelName: string, pascalName: string): string {
  return `// Form configuration for ${pascalName} documents
import { DocumentType } from "@prisma/client";

export const ${camelName}FormConfig = {
  title: {
    placeholder: "Enter a descriptive title for your ${pascalName.toLowerCase()}",
    description: "This will be the main title of your document",
  },
  outputLength: {
    label: "Document Length",
    description: "Choose how detailed you want the document to be",
  },
  subject: {
    label: "Subject Information",
    description: "Basic information about the ${pascalName.toLowerCase()} subject",
  },
  sections: {
    label: "Sections to Include",
    description: "Select which sections to include in your document",
    multiple: true,
  },
  format: {
    label: "Document Format",
    description: "Choose the format style for your document",
  },
  includeReferences: {
    label: "Include References",
    description: "Add reference section at the end of the document",
  },
  // Add more field configurations as needed
};

// Add this to getFieldConfig() in src/app/documents/new/page.tsx:
// [DocumentType.${typeName}]: {
//   ...commonConfig,
//   ...${camelName}FormConfig,
// },`;
}

function createAIServiceInstructions(typeName: string, pascalName: string): string {
  return `# AI Service Update Instructions

To complete the ${pascalName} document type integration, update the AI service:

## 1. Update src/lib/ai/index.ts

Add to \`getOutlineSystemPrompt()\`:
\`\`\`typescript
[DocumentType.${typeName}]: "\\n\\nFor ${pascalName.toLowerCase()} documents, ensure the outline includes clear structure for each section with appropriate depth and detail.",
\`\`\`

Add to \`getSectionSystemPrompt()\`:
\`\`\`typescript
[DocumentType.${typeName}]: "\\n\\nFor ${pascalName.toLowerCase()} documents, maintain professional tone and ensure each section builds upon previous content.",
\`\`\`

## 2. Update src/env.js

Add to the schema:
\`\`\`javascript
ENABLE_${typeName}: z.string().transform((val) => val === "true"),
\`\`\`

## 3. Test the Integration

1. Set \`ENABLE_${typeName}="true"\` in your .env file
2. Run \`npm run db:push\` to update the database
3. Navigate to /documents/new and select ${pascalName} type
4. Test document generation

## 4. Customize Prompts

Edit the prompt templates in this directory to refine the AI behavior for ${pascalName} documents.`;
}