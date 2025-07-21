// File: src/components/app-sidebar.tsx (or similar navigation component)
// ============================================
"use client";
import {
    Code2,
    FileText,
    Home,
    Settings,
    Users,
    Sparkles // For generators
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from "~/components/ui/sidebar";
import Link from "next/link";
import { useSession } from "next-auth/react";

export function AppSidebar() {
    const { data: session } = useSession();
    const userRole = session?.user?.role ?? "USER";

    const menuItems = [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: Home,
            roles: ["USER", "DEVELOPER", "ADMIN"]
        },
        {
            title: "Documents",
            url: "/documents",
            icon: FileText,
            roles: ["USER", "DEVELOPER", "ADMIN"]
        },
        {
            title: "Code Generators",
            url: "/admin/generators",
            icon: Sparkles,
            roles: ["DEVELOPER", "ADMIN"], // Only for developers and admins
            badge: "Beta" // Optional badge
        },
        {
            title: "Settings",
            url: "/settings",
            icon: Settings,
            roles: ["USER", "DEVELOPER", "ADMIN"]
        },
        {
            title: "Admin",
            url: "/admin",
            icon: Users,
            roles: ["ADMIN"]
        }
    ];

    // Filter menu items based on user role
    const visibleMenuItems = menuItems.filter(item =>
        item.roles.includes(userRole)
    );

    return (
        <Sidebar>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {visibleMenuItems.map((item) => (
                                <SidebarMenuItem key={item.url}>
                                    <SidebarMenuButton asChild>
                                        <Link href={item.url}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                            {item.badge && (
                                                <span className="ml-auto text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}