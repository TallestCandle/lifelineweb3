
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileProvider } from '@/context/profile-provider';
import { ProfileGuard } from './auth/profile-guard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const menuItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log", label: "AI Logger", icon: Camera },
  { href: "/deep-dive", label: "Deep Dive", icon: BrainCircuit },
  { href: "/clinic", label: "Clinic", icon: Building2 },
  { href: "/dietician", label: "AI Dietician", icon: Salad },
  { href: "/report", label: "Health Report", icon: FileText },
  { href: "/reminders", label: "Prescriptions", icon: FileSpreadsheet },
];

const bottomMenuItems: { href: string; label: string; icon: LucideIcon; isAction?: boolean, isDestructive?: boolean }[] = [
    { href: "/profiles", label: "My Profile", icon: UserCircle },
    { href: "/emergency", label: "Emergency", icon: Siren, isDestructive: true },
    { href: "#", label: "Logout", icon: LogOut, isAction: true },
];

function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

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

  if (!isClient) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <TooltipProvider delayDuration={0}>
        <aside className="fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border bg-card">
          <div className="flex h-16 items-center justify-center border-b border-border px-4">
            <Link href="/" className="flex items-center gap-2 text-primary">
              <Stethoscope className="w-8 h-8" />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col items-center gap-2 py-4">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground",
                        isActive && "bg-primary text-primary-foreground hover:text-primary-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
          <nav className="mt-auto flex flex-col items-center gap-2 py-4">
            {bottomMenuItems.map((item) => {
                const isActive = pathname === item.href;
                 return (
                    <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                        <button
                        onClick={item.isAction ? handleLogout : () => router.push(item.href)}
                        className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground",
                            isActive && "bg-primary text-primary-foreground hover:text-primary-foreground",
                            item.isDestructive && "hover:text-red-500"
                        )}
                        >
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.label}</span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                );
            })}
          </nav>
        </aside>
      </TooltipProvider>

      <div className="flex flex-1 flex-col pl-[65px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-end border-b border-border bg-card/80 px-6 backdrop-blur-sm">
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
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <ProfileProvider>
            <AppShellLayout>{children}</AppShellLayout>
        </ProfileProvider>
    )
}
