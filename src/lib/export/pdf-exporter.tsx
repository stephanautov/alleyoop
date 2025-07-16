//src/lib/export/pdf-exporter.tsx

import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    PDFViewer,
    Font,
    pdf,
} from "@react-pdf/renderer";
import type { DocumentData, Exporter } from "./index";

// Register fonts (optional - for better typography)
// Font.register({
//   family: "Inter",
//   src: "/fonts/Inter-Regular.ttf",
// });

// Create styles
const styles = StyleSheet.create({
    page: {
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        padding: 60,
        fontFamily: "Helvetica",
    },
    header: {
        marginBottom: 30,
        borderBottom: "2pt solid #000000",
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        color: "#666666",
    },
    metadata: {
        fontSize: 10,
        color: "#666666",
        marginBottom: 20,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 10,
        marginTop: 10,
    },
    sectionContent: {
        fontSize: 11,
        lineHeight: 1.6,
        textAlign: "justify",
    },
    paragraph: {
        marginBottom: 10,
    },
    footer: {
        position: "absolute",
        bottom: 30,
        left: 60,
        right: 60,
        fontSize: 10,
        textAlign: "center",
        color: "#666666",
    },
    pageNumber: {
        fontSize: 10,
        textAlign: "center",
    },
    toc: {
        marginBottom: 30,
    },
    tocTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 15,
    },
    tocItem: {
        fontSize: 11,
        marginBottom: 5,
        marginLeft: 20,
    },
    list: {
        marginLeft: 20,
        marginBottom: 10,
    },
    listItem: {
        fontSize: 11,
        lineHeight: 1.6,
        marginBottom: 5,
    },
});

// PDF Document Component
const PDFDocument: React.FC<{ data: DocumentData }> = ({ data }) => {
    // Sort sections by order
    const sortedSections = [...data.sections].sort((a, b) => a.order - b.order);

    // Format date
    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    // Parse content and handle formatting
    const renderContent = (content: string) => {
        // Split content into paragraphs
        const paragraphs = content.split("\n\n").filter(p => p.trim());

        return paragraphs.map((paragraph, index) => {
            // Check if it's a list
            if (paragraph.trim().startsWith("- ") || paragraph.trim().startsWith("• ")) {
                const items = paragraph.split("\n").filter(item => item.trim());
                return (
                    <View key={index} style={styles.list}>
                        {items.map((item, itemIndex) => (
                            <Text key={itemIndex} style={styles.listItem}>
                                • {item.replace(/^[-•]\s*/, "")}
                            </Text>
                        ))}
                    </View>
                );
            }

            // Regular paragraph
            return (
                <Text key={index} style={styles.paragraph}>
                    {paragraph}
                </Text>
            );
        });
    };

    return (
        <Document>
            {/* First Page with Title and TOC */}
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>{data.title}</Text>
                    <Text style={styles.subtitle}>{data.type}</Text>
                </View>

                <View style={styles.metadata}>
                    <Text>Created: {formatDate(data.metadata.createdAt)}</Text>
                    {data.metadata.completedAt && (
                        <Text>Completed: {formatDate(data.metadata.completedAt)}</Text>
                    )}
                    <Text>Word Count: {data.metadata.wordCount.toLocaleString()}</Text>
                    {data.metadata.author && <Text>Author: {data.metadata.author}</Text>}
                </View>

                {/* Table of Contents */}
                <View style={styles.toc}>
                    <Text style={styles.tocTitle}>Table of Contents</Text>
                    {sortedSections.map((section, index) => (
                        <Text key={section.id} style={styles.tocItem}>
                            {index + 1}. {section.name}
                        </Text>
                    ))}
                </View>

                <Text
                    style={styles.pageNumber}
                    render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
                    fixed
                />
            </Page>

            {/* Content Pages */}
            {sortedSections.map((section, sectionIndex) => (
                <Page key={section.id} size="A4" style={styles.page}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            {sectionIndex + 1}. {section.name}
                        </Text>
                        <View style={styles.sectionContent}>
                            {renderContent(section.content)}
                        </View>
                    </View>

                    <Text
                        style={styles.pageNumber}
                        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
                        fixed
                    />
                </Page>
            ))}
        </Document>
    );
};

/**
 * PDF Exporter Implementation
 */
export class PDFExporter implements Exporter {
    async export(data: DocumentData): Promise<Buffer> {
        // Create PDF component
        const pdfDoc = <PDFDocument data={data} />;

        // Generate PDF blob
        const blob = await pdf(pdfDoc).toBlob();

        // Convert blob to buffer
        const arrayBuffer = await blob.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    getMimeType(): string {
        return "application/pdf";
    }

    getFileExtension(): string {
        return "pdf";
    }
}

// Export for preview component
export const PDFPreview: React.FC<{ data: DocumentData }> = ({ data }) => {
    return (
        <PDFViewer width="100%" height="600px">
            <PDFDocument data={data} />
        </PDFViewer>
    );
};