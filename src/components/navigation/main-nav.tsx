// src/components/navigation/main-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "~/components/ui/navigation-menu";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
    Sparkles,
    FileText,
    Plus,
    Search,
    Bell,
    Settings,
    HelpCircle,
    Menu,
    X,
    Home,
    BarChart3,
    CreditCard,
    Users,
    Code,
    BookOpen,
    Zap,
    ChevronDown,
    User
} from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";

const navigation = [
    {
        name: "Dashboard",
        href: "/dashboard",
        icon: Home,
    },
    {
        name: "Documents",
        href: "/documents",
        icon: FileText,
        children: [
            {
                name: "All Documents",
                href: "/documents",
                description: "View and manage all your documents",
            },
            {
                name: "Create New",
                href: "/documents/new",
                description: "Start a new document from scratch",
                icon: Plus,
            },
            {
                name: "Templates",
                href: "/templates",
                description: "Browse pre-made templates",
                icon: Sparkles,
            },
        ],
    },
    {
        name: "Analytics",
        href: "/analytics",
        icon: BarChart3,
    },
];

const resourcesNav = [
    {
        name: "Help Center",
        href: "/help",
        icon: HelpCircle,
        description: "Get help with AlleyOop",
    },
    {
        name: "API Docs",
        href: "/developers",
        icon: Code,
        description: "Integrate with our API",
    },
    {
        name: "Blog",
        href: "/blog",
        icon: BookOpen,
        description: "Tips and best practices",
    },
];

export function MainNav() {
    const pathname = usePathname();
    const { data: session, status: sessionStatus } = useSession();
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Mock notification count - replace with real data
    const notificationCount = 3;

    return (
        <header className={cn(
            "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
            isScrolled && "shadow-sm"
        )}>
            <div className="container flex h-16 items-center">
                {/* Logo */}
                <Link href="/" className="mr-6 flex items-center space-x-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    <span className="hidden font-bold sm:inline-block">AlleyOop</span>
                </Link>

                {/* Desktop Navigation */}
                <NavigationMenu className="hidden lg:flex">
                    <NavigationMenuList>
                        {navigation.map((item) => (
                            <NavigationMenuItem key={item.name}>
                                {item.children ? (
                                    <>
                                        <NavigationMenuTrigger className={cn(
                                            pathname.startsWith(item.href) && "bg-accent"
                                        )}>
                                            <item.icon className="mr-2 h-4 w-4" />
                                            {item.name}
                                        </NavigationMenuTrigger>
                                        <NavigationMenuContent>
                                            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">
                                                {item.children.map((child) => (
                                                    <li key={child.name}>
                                                        <NavigationMenuLink asChild>
                                                            <Link
                                                                href={child.href}
                                                                className={cn(
                                                                    "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                                                    pathname === child.href && "bg-accent"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {child.icon && <child.icon className="h-4 w-4" />}
                                                                    <div className="text-sm font-medium leading-none">
                                                                        {child.name}
                                                                    </div>
                                                                </div>
                                                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                                                    {child.description}
                                                                </p>
                                                            </Link>
                                                        </NavigationMenuLink>
                                                    </li>
                                                ))}
                                            </ul>
                                        </NavigationMenuContent>
                                    </>
                                ) : (
                                    <Link href={item.href} legacyBehavior passHref>
                                        <NavigationMenuLink className={cn(
                                            "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                                            pathname.startsWith(item.href) && "bg-accent"
                                        )}>
                                            <item.icon className="mr-2 h-4 w-4" />
                                            {item.name}
                                        </NavigationMenuLink>
                                    </Link>
                                )}
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>

                {/* Right side items */}
                <div className="ml-auto flex items-center gap-4">
                    {/* Search */}
                    <div className="hidden lg:block">
                        {searchOpen ? (
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search documents..."
                                    className="pl-10 pr-10 w-[300px]"
                                    autoFocus
                                    onBlur={() => setSearchOpen(false)}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                    onClick={() => setSearchOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSearchOpen(true)}
                            >
                                <Search className="h-5 w-5" />
                            </Button>
                        )}
                    </div>

                    {/* Quick Create */}
                    <Button asChild className="hidden sm:flex">
                        <Link href="/documents/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Create
                        </Link>
                    </Button>

                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative">
                                <Bell className="h-5 w-5" />
                                {notificationCount > 0 && (
                                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                                        {notificationCount}
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-80" align="end">
                            <DropdownMenuLabel className="flex items-center justify-between">
                                Notifications
                                <Badge variant="secondary">{notificationCount} new</Badge>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium">Document completed</p>
                                    <p className="text-xs text-muted-foreground">
                                        Your business plan has been generated
                                    </p>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium">Usage alert</p>
                                    <p className="text-xs text-muted-foreground">
                                        You've used 80% of your monthly tokens
                                    </p>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium">New feature</p>
                                    <p className="text-xs text-muted-foreground">
                                        Grant proposals are now available!
                                    </p>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="w-full">
                                <Link href="/notifications" className="w-full text-center text-sm">
                                    View all notifications
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Resources */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="hidden lg:flex">
                                Resources
                                <ChevronDown className="ml-1 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            {resourcesNav.map((item) => (
                                <DropdownMenuItem key={item.name} asChild>
                                    <Link href={item.href} className="flex items-center">
                                        <item.icon className="mr-2 h-4 w-4" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{item.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {item.description}
                                            </span>
                                        </div>
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/changelog" className="flex items-center">
                                    <Zap className="mr-2 h-4 w-4" />
                                    What's new
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* User Menu */}
                    {sessionStatus === "authenticated" && session?.user ? (
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/settings">
                                <User className="mr-2 h-4 w-4" />
                                {session.user.name}
                            </Link>
                        </Button>
                    ) : (
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/sign-in">Sign In</Link>
                        </Button>
                    )}

                    {/* Mobile menu button */}
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="lg:hidden">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                            <nav className="flex flex-col gap-4 mt-4">
                                {navigation.map((item) => (
                                    <div key={item.name}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                "flex items-center gap-2 text-sm font-medium py-2",
                                                pathname.startsWith(item.href) && "text-primary"
                                            )}
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            {item.name}
                                        </Link>
                                        {item.children && (
                                            <div className="ml-6 mt-2 space-y-2">
                                                {item.children.map((child) => (
                                                    <Link
                                                        key={child.name}
                                                        href={child.href}
                                                        className="block text-sm text-muted-foreground hover:text-foreground py-1"
                                                        onClick={() => setMobileMenuOpen(false)}
                                                    >
                                                        {child.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="border-t pt-4 mt-4">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                                        RESOURCES
                                    </p>
                                    {resourcesNav.map((item) => (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className="flex items-center gap-2 text-sm py-2"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            {item.name}
                                        </Link>
                                    ))}
                                </div>
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}