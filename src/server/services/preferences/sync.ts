// src/server/services/preferences/sync.ts

import { db } from '~/server/db';
import type { ProviderName } from '~/server/services/llm';

export class PreferencesSyncService {
    /**
     * Ensure user has preferences, create defaults if not
     */
    static async ensureUserPreferences(userId: string) {
        const existing = await db.userPreferences.findUnique({
            where: { userId },
        });

        if (!existing) {
            return await db.userPreferences.create({
                data: {
                    userId,
                    defaultProvider: 'openai',
                    providerModels: {},
                    temperature: 0.7,
                    systemPromptStyle: 'professional',
                    costAlertEmail: true,
                    allowFallback: true,
                    cacheEnabled: true,
                    preferSpeed: false,
                },
            });
        }

        return existing;
    }

    /**
     * Check if user has exceeded cost limit
     */
    static async checkCostLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
        const preferences = await db.userPreferences.findUnique({
            where: { userId },
            select: { monthlyCostLimit: true },
        });

        if (!preferences?.monthlyCostLimit) {
            return { allowed: true };
        }

        // Get current month's cost
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const usage = await db.lLMCall.aggregate({
            where: {
                document: { userId },
                createdAt: { gte: startOfMonth },
            },
            _sum: { cost: true },
        });

        const currentCost = usage._sum.cost || 0;

        if (currentCost >= preferences.monthlyCostLimit) {
            return {
                allowed: false,
                reason: `Monthly cost limit of $${preferences.monthlyCostLimit} exceeded. Current: $${currentCost.toFixed(2)}`,
            };
        }

        return { allowed: true };
    }

    /**
     * Send cost alert if approaching limit
     */
    static async checkAndSendCostAlert(userId: string) {
        const preferences = await db.userPreferences.findUnique({
            where: { userId },
            include: { user: true },
        });

        if (!preferences?.monthlyCostLimit || !preferences.costAlertEmail) {
            return;
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const usage = await db.lLMCall.aggregate({
            where: {
                document: { userId },
                createdAt: { gte: startOfMonth },
            },
            _sum: { cost: true },
        });

        const currentCost = usage._sum.cost || 0;
        const percentage = (currentCost / preferences.monthlyCostLimit) * 100;

        // Send alert at 80% and 100%
        if (percentage >= 80 && percentage < 100) {
            // TODO: Implement email sending
            console.log(`Cost alert: User ${userId} at ${percentage.toFixed(0)}% of limit`);

            // Send webhook if configured
            if (preferences.costAlertWebhook) {
                await this.sendWebhookAlert(preferences.costAlertWebhook, {
                    userId,
                    email: preferences.user.email,
                    currentCost,
                    limit: preferences.monthlyCostLimit,
                    percentage,
                });
            }
        }
    }

    private static async sendWebhookAlert(webhookUrl: string, data: any) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'cost_alert',
                    timestamp: new Date().toISOString(),
                    data,
                }),
            });
        } catch (error) {
            console.error('Failed to send webhook alert:', error);
        }
    }
}