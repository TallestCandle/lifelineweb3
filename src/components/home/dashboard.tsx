
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

type DashboardColor = "chart-1" | "destructive" | "chart-2" | "chart-4" | "chart-5" | "primary" | "chart-6";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  colorClass: `text-${DashboardColor}`;
  borderClass: `group-hover:border-${DashboardColor}`;
  shadowClass: `group-hover:shadow-${DashboardColor}/40`;
  glowClass: `bg-${DashboardColor}/10`;
}

const menuItems: MenuItem[] = [
    { href: "/tasks", label: "Daily Tasks", icon: ListChecks, colorClass: "text-chart-1", borderClass: "group-hover:border-chart-1", shadowClass: "group-hover:shadow-chart-1/40", glowClass: "bg-chart-1/10" },
    { href: "/vitals", label: "Vitals Log", icon: HeartPulse, colorClass: "text-destructive", borderClass: "group-hover:border-destructive", shadowClass: "group-hover:shadow-destructive/40", glowClass: "bg-destructive/10" },
    { href: "/test-strips", label: "Test Strips", icon: Beaker, colorClass: "text-chart-2", borderClass: "group-hover:border-chart-2", shadowClass: "group-hover:shadow-chart-2/40", glowClass: "bg-chart-2/10" },
    { href: "/reminders", label: "Medication", icon: Pill, colorClass: "text-chart-4", borderClass: "group-hover:border-chart-4", shadowClass: "group-hover:shadow-chart-4/40", glowClass: "bg-chart-4/10" },
    { href: "/analysis", label: "AI Analysis", icon: BrainCircuit, colorClass: "text-chart-5", borderClass: "group-hover:border-chart-5", shadowClass: "group-hover:shadow-chart-5/40", glowClass: "bg-chart-5/10" },
    { href: "/report", label: "Health Report", icon: FileText, colorClass: "text-primary", borderClass: "group-hover:border-primary", shadowClass: "group-hover:shadow-primary/40", glowClass: "bg-primary/10" },
    { href: "/emergency", label: "Emergency", icon: Siren, colorClass: "text-destructive", borderClass: "group-hover:border-destructive", shadowClass: "group-hover:shadow-destructive/40", glowClass: "bg-destructive/10" },
    { href: "/profiles", label: "Profiles", icon: Users, colorClass: "text-chart-6", borderClass: "group-hover:border-chart-6", shadowClass: "group-hover:shadow-chart-6/40", glowClass: "bg-chart-6/10" },
];

export function Dashboard() {
  const router = useRouter();
  const { activeProfile } = useProfile();
  
  const firstName = activeProfile?.name.split(' ')[0];
  const greeting = firstName ? `Welcome, ${firstName}.` : 'Welcome.';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground/90">
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
                item.borderClass,
                `group-hover:shadow-lg ${item.shadowClass}`
              )}>
                <div className={cn(
                  "absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  item.glowClass
                )} />
                <Icon className={cn("w-6 h-6 transition-colors duration-300", item.colorClass)} />
              </div>
              <div className="h-8 flex items-center">
                  <p className="text-xs font-bold text-foreground/80 transition-colors duration-300 group-hover:text-foreground">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
