"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { HeartPulse, Thermometer } from 'lucide-react';

const vitalsSchema = z.object({
  systolic: z.string().min(1, "Required").regex(/^\d+$/, "Must be a number"),
  diastolic: z.string().min(1, "Required").regex(/^\d+$/, "Must be a number"),
  heartRate: z.string().min(1, "Required").regex(/^\d+$/, "Must be a number"),
  temperature: z.string().min(1, "Required").regex(/^\d+(\.\d{1,2})?$/, "Must be a number"),
});

type VitalsFormValues = z.infer<typeof vitalsSchema>;

interface VitalsEntry extends VitalsFormValues {
  date: Date;
}

const initialVitals: VitalsEntry[] = [
  { date: new Date(2023, 10, 20, 8, 5), systolic: '120', diastolic: '80', heartRate: '72', temperature: '98.6' },
  { date: new Date(2023, 10, 19, 8, 2), systolic: '122', diastolic: '81', heartRate: '75', temperature: '98.7' },
];

export function VitalsLog() {
  const [vitalsHistory, setVitalsHistory] = useState<VitalsEntry[]>(initialVitals);
  const { toast } = useToast();

  const form = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: { systolic: '', diastolic: '', heartRate: '', temperature: '' },
  });

  function onSubmit(data: VitalsFormValues) {
    const newEntry = { ...data, date: new Date() };
    setVitalsHistory([newEntry, ...vitalsHistory]);
    form.reset();
    toast({
      title: "Vitals Logged",
      description: "Your new vital signs have been saved.",
    });
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Log New Vitals</CardTitle>
            <CardDescription>Enter your current measurements below.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="systolic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Pressure (Systolic)</FormLabel>
                      <FormControl><Input placeholder="e.g., 120" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="diastolic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Pressure (Diastolic)</FormLabel>
                      <FormControl><Input placeholder="e.g., 80" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heartRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Heart Rate (BPM)</FormLabel>
                      <FormControl><Input placeholder="e.g., 72" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature (°F)</FormLabel>
                      <FormControl><Input placeholder="e.g., 98.6" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Save Vitals</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Vitals History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Blood Pressure</TableHead>
                  <TableHead>Heart Rate</TableHead>
                  <TableHead>Temperature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vitalsHistory.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(entry.date, 'MMM d, yyyy, h:mm a')}</TableCell>
                    <TableCell>{entry.systolic}/{entry.diastolic} mmHg</TableCell>
                    <TableCell><div className="flex items-center gap-2"><HeartPulse className="w-4 h-4 text-red-500" />{entry.heartRate} bpm</div></TableCell>
                    <TableCell><div className="flex items-center gap-2"><Thermometer className="w-4 h-4 text-blue-500" />{entry.temperature}°F</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
