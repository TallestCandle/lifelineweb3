
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
  Search,
  Camera,
  ClipboardCheck,
  UserCircle,
  Building2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileProvider } from '@/context/profile-provider';
import { ProfileGuard } from './auth/profile-guard';


const menuItems: { href: string; label: string; icon: LucideIcon; color: string }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, color: "text-blue-400" },
  { href: "/log", label: "AI Logger", icon: Camera, color: "text-yellow-400" },
  { href: "/deep-dive", label: "Deep Dive", icon: BrainCircuit, color: "text-sky-400" },
  { href: "/investigation", label: "Admission", icon: ClipboardCheck, color: "text-purple-400" },
  { href: "/clinic", label: "Clinic", icon: Building2, color: "text-teal-400" },
  { href: "/dietician", label: "AI Dietician", icon: Salad, color: "text-green-400" },
  { href: "/report", label: "Health Report", icon: FileText, color: "text-orange-400" },
  { href: "/reminders", label: "Medication", icon: Pill, color: "text-pink-400" },
  { href: "/profiles", label: "My Profile", icon: UserCircle, color: "text-gray-400" },
  { href: "/emergency", label: "Emergency", icon: Siren, color: "text-red-500" },
];


function AppShellLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <>
      <Sidebar side="left" collapsible="icon" variant="inset">
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label} size="lg">
                  <Link href={item.href}>
                    <item.icon className={cn(item.color)} />
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
                    <SidebarMenuButton onClick={handleLogout} tooltip="Logout" size="lg">
                        <LogOut />
                        <span>Logout</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
           </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-20 items-center justify-between p-4 border-b border-border/10 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center gap-4">
                <SidebarTrigger />
                <Link href="/" className="flex items-center gap-2 text-primary">
                    <Stethoscope className="w-8 h-8" />
                    <span className="text-2xl font-bold">Lifeline</span>
                </Link>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-sm font-bold hidden sm:inline-block">{user?.displayName || 'User'}</span>
            </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 animated-gradient-bg">
            <ProfileGuard>
                {children}
            </ProfileGuard>
        </main>
      </SidebarInset>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <ProfileProvider>
            <SidebarProvider>
                <AppShellLayout>{children}</AppShellLayout>
            </SidebarProvider>
        </ProfileProvider>
    )
}
