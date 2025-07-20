// src/app/settings/page.tsx
"use client";

import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { toast } from "sonner";
import {
    User,
    Bell,
    CreditCard,
    Key,
    Palette,
    Globe,
    Shield,
    Zap,
    AlertTriangle,
    Check,
    Copy,
    Eye,
    EyeOff,
    RefreshCw,
    Download,
    Trash2,
    ChevronRight,
    Loader2
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface UserPreferences {
    emailNotifications: boolean;
    marketingEmails: boolean;
    documentReminders: boolean;
    weeklyDigest: boolean;
    defaultDocumentLength: string;
    defaultTone: string;
    autoSave: boolean;
    theme: string;
    language: string;
}

export default function SettingsPage() {
    const { userId } = useAuth();
    const { user } = useUser();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");
    const [showApiKey, setShowApiKey] = useState(false);
    const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

    // Mock data - replace with API calls
    const [apiKey] = useState("sk_live_abc123xyz789...");
    const [preferences, setPreferences] = useState<UserPreferences>({
        emailNotifications: true,
        marketingEmails: false,
        documentReminders: true,
        weeklyDigest: true,
        defaultDocumentLength: "medium",
        defaultTone: "professional",
        autoSave: true,
        theme: "system",
        language: "en",
    });

    if (!userId) {
        router.push("/sign-in");
        return null;
    }

    const handleSavePreferences = async () => {
        setIsLoading(true);
        try {
            // API call to save preferences
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Preferences saved successfully");
        } catch (error) {
            toast.error("Failed to save preferences");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegenerateApiKey = async () => {
        try {
            // API call to regenerate key
            toast.success("API key regenerated successfully");
        } catch (error) {
            toast.error("Failed to regenerate API key");
        }
    };

    const handleExportData = async () => {
        try {
            // API call to export data
            toast.success("Data export initiated. You'll receive an email when it's ready.");
        } catch (error) {
            toast.error("Failed to export data");
        }
    };

    const handleDeleteAccount = async () => {
        try {
            // API call to delete account
            toast.success("Account deletion initiated");
            router.push("/");
        } catch (error) {
            toast.error("Failed to delete account");
        }
    };

    const copyApiKey = () => {
        navigator.clipboard.writeText(apiKey);
        toast.success("API key copied to clipboard");
    };

    // Mock subscription data
    const subscription = {
        plan: "Pro",
        tokensUsed: 125000,
        tokenLimit: 500000,
        nextBillingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
    };

    return (
        <div className="container max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-2 lg:grid-cols-6 w-full">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="preferences">Preferences</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                    <TabsTrigger value="api">API</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>
                                Update your profile details and personal information
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input id="firstName" defaultValue={user?.firstName || ""} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input id="lastName" defaultValue={user?.lastName || ""} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    defaultValue={user?.primaryEmailAddress?.emailAddress || ""}
                                    disabled
                                />
                                <p className="text-xs text-muted-foreground">
                                    Email cannot be changed. Contact support if you need assistance.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="bio">Bio</Label>
                                <Textarea
                                    id="bio"
                                    placeholder="Tell us a bit about yourself..."
                                    className="min-h-[100px]"
                                />
                            </div>

                            <Button onClick={handleSavePreferences} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Preferences Tab */}
                <TabsContent value="preferences" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Document Preferences</CardTitle>
                            <CardDescription>
                                Set your default preferences for document generation
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="defaultLength">Default Document Length</Label>
                                <Select
                                    value={preferences.defaultDocumentLength}
                                    onValueChange={(value) => setPreferences({ ...preferences, defaultDocumentLength: value })}
                                >
                                    <SelectTrigger id="defaultLength">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="brief">Brief (1-2 pages)</SelectItem>
                                        <SelectItem value="medium">Medium (3-5 pages)</SelectItem>
                                        <SelectItem value="detailed">Detailed (6+ pages)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="defaultTone">Default Writing Tone</Label>
                                <Select
                                    value={preferences.defaultTone}
                                    onValueChange={(value) => setPreferences({ ...preferences, defaultTone: value })}
                                >
                                    <SelectTrigger id="defaultTone">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="professional">Professional</SelectItem>
                                        <SelectItem value="casual">Casual</SelectItem>
                                        <SelectItem value="academic">Academic</SelectItem>
                                        <SelectItem value="creative">Creative</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="autoSave">Auto-save Documents</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically save your work every 30 seconds
                                    </p>
                                </div>
                                <Switch
                                    id="autoSave"
                                    checked={preferences.autoSave}
                                    onCheckedChange={(checked) => setPreferences({ ...preferences, autoSave: checked })}
                                />
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label htmlFor="theme">Theme</Label>
                                <Select
                                    value={preferences.theme}
                                    onValueChange={(value) => setPreferences({ ...preferences, theme: value })}
                                >
                                    <SelectTrigger id="theme">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light</SelectItem>
                                        <SelectItem value="dark">Dark</SelectItem>
                                        <SelectItem value="system">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="language">Language</Label>
                                <Select
                                    value={preferences.language}
                                    onValueChange={(value) => setPreferences({ ...preferences, language: value })}
                                >
                                    <SelectTrigger id="language">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="es">Spanish</SelectItem>
                                        <SelectItem value="fr">French</SelectItem>
                                        <SelectItem value="de">German</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handleSavePreferences} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Preferences
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notification Preferences</CardTitle>
                            <CardDescription>
                                Choose what notifications you want to receive
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="emailNotifications">Email Notifications</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Receive email updates about your documents
                                        </p>
                                    </div>
                                    <Switch
                                        id="emailNotifications"
                                        checked={preferences.emailNotifications}
                                        onCheckedChange={(checked) => setPreferences({ ...preferences, emailNotifications: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="documentReminders">Document Reminders</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Get notified about document deadlines and updates
                                        </p>
                                    </div>
                                    <Switch
                                        id="documentReminders"
                                        checked={preferences.documentReminders}
                                        onCheckedChange={(checked) => setPreferences({ ...preferences, documentReminders: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="weeklyDigest">Weekly Digest</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Summary of your document activity
                                        </p>
                                    </div>
                                    <Switch
                                        id="weeklyDigest"
                                        checked={preferences.weeklyDigest}
                                        onCheckedChange={(checked) => setPreferences({ ...preferences, weeklyDigest: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="marketingEmails">Marketing Emails</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Product updates and special offers
                                        </p>
                                    </div>
                                    <Switch
                                        id="marketingEmails"
                                        checked={preferences.marketingEmails}
                                        onCheckedChange={(checked) => setPreferences({ ...preferences, marketingEmails: checked })}
                                    />
                                </div>
                            </div>

                            <Button onClick={handleSavePreferences} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Notification Settings
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Billing Tab */}
                <TabsContent value="billing" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Subscription Details</CardTitle>
                            <CardDescription>
                                Manage your subscription and billing information
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                                <div>
                                    <p className="font-medium">Current Plan</p>
                                    <p className="text-sm text-muted-foreground">
                                        You're on the {subscription.plan} plan
                                    </p>
                                </div>
                                <Badge variant="default">{subscription.plan}</Badge>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Token Usage</span>
                                    <span>{(subscription.tokensUsed / 1000).toFixed(0)}k / {subscription.tokenLimit / 1000}k</span>
                                </div>
                                <Progress value={(subscription.tokensUsed / subscription.tokenLimit) * 100} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Next billing date</p>
                                    <p className="text-sm text-muted-foreground">
                                        {subscription.nextBillingDate.toLocaleDateString()}
                                    </p>
                                </div>
                                <Button variant="outline">
                                    Manage Subscription
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="font-medium mb-4">Payment Method</h4>
                                <div className="flex items-center justify-between p-4 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <CreditCard className="h-5 w-5" />
                                        <div>
                                            <p className="font-medium">•••• •••• •••• 4242</p>
                                            <p className="text-sm text-muted-foreground">Expires 12/25</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">Update</Button>
                                </div>
                            </div>

                            <Button variant="outline" className="w-full">
                                View Billing History
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* API Tab */}
                <TabsContent value="api" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>API Access</CardTitle>
                            <CardDescription>
                                Manage your API keys and developer settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    Keep your API key secret. Anyone with your key can access your account.
                                </AlertDescription>
                            </Alert>

                            <div>
                                <Label htmlFor="apiKey">API Key</Label>
                                <div className="flex gap-2 mt-2">
                                    <div className="relative flex-1">
                                        <Input
                                            id="apiKey"
                                            type={showApiKey ? "text" : "password"}
                                            value={apiKey}
                                            readOnly
                                            className="pr-20"
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                            >
                                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={copyApiKey}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <Button variant="outline" onClick={handleRegenerateApiKey}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Regenerate
                                    </Button>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="font-medium mb-4">API Usage</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Requests today</span>
                                        <span className="font-medium">1,234</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Requests this month</span>
                                        <span className="font-medium">45,678</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Rate limit</span>
                                        <span className="font-medium">1,000 req/hour</span>
                                    </div>
                                </div>
                            </div>

                            <Button variant="outline" className="w-full">
                                View API Documentation
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Security Settings</CardTitle>
                            <CardDescription>
                                Manage your account security and privacy
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <Shield className="h-5 w-5" />
                                        <div>
                                            <p className="font-medium">Two-Factor Authentication</p>
                                            <p className="text-sm text-muted-foreground">
                                                Add an extra layer of security to your account
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="outline">Enable</Button>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <Key className="h-5 w-5" />
                                        <div>
                                            <p className="font-medium">Password</p>
                                            <p className="text-sm text-muted-foreground">
                                                Last changed 3 months ago
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="outline">Change</Button>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="font-medium mb-4">Data & Privacy</h4>
                                <div className="space-y-2">
                                    <Button variant="outline" className="w-full justify-start" onClick={handleExportData}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export My Data
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-destructive hover:text-destructive"
                                        onClick={() => setDeleteAccountOpen(true)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Account
                                    </Button>
                                </div>
                            </div>

                            <Alert>
                                <Shield className="h-4 w-4" />
                                <AlertDescription>
                                    Your data is encrypted at rest and in transit. We never share your personal information.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Delete Account Dialog */}
            <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove all your data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}