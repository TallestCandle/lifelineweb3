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
import { HeartPulse, Thermometer, Scale, Droplets, Activity, Pencil, Trash2, PlusCircle, Ban } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAuth } from '@/context/auth-provider';
import { useProfile } from '@/context/profile-provider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, getDoc } from 'firebase/firestore';

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
  const [editingId, setEditingId] = useState<string | null>(null);
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

    if (editingId) {
      const docRef = doc(db, `users/${user.uid}/profiles/${activeProfile.id}/vitals`, editingId);
      await updateDoc(docRef, data);
      setVitalsHistory(vitalsHistory.map(entry => entry.id === editingId ? { ...entry, ...data } : entry));
      toast({ title: "Vitals Updated", description: "The vital sign entry has been successfully updated." });
      setEditingId(null);
    } else {
      const newEntryData = { ...data, date: new Date().toISOString() };
      const docRef = await addDoc(vitalsCollectionRef, newEntryData);
      const newEntry: VitalsEntry = { ...newEntryData, id: docRef.id };
      setVitalsHistory([newEntry, ...vitalsHistory]);
      toast({ title: "Vitals Logged", description: "Your new vital signs have been saved." });
    }
    form.reset({ systolic: '', diastolic: '', oxygenLevel: '', temperature: '', bloodSugar: '', weight: '' });
  };
  
  const handleEdit = (entry: VitalsEntry) => {
    setEditingId(entry.id);
    form.reset(entry);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDelete = async (id: string) => {
    if (!user || !activeProfile) return;
    await deleteDoc(doc(db, `users/${user.uid}/profiles/${activeProfile.id}/vitals`, id));
    setVitalsHistory(vitalsHistory.filter(entry => entry.id !== id));
    toast({ variant: 'destructive', title: "Entry Deleted", description: "The vital sign entry has been removed." });
  };
  
  const cancelEdit = () => {
    setEditingId(null);
    form.reset();
  }

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
              <span>{editingId ? 'Edit Vitals' : 'Log New Vitals'}</span>
              {editingId ? <Pencil className="w-6 h-6 text-primary"/> : <PlusCircle className="w-6 h-6 text-primary"/>}
            </CardTitle>
            <CardDescription>{editingId ? 'Update the measurements below.' : 'Enter your current measurements below.'}</CardDescription>
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
                    {editingId && <Button type="button" variant="secondary" onClick={cancelEdit} className="w-full"><Ban />Cancel</Button>}
                    <Button type="submit" className="w-full">{editingId ? 'Update Vitals' : 'Save Vitals'}</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-8">
        <NeonGlowFilter />
        <Card>
            <CardHeader><CardTitle className="text-glow">Vitals Trends</CardTitle></CardHeader>
            <CardContent>
                <Tabs defaultValue="bp">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
                        <TabsTrigger value="bp">Pressure</TabsTrigger>
                        <TabsTrigger value="oxygen">Oxygen</TabsTrigger>
                        <TabsTrigger value="temp">Temp</TabsTrigger>
                        <TabsTrigger value="sugar">Sugar</TabsTrigger>
                        <TabsTrigger value="weight">Weight</TabsTrigger>
                    </TabsList>
                    <TabsContent value="bp" className="pt-4">
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
                    </TabsContent>
                    <TabsContent value="oxygen" className="pt-4">{renderChart('oxygenLevel', 'Oxygen Level', 'hsl(var(--chart-3))')}</TabsContent>
                    <TabsContent value="temp" className="pt-4">{renderChart('temperature', 'Temperature', 'hsl(var(--chart-4))')}</TabsContent>
                    <TabsContent value="sugar" className="pt-4">{renderChart('bloodSugar', 'Blood Sugar', 'hsl(var(--chart-5))')}</TabsContent>
                    <TabsContent value="weight" className="pt-4">{renderChart('weight', 'hsl(var(--chart-1))')}</TabsContent>
                </Tabs>
            </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Vitals History</CardTitle>
            <CardDescription>A log of all your previously recorded vital signs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vitals</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vitalsHistory.length > 0 ? vitalsHistory.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium whitespace-nowrap">{format(parseISO(entry.date), 'MMM d, yyyy, h:mm a')}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {entry.systolic && entry.diastolic && <span className="flex items-center gap-1"><HeartPulse className="w-4 h-4 text-red-400"/> {entry.systolic}/{entry.diastolic} mmHg</span>}
                            {entry.oxygenLevel && <span className="flex items-center gap-1"><Activity className="w-4 h-4 text-cyan-400"/> {entry.oxygenLevel}%</span>}
                            {entry.temperature && <span className="flex items-center gap-1"><Thermometer className="w-4 h-4 text-orange-400"/> {entry.temperature}°F</span>}
                            {entry.bloodSugar && <span className="flex items-center gap-1"><Droplets className="w-4 h-4 text-yellow-400"/> {entry.bloodSugar} mg/dL</span>}
                            {entry.weight && <span className="flex items-center gap-1"><Scale className="w-4 h-4 text-green-400"/> {entry.weight} lbs</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this vitals entry.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(entry.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
    </div>
  );
}
