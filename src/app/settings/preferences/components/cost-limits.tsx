'use client';

// src/app/settings/preferences/components/cost-limits.tsx

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { DollarSign, AlertCircle, TrendingUp } from "lucide-react";
import { api } from "~/trpc/react";

interface CostLimitsProps {
    preferences: any;
    onUpdate: (updates: any) => void;
}

export function CostLimits({ preferences, onUpdate }: CostLimitsProps) {
    const [monthlyCostLimit, setMonthlyCostLimit] = useState(
        preferences?.monthlyCostLimit?.toString() || ""
    );
    const [costAlertWebhook, setCostAlertWebhook] = useState(
        preferences?.costAlertWebhook || ""
    );

    const { data: costStatus } = api.preferences.checkCostLimit.useQuery();

    const handleSave = () => {
        onUpdate({
            monthlyCostLimit: monthlyCostLimit ? parseFloat(monthlyCostLimit) : null,
            costAlertEmail: preferences?.costAlertEmail,
            costAlertWebhook: costAlertWebhook || null,
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Cost Management</CardTitle>
                    <CardDescription>
                        Set spending limits and configure alerts
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {costStatus && costStatus.limit && (
                        <Alert>
                            <TrendingUp className="h-4 w-4" />
                            <AlertDescription>
                                Current monthly usage: ${costStatus.currentCost.toFixed(2)} / ${costStatus.limit.toFixed(2)} ({costStatus.percentage}%)
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="monthly-limit">Monthly Cost Limit (USD)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="monthly-limit"
                                type="number"
                                placeholder="100.00"
                                value={monthlyCostLimit}
                                onChange={(e) => setMonthlyCostLimit(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Document generation will be paused when this limit is reached
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="email-alerts">Email Cost Alerts</Label>
                            <Switch
                                id="email-alerts"
                                checked={preferences?.costAlertEmail ?? true}
                                onCheckedChange={(checked) => onUpdate({ costAlertEmail: checked })}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Receive email alerts when approaching your cost limit
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="webhook">Alert Webhook URL (Optional)</Label>
                        <Input
                            id="webhook"
                            type="url"
                            placeholder="https://your-webhook.com/alerts"
                            value={costAlertWebhook}
                            onChange={(e) => setCostAlertWebhook(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                            Send cost alerts to your monitoring system
                        </p>
                    </div>

                    <Button onClick={handleSave} className="w-full">
                        Save Cost Settings
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}