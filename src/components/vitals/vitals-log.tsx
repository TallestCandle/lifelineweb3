
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { HeartPulse, Thermometer, Scale, Droplets, Activity, PlusCircle, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAuth } from '@/context/auth-provider';
import { useProfile } from '@/context/profile-provider';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';

const vitalsSchema = z.object({
  systolic: z.string().regex(/^\d+$/, "Must be a number").optional().or(z.literal('')),
  diastolic: z.string().regex(/^\d+$/, "Must be a number").optional().or(z.literal('')),
  oxygenLevel: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Must be a number").optional().or(z.literal('')),
  temperature: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Must be a number").optional().or(z.literal('')),
  bloodSugar: z.string().regex(/^\d+$/, "Must be a number").optional().or(z.literal('')),
  weight: z.string().regex(/^\d{1,4}(\.\d{1,2})?$/, "Must be a number").optional().or(z.literal('')),
}).refine(data => Object.values(data).some(v => v && v.length > 0), {
    message: "At least one vital sign must be entered.",
    path: ["systolic"], 
});

type VitalsFormValues = z.infer<typeof vitalsSchema>;

interface VitalsEntry extends VitalsFormValues {
  id: string;
  date: string;
}

const bpChartConfig = {
  systolic: { label: "Systolic", color: "hsl(var(--chart-1))" },
  diastolic: { label: "Diastolic", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const singleMetricChartConfig = (label: string, color: string) => ({
    value: { label, color },
}) satisfies ChartConfig;

const NeonGlowFilter = () => (
    <svg style={{ width: 0, height: 0, position: 'absolute' }}>
      <defs>
        <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
);


export function VitalsLog() {
  const [isClient, setIsClient] = useState(false);
  const [vitalsHistory, setVitalsHistory] = useState<VitalsEntry[]>([]);
  const [selectedVital, setSelectedVital] = useState<VitalsEntry | null>(null);
  const [activeChart, setActiveChart] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  useEffect(() => {
    setIsClient(true);
    if (!user || !activeProfile) return;

    const fetchVitals = async () => {
        const vitalsCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/vitals`);
        const q = query(vitalsCollectionRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedVitals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VitalsEntry));
        setVitalsHistory(fetchedVitals);
    };

    fetchVitals().catch(error => console.error("Error fetching vitals:", error));
  }, [isClient, user, activeProfile]);


  const form = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: { systolic: '', diastolic: '', oxygenLevel: '', temperature: '', bloodSugar: '', weight: '' },
  });

  const onSubmit = async (data: VitalsFormValues) => {
    if (!user || !activeProfile) return;
    const vitalsCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/vitals`);

    const newEntryData = { ...data, date: new Date().toISOString() };
    const docRef = await addDoc(vitalsCollectionRef, newEntryData);
    const newEntry: VitalsEntry = { ...newEntryData, id: docRef.id };

    const updatedHistory = [...vitalsHistory, newEntry].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setVitalsHistory(updatedHistory);
    
    toast({ title: "Vitals Logged", description: "Your new vital signs have been saved." });
    
    form.reset({ systolic: '', diastolic: '', oxygenLevel: '', temperature: '', bloodSugar: '', weight: '' });
  };

  const chartData = useMemo(() => {
    return vitalsHistory
      .map(entry => ({
        ...entry,
        date: parseISO(entry.date),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(entry => ({
        ...entry,
        date: format(entry.date, 'MMM d'),
        systolic: entry.systolic ? Number(entry.systolic) : null,
        diastolic: entry.diastolic ? Number(entry.diastolic) : null,
        oxygenLevel: entry.oxygenLevel ? Number(entry.oxygenLevel) : null,
        temperature: entry.temperature ? Number(entry.temperature) : null,
        bloodSugar: entry.bloodSugar ? Number(entry.bloodSugar) : null,
        weight: entry.weight ? Number(entry.weight) : null,
      }));
  }, [vitalsHistory]);

  const renderChart = useCallback((dataKey: keyof VitalsFormValues, label: string, color: string) => {
    const data = chartData.filter(d => d[dataKey] !== null);
    if (data.length < 2) return <div className="flex items-center justify-center h-48 text-muted-foreground">Not enough data to display chart.</div>;
    
    return (
        <ChartContainer config={singleMetricChartConfig(label, color)} className="min-h-[200px] w-full">
            <LineChart data={data} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--foreground) / 0.1)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis domain={['dataMin - 5', 'dataMax + 5']} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                <Line dataKey={dataKey} type="monotone" stroke={color} strokeWidth={2.5} dot={false} name="value" filter="url(#neon-glow)" />
            </LineChart>
        </ChartContainer>
    );
  }, [chartData]);

  if (!isClient || !activeProfile) return null;

  return (
    <div className="grid lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-glow">
              <span>Log New Vitals</span>
              <PlusCircle className="w-6 h-6 text-primary"/>
            </CardTitle>
            <CardDescription>Enter your current measurements below.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="systolic" render={({ field }) => (<FormItem><FormLabel>Systolic</FormLabel><FormControl><Input placeholder="120" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="diastolic" render={({ field }) => (<FormItem><FormLabel>Diastolic</FormLabel><FormControl><Input placeholder="80" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="oxygenLevel" render={({ field }) => (<FormItem><FormLabel>Oxygen Level (%)</FormLabel><FormControl><Input placeholder="98" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="temperature" render={({ field }) => (<FormItem><FormLabel>Temperature (°F)</FormLabel><FormControl><Input placeholder="98.6" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="bloodSugar" render={({ field }) => (<FormItem><FormLabel>Blood Sugar (mg/dL)</FormLabel><FormControl><Input placeholder="100" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight (lbs)</FormLabel><FormControl><Input placeholder="150" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="flex gap-2 pt-2">
                    <Button type="submit" className="w-full">Save Vitals</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-8">
        <NeonGlowFilter />
        <Card>
            <CardHeader>
                <CardTitle className="text-glow">Vitals Trends</CardTitle>
                <CardDescription>Click a vital to see its trend chart in a popup.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Button variant="outline" onClick={() => setActiveChart('bp')}>
                        <HeartPulse className="mr-2"/> Blood Pressure
                    </Button>
                    <Button variant="outline" onClick={() => setActiveChart('oxygen')}>
                        <Activity className="mr-2"/> Oxygen
                    </Button>
                    <Button variant="outline" onClick={() => setActiveChart('temp')}>
                        <Thermometer className="mr-2"/> Temperature
                    </Button>
                    <Button variant="outline" onClick={() => setActiveChart('sugar')}>
                        <Droplets className="mr-2"/> Blood Sugar
                    </Button>
                    <Button variant="outline" onClick={() => setActiveChart('weight')}>
                        <Scale className="mr-2"/> Weight
                    </Button>
                </div>
            </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Vitals History</CardTitle>
            <CardDescription>A read-only log of all your previously recorded vital signs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Logged Vitals</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vitalsHistory.length > 0 ? vitalsHistory.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium whitespace-nowrap">{format(parseISO(entry.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                            {entry.systolic && entry.diastolic && <HeartPulse className="w-4 h-4 text-red-400" title="Blood Pressure"/>}
                            {entry.oxygenLevel && <Activity className="w-4 h-4 text-cyan-400" title="Oxygen Level"/>}
                            {entry.temperature && <Thermometer className="w-4 h-4 text-orange-400" title="Temperature"/>}
                            {entry.bloodSugar && <Droplets className="w-4 h-4 text-yellow-400" title="Blood Sugar"/>}
                            {entry.weight && <Scale className="w-4 h-4 text-green-400" title="Weight"/>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedVital(entry)} title="View Details">
                            <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="text-center h-24">No vitals logged yet.</TableCell></TableRow>
                  )}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      {selectedVital && (
        <Dialog open={!!selectedVital} onOpenChange={(isOpen) => !isOpen && setSelectedVital(null)}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Vitals on {format(parseISO(selectedVital.date), 'MMM d, yyyy, h:mm a')}</DialogTitle>
                    <DialogDescription>
                        A detailed look at the vitals recorded for this entry.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4">
                    {selectedVital.systolic && selectedVital.diastolic && (
                        <div className="flex items-start gap-3">
                            <HeartPulse className="w-5 h-5 text-red-400 mt-1" />
                            <div>
                                <div className="text-sm text-muted-foreground">Blood Pressure</div>
                                <div className="font-semibold">{selectedVital.systolic}/{selectedVital.diastolic} mmHg</div>
                            </div>
                        </div>
                    )}
                    {selectedVital.oxygenLevel && (
                        <div className="flex items-start gap-3">
                            <Activity className="w-5 h-5 text-cyan-400 mt-1" />
                            <div>
                                <div className="text-sm text-muted-foreground">Oxygen Saturation</div>
                                <div className="font-semibold">{selectedVital.oxygenLevel}%</div>
                            </div>
                        </div>
                    )}
                    {selectedVital.temperature && (
                        <div className="flex items-start gap-3">
                            <Thermometer className="w-5 h-5 text-orange-400 mt-1" />
                            <div>
                                <div className="text-sm text-muted-foreground">Temperature</div>
                                <div className="font-semibold">{selectedVital.temperature}°F</div>
                            </div>
                        </div>
                    )}
                    {selectedVital.bloodSugar && (
                        <div className="flex items-start gap-3">
                            <Droplets className="w-5 h-5 text-yellow-400 mt-1" />
                            <div>
                                <div className="text-sm text-muted-foreground">Blood Sugar</div>
                                <div className="font-semibold">{selectedVital.bloodSugar} mg/dL</div>
                            </div>
                        </div>
                    )}
                    {selectedVital.weight && (
                        <div className="flex items-start gap-3">
                            <Scale className="w-5 h-5 text-green-400 mt-1" />
                            <div>
                                <div className="text-sm text-muted-foreground">Weight</div>
                                <div className="font-semibold">{selectedVital.weight} lbs</div>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {activeChart && (
        <Dialog open={!!activeChart} onOpenChange={(isOpen) => !isOpen && setActiveChart(null)}>
            <DialogContent className="sm:max-w-xl">
                {activeChart === 'bp' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Blood Pressure Trend</DialogTitle>
                            <DialogDescription>Systolic and diastolic pressure over time.</DialogDescription>
                        </DialogHeader>
                        <div className="pt-4">
                            {chartData.filter(d => d.systolic || d.diastolic).length < 2 ? <div className="flex items-center justify-center h-48 text-muted-foreground">Not enough data to display chart.</div> :
                            <ChartContainer config={bpChartConfig} className="min-h-[200px] w-full">
                                <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--foreground) / 0.1)" />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} tickLine={false} axisLine={false}/>
                                    <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                                    <Line dataKey="systolic" type="monotone" stroke="var(--color-systolic)" strokeWidth={2.5} dot={false} filter="url(#neon-glow)" />
                                    <Line dataKey="diastolic" type="monotone" stroke="var(--color-diastolic)" strokeWidth={2.5} dot={false} filter="url(#neon-glow)" />
                                </LineChart>
                            </ChartContainer>}
                        </div>
                    </>
                )}
                {activeChart === 'oxygen' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Oxygen Level Trend</DialogTitle>
                            <DialogDescription>SpO2 percentage over time.</DialogDescription>
                        </DialogHeader>
                        <div className="pt-4">{renderChart('oxygenLevel', 'Oxygen Level', 'hsl(var(--chart-3))')}</div>
                    </>
                )}
                {activeChart === 'temp' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Temperature Trend</DialogTitle>
                            <DialogDescription>Body temperature over time.</DialogDescription>
                        </DialogHeader>
                        <div className="pt-4">{renderChart('temperature', 'Temperature', 'hsl(var(--chart-4))')}</div>
                    </>
                )}
                {activeChart === 'sugar' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Blood Sugar Trend</DialogTitle>
                            <DialogDescription>Blood glucose level over time.</DialogDescription>
                        </DialogHeader>
                        <div className="pt-4">{renderChart('bloodSugar', 'Blood Sugar', 'hsl(var(--chart-5))')}</div>
                    </>
                )}
                {activeChart === 'weight' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Weight Trend</DialogTitle>
                            <DialogDescription>Body weight over time.</DialogDescription>
                        </DialogHeader>
                        <div className="pt-4">{renderChart('weight', 'Weight', 'hsl(var(--chart-1))')}</div>
                    </>
                )}
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
