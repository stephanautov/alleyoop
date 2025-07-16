//src/app/page.tsx

import Link from "next/link";
import { getServerAuthSession } from "~/server/auth-compat";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  FileText,
  Zap,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Users,
  BarChart,
  Globe
} from "lucide-react";
import { getEnabledDocumentTypes, getDocumentConfig } from "~/config/documents";

export default async function HomePage() {
  const session = await getServerAuthSession();
  const enabledTypes = getEnabledDocumentTypes();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">DocuForge</span>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
                <Link href="/api/auth/signout">
                  <Button variant="outline">Sign Out</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/api/auth/signin">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/api/auth/signin">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container relative z-10 py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4" variant="secondary">
              <Sparkles className="mr-1 h-3 w-3" />
              Powered by GPT-4 & Claude 3
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Generate Professional Documents{" "}
              <span className="text-primary">in Minutes</span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
              Create biographies, business plans, legal summaries, and more with
              AI-powered assistance. Export to PDF, Word, or Markdown instantly.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href={session ? "/dashboard" : "/api/auth/signin"}>
                <Button size="lg" className="w-full sm:w-auto">
                  Start Creating <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-gray-950">
          <div className="absolute h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]"></div>
        </div>
      </section>

      {/* Document Types */}
      <section className="border-t py-16">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Document Types</h2>
            <p className="text-lg text-muted-foreground">
              Choose from our growing collection of professional document templates
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {enabledTypes.map((type) => {
              const config = getDocumentConfig(type);
              const Icon = getIconComponent(config.icon);
              return (
                <Card key={type} className="transition-all hover:shadow-lg">
                  <CardHeader>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{config.name}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {config.exportFormats.map((format) => (
                        <Badge key={format} variant="secondary" className="text-xs">
                          {format.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {/* Coming Soon */}
            <Card className="border-dashed opacity-60">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle>More Coming Soon</CardTitle>
                <CardDescription>
                  We're constantly adding new document types based on user feedback
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t py-16">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Why Choose DocuForge?</h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to create professional documents efficiently
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="mb-2 font-semibold">Lightning Fast</h3>
              <p className="text-sm text-muted-foreground">
                Generate complete documents in minutes, not hours
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="mb-2 font-semibold">Secure & Private</h3>
              <p className="text-sm text-muted-foreground">
                Your documents are encrypted and never shared
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="mb-2 font-semibold">Multiple Formats</h3>
              <p className="text-sm text-muted-foreground">
                Export to PDF, Word, Markdown, and more
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <BarChart className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="mb-2 font-semibold">Track Progress</h3>
              <p className="text-sm text-muted-foreground">
                Real-time updates as your document is created
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t py-16">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">How It Works</h2>
            <p className="text-lg text-muted-foreground">
              Three simple steps to your perfect document
            </p>
          </div>
          <div className="mx-auto max-w-3xl">
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  1
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Choose Your Document Type</h3>
                  <p className="text-muted-foreground">
                    Select from our library of professional document templates
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  2
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Provide Key Information</h3>
                  <p className="text-muted-foreground">
                    Fill out a simple form with the essential details for your document
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  3
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Download & Share</h3>
                  <p className="text-muted-foreground">
                    Export your completed document in your preferred format
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t py-16">
        <div className="container">
          <div className="grid gap-8 text-center sm:grid-cols-3">
            <div>
              <div className="text-4xl font-bold text-primary">10k+</div>
              <div className="mt-2 text-muted-foreground">Documents Created</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">98%</div>
              <div className="mt-2 text-muted-foreground">Satisfaction Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">5 min</div>
              <div className="mt-2 text-muted-foreground">Average Generation Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t py-16">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold">
              Ready to Create Your First Document?
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Join thousands of professionals who trust DocuForge for their document needs
            </p>
            <Link href={session ? "/dashboard" : "/api/auth/signin"}>
              <Button size="lg">
                Get Started for Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold">DocuForge</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 DocuForge. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper function to get icon component
function getIconComponent(iconName: string) {
  const icons: Record<string, any> = {
    User: Users,
    Scale: Shield,
    Briefcase: BarChart,
    FileHeart: FileText,
    FileText: FileText,
  };
  return icons[iconName] || FileText;
}