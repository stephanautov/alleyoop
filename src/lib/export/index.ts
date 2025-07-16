//src/lib/export/index.ts

import { type Document as PrismaDocument, ExportFormat } from "@prisma/client";
import { DocxExporter } from "./docx-exporter";
import { MarkdownExporter } from "./markdown-exporter";
import { PDFExporter } from "./pdf-exporter";
import { HtmlExporter } from "./html-exporter";
import { TxtExporter } from "./txt-exporter";
import { getDocumentConfig } from "~/config/documents";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { env } from "~/env";

// Export result type
export interface ExportResult {
    format: ExportFormat;
    buffer: Buffer;
    filename: string;
    mimeType: string;
}

// Document data for export
export interface DocumentData {
    title: string;
    type: string;
    sections: Array<{
        id: string;
        name: string;
        content: string;
        order: number;
    }>;
    metadata: {
        createdAt: Date;
        completedAt?: Date;
        wordCount: number;
        author?: string;
    };
}

// Exporter interface
export interface Exporter {
    export(data: DocumentData): Promise<Buffer>;
    getMimeType(): string;
    getFileExtension(): string;
}

// Exporter registry
class ExporterRegistry {
    private exporters = new Map<ExportFormat, Exporter>();

    constructor() {
        // Register all exporters
        this.register(ExportFormat.PDF, new PDFExporter());
        this.register(ExportFormat.DOCX, new DocxExporter());
        this.register(ExportFormat.MARKDOWN, new MarkdownExporter());
        this.register(ExportFormat.HTML, new HtmlExporter());
        this.register(ExportFormat.TXT, new TxtExporter());
    }

    register(format: ExportFormat, exporter: Exporter) {
        this.exporters.set(format, exporter);
    }

    get(format: ExportFormat): Exporter {
        const exporter = this.exporters.get(format);
        if (!exporter) {
            throw new Error(`Unsupported export format: ${format}`);
        }
        return exporter;
    }

    isSupported(format: ExportFormat): boolean {
        return this.exporters.has(format);
    }

    getSupportedFormats(): ExportFormat[] {
        return Array.from(this.exporters.keys());
    }
}

// Global registry instance
const exporterRegistry = new ExporterRegistry();

/**
 * Export a document to the specified format
 */
export async function exportDocument(
    document: PrismaDocument & { exports?: any[] },
    format: ExportFormat,
    options?: {
        author?: string;
        saveToFile?: boolean;
    }
): Promise<ExportResult> {
    // Validate format is supported
    if (!exporterRegistry.isSupported(format)) {
        throw new Error(`Export format ${format} is not supported`);
    }

    // Validate document has content
    if (!document.sections || !Array.isArray(document.sections)) {
        throw new Error("Document has no content to export");
    }

    // Get document configuration
    const config = getDocumentConfig(document.type);

    // Validate format is supported for this document type
    if (!(config.exportFormats as readonly string[]).includes(format.toLowerCase())) {
        throw new Error(
            `Export format ${format} is not supported for ${config.name} documents`
        );
    }

    // Prepare document data
    const documentData: DocumentData = {
        title: document.title,
        type: config.name,
        sections: document.sections as any[],
        metadata: {
            createdAt: document.createdAt,
            completedAt: document.completedAt || undefined,
            wordCount: document.wordCount,
            author: options?.author,
        },
    };

    // Get exporter and generate file
    const exporter = exporterRegistry.get(format);
    const buffer = await exporter.export(documentData);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTitle = document.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
    const filename = `${safeTitle}_${timestamp}.${exporter.getFileExtension()}`;

    // Save to file if requested
    if (options?.saveToFile) {
        const exportDir = join(process.cwd(), env.UPLOAD_DIR, "exports", document.userId);
        await mkdir(exportDir, { recursive: true });
        const filePath = join(exportDir, filename);
        await writeFile(filePath, buffer);
    }

    return {
        format,
        buffer,
        filename,
        mimeType: exporter.getMimeType(),
    };
}

/**
 * Export multiple documents to a zip file
 */
export async function exportMultipleDocuments(
    documents: PrismaDocument[],
    format: ExportFormat,
    options?: {
        author?: string;
    }
): Promise<ExportResult> {
    // Import archiver dynamically to avoid loading if not needed
    const archiver = await import("archiver");
    const { PassThrough } = await import("stream");

    // Create zip archive
    const archive = archiver.default("zip", {
        zlib: { level: 9 },
    });

    const buffers: Buffer[] = [];
    const output = new PassThrough();

    output.on("data", (chunk) => buffers.push(chunk));

    archive.pipe(output);

    // Export each document
    for (const document of documents) {
        try {
            const result = await exportDocument(document, format, options);
            archive.append(result.buffer, { name: result.filename });
        } catch (error) {
            console.error(`Failed to export document ${document.id}:`, error);
        }
    }

    await archive.finalize();

    // Wait for archive to finish
    await new Promise((resolve) => output.on("end", resolve));

    const buffer = Buffer.concat(buffers);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `documents_export_${timestamp}.zip`;

    return {
        format,
        buffer,
        filename,
        mimeType: "application/zip",
    };
}

/**
 * Get available export formats for a document type
 */
export function getAvailableExportFormats(documentType: string): ExportFormat[] {
    const config = getDocumentConfig(documentType as any);
    return config.exportFormats
        .map((format) => format.toUpperCase() as ExportFormat)
        .filter((format) => exporterRegistry.isSupported(format));
}

/**
 * Estimate export file size
 */
export function estimateExportSize(
    document: PrismaDocument,
    format: ExportFormat
): number {
    // Rough estimates based on format and content
    const baseSize = document.wordCount * 1.2; // Average bytes per word

    const multipliers: Record<ExportFormat, number> = {
        [ExportFormat.PDF]: 2.5,
        [ExportFormat.DOCX]: 2.0,
        [ExportFormat.MARKDOWN]: 1.1,
        [ExportFormat.HTML]: 1.5,
        [ExportFormat.TXT]: 1.0,
    };

    return Math.round(baseSize * (multipliers[format] || 1.5));
}

// Re-export types
export { ExportFormat } from "@prisma/client";