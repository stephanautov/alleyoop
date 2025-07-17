// src/app/settings/preferences/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { api } from "~/trpc/react";
import { ProviderMatrix } from "./components/provider-matrix";
import { CostLimits } from "./components/cost-limits";
import { PerformanceSettings } from "./components/performance-settings";

export default function PreferencesPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("providers");

    const { data: preferences, isLoading } = api.preferences.get.useQuery();
    const { data: providers } = api.preferences.validateProviders.useQuery();
    const updatePreferences = api.preferences.update.useMutation({
        onSuccess: () => {
            router.refresh();
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container max-w-4xl py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Preferences</h1>
                <p className="text-muted-foreground">
                    Configure your default settings for document generation
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="providers">Providers</TabsTrigger>
                    <TabsTrigger value="costs">Costs & Limits</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                </TabsList>

                <TabsContent value="providers" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Provider Preferences</CardTitle>
                            <CardDescription>
                                Set your preferred AI provider for each document type
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ProviderMatrix
                                preferences={preferences}
                                availableProviders={providers}
                                onUpdate={(providerModels) => {
                                    updatePreferences.mutate({ providerModels });
                                }}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="costs" className="space-y-6">
                    <CostLimits
                        preferences={preferences}
                        onUpdate={(updates) => {
                            updatePreferences.mutate(updates);
                        }}
                    />
                </TabsContent>

                <TabsContent value="performance" className="space-y-6">
                    <PerformanceSettings
                        preferences={preferences}
                        onUpdate={(updates) => {
                            updatePreferences.mutate(updates);
                        }}
                    />
                </TabsContent>
            </Tabs>

            {updatePreferences.isError && (
                <Alert variant="destructive" className="mt-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to save preferences. Please try again.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}