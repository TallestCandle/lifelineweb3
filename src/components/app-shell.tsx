"use client"

import * as React from "react"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger
} from "@/components/ui/sidebar"
import { Home, ListChecks, HeartPulse, Siren, Stethoscope } from "lucide-react"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/tasks", label: "Daily Tasks", icon: ListChecks },
  { href: "/vitals", label: "Vitals Log", icon: HeartPulse },
  { href: "/emergency", label: "Emergency", icon: Siren },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const getPageTitle = () => {
    const currentItem = navItems.find(item => item.href === pathname);
    return currentItem ? currentItem.label : "Nexus Lifeline";
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <Stethoscope className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-headline font-bold">Nexus Lifeline</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.label}
                >
                  <a href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between p-4 border-b">
          <h2 className="text-2xl font-bold font-headline">{getPageTitle()}</h2>
          <SidebarTrigger className="md:hidden" />
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
