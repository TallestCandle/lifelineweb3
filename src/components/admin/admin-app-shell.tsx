
"use client"

import * as React from "react"
import { Shield, LogOut, Settings, Newspaper, BookOpen, Bot } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "../ui/button"
import { useAuth } from "@/context/auth-provider"
import Link from "next/link"
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
import { SheetClose } from '../ui/sheet';


function AdminAppShellInternal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  
  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      router.push('/admin/auth');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const menu = (isMobile: boolean) => {
    const Wrapper = isMobile ? SheetClose : React.Fragment;
    const wrapperProps = isMobile ? { asChild: true } : {};

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                 <Wrapper {...wrapperProps}>
                    <Link href="/admin/dashboard">
                        <SidebarMenuButton asChild isActive={pathname === '/admin/dashboard'} tooltip="Dashboard" icon={<Settings/>}>
                            <span>Dashboard</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
             <SidebarMenuItem>
                 <Wrapper {...wrapperProps}>
                    <Link href="/admin/blog">
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/blog')} tooltip="Blog" icon={<Newspaper/>}>
                            <span>Blog</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
            <SidebarMenuItem>
                 <Wrapper {...wrapperProps}>
                    <Link href="/admin/ebooks">
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/ebooks')} tooltip="Ebooks" icon={<BookOpen/>}>
                            <span>Ebooks</span>
                        </SidebarMenuButton>
                    </Link>
                </Wrapper>
            </SidebarMenuItem>
             <SidebarSeparator className="my-2" />
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
        <Sidebar menu={menu} side="left">
            <div className="flex items-center justify-center h-16 border-b">
                <a href="/admin/dashboard" className="flex items-center gap-2 text-primary">
                    <Shield className="w-8 h-8" />
                    <h1 className="text-xl font-headline font-bold group-data-[collapsible=icon]:hidden">Admin Panel</h1>
                </a>
            </div>
        </Sidebar>

        <SidebarInset>
            <header className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <SidebarTrigger />
                    <div className="flex items-center gap-2 text-primary md:hidden">
                        <Bot className="w-8 h-8" />
                        <h1 className="text-xl font-headline font-bold">Lifeline</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <p className="text-sm font-bold hidden sm:block">{user?.displayName}</p>
                    <Button variant="ghost" onClick={handleLogout} className="md:hidden">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                {children}
            </main>
        </SidebarInset>
    </>
  )
}

export function AdminAppShell({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AdminAppShellInternal>{children}</AdminAppShellInternal>
        </SidebarProvider>
    )
}
