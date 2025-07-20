
"use client"

import * as React from "react"
import { Stethoscope, LogOut, Users, BarChart, MessageSquare, UserCircle } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "../ui/button"
import { useAuth } from "@/context/auth-provider"
import Link from "next/link"
import { DoctorProfileProvider, useDoctorProfile } from "@/context/doctor-profile-provider"
import { DoctorProfileGuard } from "./doctor-profile-guard"


const pageTitles: Record<string, string> = {
  "/doctor/dashboard": "Doctor Dashboard",
  "/doctor/messages": "Messages",
  "/doctor/profile": "Your Profile",
};

function DoctorAppShellInternal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useDoctorProfile();
  
  const getPageTitle = () => {
    return pageTitles[pathname] || "Doctor Portal";
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
    <div className="min-h-screen w-full flex">
      <nav className="hidden md:flex flex-col w-64 bg-secondary border-r border-primary/20">
        <div className="flex items-center justify-center h-16 border-b border-primary/20">
            <a href="/doctor/dashboard" className="flex items-center gap-2 text-primary">
                <Stethoscope className="w-8 h-8" />
                <h1 className="text-xl font-headline font-bold">Lifeline AI</h1>
            </a>
        </div>
        <div className="flex-1 p-4 space-y-2">
            <Button asChild variant={pathname === '/doctor/dashboard' ? 'default' : 'ghost'} className="w-full justify-start">
                <Link href="/doctor/dashboard"><BarChart className="mr-2"/>Dashboard</Link>
            </Button>
             <Button asChild variant={pathname.startsWith('/doctor/messages') ? 'default' : 'ghost'} className="w-full justify-start">
                <Link href="/doctor/messages"><MessageSquare className="mr-2"/>Messages</Link>
            </Button>
        </div>
         <div className="p-4 border-t border-primary/20">
            <Button asChild variant={pathname === '/doctor/profile' ? 'secondary' : 'ghost'} className="w-full justify-start">
                <Link href="/doctor/profile"><UserCircle className="mr-2"/>Your Profile</Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start mt-2" onClick={handleLogout}>
                <LogOut className="mr-2"/>
                <span>Logout</span>
            </Button>
        </div>
      </nav>
      <div className="flex flex-col flex-1">
        <header className="flex items-center justify-between p-4 border-b border-primary/20 bg-background/80 backdrop-blur-sm sticky top-0 z-10 md:justify-end">
            <div className="flex items-center gap-2 text-primary md:hidden">
                <Stethoscope className="w-8 h-8" />
                <h1 className="text-xl font-headline font-bold">Lifeline AI</h1>
            </div>
            <div className="flex items-center gap-4">
                <p className="text-sm font-bold hidden sm:block">{profile?.name || user?.displayName}</p>
                 <Button variant="ghost" onClick={handleLogout} className="md:hidden">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                </Button>
            </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 animated-gradient-bg">
            <DoctorProfileGuard>
                {children}
            </DoctorProfileGuard>
        </main>
      </div>
    </div>
  )
}

export function DoctorAppShell({ children }: { children: React.ReactNode }) {
  return (
    <DoctorProfileProvider>
      <DoctorAppShellInternal>{children}</DoctorAppShellInternal>
    </DoctorProfileProvider>
  )
}
