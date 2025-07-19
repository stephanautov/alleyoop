import {
  PrismaClient,
  DocumentType,
  DocumentStatus,
  ExportFormat,
} from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clean existing data
  console.log("🧹 Cleaning existing data...");
  await prisma.export.deleteMany();
  await prisma.document.deleteMany();
  await prisma.usage.deleteMany();
  await prisma.template.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create test users
  console.log("👥 Creating users...");
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=test`,
      },
    }),
    prisma.user.create({
      data: {
        email: "demo@example.com",
        name: "Demo User",
        emailVerified: new Date(),
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=demo`,
      },
    }),
  ]);

  // Create usage records
  console.log("📊 Creating usage records...");
  for (const user of users) {
    await prisma.usage.create({
      data: {
        userId: user.id,
        documentsCount: 0,
        totalTokens: 0,
        totalCost: 0,
        monthlyDocs: 0,
        monthlyTokens: 0,
      },
    });
  }

  // Create system templates
  console.log("📋 Creating templates...");
  const templates = [
    {
      name: "Professional Biography",
      description: "Standard template for professional biographies",
      type: DocumentType.BIOGRAPHY,
      config: {
        purpose: "professional",
        tone: "formal",
        focusAreas: ["career", "achievements", "education"],
        outputLength: "medium",
      },
      isPublic: true,
    },
    {
      name: "Legal Case Brief",
      description: "Standard format for legal case summaries",
      type: DocumentType.CASE_SUMMARY,
      config: {
        includeAnalysis: true,
        citationStyle: "bluebook",
        outputLength: "medium",
      },
      isPublic: true,
    },
    {
      name: "Startup Business Plan",
      description: "Template for startup funding proposals",
      type: DocumentType.BUSINESS_PLAN,
      config: {
        targetAudience: "investors",
        sections: [
          "executive_summary",
          "market_analysis",
          "financial_projections",
        ],
        financialYears: 3,
        outputLength: "long",
      },
      isPublic: true,
    },
  ];

  await prisma.template.createMany({
    data: templates,
  });

  // Create sample documents for test user
  console.log("📄 Creating sample documents...");
  const testUser = users[0];

  const sampleDocuments = [
    {
      userId: testUser.id,
      title: "John Doe Professional Biography",
      type: DocumentType.BIOGRAPHY,
      status: DocumentStatus.COMPLETED,
      input: {
        title: "John Doe Professional Biography",
        subject: {
          name: "John Doe",
          occupation: "Software Engineer",
          birthDate: "1985-03-15",
          birthPlace: "San Francisco, CA",
        },
        purpose: "professional",
        tone: "formal",
        focusAreas: ["career", "achievements", "education"],
        outputLength: "medium",
      },
      outline: {
        content:
          "1. Introduction\n2. Early Life and Education\n3. Career Journey\n4. Major Achievements\n5. Current Role\n6. Future Aspirations",
        tokens: 150,
      },
      sections: [
        {
          id: "introduction",
          name: "Introduction",
          content: faker.lorem.paragraphs(2),
          order: 1,
          promptTokens: 100,
          completionTokens: 200,
        },
        {
          id: "early_life",
          name: "Early Life and Education",
          content: faker.lorem.paragraphs(3),
          order: 2,
          promptTokens: 120,
          completionTokens: 250,
        },
        {
          id: "career",
          name: "Career Journey",
          content: faker.lorem.paragraphs(4),
          order: 3,
          promptTokens: 150,
          completionTokens: 300,
        },
        {
          id: "achievements",
          name: "Major Achievements",
          content: faker.lorem.paragraphs(3),
          order: 4,
          promptTokens: 130,
          completionTokens: 280,
        },
      ],
      wordCount: 1250,
      promptTokens: 600,
      completionTokens: 1030,
      totalCost: 0.05,
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      userId: testUser.id,
      title: "Smith v. Jones Case Summary",
      type: DocumentType.CASE_SUMMARY,
      status: DocumentStatus.COMPLETED,
      input: {
        title: "Smith v. Jones Case Summary",
        caseInfo: {
          caseName: "Smith v. Jones",
          caseNumber: "2023-CV-1234",
          court: "Superior Court of California",
          dateDecided: "2023-06-15",
        },
        parties: {
          plaintiff: "John Smith",
          defendant: "ABC Corporation",
        },
        legalIssues: ["Breach of Contract", "Negligence"],
        includeAnalysis: true,
        citationStyle: "bluebook",
        outputLength: "medium",
      },
      sections: [
        {
          id: "header",
          name: "Case Header",
          content: "Smith v. Jones, 2023-CV-1234 (Cal. Super. Ct. 2023)",
          order: 1,
          promptTokens: 50,
          completionTokens: 100,
        },
        {
          id: "facts",
          name: "Facts of the Case",
          content: faker.lorem.paragraphs(3),
          order: 2,
          promptTokens: 150,
          completionTokens: 300,
        },
      ],
      wordCount: 800,
      promptTokens: 400,
      completionTokens: 700,
      totalCost: 0.03,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      userId: testUser.id,
      title: "TechStartup Inc. Business Plan",
      type: DocumentType.BUSINESS_PLAN,
      status: DocumentStatus.PROCESSING,
      input: {
        title: "TechStartup Inc. Business Plan",
        business: {
          name: "TechStartup Inc.",
          industry: "Software as a Service",
          stage: "startup",
          location: "San Francisco, CA",
        },
        targetAudience: "investors",
        fundingAmount: "$2,000,000",
        financialYears: 3,
        outputLength: "long",
      },
      wordCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
    },
    {
      userId: testUser.id,
      title: "Failed Document Example",
      type: DocumentType.BIOGRAPHY,
      status: DocumentStatus.FAILED,
      input: {
        title: "Failed Document Example",
        subject: { name: "Test Subject" },
        purpose: "professional",
        tone: "formal",
        outputLength: "short",
      },
      wordCount: 0,
      promptTokens: 100,
      completionTokens: 0,
      totalCost: 0.01,
    },
  ];

  const documents = await Promise.all(
    sampleDocuments.map((doc) => prisma.document.create({ data: doc })),
  );

  // Create sample exports for completed documents
  console.log("📤 Creating sample exports...");
  const completedDocs = documents.filter(
    (doc) => doc.status === DocumentStatus.COMPLETED,
  );

  for (const doc of completedDocs) {
    await prisma.export.create({
      data: {
        documentId: doc.id,
        userId: doc.userId,
        format: ExportFormat.PDF,
        status: "COMPLETED",
        url: `https://storage.example.com/exports/${doc.id}.pdf`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  // Update usage stats
  console.log("📈 Updating usage statistics...");
  const userStats = await prisma.document.groupBy({
    by: ["userId"],
    _sum: {
      promptTokens: true,
      completionTokens: true,
      totalCost: true,
    },
    _count: true,
  });

  for (const stat of userStats) {
    await prisma.usage.update({
      where: { userId: stat.userId },
      data: {
        documentsCount: stat._count,
        totalTokens:
          (stat._sum.promptTokens ?? 0) + (stat._sum.completionTokens ?? 0),
        totalCost: stat._sum.totalCost ?? 0,
        monthlyDocs: stat._count,
        monthlyTokens:
          (stat._sum.promptTokens ?? 0) + (stat._sum.completionTokens ?? 0),
      },
    });
  }

  console.log("✅ Database seed completed!");
  console.log(`   - ${users.length} users created`);
  console.log(`   - ${templates.length} templates created`);
  console.log(`   - ${documents.length} documents created`);
  console.log(`   - ${completedDocs.length} exports created`);
  console.log("\n📝 Test accounts:");
  console.log("   Email: test@example.com");
  console.log("   Email: demo@example.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
