// src/components/layout/navigation.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import {
    Home,
    FileText,
    BookOpen,
    Settings,
    BarChart3,
    Menu,
    X,
    Search,
    Bell,
    HelpCircle,
    LogOut,
    ChevronDown,
    Plus,
    User,
    CreditCard,
    Shield,
    Sparkles,
    Code2
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { useSession } from "next-auth/react";
import { UserMenu } from "./user-menu";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { useHotkeys } from "react-hotkeys-hook";

interface NavItem {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    children?: NavItem[];
    requiresAuth?: boolean;
    roles?: string[];
}

const navItems: NavItem[] = [
    {
        title: "Dashboard",
        href: "/",
        icon: Home,
    },
    {
        title: "Documents",
        href: "/documents",
        icon: FileText,
        children: [
            {
                title: "All Documents",
                href: "/documents",
                icon: FileText,
            },
            {
                title: "Create New",
                href: "/documents/new",
                icon: Plus,
            },
        ],
    },
    {
        title: "Knowledge",
        href: "/knowledge",
        icon: BookOpen,
        badge: "NEW",
    },
    {
        title: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        requiresAuth: true,
    },
    {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        children: [
            {
                title: "Preferences",
                href: "/settings/preferences",
                icon: User,
            },
            {
                title: "API Keys",
                href: "/settings/api-keys",
                icon: Shield,
            },
            {
                title: "Billing",
                href: "/settings/billing",
                icon: CreditCard,
            },
        ],
    },
];

interface NavigationProps {
    className?: string;
}

export function Navigation({ className }: NavigationProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    // Command palette shortcut
    useHotkeys('cmd+k', () => setSearchOpen(true), { preventDefault: true });
    useHotkeys('ctrl+k', () => setSearchOpen(true), { preventDefault: true });

    const toggleExpanded = (title: string) => {
        setExpandedItems(prev =>
            prev.includes(title)
                ? prev.filter(item => item !== title)
                : [...prev, title]
        );
    };

    const isActive = (href: string) => {
        if (href === '/') return pathname === href;
        return pathname.startsWith(href);
    };

    const canAccess = (item: NavItem) => {
        if (!item.requiresAuth) return true;
        if (!session) return false;
        if (!item.roles || item.roles.length === 0) return true;
        return item.roles.includes(session.user.role || 'USER');
    };

    const renderNavItem = (item: NavItem, isMobile = false) => {
        if (!canAccess(item)) return null;

        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedItems.includes(item.title);
        const isItemActive = isActive(item.href);

        if (hasChildren) {
            return (
                <div key={item.title} className="space-y-1">
                    <button
                        onClick={() => toggleExpanded(item.title)}
                        className={cn(
                            "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            isItemActive
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted hover:text-foreground text-muted-foreground"
                        )}
                    >
                        <span className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" />
                            {item.title}
                        </span>
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-180"
                            )}
                        />
                    </button>
                    {isExpanded && (
                        <div className="ml-4 space-y-1">
                            {item.children.map(child => renderNavItem(child, isMobile))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <Link
                key={item.href}
                href={item.href}
                onClick={() => isMobile && setMobileOpen(false)}
                className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isItemActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted hover:text-foreground text-muted-foreground"
                )}
            >
                <item.icon className="h-4 w-4" />
                {item.title}
                {item.badge && (
                    <Badge variant="secondary" className="ml-auto">
                        {item.badge}
                    </Badge>
                )}
            </Link>
        );
    };

    return (
        <>
            {/* Desktop Navigation */}
            <nav className={cn("hidden lg:block", className)}>
                <div className="space-y-1">
                    {navItems.map(item => renderNavItem(item))}
                </div>
            </nav>

            {/* Mobile Navigation */}
            <div className="lg:hidden">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="lg:hidden">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px]">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold">DocuForge</h2>
                        </div>
                        <nav className="space-y-1">
                            {navItems.map(item => renderNavItem(item, true))}
                        </nav>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Search Command Palette */}
            <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
                <CommandInput placeholder="Search documents, settings, and more..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Documents">
                        <CommandItem onSelect={() => {
                            setSearchOpen(false);
                            window.location.href = '/documents/new';
                        }}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create New Document
                        </CommandItem>
                        <CommandItem onSelect={() => {
                            setSearchOpen(false);
                            window.location.href = '/documents';
                        }}>
                            <FileText className="mr-2 h-4 w-4" />
                            View All Documents
                        </CommandItem>
                    </CommandGroup>
                    <CommandGroup heading="Knowledge">
                        <CommandItem onSelect={() => {
                            setSearchOpen(false);
                            window.location.href = '/knowledge';
                        }}>
                            <BookOpen className="mr-2 h-4 w-4" />
                            Manage Knowledge Base
                        </CommandItem>
                    </CommandGroup>
                    <CommandGroup heading="Settings">
                        <CommandItem onSelect={() => {
                            setSearchOpen(false);
                            window.location.href = '/settings/preferences';
                        }}>
                            <Settings className="mr-2 h-4 w-4" />
                            Preferences
                        </CommandItem>
                        <CommandItem onSelect={() => {
                            setSearchOpen(false);
                            window.location.href = '/settings/api-keys';
                        }}>
                            <Shield className="mr-2 h-4 w-4" />
                            API Keys
                        </CommandItem>
                    </CommandGroup>
                    <CommandGroup heading="Help">
                        <CommandItem onSelect={() => {
                            setSearchOpen(false);
                            // Open help docs
                        }}>
                            <HelpCircle className="mr-2 h-4 w-4" />
                            Documentation
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}

// Top Navigation Bar Component
export function TopNav() {
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center">
                <div className="mr-4 hidden md:flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <Sparkles className="h-6 w-6" />
                        <span className="hidden font-bold sm:inline-block">
                            DocuForge
                        </span>
                    </Link>
                    {(session?.user?.role === "ADMIN" || session?.user?.role === "DEVELOPER") && (
                        <Link href="/admin/generators">
                            <Button variant="ghost">
                                <Code2 className="h-4 w-4 mr-2" />
                                Generators
                            </Button>
                        </Link>
                    )}
                </div>

                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        <Button
                            variant="outline"
                            className="relative h-9 w-full justify-start text-sm text-muted-foreground md:w-40 lg:w-64"
                            onClick={() => setSearchOpen(true)}
                        >
                            <Search className="mr-2 h-4 w-4" />
                            Search...
                            <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                                <span className="text-xs">⌘</span>K
                            </kbd>
                        </Button>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon">
                            <Bell className="h-5 w-5" />
                        </Button>
                        <UserMenu />
                    </div>
                </div>
            </div>
        </header>
    );
}