// src/app/_components/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/components/theme-provider";
import { SocketProvider } from "~/components/providers/socket-provider";
import { SidebarProvider } from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <TRPCReactProvider>
                    <SocketProvider>
                        <SidebarProvider>
                            {children}
                            <Toaster richColors closeButton />
                        </SidebarProvider>
                    </SocketProvider>
                </TRPCReactProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}