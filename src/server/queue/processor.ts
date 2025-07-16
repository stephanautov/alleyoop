//src/server/queue/processor.ts

import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "~/env";
import { db } from "~/server/db";
import { DocumentStatus, DocumentType } from "@prisma/client";
import { getDocumentConfig } from "~/config/documents";
import { OpenAI } from "openai";
import { z } from "zod";

// Initialize Redis connection
const redis = new Redis(env.REDIS_URL);

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

// Job data schema
const jobDataSchema = z.object({
    documentId: z.string(),
    userId: z.string(),
    type: z.nativeEnum(DocumentType),
    input: z.record(z.unknown()),
});

type JobData = z.infer<typeof jobDataSchema>;

// Progress stages
const PROGRESS_STAGES = {
    VALIDATING: 5,
    GENERATING_OUTLINE: 20,
    GENERATING_SECTIONS: 70,
    ASSEMBLING: 90,
    COMPLETE: 100,
};

/**
 * Document Generation Worker
 * Processes document generation jobs from the queue
 */
const documentWorker = new Worker(
    "document-generation",
    async (job: Job<JobData>) => {
        console.log(`Processing document ${job.data.documentId}`);

        try {
            // Validate job data
            const jobData = jobDataSchema.parse(job.data);

            // Update progress: Validating
            await job.updateProgress(PROGRESS_STAGES.VALIDATING);

            // Update document status to processing
            await db.document.update({
                where: { id: jobData.documentId },
                data: { status: DocumentStatus.PROCESSING },
            });

            // Get document configuration
            const config = getDocumentConfig(jobData.type);

            // Generate outline
            await job.updateProgress(PROGRESS_STAGES.GENERATING_OUTLINE);
            const outline = await generateOutline(jobData.type, jobData.input);

            // Save outline
            await db.document.update({
                where: { id: jobData.documentId },
                data: { outline },
            });

            // Generate sections
            await job.updateProgress(PROGRESS_STAGES.GENERATING_SECTIONS);
            const sections = await generateSections(
                jobData.type,
                jobData.input,
                outline,
                config.sections,
                async (progress) => {
                    // Update progress during section generation
                    const sectionProgress =
                        PROGRESS_STAGES.GENERATING_OUTLINE +
                        (PROGRESS_STAGES.GENERATING_SECTIONS - PROGRESS_STAGES.GENERATING_OUTLINE) * progress;
                    await job.updateProgress(Math.round(sectionProgress));
                }
            );

            // Assemble document
            await job.updateProgress(PROGRESS_STAGES.ASSEMBLING);
            const wordCount = calculateWordCount(sections);

            // Calculate costs
            const promptTokens = outline.tokens + sections.reduce((sum, s) => sum + s.promptTokens, 0);
            const completionTokens = sections.reduce((sum, s) => sum + s.completionTokens, 0);
            const totalCost = calculateCost(promptTokens + completionTokens);

            // Update document with results
            await db.document.update({
                where: { id: jobData.documentId },
                data: {
                    sections,
                    wordCount,
                    promptTokens,
                    completionTokens,
                    totalCost,
                    status: DocumentStatus.COMPLETED,
                    completedAt: new Date(),
                },
            });

            // Update user usage
            await db.usage.update({
                where: { userId: jobData.userId },
                data: {
                    totalTokens: { increment: promptTokens + completionTokens },
                    totalCost: { increment: totalCost },
                },
            });

            // Complete
            await job.updateProgress(PROGRESS_STAGES.COMPLETE);

            return {
                success: true,
                documentId: jobData.documentId,
                wordCount,
                totalCost,
            };

        } catch (error) {
            console.error(`Error processing document ${job.data.documentId}:`, error);

            // Update document status to failed
            await db.document.update({
                where: { id: job.data.documentId },
                data: {
                    status: DocumentStatus.FAILED,
                },
            });

            throw error;
        }
    },
    {
        connection: redis,
        concurrency: 3, // Process up to 3 documents simultaneously
        removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
        },
    }
);

/**
 * Generate document outline using AI
 */
async function generateOutline(type: DocumentType, input: any) {
    const config = getDocumentConfig(type);
    const prompt = buildOutlinePrompt(type, input, config);

    const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
            {
                role: "system",
                content: "You are an expert document writer. Generate a detailed outline for the requested document.",
            },
            {
                role: "user",
                content: prompt,
            },
        ],
        temperature: 0.7,
        max_tokens: 1000,
    });

    const outline = completion.choices[0]?.message?.content ?? "";
    const tokens = completion.usage?.total_tokens ?? 0;

    return {
        content: outline,
        tokens,
    };
}

/**
 * Generate document sections using AI
 */
async function generateSections(
    type: DocumentType,
    input: any,
    outline: any,
    sectionConfigs: ReadonlyArray<any>,
    onProgress: (progress: number) => Promise<void>
) {
    const sections = [];
    const totalSections = sectionConfigs.length;

    for (let i = 0; i < sectionConfigs.length; i++) {
        const section = sectionConfigs[i];
        const prompt = buildSectionPrompt(type, input, outline, section);

        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: "You are an expert document writer. Write the requested section based on the outline provided.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 2000,
        });

        const content = completion.choices[0]?.message?.content ?? "";
        const promptTokens = completion.usage?.prompt_tokens ?? 0;
        const completionTokens = completion.usage?.completion_tokens ?? 0;

        sections.push({
            id: section.id,
            name: section.name,
            content,
            order: section.order,
            promptTokens,
            completionTokens,
        });

        // Update progress
        await onProgress((i + 1) / totalSections);
    }

    return sections;
}

/**
 * Build prompt for outline generation
 */
function buildOutlinePrompt(type: DocumentType, input: any, config: any): string {
    // This would be customized per document type
    // For now, a generic template
    return `
Create a detailed outline for a ${config.name}.

Input details:
${JSON.stringify(input, null, 2)}

The outline should include the following sections:
${config.sections.map((s: any) => `- ${s.name}`).join("\n")}

Provide a comprehensive outline that covers all important aspects.
Format the outline with clear headings and bullet points.
  `.trim();
}

/**
 * Build prompt for section generation
 */
function buildSectionPrompt(
    type: DocumentType,
    input: any,
    outline: any,
    section: any
): string {
    return `
Write the "${section.name}" section for a ${type} document.

Document outline:
${outline.content}

Input details:
${JSON.stringify(input, null, 2)}

Write a comprehensive ${section.name} section that:
- Follows the outline structure
- Is professional and well-written
- Includes relevant details
- Maintains consistency with the document type

Length: Approximately ${getLengthForSection(input.outputLength)} words.
  `.trim();
}

/**
 * Get target word count for a section based on output length
 */
function getLengthForSection(outputLength: string): number {
    const lengths: Record<string, number> = {
        short: 200,
        medium: 400,
        long: 800,
    };
    return lengths[outputLength] || 400;
}

/**
 * Calculate total word count from sections
 */
function calculateWordCount(sections: any[]): number {
    return sections.reduce((total, section) => {
        const words = section.content.split(/\s+/).length;
        return total + words;
    }, 0);
}

/**
 * Calculate cost based on token usage
 */
function calculateCost(tokens: number): number {
    // GPT-4 pricing (adjust as needed)
    const costPer1kTokens = 0.03;
    return (tokens / 1000) * costPer1kTokens;
}

// Worker event handlers
documentWorker.on("completed", (job) => {
    console.log(`Document ${job.data.documentId} completed successfully`);
});

documentWorker.on("failed", (job, err) => {
    console.error(`Document ${job?.data.documentId} failed:`, err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing worker...");
    await documentWorker.close();
    process.exit(0);
});

process.on("SIGINT", async () => {
    console.log("SIGINT received, closing worker...");
    await documentWorker.close();
    process.exit(0);
});

console.log("Document generation worker started");

// Export for testing
export { documentWorker };