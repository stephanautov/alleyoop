//src/app/documents/[id]/export-dropdown.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Download, FileText, FileCode, FileIcon, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { type ExportFormat } from "@prisma/client";

interface ExportDropdownProps {
    documentId: string;
    formats: string[];
}

const formatIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    pdf: FileText,
    docx: FileText,
    markdown: FileCode,
    html: FileCode,
    txt: FileIcon,
};

const formatLabels: Record<string, string> = {
    pdf: "PDF Document",
    docx: "Word Document",
    markdown: "Markdown",
    html: "HTML",
    txt: "Plain Text",
};

export function ExportDropdown({ documentId, formats }: ExportDropdownProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [exportingFormat, setExportingFormat] = useState<string | null>(null);

    const exportDocument = api.export.create.useMutation({
        onSuccess: (data) => {
            // Trigger download
            if (data.url) {
                window.open(data.url, "_blank");
            }
            toast.success(`Document exported as ${exportingFormat?.toUpperCase()}`);
        },
        onError: (error) => {
            toast.error(error.message ?? "Failed to export document");
        },
        onSettled: () => {
            setIsExporting(false);
            setExportingFormat(null);
        },
    });

    const handleExport = async (format: string) => {
        setIsExporting(true);
        setExportingFormat(format);

        await exportDocument.mutateAsync({
            documentId,
            format: format.toUpperCase() as ExportFormat,
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isExporting}>
                    {isExporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {formats.map((format) => {
                    const Icon = formatIcons[format] || FileIcon;
                    const label = formatLabels[format] || format.toUpperCase();

                    return (
                        <DropdownMenuItem
                            key={format}
                            onClick={() => handleExport(format)}
                            disabled={isExporting}
                        >
                            <Icon className="mr-2 h-4 w-4" />
                            {label}
                            {isExporting && exportingFormat === format && (
                                <Loader2 className="ml-auto h-3 w-3 animate-spin" />
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}