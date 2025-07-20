// src/components/layout/user-menu.tsx
"use client";

import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/ui/badge";
import {
    User,
    Settings,
    CreditCard,
    LogOut,
    HelpCircle,
    Sparkles,
    Shield,
    FileText,
    BarChart3,
    Code2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function UserMenu() {
    const { data: session } = useSession();
    const router = useRouter();

    if (!session) {
        return (
            <Button variant="ghost" asChild>
                <Link href="/auth/signin">Sign In</Link>
            </Button>
        );
    }

    const user = session.user;
    const initials = user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

    const handleSignOut = async () => {
        await signOut({ redirect: false });
        router.push("/");
    };

    const getRoleBadge = (role?: string) => {
        switch (role) {
            case "ADMIN":
                return (
                    <Badge variant="destructive" className="ml-2">
                        Admin
                    </Badge>
                );
            case "DEVELOPER":
                return (
                    <Badge variant="secondary" className="ml-2">
                        Developer
                    </Badge>
                );
            default:
                return null;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none flex items-center">
                            {user.name}
                            {getRoleBadge(user.role)}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href="/profile" className="cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/documents" className="cursor-pointer">
                            <FileText className="mr-2 h-4 w-4" />
                            <span>My Documents</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/analytics" className="cursor-pointer">
                            <BarChart3 className="mr-2 h-4 w-4" />
                            <span>Analytics</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/settings/preferences" className="cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href="/settings/billing" className="cursor-pointer">
                            <CreditCard className="mr-2 h-4 w-4" />
                            <span>Billing</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/settings/api-keys" className="cursor-pointer">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>API Keys</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                {(user.role === "ADMIN" || user.role === "DEVELOPER") && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Admin Tools
                            </DropdownMenuLabel>
                            {user.role === "DEVELOPER" && (
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/generators" className="cursor-pointer">
                                        <Code2 className="mr-2 h-4 w-4" />
                                        <span>Code Generators</span>
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            {user.role === "ADMIN" && (
                                <DropdownMenuItem asChild>
                                    <Link href="/admin" className="cursor-pointer">
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        <span>Admin Dashboard</span>
                                    </Link>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/help" className="cursor-pointer">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        <span>Help & Support</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}