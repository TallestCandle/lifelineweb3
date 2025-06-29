
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ListChecks,
  HeartPulse,
  Beaker,
  Pill,
  BrainCircuit,
  FileText,
  Siren,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import { useProfile } from '@/context/profile-provider';

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
  border: string;
  shadow: string;
  glow: string;
}

const menuItems: MenuItem[] = [
    { href: "/tasks", label: "Daily Tasks", icon: ListChecks, color: "text-green-400", border: "group-hover:border-green-400", shadow: "group-hover:shadow-lg group-hover:shadow-green-400/40", glow: "bg-green-400/10" },
    { href: "/vitals", label: "Vitals Log", icon: HeartPulse, color: "text-red-500", border: "group-hover:border-red-500", shadow: "group-hover:shadow-lg group-hover:shadow-red-500/40", glow: "bg-red-500/10" },
    { href: "/test-strips", label: "Test Strips", icon: Beaker, color: "text-purple-400", border: "group-hover:border-purple-400", shadow: "group-hover:shadow-lg group-hover:shadow-purple-400/40", glow: "bg-purple-400/10" },
    { href: "/reminders", label: "Medication", icon: Pill, color: "text-orange-400", border: "group-hover:border-orange-400", shadow: "group-hover:shadow-lg group-hover:shadow-orange-400/40", glow: "bg-orange-400/10" },
    { href: "/analysis", label: "AI Analysis", icon: BrainCircuit, color: "text-cyan-400", border: "group-hover:border-cyan-400", shadow: "group-hover:shadow-lg group-hover:shadow-cyan-400/40", glow: "bg-cyan-400/10" },
    { href: "/report", label: "Health Report", icon: FileText, color: "text-indigo-400", border: "group-hover:border-indigo-400", shadow: "group-hover:shadow-lg group-hover:shadow-indigo-400/40", glow: "bg-indigo-400/10" },
    { href: "/emergency", label: "Emergency", icon: Siren, color: "text-red-600", border: "group-hover:border-red-600", shadow: "group-hover:shadow-lg group-hover:shadow-red-600/40", glow: "bg-red-600/10" },
    { href: "/profiles", label: "Profiles", icon: Users, color: "text-yellow-400", border: "group-hover:border-yellow-400", shadow: "group-hover:shadow-lg group-hover:shadow-yellow-400/40", glow: "bg-yellow-400/10" },
];

export function Dashboard() {
  const router = useRouter();
  const { activeProfile } = useProfile();
  
  const firstName = activeProfile?.name.split(' ')[0];
  const greeting = firstName ? `Welcome, ${firstName}.` : 'Welcome.';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">
          {greeting}
        </h1>
        <p className="text-muted-foreground">Here's your command center for a healthier life.</p>
      </div>
      <div className="grid grid-cols-4 gap-4 pt-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div 
              key={item.href}
              className="flex flex-col items-center justify-start text-center gap-2 cursor-pointer group"
              onClick={() => router.push(item.href)}
              onKeyDown={(e) => e.key === 'Enter' && router.push(item.href)}
              tabIndex={0}
            >
              <div className={cn(
                "relative flex items-center justify-center bg-card/50 p-3 rounded-full shadow-lg border border-primary/20 transition-all duration-300 group-hover:-translate-y-1",
                item.border,
                item.shadow
              )}>
                <div className={cn(
                  "absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  item.glow
                )} />
                <Icon className={cn("w-6 h-6 transition-colors duration-300", item.color)} />
              </div>
              <div className="h-8 flex items-center">
                  <p className="text-xs font-medium text-foreground/80 transition-colors duration-300 group-hover:text-foreground">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
