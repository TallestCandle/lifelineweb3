"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
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
  description: string;
  icon: LucideIcon;
}

const menuItems: MenuItem[] = [
  { href: "/tasks", label: "Daily Tasks", description: "Track your daily health activities.", icon: ListChecks },
  { href: "/vitals", label: "Vitals Log", description: "Log and monitor your vital signs.", icon: HeartPulse },
  { href: "/test-strips", label: "Test Strips", description: "Record urine test strip results.", icon: Beaker },
  { href: "/reminders", label: "Medication", description: "Manage your medication schedule.", icon: Pill },
  { href: "/analysis", label: "AI Analysis", description: "Get AI-powered health insights.", icon: BrainCircuit },
  { href: "/report", label: "Health Report", description: "Generate and view monthly reports.", icon: FileText },
  { href: "/emergency", label: "Emergency", description: "Access emergency contacts and alerts.", icon: Siren },
  { href: "/profiles", label: "Profiles", description: "Manage user profiles.", icon: Users },
];

export function Dashboard() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Welcome to Nexus Lifeline</h1>
        <p className="text-muted-foreground">Your personal health and wellness companion. Select an option to get started.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card 
              key={item.href}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push(item.href)}
              onKeyDown={(e) => e.key === 'Enter' && router.push(item.href)}
              tabIndex={0}
            >
              <CardContent className="flex flex-col items-center justify-center text-center p-6 gap-4">
                 <div className="bg-primary/10 p-4 rounded-full">
                    <Icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
