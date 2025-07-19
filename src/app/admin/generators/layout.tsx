// File: src/app/admin/generators/layout.tsx
// ============================================

import { NavigationGuard } from "~/components/navigation-guard";

export default function GeneratorsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <NavigationGuard allowedRoles={["DEVELOPER", "ADMIN"]}>
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                {children}
            </div>
        </NavigationGuard>
    );
}