
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/auth-provider';
import {
  LayoutDashboard,
  Camera,
  BrainCircuit,
  Building2,
  Salad,
  FileText,
  FileSpreadsheet,
  UserCircle,
  Siren,
  LogOut,
  Stethoscope,
  ChevronLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ProfileProvider } from '@/context/profile-provider';
import { ProfileGuard } from './auth/profile-guard';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from './ui/button';


const menuItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log", label: "AI Logger", icon: Camera },
  { href: "/deep-dive", label: "Deep Dive", icon: BrainCircuit },
  { href: "/clinic", label: "Clinic", icon: Building2 },
  { href: "/dietician", label: "AI Dietician", icon: Salad },
  { href: "/report", label: "Health Report", icon: FileText },
  { href: "/reminders", label: "Prescriptions", icon: FileSpreadsheet },
];

const bottomMenuItems: { href: string; label: string; icon: LucideIcon; isDestructive?: boolean }[] = [
    { href: "/profiles", label: "My Profile", icon: UserCircle },
    { href: "/emergency", label: "Emergency", icon: Siren, isDestructive: true },
];

function AppShellInternal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { toggleSidebar, state } = useSidebar();

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader>
           {/* Header is kept for structure but content is moved to main header */}
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                    <SidebarMenuButton
                        isActive={pathname === item.href}
                        icon={<item.icon />}
                        tooltip={{ children: item.label, side: "right" }}
                    >
                        {item.label}
                    </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                 {bottomMenuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <Link href={item.href}>
                             <SidebarMenuButton
                                isActive={pathname === item.href}
                                icon={<item.icon />}
                                className={item.isDestructive ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : ''}
                                tooltip={{ children: item.label, side: "right" }}
                            >
                                {item.label}
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                     <SidebarMenuButton
                        onClick={handleLogout}
                        icon={<LogOut />}
                        tooltip={{ children: 'Logout', side: "right" }}
                    >
                        Logout
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
            <div className="flex items-center gap-2">
                 <SidebarTrigger className="md:hidden" />
                 <Button
                    variant="ghost"
                    size="icon"
                    className="hidden md:flex"
                    onClick={toggleSidebar}
                    aria-label="Toggle Sidebar"
                 >
                    <ChevronLeft className={`h-5 w-5 transition-transform duration-300 ${state === 'collapsed' ? 'rotate-180' : ''}`} />
                 </Button>
                 <div className="hidden md:flex items-center gap-2">
                    <Stethoscope className="w-8 h-8 text-primary" />
                    <span className="font-bold text-lg text-foreground">Lifeline AI</span>
                </div>
            </div>
            <div className="md:hidden flex items-center gap-2">
                <Stethoscope className="w-8 h-8 text-primary" />
                <span className="font-bold text-lg text-foreground">Lifeline AI</span>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-foreground hidden sm:inline-block">{user?.displayName || 'User'}</span>
                <UserCircle className="h-8 w-8 text-primary" />
            </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <ProfileGuard>
                {children}
            </ProfileGuard>
        </main>
      </SidebarInset>
    </>
  );
}


export function AppShell({ children }: { children: React.ReactNode }) {
    const defaultOpen = typeof window !== 'undefined' ? 
        document.cookie.includes('sidebar_state=true') : true;

    return (
        <ProfileProvider>
            <SidebarProvider defaultOpen={defaultOpen}>
                 <AppShellInternal>{children}</AppShellInternal>
            </SidebarProvider>
        </ProfileProvider>
    )
}
