
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import {
  Heart,
  Droplet,
  Wind,
  Activity,
  TrendingDown,
  TrendingUp,
  Minus,
  Wallet,
  AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/context/profile-provider';


type VitalType = 'blood_pressure' | 'blood_sugar' | 'oxygen_saturation' | 'pulse_rate';

interface LatestVital {
    type: VitalType;
    value: string;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    trendValue: string;
    history: { value: number }[];
    status: 'Good' | 'Moderate' | 'Critical';
}

interface VitalHistoryEntry {
    date: Date;
    systolic?: string;
    diastolic?: string;
    bloodSugar?: string;
    oxygenSaturation?: string;
    pulseRate?: string;
}


const vitalConfig: Record<VitalType, { icon: React.ElementType; title: string; unit: string; color: string; }> = {
    blood_pressure: { icon: Heart, title: 'Blood Pressure', unit: 'mmHg', color: 'hsl(var(--chart-1))' },
    blood_sugar: { icon: Droplet, title: 'Blood Sugar', unit: 'mg/dL', color: 'hsl(var(--chart-2))' },
    oxygen_saturation: { icon: Wind, title: 'Oxygen Sat.', unit: '%', color: 'hsl(var(--chart-3))' },
    pulse_rate: { icon: Activity, title: 'Pulse Rate', unit: 'BPM', color: 'hsl(var(--chart-4))' },
};

function MiniLineChart({ data, color }: { data: { value: number }[], color: string }) {
    return (
        <ResponsiveContainer width="100%" height={40}>
            <LineChart data={data}>
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
        </ResponsiveContainer>
    );
}

const TrendIndicator = ({ trend, value }: { trend: 'up' | 'down' | 'stable', value: string }) => {
    const isUp = trend === 'up';
    const isDown = trend === 'down';
    const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
    const color = isUp ? 'text-destructive' : isDown ? 'text-primary' : 'text-muted-foreground';
    if (trend === 'stable') return <span className="text-sm text-muted-foreground">No recent change</span>
    return (
        <div className="flex items-center gap-1">
            <Icon className={cn("h-4 w-4", color)} />
            <span className={cn("font-bold", color)}>{value}</span>
            <span className="text-muted-foreground text-xs"></span>
        </div>
    )
};


export function Dashboard() {
    const { user } = useAuth();
    const { profile, loading: profileLoading } = useProfile();
    const { toast } = useToast();
    const [latestVitals, setLatestVitals] = useState<LatestVital[]>([]);
    const [bpHistory, setBpHistory] = useState<{name: string, systolic: number, diastolic: number}[]>([]);
    const [trendsHistory, setTrendsHistory] = useState<{name: string, blood_sugar?: number, oxygen_saturation?: number, pulse_rate?: number}[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const firstName = user?.displayName?.split(' ')[0] || 'User';

    useEffect(() => {
        if (!user?.uid) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const vitalsQuery = query(collection(db, `users/${user.uid}/vitals`), orderBy('date', 'desc'), limit(50));
                const snapshot = await getDocs(vitalsQuery);
                
                const history: VitalHistoryEntry[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        date: data.date ? parseISO(data.date) : new Date(),
                    } as VitalHistoryEntry;
                });
                
                const latestReadings = new Map<VitalType, VitalHistoryEntry>();

                for (const vital of history) {
                    if (!latestReadings.has('blood_pressure') && vital.systolic && vital.diastolic) {
                        latestReadings.set('blood_pressure', vital);
                    }
                    if (!latestReadings.has('blood_sugar') && vital.bloodSugar) {
                        latestReadings.set('blood_sugar', vital);
                    }
                    if (!latestReadings.has('oxygen_saturation') && vital.oxygenSaturation) {
                        latestReadings.set('oxygen_saturation', vital);
                    }
                     if (!latestReadings.has('pulse_rate') && vital.pulseRate) {
                        latestReadings.set('pulse_rate', vital);
                    }
                }

                const processedVitals = (Object.keys(vitalConfig) as VitalType[]).map(type => {
                    const latest = latestReadings.get(type);
                    if (!latest) return null;

                    const historyForType = history.filter(v => (type === 'blood_pressure' && v.systolic) || (type === 'blood_sugar' && v.bloodSugar) || (type === 'oxygen_saturation' && v.oxygenSaturation) || (type === 'pulse_rate' && v.pulseRate));
                    if (historyForType.length < 2) return null;
                    
                    const previousIndex = historyForType.findIndex(v => v.date < latest.date);
                    const previous = previousIndex !== -1 ? historyForType[previousIndex] : null;

                    let value = '', currentValue = 0, prevValue = 0, trend: 'up' | 'down' | 'stable' = 'stable', status: 'Good' | 'Moderate' | 'Critical' = 'Good';

                    switch(type) {
                        case 'blood_pressure':
                            value = `${latest.systolic}/${latest.diastolic}`;
                            currentValue = parseFloat(latest.systolic!);
                            prevValue = previous ? parseFloat(previous.systolic!) : 0;
                            const s = parseFloat(latest.systolic!);
                            const d = parseFloat(latest.diastolic!);
                            if (s >= 130 || d >= 80) status = 'Critical';
                            else if (s >= 120) status = 'Moderate';
                            else status = 'Good';
                            break;
                        case 'blood_sugar':
                            value = latest.bloodSugar!;
                            currentValue = parseFloat(value);
                            prevValue = previous ? parseFloat(previous.bloodSugar!) : 0;
                            if (currentValue > 180 || currentValue < 70) status = 'Critical';
                            else if (currentValue > 140) status = 'Moderate';
                            break;
                        case 'oxygen_saturation':
                            value = latest.oxygenSaturation!;
                            currentValue = parseFloat(value);
                            prevValue = previous ? parseFloat(previous.oxygenSaturation!) : 0;
                            if (currentValue < 92) status = 'Critical';
                            else if (currentValue < 95) status = 'Moderate';
                            break;
                        case 'pulse_rate':
                            value = latest.pulseRate!;
                            currentValue = parseFloat(value);
                            prevValue = previous ? parseFloat(previous.pulseRate!) : 0;
                            if (currentValue > 100 || currentValue < 60) status = 'Critical';
                            else if (currentValue > 90) status = 'Moderate';
                            break;
                    }
                    
                    if(previous) {
                        if (currentValue > prevValue) trend = 'up';
                        else if (currentValue < prevValue) trend = 'down';
                    }
                    
                    const change = Math.abs(currentValue - (prevValue || currentValue));
                    const trendValue = `${change.toFixed(type === 'blood_pressure' ? 0 : 1)}${vitalConfig[type].unit}`;
                    
                    const historyForChart = historyForType.slice(0, 10).reverse().map(d => {
                        let chartValue = 0;
                        if(type === 'blood_pressure' && d.systolic) chartValue = parseFloat(d.systolic);
                        if(type === 'blood_sugar' && d.bloodSugar) chartValue = parseFloat(d.bloodSugar);
                        if(type === 'oxygen_saturation' && d.oxygenSaturation) chartValue = parseFloat(d.oxygenSaturation);
                        if(type === 'pulse_rate' && d.pulseRate) chartValue = parseFloat(d.pulseRate);
                        return { value: chartValue };
                    });
                    
                    return { type, value, unit: vitalConfig[type].unit, status, trend, trendValue, history: historyForChart };

                }).filter(Boolean) as LatestVital[];
                
                setLatestVitals(processedVitals);

                const bpHistoryForChart = history
                    .filter(v => v.systolic && v.diastolic)
                    .slice(0, 7)
                    .reverse()
                    .map(d => ({ name: format(d.date, 'eee'), systolic: parseFloat(d.systolic!), diastolic: parseFloat(d.diastolic!) }));
                setBpHistory(bpHistoryForChart);

                const trendsHistoryForChart = history
                    .slice(0, 7)
                    .reverse()
                    .map(d => ({
                        name: format(d.date, 'eee'),
                        blood_sugar: d.bloodSugar ? parseFloat(d.bloodSugar) : undefined,
                        oxygen_saturation: d.oxygenSaturation ? parseFloat(d.oxygenSaturation) : undefined,
                        pulse_rate: d.pulseRate ? parseFloat(d.pulseRate) : undefined,
                    }));
                setTrendsHistory(trendsHistoryForChart);


            } catch (error) {
                console.error("Error processing vitals:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not load dashboard data." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user, toast]);

    const VitalCard = ({ vital }: { vital: LatestVital }) => {
        const config = vitalConfig[vital.type];
        
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium text-muted-foreground">{config.title}</CardTitle>
                        <config.icon className={cn("w-6 h-6", config.color)} />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-bold">{vital.value}</p>
                        <p className="text-muted-foreground">{vital.unit}</p>
                    </div>
                    <TrendIndicator trend={vital.trend} value={vital.trendValue}/>
                    <div className="h-10">
                        <MiniLineChart data={vital.history} color={config.color} />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    const WalletCard = () => (
        <Card className="bg-gradient-to-br from-primary/20 to-secondary/20 border-primary/30">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-muted-foreground">My Wallet</CardTitle>
                    <Wallet className="w-6 h-6 text-primary" />
                </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    {profileLoading ? <Skeleton className="h-10 w-24 mt-1" /> : <p className="text-4xl font-bold">₦{profile?.balance.toLocaleString() ?? '0'}</p>}
                </div>
                <Button asChild>
                    <Link href="/wallet">Top Up</Link>
                </Button>
            </CardContent>
        </Card>
    );

    if (isLoading) {
        return (
             <div className="space-y-8 animate-fade-in">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                </div>
                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Skeleton className="h-80" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">Welcome back, {firstName}</h1>
                <p className="text-muted-foreground">Here’s what’s happening with your health today.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <WalletCard />
                {latestVitals.slice(0, 3).map(v => <VitalCard key={v.type} vital={v} />)}
                {latestVitals.length === 0 && (
                    <Card className="md:col-span-2 lg:col-span-3">
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center h-full">
                            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4"/>
                            <h3 className="text-lg font-bold">Not Enough Data</h3>
                            <p className="text-muted-foreground">Log your vitals for at least two days to see your dashboard cards.</p>
                            <Button asChild className="mt-4"><Link href="/log">Go to Logger</Link></Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-1">
                 <Card>
                    <CardHeader>
                        <CardTitle>Blood Pressure Over Time</CardTitle>
                        <CardDescription>Your last 7 BP readings.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={bpHistory}>
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: 'var(--radius)',
                                    }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    cursor={{fill: 'hsl(var(--muted) / 0.3)'}}
                                />
                                <Bar dataKey="systolic" fill="hsl(var(--chart-1))" name="Systolic" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="diastolic" fill="hsl(var(--chart-2))" name="Diastolic" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
