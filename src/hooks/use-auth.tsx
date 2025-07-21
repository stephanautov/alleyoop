"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useAuth(requireAuth = true) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (requireAuth && status === "unauthenticated") {
            router.push("/auth/signin");
        }
    }, [requireAuth, status, router]);

    return {
        user: session?.user,
        userId: session?.user?.id,
        isLoaded: status !== "loading",
        isSignedIn: status === "authenticated",
        session,
        status,
    };
}