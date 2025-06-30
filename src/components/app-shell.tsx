
"use client"

import * as React from "react"
import { Stethoscope, LogOut, ChevronsUpDown, User as UserIcon, PlusCircle } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useProfile } from "@/context/profile-provider"
import { Button } from "./ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { ThemeToggle } from "./theme/theme-toggle"
import { useTheme } from "@/context/theme-provider"

// Define a map for page titles
const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/tasks": "Daily Tasks",
  "/vitals": "Vitals Log",
  "/test-strips": "Test Strips",
  "/reminders": "Medication Reminders",
  "/analysis": "AI Analysis",
  "/report": "Health Report",
  "/dietician": "AI Dietician",
  "/emergency": "Emergency",
  "/profiles": "Manage Profiles",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProfile, profiles, switchProfile } = useProfile();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    if (activeProfile?.theme) {
      setTheme(activeProfile.theme);
    }
  }, [activeProfile, setTheme]);
  
  const getPageTitle = () => {
    return pageTitles[pathname] || "Nexus Lifeline";
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
    <div className="min-h-screen w-full flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-primary/20 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-primary">
                <Stethoscope className="w-8 h-8" />
                <h1 className="text-xl font-headline font-bold hidden sm:block">Nexus Lifeline</h1>
            </a>
            {pathname !== '/' && (
                <>
                    <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>
                    <h2 className="text-xl font-bold font-headline text-foreground/80">{getPageTitle()}</h2>
                </>
            )}
          </div>
          <div className="flex items-center gap-4">
              {activeProfile && (
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                  <AvatarFallback>{activeProfile.name.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="hidden sm:inline-block">{activeProfile.name}</span>
                              <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56" align="end">
                          <DropdownMenuLabel>Switch Profile</DropdownMenuLabel>
                          <DropdownMenuGroup>
                              {profiles.map(profile => (
                                  <DropdownMenuItem key={profile.id} onClick={() => switchProfile(profile.id)} disabled={profile.id === activeProfile.id}>
                                      <UserIcon className="mr-2 h-4 w-4" />
                                      <span>{profile.name}</span>
                                  </DropdownMenuItem>
                              ))}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="focus:bg-transparent p-2">
                            <ThemeToggle />
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <DropdownMenuItem onClick={() => router.push('/profiles')}>
                              <PlusCircle className="mr-2 h-4 w-4" />
                              <span>Manage Profiles</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <DropdownMenuItem onClick={handleLogout}>
                              <LogOut className="mr-2 h-4 w-4" />
                              <span>Logout</span>
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
              )}
          </div>
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8 animated-gradient-bg">
          {children}
      </main>
    </div>
  )
}
