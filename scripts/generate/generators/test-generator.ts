import fs from "fs/promises";
import path from "path";
import { formatCode, pascalCase, camelCase } from "../utils";

interface TestOptions {
  type?: "unit" | "integration" | "e2e";
}

export async function generateTest(targetPath: string, options: TestOptions = {}) {
  const testType = options.type || detectTestType(targetPath);
  const absolutePath = path.isAbsolute(targetPath) 
    ? targetPath 
    : path.join(process.cwd(), targetPath);
  
  // Check if target file exists
  const fileExists = await fs.access(absolutePath).then(() => true).catch(() => false);
  if (!fileExists) {
    console.warn(`⚠️  Target file not found: ${targetPath}`);
    console.log("Generating test template anyway...");
  }

  const fileContent = fileExists ? await fs.readFile(absolutePath, "utf-8") : "";
  const fileInfo = parseFileInfo(targetPath, fileContent);
  
  let testContent: string;
  let testPath: string;

  switch (testType) {
    case "unit":
      testContent = await generateUnitTest(fileInfo, fileContent);
      testPath = getUnitTestPath(absolutePath);
      break;
    case "integration":
      testContent = await generateIntegrationTest(fileInfo, fileContent);
      testPath = getIntegrationTestPath(absolutePath);
      break;
    case "e2e":
      testContent = await generateE2ETest(fileInfo, fileContent);
      testPath = getE2ETestPath(absolutePath);
      break;
    default:
      testContent = await generateUnitTest(fileInfo, fileContent);
      testPath = getUnitTestPath(absolutePath);
  }

  // Ensure test directory exists
  await fs.mkdir(path.dirname(testPath), { recursive: true });
  
  // Write test file
  await fs.writeFile(testPath, await formatCode(testContent));
  
  console.log(`✅ Generated ${testType} test: ${path.relative(process.cwd(), testPath)}`);
}

function detectTestType(targetPath: string): "unit" | "integration" | "e2e" {
  if (targetPath.includes("/app/") || targetPath.includes("/pages/")) {
    return "e2e";
  }
  if (targetPath.includes("/api/") || targetPath.includes("/server/")) {
    return "integration";
  }
  return "unit";
}

interface FileInfo {
  fileName: string;
  componentName: string;
  isReactComponent: boolean;
  isApiRoute: boolean;
  isPage: boolean;
  exportedFunctions: string[];
  imports: string[];
}

function parseFileInfo(filePath: string, content: string): FileInfo {
  const fileName = path.basename(filePath, path.extname(filePath));
  const componentName = pascalCase(fileName.replace(/\.(tsx?|jsx?)$/, ""));
  
  // Simple parsing - in production, use proper AST parsing
  const isReactComponent = content.includes("export function") && content.includes("return (");
  const isApiRoute = filePath.includes("/api/") || filePath.includes("/server/");
  const isPage = filePath.includes("/app/") && fileName === "page";
  
  // Extract exported functions (simplified)
  const exportedFunctions: string[] = [];
  const exportRegex = /export\s+(async\s+)?function\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exportedFunctions.push(match[2]);
  }
  
  // Extract imports (simplified)
  const imports: string[] = [];
  const importRegex = /import\s+.+\s+from\s+["'](.+)["']/g;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return {
    fileName,
    componentName,
    isReactComponent,
    isApiRoute,
    isPage,
    exportedFunctions,
    imports,
  };
}

async function generateUnitTest(fileInfo: FileInfo, fileContent: string): Promise<string> {
  if (fileInfo.isReactComponent) {
    return generateReactComponentTest(fileInfo);
  } else if (fileInfo.isApiRoute) {
    return generateApiUnitTest(fileInfo);
  } else {
    return generateFunctionTest(fileInfo);
  }
}

function generateReactComponentTest(fileInfo: FileInfo): string {
  const { componentName } = fileInfo;
  
  return `import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ${componentName} } from "./${fileInfo.fileName}";

// Mock tRPC
jest.mock("~/trpc/react", () => ({
  api: {
    useContext: jest.fn(),
  },
}));

describe("${componentName}", () => {
  const defaultProps = {
    // Add default props here
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<${componentName} {...defaultProps} />);
    expect(screen.getByRole("generic")).toBeInTheDocument();
  });

  it("displays correct content", () => {
    render(<${componentName} {...defaultProps} />);
    // Add specific content checks based on component
  });

  it("handles user interactions", async () => {
    const user = userEvent.setup();
    const mockOnClick = jest.fn();
    
    render(<${componentName} {...defaultProps} onClick={mockOnClick} />);
    
    // Example: clicking a button
    const button = screen.getByRole("button");
    await user.click(button);
    
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    const customClass = "custom-class";
    render(<${componentName} {...defaultProps} className={customClass} />);
    
    expect(screen.getByRole("generic")).toHaveClass(customClass);
  });

  // Add more specific tests based on component functionality
  describe("edge cases", () => {
    it("handles empty data gracefully", () => {
      render(<${componentName} {...defaultProps} data={[]} />);
      expect(screen.queryByText(/no data/i)).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(<${componentName} {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });

    it("displays error state", () => {
      const errorMessage = "Something went wrong";
      render(<${componentName} {...defaultProps} error={errorMessage} />);
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  // Accessibility tests
  describe("accessibility", () => {
    it("has no accessibility violations", async () => {
      const { container } = render(<${componentName} {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<${componentName} {...defaultProps} />);
      
      await user.tab();
      // Check focus management
    });
  });
});
`;
}

function generateApiUnitTest(fileInfo: FileInfo): string {
  const routerName = camelCase(fileInfo.fileName.replace("Router", ""));
  
  return `import { createInnerTRPCContext } from "~/server/api/trpc";
import { ${fileInfo.componentName} } from "./${fileInfo.fileName}";
import { type Session } from "next-auth";
import { db } from "~/server/db";

// Mock database
jest.mock("~/server/db", () => ({
  db: {
    ${routerName}: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe("${fileInfo.componentName}", () => {
  const mockSession: Session = {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };

  const ctx = createInnerTRPCContext({ session: mockSession });
  const caller = ${fileInfo.componentName}.createCaller(ctx);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("creates a new item successfully", async () => {
      const input = {
        name: "Test Item",
        description: "Test description",
      };

      const mockCreated = {
        id: "test-id",
        ...input,
        userId: mockSession.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.${routerName}.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await caller.create(input);

      expect(db.${routerName}.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...input,
          userId: mockSession.user.id,
        }),
      });
      expect(result).toEqual(mockCreated);
    });

    it("throws error for invalid input", async () => {
      const invalidInput = {
        name: "", // Empty name should fail validation
      };

      await expect(caller.create(invalidInput as any)).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("returns paginated list of items", async () => {
      const mockItems = [
        { id: "1", name: "Item 1", userId: mockSession.user.id },
        { id: "2", name: "Item 2", userId: mockSession.user.id },
      ];

      (db.${routerName}.findMany as jest.Mock).mockResolvedValue(mockItems);
      (db.${routerName}.count as jest.Mock).mockResolvedValue(2);

      const result = await caller.list({});

      expect(db.${routerName}.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockSession.user.id,
          }),
        })
      );
      expect(result.items).toEqual(mockItems);
      expect(result.totalCount).toBe(2);
    });

    it("applies filters correctly", async () => {
      await caller.list({
        filters: { status: "active" },
      });

      expect(db.${routerName}.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockSession.user.id,
            status: "active",
          }),
        })
      );
    });
  });

  describe("getById", () => {
    it("returns item by id", async () => {
      const mockItem = {
        id: "test-id",
        name: "Test Item",
        userId: mockSession.user.id,
      };

      (db.${routerName}.findUnique as jest.Mock).mockResolvedValue(mockItem);

      const result = await caller.getById({ id: "test-id" });

      expect(db.${routerName}.findUnique).toHaveBeenCalledWith({
        where: { id: "test-id", userId: mockSession.user.id },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockItem);
    });

    it("throws error when item not found", async () => {
      (db.${routerName}.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(caller.getById({ id: "non-existent" })).rejects.toThrow(
        "${fileInfo.componentName} not found"
      );
    });
  });

  describe("update", () => {
    it("updates item successfully", async () => {
      const mockExisting = {
        id: "test-id",
        userId: mockSession.user.id,
      };

      const updateData = {
        name: "Updated Name",
      };

      const mockUpdated = {
        ...mockExisting,
        ...updateData,
        updatedAt: new Date(),
      };

      (db.${routerName}.findUnique as jest.Mock).mockResolvedValue(mockExisting);
      (db.${routerName}.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await caller.update({
        id: "test-id",
        data: updateData,
      });

      expect(result).toEqual(mockUpdated);
    });

    it("throws error when updating non-owned item", async () => {
      (db.${routerName}.findUnique as jest.Mock).mockResolvedValue({
        id: "test-id",
        userId: "different-user",
      });

      await expect(
        caller.update({ id: "test-id", data: { name: "New Name" } })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("delete", () => {
    it("deletes item successfully", async () => {
      const mockItem = {
        id: "test-id",
        userId: mockSession.user.id,
      };

      (db.${routerName}.findUnique as jest.Mock).mockResolvedValue(mockItem);
      (db.${routerName}.delete as jest.Mock).mockResolvedValue(mockItem);

      const result = await caller.delete({ id: "test-id" });

      expect(db.${routerName}.delete).toHaveBeenCalledWith({
        where: { id: "test-id" },
      });
      expect(result.success).toBe(true);
    });
  });
});
`;
}

function generateFunctionTest(fileInfo: FileInfo): string {
  return `import { ${fileInfo.exportedFunctions.join(", ")} } from "./${fileInfo.fileName}";

describe("${fileInfo.fileName}", () => {
  ${fileInfo.exportedFunctions.map(funcName => `
  describe("${funcName}", () => {
    it("should work correctly with valid input", () => {
      // Add test implementation
      const result = ${funcName}(/* add arguments */);
      expect(result).toBeDefined();
    });

    it("should handle edge cases", () => {
      // Test edge cases
    });

    it("should throw error for invalid input", () => {
      // Test error cases
      expect(() => ${funcName}(/* invalid args */)).toThrow();
    });
  });
  `).join("\n")}
});
`;
}

async function generateIntegrationTest(fileInfo: FileInfo, fileContent: string): Promise<string> {
  if (fileInfo.isApiRoute) {
    return generateApiIntegrationTest(fileInfo);
  }
  
  return `import { test, expect } from "@jest/globals";

describe("${fileInfo.componentName} Integration Tests", () => {
  beforeAll(async () => {
    // Setup test database or services
  });

  afterAll(async () => {
    // Cleanup
  });

  test("integrates correctly with external services", async () => {
    // Add integration test
  });
});
`;
}

function generateApiIntegrationTest(fileInfo: FileInfo): string {
  const routerName = camelCase(fileInfo.fileName.replace("Router", ""));
  
  return `import { appRouter } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { type Session } from "next-auth";
import { db } from "~/server/db";

describe("${fileInfo.componentName} Integration Tests", () => {
  const mockSession: Session = {
    user: {
      id: "integration-test-user",
      email: "integration@test.com",
      name: "Integration Test User",
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };

  const ctx = createInnerTRPCContext({ session: mockSession });
  const caller = appRouter.createCaller(ctx);

  beforeEach(async () => {
    // Clean up test data
    await db.${routerName}.deleteMany({
      where: { userId: mockSession.user.id },
    });
  });

  afterAll(async () => {
    // Final cleanup
    await db.${routerName}.deleteMany({
      where: { userId: mockSession.user.id },
    });
  });

  test("complete CRUD flow", async () => {
    // Create
    const created = await caller.${routerName}.create({
      name: "Integration Test Item",
      description: "Test description",
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe("Integration Test Item");

    // Read
    const item = await caller.${routerName}.getById({ id: created.id });
    expect(item).toEqual(created);

    // Update
    const updated = await caller.${routerName}.update({
      id: created.id,
      data: { name: "Updated Item" },
    });
    expect(updated.name).toBe("Updated Item");

    // List
    const list = await caller.${routerName}.list({});
    expect(list.items).toHaveLength(1);
    expect(list.items[0].id).toBe(created.id);

    // Delete
    await caller.${routerName}.delete({ id: created.id });
    const listAfterDelete = await caller.${routerName}.list({});
    expect(listAfterDelete.items).toHaveLength(0);
  });

  test("handles concurrent operations", async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      caller.${routerName}.create({
        name: \`Concurrent Item \${i}\`,
      })
    );

    const items = await Promise.all(promises);
    expect(items).toHaveLength(5);

    const list = await caller.${routerName}.list({});
    expect(list.items).toHaveLength(5);
  });

  test("respects user isolation", async () => {
    // Create item as test user
    const item = await caller.${routerName}.create({
      name: "User Isolated Item",
    });

    // Create context for different user
    const otherUserCtx = createInnerTRPCContext({
      session: {
        ...mockSession,
        user: { ...mockSession.user, id: "other-user" },
      },
    });
    const otherCaller = appRouter.createCaller(otherUserCtx);

    // Other user should not see the item
    await expect(
      otherCaller.${routerName}.getById({ id: item.id })
    ).rejects.toThrow();

    const otherUserList = await otherCaller.${routerName}.list({});
    expect(otherUserList.items).toHaveLength(0);
  });
});
`;
}

async function generateE2ETest(fileInfo: FileInfo, fileContent: string): Promise<string> {
  const pageName = fileInfo.componentName.replace("Page", "");
  const route = fileInfo.fileName === "page" 
    ? `/${fileInfo.fileName.split("/").slice(-2, -1)[0] || ""}`
    : `/${fileInfo.fileName}`;

  return `import { test, expect } from "@playwright/test";

test.describe("${pageName} Page E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate to the page
    await page.goto("${route}");
    
    // Handle authentication if needed
    // await loginUser(page);
  });

  test("page loads successfully", async ({ page }) => {
    // Check if page loads without errors
    await expect(page).toHaveTitle(/.*${pageName}.*/i);
    
    // Check for main heading
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("displays expected content", async ({ page }) => {
    // Check for specific content elements
    await expect(page.getByText(/.*${pageName}.*/i)).toBeVisible();
    
    // Add more specific content checks based on the page
  });

  test("handles user interactions", async ({ page }) => {
    // Example: Click a button
    const button = page.getByRole("button", { name: /add|create|new/i });
    if (await button.isVisible()) {
      await button.click();
      
      // Check navigation or modal
      await expect(page.url()).toContain("/new");
      // OR
      // await expect(page.getByRole("dialog")).toBeVisible();
    }
  });

  test("form submission works", async ({ page }) => {
    // Navigate to form page
    await page.goto("${route}/new");
    
    // Fill form fields
    await page.getByLabel(/name/i).fill("Test Name");
    await page.getByLabel(/description/i).fill("Test Description");
    
    // Submit form
    await page.getByRole("button", { name: /submit|create|save/i }).click();
    
    // Check success message or redirect
    await expect(page.getByText(/success|created/i)).toBeVisible();
    // OR check redirect
    // await expect(page.url()).not.toContain("/new");
  });

  test("handles errors gracefully", async ({ page }) => {
    // Trigger an error condition
    await page.route("**/api/**", (route) => 
      route.fulfill({ status: 500, body: "Server error" })
    );
    
    await page.reload();
    
    // Check error message is displayed
    await expect(page.getByText(/error|failed|problem/i)).toBeVisible();
  });

  test("responsive design", async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check mobile menu or responsive elements
    const mobileMenu = page.getByRole("button", { name: /menu/i });
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.getByRole("navigation")).toBeVisible();
    }
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    // Add tablet-specific checks
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    // Add desktop-specific checks
  });

  test("accessibility", async ({ page }) => {
    // Check for accessibility issues
    const accessibilityScanResults = await page.evaluate(() => {
      // This would use an accessibility testing library
      // For now, just check basic requirements
      const images = Array.from(document.querySelectorAll("img"));
      const imagesWithoutAlt = images.filter(img => !img.alt);
      
      const buttons = Array.from(document.querySelectorAll("button"));
      const buttonsWithoutText = buttons.filter(
        btn => !btn.textContent && !btn.getAttribute("aria-label")
      );
      
      return {
        imagesWithoutAlt: imagesWithoutAlt.length,
        buttonsWithoutText: buttonsWithoutText.length,
      };
    });
    
    expect(accessibilityScanResults.imagesWithoutAlt).toBe(0);
    expect(accessibilityScanResults.buttonsWithoutText).toBe(0);
  });

  test.describe("authenticated user flows", () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test in this group
      await page.goto("/api/auth/signin");
      await page.getByLabel(/email/i).fill("test@example.com");
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL("${route}");
    });

    test("can perform authenticated actions", async ({ page }) => {
      // Test authenticated user actions
      await expect(page.getByRole("button", { name: /create|add/i })).toBeVisible();
    });
  });
});

// Helper functions
async function loginUser(page: any) {
  // Implementation for logging in a test user
  await page.goto("/api/auth/signin");
  // ... login steps
}
`;
}

// Path helpers
function getUnitTestPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  
  // If file is in __tests__ directory, keep it there
  if (dir.includes("__tests__")) {
    return filePath.replace(ext, `.test${ext}`);
  }
  
  // Otherwise, create parallel __tests__ directory
  const testDir = path.join(dir, "__tests__");
  return path.join(testDir, `${fileName}.test${ext}`);
}

function getIntegrationTestPath(filePath: string): string {
  const fileName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  
  const integrationDir = path.join(
    process.cwd(),
    "tests",
    "integration"
  );
  
  return path.join(integrationDir, `${fileName}.integration.test${ext}`);
}

function getE2ETestPath(filePath: string): string {
  const relativePath = path.relative(
    path.join(process.cwd(), "src", "app"),
    filePath
  );
  const testName = relativePath
    .replace(/\/(page|layout|loading|error)\.(tsx?|jsx?)$/, "")
    .replace(/\//g, "-") || "home";
  
  const e2eDir = path.join(process.cwd(), "tests", "e2e");
  return path.join(e2eDir, `${testName}.spec.ts`);
}