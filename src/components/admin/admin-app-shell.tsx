
"use client"

import * as React from "react"
import { Shield, LogOut, Settings } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "../ui/button"
import { useAuth } from "@/context/auth-provider"
import Link from "next/link"

export function AdminAppShell({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="min-h-screen w-full flex bg-secondary/30">
      <nav className="hidden md:flex flex-col w-64 bg-background border-r">
        <div className="flex items-center justify-center h-16 border-b">
            <a href="/admin/dashboard" className="flex items-center gap-2 text-primary">
                <Shield className="w-8 h-8" />
                <h1 className="text-xl font-headline font-bold">Admin Panel</h1>
            </a>
        </div>
        <div className="flex-1 p-4 space-y-2">
            <Button asChild variant={pathname === '/admin/dashboard' ? 'secondary' : 'ghost'} className="w-full justify-start">
                <Link href="/admin/dashboard"><Settings className="mr-2"/>Dashboard</Link>
            </Button>
        </div>
         <div className="p-4 border-t">
            <Button variant="ghost" className="w-full justify-start mt-2" onClick={handleLogout}>
                <LogOut className="mr-2"/>
                <span>Logout</span>
            </Button>
        </div>
      </nav>
      <div className="flex flex-col flex-1">
        <header className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 md:justify-end">
            <div className="flex items-center gap-2 text-primary md:hidden">
                <Shield className="w-8 h-8" />
                <h1 className="text-xl font-headline font-bold">Admin Panel</h1>
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
      </div>
    </div>
  )
}
