
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
  Siren,
  LogOut,
  Settings,
  Bell,
  Wallet,
  Calculator,
  Ruler,
  LifeBuoy,
  HeartHandshake,
  BookOpen,
  Bot,
  CreditCard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  SidebarProvider,
  Sidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { SheetClose } from './ui/sheet';
import { InstallButton } from './pwa/install-button';
import { useSettings } from '@/context/settings-provider';

interface MenuItem {
    href: string;
    label: string;
    icon: LucideIcon;
    featureFlag?: 'isClinicEnabled' | 'isReportEnabled' | 'isPrescriptionsEnabled';
}

const mainMenuItems: MenuItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log", label: "Vitals Logger", icon: Camera },
  { href: "/deep-dive", label: "Deep Dive", icon: BrainCircuit },
  { href: "/clinic", label: "Clinic", icon: Building2, featureFlag: 'isClinicEnabled' },
  { href: "/dietician", label: "Meal Analyzer", icon: Salad },
  { href: "/report", label: "Health Report", icon: FileText, featureFlag: 'isReportEnabled' },
  { href: "/reminders", label: "Prescriptions", icon: FileSpreadsheet, featureFlag: 'isPrescriptionsEnabled' },
  { href: "/ebook-store", label: "Ebook Store", icon: BookOpen },
  { href: "/subscription", label: "Subscription", icon: CreditCard },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();

  const handleLogout = async () => {
    try {
      // Sign out from both Firebase and Pi Network
      if (auth) {
        await signOut(auth);
      }
      
      // Clear Pi Network data
      localStorage.removeItem('pi_user');
      localStorage.removeItem('pi_user_data');
      
      // Refresh the page to reset all states
      window.location.href = '/';
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const filteredMainMenuItems = mainMenuItems.filter(item => {
    if (item.featureFlag) {
        return settings?.featureFlags?.[item.featureFlag] ?? true;
    }
    return true;
  });

  const sidebarMenu = (isMobile: boolean) => {
    const Wrapper = isMobile ? SheetClose : React.Fragment;
    const wrapperProps = isMobile ? { asChild: true } : {};
    
    return (
        <SidebarMenu>
            <SidebarSeparator className="mb-2" />
            {filteredMainMenuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                    <Wrapper {...wrapperProps}>
                        <Link href={item.href}>
                            <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label} icon={<item.icon/>}>
                                <span>{item.label}</span>
                            </SidebarMenuButton>
                        </Link>
                    </Wrapper>
                </SidebarMenuItem>
            ))}
            <SidebarSeparator className="my-2" />
            <p className="px-2 text-xs font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">Health Tools</p>
             <SidebarMenuItem>
                <Wrapper {...wrapperProps}>
                    <Link href="/bmi">
                        <SidebarMenuButton asChild isActive={pathname === '/bmi'} tooltip="BMI Calculator" icon={<Calculator/>}>
                            <span>BMI Calculator</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Wrapper {...wrapperProps}>
                    <Link href="/body-metrics">
                        <SidebarMenuButton asChild isActive={pathname === '/body-metrics'} tooltip="Body Metrics" icon={<Ruler/>}>
                            <span>Body Metrics</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Wrapper {...wrapperProps}>
                    <Link href="/period-tracker">
                        <SidebarMenuButton asChild isActive={pathname === '/period-tracker'} tooltip="Period Tracker" icon={<HeartHandshake/>}>
                            <span>Period Tracker</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
            <SidebarSeparator className="my-2" />
            <SidebarMenuItem>
                <Wrapper {...wrapperProps}>
                    <Link href="/wallet">
                        <SidebarMenuButton asChild isActive={pathname === '/wallet'} tooltip="Wallet" icon={<Wallet/>}>
                            <span>Wallet</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Wrapper {...wrapperProps}>
                    <Link href="/support">
                        <SidebarMenuButton asChild isActive={pathname === '/support'} tooltip="Support" icon={<LifeBuoy/>}>
                            <span>Support</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Wrapper {...wrapperProps}>
                    <Link href="/profiles">
                        <SidebarMenuButton asChild isActive={pathname === '/profiles'} tooltip="Settings" icon={<Settings/>}>
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
            <SidebarSeparator className="my-2" />
            <InstallButton />
            <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip="Logout" icon={<LogOut/>}>
                    Logout
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
  }

  return (
    <>
      <Sidebar menu={sidebarMenu} />
      
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <SidebarTrigger className="shrink-0"/>
            
            <div className="flex items-center gap-2 text-primary">
                <Bot className="w-8 h-8" />
                <span className="font-bold text-xl">Lifeline</span>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Toggle notifications</span>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>{user?.displayName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{user?.displayName}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>
                            My Account
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
        
        <main className="flex-1 p-4 sm:p-6">
            {children}
        </main>
      </SidebarInset>
    </>
  );
}


export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayout>{children}</AppLayout>
    </SidebarProvider>
  );
}
