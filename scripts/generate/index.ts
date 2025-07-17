#!/usr/bin/env tsx
/**
 * scripts/generate/index.ts
 * Code Generation Scripts for DocuForge
 * Rapidly generate boilerplate code for common patterns
 */

import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { generateComponent } from "./generators/component";
import { generateDocumentType } from "./generators/document-type";
import { generateFeature } from "./generators/feature";
import { generateRouter } from "./generators/router";
import { generateTest } from "./generators/test";

const program = new Command();

program
  .name("generate")
  .description("Generate boilerplate code for DocuForge")
  .version("1.0.0");

// Generate a new tRPC router
program
  .command("router <name>")
  .description("Generate a new tRPC router with CRUD operations")
  .option("-m, --model <model>", "Prisma model name")
  .option("-c, --crud", "Include CRUD operations", true)
  .option("--no-crud", "Exclude CRUD operations")
  .action(async (name: string, options: { model?: string; crud?: boolean }) => {
    console.log(chalk.blue(`🔧 Generating router: ${name}`));
    await generateRouter(name, options);
    console.log(chalk.green(`✅ Router ${name} generated successfully!`));
  });

// Generate a new React component
program
  .command("component <name>")
  .description("Generate a new React component")
  .option(
    "-t, --type <type>",
    "Component type (page, component, form)",
    "component",
  )
  .option("-d, --dir <dir>", "Directory to create component in")
  .action(async (name: string, options) => {
    console.log(chalk.blue(`🎨 Generating component: ${name}`));
    await generateComponent(name, options);
    console.log(chalk.green(`✅ Component ${name} generated successfully!`));
  });

// Generate a new document type
program
  .command("document-type <name>")
  .description("Generate a complete document type with all infrastructure")
  .option(
    "--answers <json>",
    "Provide answers as JSON (for non-interactive mode)",
  )
  .action(async (name: string, options: { answers?: string }) => {
    console.log(chalk.blue(`📄 Generating document type: ${name}`));

    let answers;
    if (options.answers) {
      // Parse answers from JSON for API mode
      try {
        answers = JSON.parse(options.answers);
      } catch (error) {
        console.error(chalk.red("Invalid JSON provided for answers"));
        process.exit(1);
      }
    } else {
      // Interactive mode
      answers = await inquirer.prompt([
        {
          type: "input",
          name: "description",
          message: "Document type description:",
        },
        {
          type: "checkbox",
          name: "sections",
          message: "Select sections to include:",
          choices: [
            "Introduction",
            "Background",
            "Main Content",
            "Analysis",
            "Conclusion",
            "References",
            "Appendix",
          ],
        },
        {
          type: "checkbox",
          name: "exportFormats",
          message: "Select export formats:",
          choices: ["pdf", "docx", "markdown", "html", "txt"],
          default: ["pdf", "docx"],
        },
      ]);
    }

    await generateDocumentType(name, answers);
    console.log(
      chalk.green(`✅ Document type ${name} generated successfully!`),
    );
  });

// Generate tests
program
  .command("test <path>")
  .description("Generate tests for a component or function")
  .option("-t, --type <type>", "Test type (unit, integration, e2e)", "unit")
  .action(async (path: string, options) => {
    console.log(chalk.blue(`🧪 Generating tests for: ${path}`));
    await generateTest(path, options);
    console.log(chalk.green(`✅ Tests generated successfully!`));
  });

// Generate complete feature
program
  .command("feature <name>")
  .description("Generate a complete feature with API, UI, and tests")
  .option(
    "--answers <json>",
    "Provide answers as JSON (for non-interactive mode)",
  )
  .action(async (name: string, options: { answers?: string }) => {
    console.log(chalk.blue(`🚀 Generating complete feature: ${name}`));

    let answers;
    if (options.answers) {
      // Parse answers from JSON for API mode
      try {
        answers = JSON.parse(options.answers);
      } catch (error) {
        console.error(chalk.red("Invalid JSON provided for answers"));
        process.exit(1);
      }
    } else {
      // Interactive mode
      answers = await inquirer.prompt([
        {
          type: "confirm",
          name: "includeApi",
          message: "Include API routes?",
          default: true,
        },
        {
          type: "confirm",
          name: "includeUi",
          message: "Include UI components?",
          default: true,
        },
        {
          type: "confirm",
          name: "includeTests",
          message: "Generate tests?",
          default: true,
        },
        {
          type: "input",
          name: "model",
          message: "Prisma model name (if applicable):",
        },
      ]);
    }

    await generateFeature(name, answers);
    console.log(chalk.green(`✅ Feature ${name} generated successfully!`));
  });

// Interactive mode
program
  .command("interactive")
  .alias("i")
  .description("Run generator in interactive mode")
  .action(async () => {
    const { generatorType } = await inquirer.prompt([
      {
        type: "list",
        name: "generatorType",
        message: "What would you like to generate?",
        choices: [
          { name: "📡 tRPC Router", value: "router" },
          { name: "🎨 React Component", value: "component" },
          { name: "📄 Document Type", value: "document-type" },
          { name: "🧪 Tests", value: "test" },
          { name: "🚀 Complete Feature", value: "feature" },
        ],
      },
    ]);

    switch (generatorType) {
      case "router":
        const routerAnswers = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Router name:",
            validate: (input) => input.length > 0,
          },
          {
            type: "input",
            name: "model",
            message: "Prisma model name:",
          },
          {
            type: "confirm",
            name: "crud",
            message: "Include CRUD operations?",
            default: true,
          },
        ]);
        await generateRouter(routerAnswers.name, routerAnswers);
        break;

      case "component":
        const componentAnswers = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Component name:",
            validate: (input) => input.length > 0,
          },
          {
            type: "list",
            name: "type",
            message: "Component type:",
            choices: ["component", "page", "form"],
          },
          {
            type: "input",
            name: "dir",
            message: "Directory (relative to src/components):",
            default: "",
          },
        ]);
        await generateComponent(componentAnswers.name, componentAnswers);
        break;

      case "document-type":
        const docAnswers = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Document type name:",
            validate: (input) => input.length > 0,
          },
          {
            type: "input",
            name: "description",
            message: "Document type description:",
          },
          {
            type: "checkbox",
            name: "sections",
            message: "Select sections to include:",
            choices: [
              "Introduction",
              "Background",
              "Main Content",
              "Analysis",
              "Conclusion",
              "References",
              "Appendix",
            ],
          },
          {
            type: "checkbox",
            name: "exportFormats",
            message: "Select export formats:",
            choices: ["pdf", "docx", "markdown", "html", "txt"],
            default: ["pdf", "docx"],
          },
        ]);
        await generateDocumentType(docAnswers.name, {
          description: docAnswers.description,
          sections: docAnswers.sections,
          exportFormats: docAnswers.exportFormats,
        });
        break;

      case "test":
        const testAnswers = await inquirer.prompt([
          {
            type: "input",
            name: "path",
            message: "File path:",
            validate: (input) => input.length > 0,
          },
          {
            type: "list",
            name: "type",
            message: "Test type:",
            choices: ["unit", "integration", "e2e"],
          },
        ]);
        await generateTest(testAnswers.path, testAnswers);
        break;

      case "feature":
        const featureAnswers = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Feature name:",
            validate: (input) => input.length > 0,
          },
          {
            type: "confirm",
            name: "includeApi",
            message: "Include API routes?",
            default: true,
          },
          {
            type: "confirm",
            name: "includeUi",
            message: "Include UI components?",
            default: true,
          },
          {
            type: "confirm",
            name: "includeTests",
            message: "Generate tests?",
            default: true,
          },
          {
            type: "input",
            name: "model",
            message: "Prisma model name (if applicable):",
          },
        ]);
        await generateFeature(featureAnswers.name, featureAnswers);
        break;
    }

    console.log(chalk.green("✅ Generation complete!"));
  });

// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
