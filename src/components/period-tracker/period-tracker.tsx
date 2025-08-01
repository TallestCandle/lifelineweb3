
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDays, subDays, format, parseISO, isSameDay, differenceInDays, startOfDay } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Droplet, HeartHandshake, Loader2, Sparkles, UserX, Target, Wind, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useProfile } from '@/context/profile-provider';

const periodTrackerSchema = z.object({
  lastPeriodStartDate: z.date({
    required_error: "Your last period's start date is required.",
  }),
  cycleLength: z.coerce.number().min(20, "Cycle must be at least 20 days.").max(45, "Cycle cannot be longer than 45 days."),
});

type PeriodTrackerFormValues = z.infer<typeof periodTrackerSchema>;

interface CycleLog {
  id: string;
  startDate: string;
  cycleLength: number;
}

// --- SVG Cycle Dial Component ---
const CycleDial = ({ cycleData }: { cycleData: any }) => {
  if (!cycleData) return null;
  const { cycleLength, daysUntilNextPeriod, currentDayInCycle, periodLength, fertileWindowStart, fertileWindowEnd, ovulationDay, lastPeriodStart, nextPeriodStart } = cycleData;

  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  const getCoordinatesForDay = (day: number, customRadius = radius) => {
    const angle = (day / cycleLength) * 360;
    const x = 100 + customRadius * Math.cos((angle - 90) * (Math.PI / 180));
    const y = 100 + customRadius * Math.sin((angle - 90) * (Math.PI / 180));
    return { x, y };
  };

  const describeArc = (startDay: number, endDay: number) => {
    const startAngle = (startDay / cycleLength) * 360;
    const endAngle = (endDay / cycleLength) * 360;

    const start = getCoordinatesForDay(startDay);
    const end = getCoordinatesForDay(endDay);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };
  
  const fertileStartDay = differenceInDays(fertileWindowStart, lastPeriodStart);
  const fertileEndDay = differenceInDays(fertileWindowEnd, lastPeriodStart);
  const ovulationDisplayDay = differenceInDays(ovulationDay, lastPeriodStart);

  const currentDayIndicator = getCoordinatesForDay(currentDayInCycle);

  const nextPeriodDate = getCoordinatesForDay(0, radius + 12);
  const periodEndDate = getCoordinatesForDay(periodLength, radius + 12);
  const fertileStartDate = getCoordinatesForDay(fertileStartDay, radius + 12);
  const fertileEndDate = getCoordinatesForDay(fertileEndDay, radius + 12);

  return (
    <div className="flex flex-col justify-center items-center">
        <h3 className="text-xl font-bold text-primary mb-2">
            {format(nextPeriodStart, 'MMMM yyyy')}
        </h3>
        <svg viewBox="0 0 200 200" className="w-full h-auto max-w-sm">
            {/* Background track */}
            <circle cx="100" cy="100" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" />

            {/* Period arc */}
            <path d={describeArc(0, periodLength)} fill="none" stroke="hsl(var(--destructive)/0.5)" strokeWidth="12" />
            <path d={describeArc(cycleLength, cycleLength + periodLength)} fill="none" stroke="hsl(var(--destructive)/0.5)" strokeWidth="12" />
            
            {/* Fertile window arc */}
            <path d={describeArc(fertileStartDay, fertileEndDay)} fill="none" stroke="hsl(var(--primary)/0.4)" strokeWidth="12" />

            {/* Ovulation day marker */}
            <circle cx={getCoordinatesForDay(ovulationDisplayDay).x} cy={getCoordinatesForDay(ovulationDisplayDay).y} r="8" fill="hsl(var(--primary))" />

            {/* Current day indicator */}
            <circle cx={currentDayIndicator.x} cy={currentDayIndicator.y} r="5" fill="hsl(var(--foreground))" stroke="hsl(var(--background))" strokeWidth="2" />
            
            {/* Date Labels */}
            <text x={nextPeriodDate.x} y={nextPeriodDate.y} textAnchor="middle" dy="4" className="text-[10px] font-bold fill-foreground">{format(nextPeriodStart, 'd')}</text>
            <text x={periodEndDate.x} y={periodEndDate.y} textAnchor="middle" dy="4" className="text-[10px] font-bold fill-foreground">{format(addDays(nextPeriodStart, periodLength), 'd')}</text>
            <text x={fertileStartDate.x} y={fertileStartDate.y} textAnchor="middle" dy="4" className="text-[10px] font-bold fill-foreground">{format(fertileWindowStart, 'd')}</text>
            <text x={fertileEndDate.x} y={fertileEndDate.y} textAnchor="middle" dy="4" className="text-[10px] font-bold fill-foreground">{format(fertileWindowEnd, 'd')}</text>

            {/* Center Text */}
            <text x="100" y="85" textAnchor="middle" className="text-4xl font-bold fill-foreground">{daysUntilNextPeriod}</text>
            <text x="100" y="105" textAnchor="middle" className="text-sm fill-muted-foreground">days until</text>
            <text x="100" y="125" textAnchor="middle" className="text-lg font-bold fill-primary">Next Period</text>
        </svg>
    </div>
  );
};


export function PeriodTracker() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [cycleLogs, setCycleLogs] = useState<CycleLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const latestLog = cycleLogs[0];

  const form = useForm<PeriodTrackerFormValues>({
    resolver: zodResolver(periodTrackerSchema),
    defaultValues: {
      cycleLength: 28,
    },
  });

  // Effect to subscribe to Firestore updates
  useEffect(() => {
    if (!user) {
        setIsLoading(false);
        return;
    }
    const q = query(collection(db, `users/${user.uid}/cycles`), orderBy('startDate', 'desc'), limit(12));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CycleLog));
        setCycleLogs(logs);
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Effect to update the form when the latest log changes
  useEffect(() => {
      if (latestLog) {
          form.reset({
              lastPeriodStartDate: parseISO(latestLog.startDate),
              cycleLength: latestLog.cycleLength,
          });
      }
  }, [latestLog, form]);


  const cycleData = useMemo(() => {
    if (!latestLog) return null;

    const today = startOfDay(new Date());
    const lastPeriodStart = startOfDay(parseISO(latestLog.startDate));
    const cycleLength = latestLog.cycleLength;
    const periodLength = 5;

    const nextPeriodStart = addDays(lastPeriodStart, cycleLength);
    const ovulationDay = subDays(nextPeriodStart, 14);
    const fertileWindowStart = subDays(ovulationDay, 5);
    const fertileWindowEnd = ovulationDay;
    
    const daysUntilNextPeriod = differenceInDays(nextPeriodStart, today);
    const currentDayInCycle = differenceInDays(today, lastPeriodStart);

    return {
      lastPeriodStart,
      nextPeriodStart,
      ovulationDay,
      fertileWindowStart,
      fertileWindowEnd,
      periodLength,
      cycleLength,
      daysUntilNextPeriod: daysUntilNextPeriod > 0 ? daysUntilNextPeriod : 0,
      currentDayInCycle: currentDayInCycle >= 0 ? currentDayInCycle % cycleLength : 0,
    };
  }, [latestLog]);

  const onSubmit = async (data: PeriodTrackerFormValues) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/cycles`), {
        startDate: data.lastPeriodStartDate.toISOString(),
        cycleLength: data.cycleLength,
      });
      toast({ title: 'Cycle Logged', description: 'Your cycle information has been saved.' });
    } catch (error) {
      console.error("Error logging cycle:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save your cycle information.' });
    }
  };
  
  if (isLoading || profileLoading) {
    return (
        <div className="flex justify-center items-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
  }

  if (profile?.gender !== 'Female') {
    return (
        <Card className="w-full max-w-lg mx-auto text-center">
            <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                    <UserX className="w-8 h-8"/> Feature Unavailable
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">The Period Tracker is designed for users who identify as female. Based on your profile, this feature is not enabled for your account.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HeartHandshake className="w-8 h-8 text-primary"/> Period Tracker</CardTitle>
            <CardDescription>Log your cycle to get predictions for your next period, fertile window, and ovulation day.</CardDescription>
          </CardHeader>
          <CardContent>
            {cycleData ? (
                <CycleDial cycleData={cycleData}/>
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                    <p>Log your first cycle to see your personalized dial.</p>
                </div>
            )}
             <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-destructive/50"></span> Period</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary/40"></span> Fertile Window</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary ring-1 ring-primary-foreground"></span> Ovulation Day</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Log Your Cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="lastPeriodStartDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Last Period Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="cycleLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Average Cycle Length (days)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Save Cycle</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {cycleData && (
            <Card className="bg-secondary/50">
                <CardHeader>
                    <CardTitle className="text-lg">Key Dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Alert>
                        <Droplet className="h-4 w-4" />
                        <AlertTitle>Next Period</AlertTitle>
                        <AlertDescription>
                            Your next period is predicted to start around <span className="font-bold">{format(cycleData.nextPeriodStart, 'MMMM d, yyyy')}</span>.
                        </AlertDescription>
                    </Alert>
                     <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertTitle>Next Fertile Window</AlertTitle>
                        <AlertDescription>
                            Your fertile window is likely between <span className="font-bold">{format(cycleData.fertileWindowStart, 'MMM d')}</span> and <span className="font-bold">{format(cycleData.fertileWindowEnd, 'MMM d')}</span>.
                        </AlertDescription>
                    </Alert>
                    <Alert>
                        <Target className="h-4 w-4" />
                        <AlertTitle>Next Ovulation</AlertTitle>
                        <AlertDescription>
                            Estimated ovulation on <span className="font-bold">{format(cycleData.ovulationDay, 'MMMM d, yyyy')}</span>.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
