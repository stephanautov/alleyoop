// src/server/jobs/cache-warmer.ts

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { DocumentType } from '@prisma/client';
import { env } from '~/env';
import { db } from '~/server/db';
import { getCacheManager } from '../services/cache/manager';
import { CachedLLMService } from '../services/llm/cached-llm-service';
import type { DocumentProviderName } from '../services/document/types';

interface CacheWarmerJobData {
    documentType: DocumentType;
    provider: DocumentProviderName;
    model: string;
    patterns?: any[];
    userId?: string;
}

// Common patterns for different document types
const COMMON_PATTERNS: Record<DocumentType, any[]> = {
    [DocumentType.BIOGRAPHY]: [
        {
            subject: { name: 'Executive', profession: 'CEO' },
            purpose: 'professional',
            tone: 'professional',
            focusAreas: ['leadership', 'achievements', 'vision'],
            outputLength: 'medium',
        },
        {
            subject: { name: 'Academic', profession: 'Professor' },
            purpose: 'academic',
            tone: 'academic',
            focusAreas: ['research', 'publications', 'teaching'],
            outputLength: 'long',
        },
    ],
    [DocumentType.BUSINESS_PLAN]: [
        {
            businessType: 'saas',
            industry: 'technology',
            stage: 'startup',
            fundingNeeded: true,
            sections: ['executive_summary', 'market_analysis', 'financial_projections'],
        },
        {
            businessType: 'ecommerce',
            industry: 'retail',
            stage: 'growth',
            fundingNeeded: false,
            sections: ['executive_summary', 'marketing_strategy', 'operations_plan'],
        },
    ],
    [DocumentType.GRANT_PROPOSAL]: [
        {
            organization: { name: 'Nonprofit', type: 'nonprofit' },
            grant: { programName: 'Community Development', amount: '50000' },
            project: { title: 'Youth Education Program', duration: '12 months' },
            focusArea: 'education',
        },
        {
            organization: { name: 'Research Institute', type: 'research' },
            grant: { programName: 'Scientific Research', amount: '200000' },
            project: { title: 'Climate Study', duration: '24 months' },
            focusArea: 'environment',
        },
    ],
    [DocumentType.CASE_SUMMARY]: [
        {
            caseInfo: {
                title: 'Contract Dispute',
                type: 'civil',
                jurisdiction: 'federal',
            },
            analysisDepth: 'comprehensive',
            includePrecedents: true,
        },
    ],
    [DocumentType.MEDICAL_REPORT]: [
        // Only cache templates, not actual reports
        {
            reportType: 'consultation',
            specialty: 'general',
            templateOnly: true,
            includeDisclaimer: true,
        },
    ],
};

const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

export const cacheWarmerWorker = new Worker<CacheWarmerJobData>(
    'cache-warmer',
    async (job: Job<CacheWarmerJobData>) => {
        const { documentType, provider, model, patterns, userId } = job.data;
        const cacheManager = getCacheManager();

        console.log(`Warming cache for ${documentType} with ${provider}/${model}`);

        try {
            // Get patterns to warm
            const patternsToWarm = patterns || COMMON_PATTERNS[documentType] || [];

            if (patternsToWarm.length === 0) {
                console.log(`No patterns to warm for ${documentType}`);
                return { warmed: 0 };
            }

            let warmedCount = 0;

            // Create a mock LLM service for warming
            const mockBaseService = {
                generateOutline: async (params: any) => {
                    // Generate a realistic outline based on document type
                    return generateMockOutline(documentType, params.input);
                },
                generateSection: async (params: any) => {
                    // Generate realistic section content
                    return generateMockSection(documentType, params.sectionKey);
                },
            };

            const llmService = new CachedLLMService(
                {
                    provider,
                    model,
                    useCache: true,
                    forceRefresh: false,
                },
                mockBaseService
            );

            // Process each pattern
            for (const pattern of patternsToWarm) {
                await job.updateProgress({
                    current: warmedCount,
                    total: patternsToWarm.length,
                    pattern: JSON.stringify(pattern).substring(0, 100),
                });

                try {
                    // Generate outline for this pattern
                    await cacheManager.getOrGenerateOutline(
                        {
                            documentType,
                            input: pattern,
                            provider,
                            model,
                            userId,
                        },
                        async () => mockBaseService.generateOutline({ input: pattern }),
                        { forceRefresh: false }
                    );

                    warmedCount++;

                    // Add delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Failed to warm pattern:`, error);
                }
            }

            // Log warming results
            await db.systemLog.create({
                data: {
                    type: 'CACHE_WARMING',
                    message: `Warmed ${warmedCount} patterns for ${documentType}`,
                    metadata: {
                        documentType,
                        provider,
                        model,
                        patternsWarmed: warmedCount,
                        totalPatterns: patternsToWarm.length,
                    },
                },
            });

            return {
                warmed: warmedCount,
                total: patternsToWarm.length,
            };
        } catch (error) {
            console.error('Cache warming error:', error);
            throw error;
        }
    },
    {
        connection: redis,
        concurrency: 1, // Process one warming job at a time
    }
);

/**
 * Generate mock outline for cache warming
 */
function generateMockOutline(documentType: DocumentType, input: any): any {
    const outlines: Record<DocumentType, any> = {
        [DocumentType.BIOGRAPHY]: {
            introduction: {
                title: 'Introduction',
                keyPoints: ['Background', 'Overview'],
            },
            early_life: {
                title: 'Early Life and Education',
                keyPoints: ['Childhood', 'Education', 'Influences'],
            },
            career: {
                title: 'Professional Career',
                keyPoints: ['Career start', 'Major achievements', 'Leadership roles'],
            },
            achievements: {
                title: 'Major Achievements',
                keyPoints: ['Awards', 'Recognition', 'Impact'],
            },
            legacy: {
                title: 'Legacy and Impact',
                keyPoints: ['Contributions', 'Influence', 'Future vision'],
            },
        },
        [DocumentType.BUSINESS_PLAN]: {
            executive_summary: {
                title: 'Executive Summary',
                keyPoints: ['Vision', 'Mission', 'Value proposition'],
            },
            market_analysis: {
                title: 'Market Analysis',
                keyPoints: ['Market size', 'Target audience', 'Competition'],
            },
            business_model: {
                title: 'Business Model',
                keyPoints: ['Revenue streams', 'Cost structure', 'Key metrics'],
            },
            marketing_strategy: {
                title: 'Marketing Strategy',
                keyPoints: ['Channels', 'Customer acquisition', 'Retention'],
            },
            financial_projections: {
                title: 'Financial Projections',
                keyPoints: ['Revenue forecast', 'Expenses', 'Break-even analysis'],
            },
        },
        // Add other document types...
        [DocumentType.GRANT_PROPOSAL]: {
            executive_summary: {
                title: 'Executive Summary',
                keyPoints: ['Project overview', 'Funding request', 'Expected impact'],
            },
            statement_of_need: {
                title: 'Statement of Need',
                keyPoints: ['Problem description', 'Target population', 'Evidence'],
            },
            project_description: {
                title: 'Project Description',
                keyPoints: ['Objectives', 'Methods', 'Timeline'],
            },
            budget: {
                title: 'Budget',
                keyPoints: ['Budget breakdown', 'Cost justification', 'Sustainability'],
            },
        },
        [DocumentType.CASE_SUMMARY]: {
            case_overview: {
                title: 'Case Overview',
                keyPoints: ['Parties', 'Claims', 'Procedural history'],
            },
            legal_issues: {
                title: 'Legal Issues',
                keyPoints: ['Primary issues', 'Applicable law', 'Standards'],
            },
            analysis: {
                title: 'Analysis',
                keyPoints: ['Arguments', 'Precedents', 'Application'],
            },
            conclusion: {
                title: 'Conclusion',
                keyPoints: ['Summary', 'Recommendations', 'Next steps'],
            },
        },
        [DocumentType.MEDICAL_REPORT]: {
            patient_information: {
                title: 'Patient Information',
                keyPoints: ['Demographics', 'Medical history', 'Current medications'],
            },
            clinical_findings: {
                title: 'Clinical Findings',
                keyPoints: ['Examination', 'Test results', 'Observations'],
            },
            diagnosis: {
                title: 'Diagnosis',
                keyPoints: ['Primary diagnosis', 'Differential diagnosis', 'Prognosis'],
            },
            treatment_plan: {
                title: 'Treatment Plan',
                keyPoints: ['Recommendations', 'Follow-up', 'Patient education'],
            },
        },
    };

    return outlines[documentType] || {};
}

/**
 * Generate mock section content for cache warming
 */
function generateMockSection(documentType: DocumentType, sectionKey: string): string {
    // Return generic content that would be similar across documents
    const genericSections: Record<string, string> = {
        introduction: 'This document provides a comprehensive overview...',
        executive_summary: 'This executive summary outlines the key points...',
        conclusion: 'In conclusion, the analysis demonstrates...',
        // Add more generic sections
    };

    return genericSections[sectionKey] || `Content for ${sectionKey} section...`;
}