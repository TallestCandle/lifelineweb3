"use client"

import * as React from "react"
import { Stethoscope, LogOut } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/context/auth-provider"
import { Button } from "./ui/button"

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
  "/doctors": "Consult a Doctor",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  
  const getPageTitle = () => {
    return pageTitles[pathname] || "Lifeline AI";
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
      <header className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-primary">
                <Stethoscope className="w-8 h-8" />
                <h1 className="text-xl font-headline font-bold hidden sm:block">Lifeline AI</h1>
            </a>
            {pathname !== '/' && (
                <>
                    <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>
                    <h2 className="text-xl font-bold font-headline text-foreground/80">{getPageTitle()}</h2>
                </>
            )}
          </div>
          <div className="flex items-center gap-4">
              <span className="text-sm font-bold hidden sm:inline-block">{user?.displayName || 'User'}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
          </div>
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8 animated-gradient-bg">
          {children}
      </main>
    </div>
  )
}
