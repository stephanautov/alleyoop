"use client";

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues
const KnowledgeManagement = dynamic(
  () => import('~/components/knowledge/knowledge-management'),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  }
);

export default function KnowledgePage() {
  return <KnowledgeManagement />;
}
