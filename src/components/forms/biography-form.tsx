// src/components/forms/biography-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { FormGenerator } from "~/components/forms/form-generator";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { AlertCircle, Sparkles, User, Briefcase, Calendar, MapPin, Target, Edit3, Focus, FileText } from "lucide-react";
import { toast } from "sonner";
import { biographySchema, biographyFieldConfig } from "~/config/schemas/biography";
import { DocumentType } from "@prisma/client";

interface BiographyFormProps {
    onSubmit: (data: any) => Promise<void>;
    isSubmitting?: boolean;
    defaultValues?: any;
}

export function BiographyForm({ onSubmit, isSubmitting = false, defaultValues }: BiographyFormProps) {
    const router = useRouter();
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleSubmit = async (data: any) => {
        try {
            await onSubmit(data);
            toast.success("Biography created successfully!");
            router.push("/documents");
        } catch (error) {
            toast.error("Failed to create biography. Please try again.");
        }
    };

    const fieldConfig = {
        ...biographyFieldConfig,
        // Add icons and enhanced UI
        "subject.name": {
            ...biographyFieldConfig["subject.name"],
            icon: <User className="h-4 w-4" />,
        },
        "subject.occupation": {
            ...biographyFieldConfig["subject.occupation"],
            icon: <Briefcase className="h-4 w-4" />,
        },
        "subject.birthDate": {
            ...biographyFieldConfig["subject.birthDate"],
            icon: <Calendar className="h-4 w-4" />,
        },
        "subject.birthPlace": {
            ...biographyFieldConfig["subject.birthPlace"],
            icon: <MapPin className="h-4 w-4" />,
        },
        purpose: {
            ...biographyFieldConfig.purpose,
            icon: <Target className="h-4 w-4" />,
        },
        tone: {
            ...biographyFieldConfig.tone,
            icon: <Edit3 className="h-4 w-4" />,
        },
        focusAreas: {
            ...biographyFieldConfig.focusAreas,
            icon: <Focus className="h-4 w-4" />,
        },
        additionalInfo: {
            label: "Additional Information",
            placeholder: "Add any specific details, achievements, or context you want included...",
            type: "textarea",
            rows: 4,
            icon: <FileText className="h-4 w-4" />,
        },
    };

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <Card className="border-primary/20">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Create a Biography</CardTitle>
                            <CardDescription>
                                Generate a professional biography tailored to your needs
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Quick Start Guide */}
            <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                    <strong>Quick Start:</strong> Fill in the subject's name and select a purpose to get started.
                    You can customize the tone and focus areas for a more personalized biography.
                </AlertDescription>
            </Alert>

            {/* Main Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Biography Details</CardTitle>
                    <CardDescription>
                        Provide information about the person you're writing about
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FormGenerator
                        schema={biographySchema}
                        onSubmit={handleSubmit}
                        fieldConfig={fieldConfig}
                        defaultValues={defaultValues}
                        submitButton={{
                            label: isSubmitting ? "Creating Biography..." : "Generate Biography",
                            disabled: isSubmitting,
                            icon: <Sparkles className="h-4 w-4" />,
                        }}
                        sections={[
                            {
                                title: "Subject Information",
                                description: "Basic details about the person",
                                fields: ["subject.name", "subject.occupation", "subject.birthDate", "subject.birthPlace"],
                            },
                            {
                                title: "Biography Settings",
                                description: "Customize how the biography will be written",
                                fields: ["purpose", "tone", "outputLength"],
                            },
                            {
                                title: "Content Focus",
                                description: "Choose which aspects to emphasize",
                                fields: ["focusAreas"],
                                collapsible: true,
                                defaultCollapsed: !showAdvanced,
                            },
                            {
                                title: "Additional Context",
                                description: "Any specific information you want included",
                                fields: ["additionalInfo"],
                                collapsible: true,
                                defaultCollapsed: !showAdvanced,
                            },
                        ]}
                    />
                </CardContent>
            </Card>

            {/* Tips Card */}
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-base">Tips for Better Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-3">
                        <Badge variant="secondary" className="shrink-0">Purpose</Badge>
                        <p className="text-sm text-muted-foreground">
                            Choose the right purpose - professional for LinkedIn/resumes, academic for research contexts
                        </p>
                    </div>
                    <Separator />
                    <div className="flex gap-3">
                        <Badge variant="secondary" className="shrink-0">Details</Badge>
                        <p className="text-sm text-muted-foreground">
                            The more specific information you provide, the more personalized and accurate the biography will be
                        </p>
                    </div>
                    <Separator />
                    <div className="flex gap-3">
                        <Badge variant="secondary" className="shrink-0">Focus</Badge>
                        <p className="text-sm text-muted-foreground">
                            Select focus areas that are most relevant to your biography's purpose and audience
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Advanced Options Toggle */}
            <div className="flex justify-center">
                <Button
                    variant="ghost"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm"
                >
                    {showAdvanced ? "Hide" : "Show"} Advanced Options
                </Button>
            </div>
        </div>
    );
}