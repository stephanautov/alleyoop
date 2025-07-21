"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { DocumentList } from "~/components/documents/document-list";
import { NoDocumentsEmptyState, LoadingState } from "~/components/ui/empty-states";

export default function DocumentsPage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();

    // Always declare queries before any conditional returns to keep hook order stable
    const { data: result, isLoading } = api.document.list.useQuery(
        {
            pagination: { limit: 100 },
            orderBy: { field: "updatedAt", direction: "desc" },
        },
        {
            enabled: sessionStatus === "authenticated",
        },
    );

    // Redirect unauthenticated users / loading states
    if (sessionStatus === "loading") {
        return <LoadingState message="Checking authentication..." />;
    }

    if (!session) {
        router.push("/sign-in");
        return null;
    }

    if (isLoading) {
        return <LoadingState message="Loading your documents..." />;
    }

    const documents = result?.items ?? [];

    if (documents.length === 0) {
        return <NoDocumentsEmptyState />;
    }

    return <DocumentList documents={documents} />;
}