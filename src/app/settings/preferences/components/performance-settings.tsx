// src/app/settings/preferences/components/performance-settings.tsx

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Zap, Database, RefreshCw } from "lucide-react";

interface PerformanceSettingsProps {
    preferences: any;
    onUpdate: (updates: any) => void;
}

export function PerformanceSettings({ preferences, onUpdate }: PerformanceSettingsProps) {
    const handleSave = (updates: any) => {
        onUpdate(updates);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Generation Settings</CardTitle>
                    <CardDescription>
                        Fine-tune document generation behavior
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <Label>Temperature ({preferences?.temperature || 0.7})</Label>
                        <Slider
                            value={[preferences?.temperature || 0.7]}
                            onValueChange={([value]) => handleSave({ temperature: value })}
                            min={0}
                            max={2}
                            step={0.1}
                            className="w-full"
                        />
                        <p className="text-sm text-muted-foreground">
                            Lower values are more focused, higher values are more creative
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="prompt-style">System Prompt Style</Label>
                        <Select
                            value={preferences?.systemPromptStyle || 'professional'}
                            onValueChange={(value) => handleSave({ systemPromptStyle: value })}
                        >
                            <SelectTrigger id="prompt-style">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="creative">Creative</SelectItem>
                                <SelectItem value="technical">Technical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="max-tokens">Max Tokens Override</Label>
                        <Input
                            id="max-tokens"
                            type="number"
                            placeholder="Leave empty for defaults"
                            value={preferences?.maxTokensOverride || ''}
                            onChange={(e) => handleSave({
                                maxTokensOverride: e.target.value ? parseInt(e.target.value) : null
                            })}
                        />
                        <p className="text-sm text-muted-foreground">
                            Override the default maximum tokens for all generations
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Performance Options</CardTitle>
                    <CardDescription>
                        Optimize for speed or quality
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="prefer-speed" className="flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                Prefer Speed
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Use faster models when available
                            </p>
                        </div>
                        <Switch
                            id="prefer-speed"
                            checked={preferences?.preferSpeed ?? false}
                            onCheckedChange={(checked) => handleSave({ preferSpeed: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="allow-fallback" className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Allow Provider Fallback
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Switch providers if primary fails
                            </p>
                        </div>
                        <Switch
                            id="allow-fallback"
                            checked={preferences?.allowFallback ?? true}
                            onCheckedChange={(checked) => handleSave({ allowFallback: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="cache-enabled" className="flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Enable Caching
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Cache similar generations to save costs
                            </p>
                        </div>
                        <Switch
                            id="cache-enabled"
                            checked={preferences?.cacheEnabled ?? true}
                            onCheckedChange={(checked) => handleSave({ cacheEnabled: checked })}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}