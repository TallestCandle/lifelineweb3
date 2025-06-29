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

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const menuItems: MenuItem[] = [
  { href: "/tasks", label: "Daily Tasks", icon: ListChecks },
  { href: "/vitals", label: "Vitals Log", icon: HeartPulse },
  { href: "/test-strips", label: "Test Strips", icon: Beaker },
  { href: "/reminders", label: "Medication", icon: Pill },
  { href: "/analysis", label: "AI Analysis", icon: BrainCircuit },
  { href: "/report", label: "Health Report", icon: FileText },
  { href: "/emergency", label: "Emergency", icon: Siren },
  { href: "/profiles", label: "Profiles", icon: Users },
];

export function Dashboard() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Welcome to Nexus Lifeline</h1>
        <p className="text-muted-foreground">Your personal health and wellness companion.</p>
      </div>
      <div className="grid grid-cols-4 gap-4 pt-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div 
              key={item.href}
              className="flex flex-col items-center justify-start text-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-accent/50 transition-colors"
              onClick={() => router.push(item.href)}
              onKeyDown={(e) => e.key === 'Enter' && router.push(item.href)}
              tabIndex={0}
            >
              <div className="bg-card p-3 rounded-full shadow-sm border">
                  <Icon className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs font-medium text-foreground h-8 flex items-center">{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
