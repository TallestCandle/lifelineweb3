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
  SidebarTrigger,
  SidebarFooter
} from "@/components/ui/sidebar"
import { Home, ListChecks, HeartPulse, Siren, Stethoscope, LogOut, FileText, Beaker, Pill, Users, ChevronsUpDown, User as UserIcon, PlusCircle } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useProfile } from "@/context/profile-provider"
import { Button } from "./ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Avatar, AvatarFallback } from "./ui/avatar"

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/tasks", label: "Daily Tasks", icon: ListChecks },
  { href: "/vitals", label: "Vitals Log", icon: HeartPulse },
  { href: "/test-strips", label: "Test Strips", icon: Beaker },
  { href: "/reminders", label: "Medication", icon: Pill },
  { href: "/report", label: "Health Report", icon: FileText },
  { href: "/emergency", label: "Emergency", icon: Siren },
  { href: "/profiles", label: "Profiles", icon: Users },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProfile, profiles, switchProfile } = useProfile();
  
  const getPageTitle = () => {
    // Special case for profiles page
    if (pathname === '/profiles') return 'Manage Profiles';
    const currentItem = navItems.find(item => item.href === pathname);
    return currentItem ? currentItem.label : "Nexus Lifeline";
  }

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
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout}>
                        <LogOut />
                        <span>Logout</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between p-4 border-b">
            <h2 className="text-2xl font-bold font-headline">{getPageTitle()}</h2>
            <div className="flex items-center gap-4">
                {activeProfile && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                    <AvatarFallback>{activeProfile.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span>{activeProfile.name}</span>
                                <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                            <DropdownMenuLabel>Switch Profile</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                {profiles.map(profile => (
                                    <DropdownMenuItem key={profile.id} onClick={() => switchProfile(profile.id)} disabled={profile.id === activeProfile.id}>
                                        <UserIcon className="mr-2 h-4 w-4" />
                                        <span>{profile.name}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => router.push('/profiles')}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                <span>Manage Profiles</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <SidebarTrigger className="md:hidden" />
            </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
