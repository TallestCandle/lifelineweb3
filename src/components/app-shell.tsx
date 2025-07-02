
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/auth-provider';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  HeartPulse,
  Beaker,
  Pill,
  BrainCircuit,
  FileText,
  Siren,
  Salad,
  LayoutDashboard,
  LogOut,
  Stethoscope,
  Bot
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const menuItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vitals", label: "Vitals Log", icon: HeartPulse },
  { href: "/test-strips", label: "Test Strips", icon: Beaker },
  { href: "/analysis", label: "AI Analysis", icon: BrainCircuit },
  { href: "/doctors", label: "AI Consultation", icon: Bot },
  { href: "/dietician", label: "AI Dietician", icon: Salad },
  { href: "/report", label: "Health Report", icon: FileText },
  { href: "/reminders", label: "Medication", icon: Pill },
  { href: "/emergency", label: "Emergency", icon: Siren },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      router.push('/auth');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const getPageTitle = () => {
    // Check for exact match first, especially for "/"
    const exactMatch = menuItems.find(item => item.href === pathname);
    if (exactMatch) return exactMatch.label;
    
    // Fallback for nested routes, avoiding "/"
    const nestedMatch = menuItems.find(item => item.href !== '/' && pathname.startsWith(item.href));
    if (nestedMatch) return nestedMatch.label;

    return 'Lifeline AI';
  };

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon" className="border-primary/20">
        <SidebarHeader className="h-20 items-center justify-center p-2">
            <Link href="/" className="flex items-center gap-2 text-primary group-data-[state=expanded]:w-full group-data-[state=expanded]:justify-start group-data-[state=collapsed]:justify-center">
                <Stethoscope className="w-8 h-8 shrink-0" />
                <span className="text-xl font-bold group-data-[state=collapsed]:hidden">Lifeline AI</span>
            </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
           <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                        <LogOut />
                        <span>Logout</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
           </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-20 items-center justify-between p-4 border-b border-border/10 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="md:hidden" />
                <h2 className="text-xl font-bold text-foreground/90">{getPageTitle()}</h2>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-sm font-bold hidden sm:inline-block">{user?.displayName || 'User'}</span>
            </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 animated-gradient-bg">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
