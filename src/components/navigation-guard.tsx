// File: src/components/navigation-guard.tsx
// ============================================

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface NavigationGuardProps {
    children: React.ReactNode;
    allowedRoles?: string[];
    redirectTo?: string;
}

export function NavigationGuard({
    children,
    allowedRoles = ["USER", "DEVELOPER", "ADMIN"],
    redirectTo = "/dashboard"
}: NavigationGuardProps) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return;

        if (!session) {
            router.push("/auth/signin");
            return;
        }

        const userRole = session.user?.role ?? "USER";
        if (!allowedRoles.includes(userRole)) {
            router.push(redirectTo);
        }
    }, [session, status, router, allowedRoles, redirectTo]);

    if (status === "loading") {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const userRole = session?.user?.role ?? "USER";
    if (!session || !allowedRoles.includes(userRole)) {
        return null;
    }

    return <>{children}</>;
}