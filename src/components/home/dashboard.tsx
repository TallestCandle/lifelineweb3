
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
  Thermometer,
  Weight,
  Building2,
  ArrowRight,
  ClipboardList,
  LucideIcon
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

// Types
interface Vital {
  systolic?: string;
  diastolic?: string;
  bloodSugar?: string;
  temperature?: string;
  weight?: string;
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


// Sub-components
const StatCard = ({ icon: Icon, title, value, unit, date, isLoading }: { icon: LucideIcon, title: string, value: string | null, unit?: string, date?: string | null, isLoading: boolean }) => {
  if (isLoading) {
    return <Skeleton className="h-28 w-full" />;
  }

  return (
    <Card className="bg-secondary/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {value ? (
          <>
            <div className="text-2xl font-bold">{value} <span className="text-base font-normal text-muted-foreground">{unit}</span></div>
            <p className="text-xs text-muted-foreground">
              {date ? `as of ${format(parseISO(date), 'MMM d, h:mm a')}` : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground pt-2">No data recorded</p>
        )}
      </CardContent>
    </Card>
  );
};

export function Dashboard() {
  const { user } = useAuth();
  const [latestVitals, setLatestVitals] = useState<Vital | null>(null);
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
        setLatestVitals(snapshot.docs[0].data() as Vital);
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

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Welcome, {firstName}
        </h1>
        <p className="text-lg text-muted-foreground">Here is a quick overview of your current health status.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={HeartPulse}
          title="Blood Pressure"
          value={latestVitals?.systolic && latestVitals?.diastolic ? `${latestVitals.systolic}/${latestVitals.diastolic}` : null}
          unit="mmHg"
          date={latestVitals?.date}
          isLoading={isLoading}
        />
        <StatCard
          icon={Droplet}
          title="Blood Sugar"
          value={latestVitals?.bloodSugar || null}
          unit="mg/dL"
          date={latestVitals?.date}
          isLoading={isLoading}
        />
        <StatCard
          icon={Thermometer}
          title="Temperature"
          value={latestVitals?.temperature || null}
          unit="°F"
          date={latestVitals?.date}
          isLoading={isLoading}
        />
        <StatCard
          icon={Weight}
          title="Weight"
          value={latestVitals?.weight || null}
          unit="lbs"
          date={latestVitals?.date}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
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
      </div>

      {!isLoading && !latestVitals && activeCases.length === 0 && (
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
