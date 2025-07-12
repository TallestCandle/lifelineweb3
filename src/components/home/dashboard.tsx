
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import {
  Building2,
  ArrowRight,
  ClipboardList,
  Heart,
  Droplet,
  Thermometer,
  Wind,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface Investigation {
  id: string;
  status: 'pending_review' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected' | 'awaiting_follow_up_visit';
  createdAt: string;
}

interface Vital {
    date: string;
    systolic?: string;
    diastolic?: string;
    bloodSugar?: string;
    oxygenSaturation?: string;
    temperature?: string;
}

type VitalType = 'blood_pressure' | 'blood_sugar' | 'oxygen_saturation' | 'temperature';

interface LatestVital {
    type: VitalType;
    value: string;
    unit: string;
    status: 'Good' | 'Moderate' | 'Critical';
    trend: 'up' | 'down' | 'stable';
}

const caseStatusConfig: Record<Investigation['status'], { text: string; color: string }> = {
    pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
    awaiting_lab_results: { text: 'Awaiting Lab Results', color: 'bg-blue-500' },
    pending_final_review: { text: 'Doctor Reviewing Results', color: 'bg-yellow-500' },
    completed: { text: 'Case Complete', color: 'bg-green-500' },
    rejected: { text: 'Case Closed', color: 'bg-red-500' },
    awaiting_follow_up_visit: { text: 'Follow-up Visit Pending', color: 'bg-cyan-500' },
};

const vitalConfig: Record<VitalType, { icon: React.ElementType; title: string; unit: string }> = {
    blood_pressure: { icon: Heart, title: 'Blood Pressure', unit: 'mmHg' },
    blood_sugar: { icon: Droplet, title: 'Blood Sugar', unit: 'mg/dL' },
    oxygen_saturation: { icon: Wind, title: 'Oxygen Sat.', unit: '%' },
    temperature: { icon: Thermometer, title: 'Temperature', unit: '°F' },
};

// --- Main Dashboard Component ---
export function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCases, setActiveCases] = useState<Investigation[]>([]);
  const [latestVitals, setLatestVitals] = useState<LatestVital[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const firstName = user?.displayName?.split(' ')[0] || 'User';

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    // --- Fetch Active Cases ---
    const casesQuery = query(
        collection(db, "investigations"), 
        where("userId", "==", user.uid), 
        where("status", "in", ["pending_review", "awaiting_lab_results", "pending_final_review", "awaiting_follow_up_visit"])
    );
    const unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
      setActiveCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation)));
    }, (error) => {
        console.error("Error fetching cases:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not fetch clinic cases." });
    });

    // --- Fetch and Process Vitals ---
    const fetchVitals = async () => {
        try {
            const vitalsQuery = query(collection(db, `users/${user.uid}/vitals`), orderBy('date', 'desc'), limit(25));
            const snapshot = await getDocs(vitalsQuery);
            const vitalsHistory = snapshot.docs.map(doc => doc.data() as Vital);

            const processedVitals = new Map<VitalType, LatestVital>();

            const findLatest = (type: VitalType, key: keyof Vital, secondKey?: keyof Vital) => {
                const recent = vitalsHistory.find(v => v[key]);
                if (!recent) return null;
                
                const prev = vitalsHistory.find(v => v[key] && v.date < recent.date);
                const currentValue = secondKey ? parseFloat(recent[key]!) + parseFloat(recent[secondKey]!) : parseFloat(recent[key]!);
                const prevValue = prev && prev[key] ? (secondKey ? parseFloat(prev[key]!) + parseFloat(prev[secondKey]!) : parseFloat(prev[key]!)) : null;

                let trend: 'up' | 'down' | 'stable' = 'stable';
                if (prevValue !== null) {
                    if (currentValue > prevValue) trend = 'up';
                    if (currentValue < prevValue) trend = 'down';
                }

                let status: 'Good' | 'Moderate' | 'Critical' = 'Good';
                const s = parseFloat(recent.systolic || '0');
                const d = parseFloat(recent.diastolic || '0');
                const sugar = parseFloat(recent.bloodSugar || '0');
                const temp = parseFloat(recent.temperature || '0');
                const oxygen = parseFloat(recent.oxygenSaturation || '0');

                switch(type) {
                    case 'blood_pressure':
                        if (s > 140 || s < 90 || d > 90 || d < 60) status = 'Critical';
                        else if (s > 120 || d > 80) status = 'Moderate';
                        break;
                    case 'blood_sugar':
                        if (sugar > 180 || sugar < 70) status = 'Critical';
                        else if (sugar > 140) status = 'Moderate';
                        break;
                    case 'oxygen_saturation':
                        if (oxygen < 92) status = 'Critical';
                        else if (oxygen < 95) status = 'Moderate';
                        break;
                    case 'temperature':
                        if (temp > 100.4 || temp < 97) status = 'Critical';
                        else if (temp > 99.5) status = 'Moderate';
                        break;
                }

                return {
                    type,
                    value: secondKey ? `${recent[key]}/${recent[secondKey]}` : recent[key]!,
                    unit: vitalConfig[type].unit,
                    status,
                    trend,
                };
            };
            
            const latestBP = findLatest('blood_pressure', 'systolic', 'diastolic');
            const latestSugar = findLatest('blood_sugar', 'bloodSugar');
            const latestOxygen = findLatest('oxygen_saturation', 'oxygenSaturation');
            const latestTemp = findLatest('temperature', 'temperature');

            const vitalsToShow = [latestBP, latestSugar, latestOxygen, latestTemp].filter(v => v !== null) as LatestVital[];
            setLatestVitals(vitalsToShow);

        } catch (error) {
            console.error("Error processing vitals:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not load health snapshot." });
        } finally {
            setIsLoading(false);
        }
    };

    fetchVitals();

    return () => {
      unsubscribeCases();
    };
  }, [user, toast]);

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <ArrowUp className="w-4 h-4 text-destructive" />;
    if (trend === 'down') return <ArrowDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const statusColorMap = {
      Good: 'text-green-400',
      Moderate: 'text-yellow-400',
      Critical: 'text-red-400'
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Welcome, {firstName}</h1>
        <p className="text-lg text-muted-foreground">This is your health mission control.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="lg:col-span-2">
           <CardHeader>
                <CardTitle>Vitals at a Glance</CardTitle>
                <CardDescription>Your most recent key health metrics and their trends.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" />
                    </div>
                ) : latestVitals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {latestVitals.map((vital) => {
                            const Icon = vitalConfig[vital.type].icon;
                            return (
                                <div key={vital.type} className="p-4 rounded-lg bg-secondary/50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Icon className={cn("w-8 h-8", statusColorMap[vital.status])}/>
                                        <div>
                                            <p className="text-sm text-muted-foreground">{vitalConfig[vital.type].title}</p>
                                            <p className="text-2xl font-bold">{vital.value} <span className="text-base font-normal text-muted-foreground">{vital.unit}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <TrendIcon trend={vital.trend} />
                                        <Badge variant={vital.status === 'Good' ? 'default' : 'destructive'} className={cn(
                                            {'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30': vital.status === 'Good'},
                                            {'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30': vital.status === 'Moderate'},
                                            {'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30': vital.status === 'Critical'},
                                        )}>{vital.status}</Badge>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">No Recent Vitals</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Use the AI Logger to start tracking your health data.</p>
                        <Button asChild className="mt-4">
                            <Link href="/log">Log Vitals</Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="text-primary" /> Active Clinic Cases
            </CardTitle>
             <CardDescription>An overview of your ongoing health investigations.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-12 w-full" /></div>
            ) : activeCases.length > 0 ? (
              <div className="space-y-4">
                {activeCases.map((c) => {
                  const config = caseStatusConfig[c.status];
                  const createdAtDate = parseISO(c.createdAt);
                  const formattedDate = isValid(createdAtDate) ? format(createdAtDate, 'MMM d, yyyy') : 'Invalid Date';
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-bold">Case from {formattedDate}</p>
                        <Badge className={cn('mt-1 text-white', config.color)}>{config.text}</Badge>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/clinic">
                          View Case <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  );
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
    </div>
  );
}
