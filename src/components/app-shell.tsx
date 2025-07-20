
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
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
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

const mainMenuItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log", label: "AI Logger", icon: Camera },
  { href: "/deep-dive", label: "Deep Dive", icon: BrainCircuit },
  { href: "/clinic", label: "Clinic", icon: Building2 },
  { href: "/dietician", label: "AI Dietician", icon: Salad },
  { href: "/report", label: "Health Report", icon: FileText },
  { href: "/reminders", label: "Prescriptions", icon: FileSpreadsheet },
];

const toolsMenuItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/bmi", label: "BMI Calculator", icon: Calculator },
    { href: "/body-metrics", label: "Body Metrics", icon: Ruler },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const sidebarMenu = (isMobile: boolean) => {
    const Wrapper = isMobile ? SheetClose : React.Fragment;
    const wrapperProps = isMobile ? { asChild: true } : {};
    
    return (
        <SidebarMenu>
            <SidebarSeparator className="mb-2" />
            {mainMenuItems.map((item) => (
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
             {toolsMenuItems.map((item) => (
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
                    <Link href="/profiles">
                        <SidebarMenuButton asChild isActive={pathname === '/profiles'} tooltip="Settings" icon={<Settings/>}>
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
            <SidebarSeparator className="my-2" />
            <SidebarMenuItem>
                <Wrapper {...wrapperProps}>
                    <Link href="/emergency">
                        <SidebarMenuButton asChild isActive={pathname === '/emergency'} tooltip="Emergency" className="text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground" icon={<Siren/>}>
                            <span>Emergency</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
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
            
            <div className="flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                    <path d="M12 2L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 19L12 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19.0711 4.92896L16.9497 7.05028" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7.05023 16.9497L4.92892 19.0711" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19.0711 19.0711L16.9497 16.9497" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7.05023 7.05028L4.92892 4.92896" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15.9546 15.2234L15.3486 14.6174C16.3213 13.6446 16.3213 12.0696 15.3486 11.0968L12.9038 8.65198C11.9311 7.67925 10.3561 7.67925 9.38334 8.65198L8.64861 9.38671" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8.77661 8.04541L8.04188 8.78014C7.06915 9.75287 7.06915 11.3279 8.04188 12.3006L10.4867 14.7454C11.4594 15.7182 13.0344 15.7182 14.0071 14.7454L14.6514 14.1011" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-bold text-xl">Lifeline AI</span>
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
                                <AvatarImage src={`https://i.pravatar.cc/150?u=${user?.uid}`} alt={user?.displayName || 'User'} />
                                <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
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
