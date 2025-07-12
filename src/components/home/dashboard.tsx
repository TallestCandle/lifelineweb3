
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import {
  HeartPulse,
  Droplet,
  Building2,
  ArrowRight,
  ClipboardList,
  Wind,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { VitalMeter, type Level } from './vital-meter';

// Types
interface VitalReading {
  systolic?: string;
  diastolic?: string;
  bloodSugar?: string;
  oxygenSaturation?: string;
  date: string;
}

interface Investigation {
  id: string;
  status: 'pending_review' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected' | 'awaiting_follow_up_visit';
  createdAt: string;
}

const statusConfig: Record<Investigation['status'], { text: string; color: string; }> = {
  pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
  awaiting_lab_results: { text: 'Awaiting Lab Results', color: 'bg-blue-500' },
  pending_final_review: { text: 'Doctor Reviewing Results', color: 'bg-yellow-500' },
  completed: { text: 'Case Complete', color: 'bg-green-500' },
  rejected: { text: 'Case Closed', color: 'bg-red-500' },
  awaiting_follow_up_visit: { text: 'Follow-up Visit Pending', color: 'bg-cyan-500' },
};

// --- Meter Configurations ---
const bpLevels: Level[] = [
  { name: 'Low', color: 'text-blue-400', bgColor: 'bg-blue-400', value: 90 },
  { name: 'Normal', color: 'text-green-400', bgColor: 'bg-green-400', value: 120 },
  { name: 'High', color: 'text-yellow-400', bgColor: 'bg-yellow-400', value: 140 },
  { name: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500', value: 180 },
];

const sugarLevels: Level[] = [
  { name: 'Low', color: 'text-blue-400', bgColor: 'bg-blue-400', value: 70 },
  { name: 'Normal', color: 'text-green-400', bgColor: 'bg-green-400', value: 140 },
  { name: 'High', color: 'text-yellow-400', bgColor: 'bg-yellow-400', value: 200 },
  { name: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500', value: 240 },
];

const oxygenLevels: Level[] = [
  { name: 'Low', color: 'text-red-500', bgColor: 'bg-red-500', value: 90 },
  { name: 'Normal', color: 'text-green-400', bgColor: 'bg-green-400', value: 95 },
  { name: 'High', color: 'text-green-400', bgColor: 'bg-green-400', value: 100 },
];


export function Dashboard() {
  const { user } = useAuth();
  const [latestVitals, setLatestVitals] = useState<VitalReading | null>(null);
  const [activeCases, setActiveCases] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const firstName = user?.displayName?.split(' ')[0] || 'User';

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const vitalsQuery = query(collection(db, `users/${user.uid}/vitals`), orderBy("date", "desc"), limit(1));
    const unsubscribeVitals = onSnapshot(vitalsQuery, (snapshot) => {
      if (!snapshot.empty) {
        setLatestVitals(snapshot.docs[0].data() as VitalReading);
      }
      setIsLoading(false);
    });
    
    const casesQuery = query(collection(db, "investigations"), where("userId", "==", user.uid), where("status", "in", ["pending_review", "awaiting_lab_results", "pending_final_review", "awaiting_follow_up_visit"]));
    const unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
      setActiveCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation)));
    });

    return () => {
      unsubscribeVitals();
      unsubscribeCases();
    };
  }, [user]);

  const hasData = !isLoading && (latestVitals || activeCases.length > 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Welcome, {firstName}
        </h1>
        <p className="text-lg text-muted-foreground">Here's a visual summary of your latest health stats.</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
        ) : (
            <>
                {latestVitals?.systolic && latestVitals?.diastolic && (
                    <VitalMeter
                        icon={HeartPulse}
                        title="Blood Pressure"
                        value={parseInt(latestVitals.systolic, 10)}
                        displayValue={`${latestVitals.systolic}/${latestVitals.diastolic}`}
                        unit="mmHg"
                        date={latestVitals.date}
                        min={50}
                        max={200}
                        levels={bpLevels}
                    />
                )}
                {latestVitals?.bloodSugar && (
                    <VitalMeter
                        icon={Droplet}
                        title="Blood Sugar"
                        value={parseInt(latestVitals.bloodSugar, 10)}
                        displayValue={latestVitals.bloodSugar}
                        unit="mg/dL"
                        date={latestVitals.date}
                        min={40}
                        max={300}
                        levels={sugarLevels}
                    />
                )}
                {latestVitals?.oxygenSaturation && (
                     <VitalMeter
                        icon={Wind}
                        title="Oxygen Saturation"
                        value={parseInt(latestVitals.oxygenSaturation, 10)}
                        displayValue={latestVitals.oxygenSaturation}
                        unit="%"
                        date={latestVitals.date}
                        min={80}
                        max={100}
                        levels={oxygenLevels}
                    />
                )}
            </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="text-primary"/> Active Clinic Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : activeCases.length > 0 ? (
            <div className="space-y-4">
              {activeCases.map(c => {
                const config = statusConfig[c.status];
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div>
                      <p className="font-bold">Case from {format(parseISO(c.createdAt), 'MMM d, yyyy')}</p>
                      <Badge className={cn("mt-1 text-white", config.color)}>{config.text}</Badge>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/clinic">View Case <ArrowRight className="ml-2 h-4 w-4"/></Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Active Cases</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a new case in the clinic if you have any health concerns.
              </p>
              <Button asChild className="mt-4">
                <Link href="/clinic">Go to Clinic</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!hasData && (
         <Card className="bg-primary/5 border-primary/20 text-center py-10">
            <CardContent>
                <h3 className="text-xl font-bold">Get Started with Lifeline AI</h3>
                <p className="text-muted-foreground mt-2 mb-6">Log your first health metric using our AI Logger to see your dashboard come to life.</p>
                <Button asChild>
                    <Link href="/log">Log Your First Data <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
            </CardContent>
        </Card>
      )}

    </div>
  );
}
