import fs from "fs/promises";
import path from "path";
import { formatCode, constantCase, pascalCase, camelCase, kebabCase } from "../utils";

interface DocumentTypeOptions {
  description: string;
  sections: string[];
  exportFormats: string[];
}

export async function generateDocumentType(name: string, options: DocumentTypeOptions) {
  const typeName = constantCase(name);
  const pascalName = pascalCase(name);
  const camelName = camelCase(name);
  const kebabName = kebabCase(name);

  console.log(`📄 Generating document type: ${typeName}`);

  // 1. Update Prisma schema
  await updatePrismaSchema(typeName);

  // 2. Update document configuration
  await updateDocumentConfig(typeName, pascalName, options);

  // 3. Create schema file
  await createDocumentSchema(camelName, pascalName, options);

  // 4. Create prompt templates
  await createPromptTemplates(kebabName, pascalName, options);

  // 5. Update AI service
  await updateAIService(typeName, pascalName);

  // 6. Create form configuration
  await createFormConfig(camelName, pascalName);

  // 7. Add environment variable
  await addEnvironmentVariable(typeName);

  console.log(`✅ Document type ${name} generated successfully!`);
  console.log(`\n📝 Next steps:`);
  console.log(`1. Run 'npm run db:push' to update the database`);
  console.log(`2. Set ENABLE_${typeName}="true" in your .env file`);
  console.log(`3. Customize the prompt templates in src/lib/ai/prompts/${kebabName}/`);
  console.log(`4. Test the new document type in the UI`);
}

async function updatePrismaSchema(typeName: string) {
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

async function updateDocumentConfig(typeName: string, pascalName: string, options: DocumentTypeOptions) {
  const configPath = path.join(process.cwd(), "src", "config", "documents.ts");
  
  try {
    let content = await fs.readFile(configPath, "utf-8");
    
    // Add import for the new schema
    const schemaImport = `${camelCase(pascalName)}Schema`;
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

async function createDocumentSchema(camelName: string, pascalName: string, options: DocumentTypeOptions) {
  const schemaContent = `import { z } from "zod";
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

export type ${pascalName}Input = z.infer<typeof ${camelName}Schema>;
`;

  const schemaPath = path.join(
    process.cwd(),
    "src",
    "config",
    "schemas",
    `${kebabCase(pascalName)}.ts`
  );
  
  await fs.mkdir(path.dirname(schemaPath), { recursive: true });
  await fs.writeFile(schemaPath, await formatCode(schemaContent));
  console.log(`✓ Created document schema`);
}

async function createPromptTemplates(kebabName: string, pascalName: string, options: DocumentTypeOptions) {
  const promptDir = path.join(process.cwd(), "src", "lib", "ai", "prompts", kebabName);
  await fs.mkdir(promptDir, { recursive: true });
  
  // Create outline prompt
  const outlinePrompt = `# ${pascalName} Document Outline Prompt

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
}
`;

  await fs.writeFile(
    path.join(promptDir, "outline.md"),
    outlinePrompt
  );
  
  // Create section prompt
  const sectionPrompt = `# ${pascalName} Section Generation Prompt

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

Write the complete section content:
`;

  await fs.writeFile(
    path.join(promptDir, "section.md"),
    sectionPrompt
  );
  
  console.log(`✓ Created prompt templates`);
}

async function updateAIService(typeName: string, pascalName: string) {
  console.log(`✓ AI service update: Add ${typeName} case to getOutlineSystemPrompt() and getSectionSystemPrompt()`);
  
  // In a real implementation, we could automatically update the AI service file
  // For now, we'll just provide instructions
  const instructions = `
// Add to getOutlineSystemPrompt() in src/lib/ai/index.ts:
[DocumentType.${typeName}]: "\\n\\nFor ${pascalName.toLowerCase()} documents, ensure the outline [specific instructions]",

// Add to buildOutlinePrompt() and buildSectionPrompt() as needed
`;
  
  const instructionsPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "ai",
    "prompts",
    kebabCase(pascalName),
    "UPDATE_AI_SERVICE.md"
  );
  
  await fs.writeFile(instructionsPath, instructions);
}

async function createFormConfig(camelName: string, pascalName: string) {
  const formConfigContent = `// Form configuration for ${pascalName} documents
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
// },
`;

  const configPath = path.join(
    process.cwd(),
    "src",
    "config",
    "forms",
    `${kebabCase(pascalName)}.ts`
  );
  
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, await formatCode(formConfigContent));
  console.log(`✓ Created form configuration`);
}

async function addEnvironmentVariable(typeName: string) {
  const envExamplePath = path.join(process.cwd(), ".env.example");
  const envLocalPath = path.join(process.cwd(), ".env.local");
  
  const envLine = `ENABLE_${typeName}="false"\n`;
  
  try {
    // Update .env.example
    if (await fs.access(envExamplePath).then(() => true).catch(() => false)) {
      const content = await fs.readFile(envExamplePath, "utf-8");
      if (!content.includes(`ENABLE_${typeName}`)) {
        await fs.appendFile(envExamplePath, envLine);
      }
    }
    
    // Update .env.local
    if (await fs.access(envLocalPath).then(() => true).catch(() => false)) {
      const content = await fs.readFile(envLocalPath, "utf-8");
      if (!content.includes(`ENABLE_${typeName}`)) {
        await fs.appendFile(envLocalPath, envLine);
      }
    }
    
    console.log(`✓ Added ENABLE_${typeName} to environment files`);
  } catch (error) {
    console.warn("Could not update environment files automatically.");
  }
  
  // Also update env.js schema
  console.log(`📝 Remember to add ENABLE_${typeName} to src/env.js schema`);
}