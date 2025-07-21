"use client";

import React from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Skeleton } from "~/components/ui/skeleton";
import Link from 'next/link';
import { api } from '~/trpc/react';
import {
  FileText,
  Plus,
  TrendingUp,
  DollarSign,
  Clock,
  BookOpen,
  ArrowRight,
  Sparkles,
  Download,
  Eye,
  BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';
import { WelcomeEmptyState } from "~/components/ui/empty-states";

// Date formatting helper
const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' years ago';

  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' months ago';

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' days ago';

  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hours ago';

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minutes ago';

  return Math.floor(seconds) + ' seconds ago';
};

// Document type icons
const typeIcons = {
  BIOGRAPHY: FileText,
  BUSINESS_PLAN: BarChart3,
  CASE_SUMMARY: FileText,
  GRANT_PROPOSAL: FileText,
  MEDICAL_REPORT: FileText,
};

// Document status colors
const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  // Auth/session handling
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session) {
      router.push("/sign-in");
    }
  }, [sessionStatus, session, router]);

  // Fetch user stats
  const { data: stats } = api.document.getStats.useQuery(undefined, {
    enabled: sessionStatus === "authenticated",
  });

  // Fetch recent documents
  const { data: recentDocs } = api.document.list.useQuery({
    pagination: { limit: 5 },
    orderBy: { field: 'createdAt', direction: 'desc' },
  }, {
    enabled: sessionStatus === "authenticated",
  });

  const statsLoading = !stats;
  const recentLoading = !recentDocs;

  const isNewUser = !statsLoading && (stats?.total ?? 0) === 0;

  if (isNewUser) {
    return (
      <div className="container mx-auto py-12 px-4">
        <WelcomeEmptyState userName={session?.user?.name ?? undefined} />
      </div>
    );
  }

  // Quick stats cards
  const statCards = [
    {
      label: 'Total Documents',
      value: stats?.total || 0,
      change: stats?.byStatus?.COMPLETED || 0,
      changeLabel: 'completed',
      icon: FileText,
      color: 'blue',
    },
    {
      label: 'Total Cost',
      value: `$${(stats?.totalCost || 0).toFixed(2)}`,
      change: '',
      changeLabel: '',
      icon: DollarSign,
      color: 'green',
    },
    // Additional stats can be added here as needed
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back! 👋
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your documents today.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/documents/new">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-blue-500 text-white rounded-xl p-6 cursor-pointer hover:bg-blue-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  Create New Document
                </h3>
                <p className="text-blue-100 text-sm">
                  Start with AI assistance
                </p>
              </div>
              <div className="bg-blue-400 bg-opacity-50 p-3 rounded-lg">
                <Plus className="h-6 w-6" />
              </div>
            </div>
          </motion.div>
        </Link>

        <Link href="/knowledge">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-purple-500 text-white rounded-xl p-6 cursor-pointer hover:bg-purple-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  Manage Knowledge
                </h3>
                <p className="text-purple-100 text-sm">
                  Upload & organize sources
                </p>
              </div>
              <div className="bg-purple-400 bg-opacity-50 p-3 rounded-lg">
                <BookOpen className="h-6 w-6" />
              </div>
            </div>
          </motion.div>
        </Link>

        <Link href="/documents">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-6 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-1 flex items-center">
                  Try RAG Enhancement
                  <Sparkles className="h-4 w-4 ml-2" />
                </h3>
                <p className="text-white text-opacity-90 text-sm">
                  Supercharge with your data
                </p>
              </div>
              <ArrowRight className="h-6 w-6" />
            </div>
          </motion.div>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg bg-${stat.color}-100`}>
                  <Icon className={`h-5 w-5 text-${stat.color}-600`} />
                </div>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              {statsLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <h3 className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </h3>
              )}
              <p className="text-sm text-gray-600 mt-1">
                {stat.label}
              </p>
              {!statsLoading && (
                <p className="text-xs text-gray-500 mt-2">
                  <span className="font-medium text-gray-700">
                    {stat.change}
                  </span>{' '}
                  {stat.changeLabel}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Recent Documents */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Documents
            </h2>
            <Link
              href="/documents"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
            >
              View all
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>

        {recentLoading ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 flex items-start space-x-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : recentDocs && recentDocs.items.length > 0 ? (
          <div className="divide-y">
            {recentDocs.items.map((doc: any) => {
              const Icon = typeIcons[doc.type as keyof typeof typeIcons] || FileText;
              return (
                <div
                  key={doc.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {doc.title}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <span>{doc.type.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>
                            {formatTimeAgo(new Date(doc.createdAt))}
                          </span>
                          {doc.ragEnabled && (
                            <>
                              <span>•</span>
                              <span className="flex items-center text-blue-600">
                                <Sparkles className="h-3 w-3 mr-1" />
                                RAG Enhanced
                              </span>
                            </>
                          )}
                        </div>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${statusColors[doc.status as keyof typeof statusColors]
                            }`}>
                            {doc.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No documents yet</p>
            <Link
              href="/documents/new"
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first document
            </Link>
          </div>
        )}
      </div>

      {/* Tips Section */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">
          💡 Pro Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start space-x-3">
            <div className="p-1.5 bg-blue-100 rounded">
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Build your knowledge base</p>
              <p className="text-gray-600 mt-1">
                Upload documents to enhance AI generation with your specific context
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-1.5 bg-purple-100 rounded">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Enable RAG for better results</p>
              <p className="text-gray-600 mt-1">
                Documents with RAG are 30-50% more relevant and accurate
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-1.5 bg-green-100 rounded">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Save costs with caching</p>
              <p className="text-gray-600 mt-1">
                Similar documents use cached results to reduce API costs
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}