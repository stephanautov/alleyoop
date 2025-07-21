//src/app/layout.tsx

import "~/styles/globals.css";
import { Inter } from "next/font/google";
import { Navigation, TopNav } from "~/components/layout/navigation";
import { AppSidebar } from "~/components/app-sidebar";
import { Providers } from "./_components/providers";
import type { Metadata } from "next";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
});

export const metadata: Metadata = {
    title: "AlleyOop - AI Document Generation",
    description: "Generate professional documents with AI assistance",
    keywords: ["document generation", "AI", "biography", "business plan", "professional documents"],
    authors: [{ name: "AlleyOop Team" }],
    openGraph: {
        title: "AlleyOop - AI Document Generation",
        description: "Generate professional documents with AI assistance",
        type: "website",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`font-sans ${inter.variable} antialiased`}>
                <Providers>
                    <div className="flex h-screen">
                        {/* Option 1: Use existing app-sidebar with navigation */}
                        <AppSidebar />

                        {/* Option 2: Use new navigation component */}
                        {/* <aside className="w-64 border-r bg-background">
                    <Navigation />
                  </aside> */}

                        <div className="flex-1 flex flex-col">
                            <TopNav />
                            <main className="flex-1 overflow-y-auto">
                                {children}
                            </main>
                        </div>
                    </div>
                </Providers>
            </body>
        </html>
    );
}