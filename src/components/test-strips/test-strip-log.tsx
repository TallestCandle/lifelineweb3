
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Beaker, Trash2, PlusCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import { useProfile } from '@/context/profile-provider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

const markers = [
    { value: "protein", label: "Protein" },
    { value: "glucose", label: "Glucose" },
    { value: "ketones", label: "Ketones" },
    { value: "blood", label: "Blood" },
    { value: "nitrite", label: "Nitrite" },
    { value: "ph", label: "pH" },
];

const levels = [
    { value: "Negative", color: "bg-green-500" },
    { value: "Trace", color: "bg-yellow-400" },
    { value: "+", color: "bg-orange-500" },
    { value: "++", color: "bg-red-500" },
    { value: "+++", color: "bg-red-700" },
    // for pH
    { value: "5.0", color: "bg-orange-400" },
    { value: "6.0", color: "bg-yellow-400" },
    { value: "6.5", color: "bg-yellow-500" },
    { value: "7.0", color: "bg-green-400" },
    { value: "7.5", color: "bg-green-500" },
    { value: "8.0", color: "bg-teal-500" },
    { value: "9.0", color: "bg-blue-500" },
];

const stripLogSchema = z.object({
  marker: z.string().min(1, "Please select a marker."),
  level: z.string().min(1, "Please select a level."),
});

type StripLogFormValues = z.infer<typeof stripLogSchema>;

interface StripLogEntry extends StripLogFormValues {
  id: string;
  date: string;
}

export function TestStripLog() {
    const [isClient, setIsClient] = useState(false);
    const [stripLogs, setStripLogs] = useState<StripLogEntry[]>([]);
    const { toast } = useToast();
    const { user } = useAuth();
    const { activeProfile } = useProfile();

    const form = useForm<StripLogFormValues>({
        resolver: zodResolver(stripLogSchema),
        defaultValues: { marker: "", level: "" },
    });

    useEffect(() => {
        setIsClient(true);
        if (!user || !activeProfile) {
            setStripLogs([]);
            return;
        }

        const logsCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/test_strips`);
        const q = query(logsCollectionRef, orderBy('date', 'desc'));
        
        getDocs(q)
            .then(snapshot => {
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StripLogEntry));
                setStripLogs(logs);
            })
            .catch(error => console.error("Error fetching test strip logs:", error));

    }, [isClient, user, activeProfile]);


    const getLevelConfig = (levelValue: string) => {
        return levels.find(l => l.value === levelValue) || { color: 'bg-gray-400' };
    };

    const onSubmit = async (data: StripLogFormValues) => {
        if (!user || !activeProfile) return;
        const newEntryData = { ...data, date: new Date().toISOString() };
        const logsCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/test_strips`);
        const docRef = await addDoc(logsCollectionRef, newEntryData);
        
        const newEntry: StripLogEntry = { ...newEntryData, id: docRef.id };
        const updatedLogs = [newEntry, ...stripLogs];
        setStripLogs(updatedLogs);
        
        toast({ title: "Test Strip Logged", description: "Your test strip result has been saved." });
        
        form.reset({marker: "", level: ""});
    };

    const handleDelete = async (id: string) => {
        if (!user || !activeProfile) return;
        await deleteDoc(doc(db, `users/${user.uid}/profiles/${activeProfile.id}/test_strips`, id));
        setStripLogs(stripLogs.filter(entry => entry.id !== id));
        toast({ variant: 'destructive', title: "Entry Deleted", description: "The log entry has been removed." });
    };
    
    const relevantLevels = markers.find(m => m.value === form.watch('marker'))?.value === 'ph'
        ? levels.filter(l => !isNaN(parseFloat(l.value)))
        : levels.filter(l => isNaN(parseFloat(l.value)));

    if (!isClient || !activeProfile) return null;

    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PlusCircle className="w-6 h-6"/>
                            Log Test Strip Result
                        </CardTitle>
                        <CardDescription>Select the marker and corresponding level from your test strip.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="marker"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Marker</FormLabel>
                                            <Select onValueChange={(value) => { field.onChange(value); form.setValue('level', ''); }} value={field.value} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select a marker" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {markers.map(marker => <SelectItem key={marker.value} value={marker.value}>{marker.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="level"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Level / Result</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!form.watch('marker')}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select a level" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {relevantLevels.map(level => (
                                                        <SelectItem key={level.value} value={level.value}>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn("w-3 h-3 rounded-full", level.color)}></span>
                                                                <span>{level.value}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full">Save Result</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Beaker className="w-6 h-6"/>
                            Test Strip History
                        </CardTitle>
                        <CardDescription>A log of your previous test strip results.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[600px] overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Marker</TableHead>
                                        <TableHead>Result</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stripLogs.length > 0 ? stripLogs.map(entry => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="font-medium whitespace-nowrap">{format(parseISO(entry.date), 'MMM d, yyyy, h:mm a')}</TableCell>
                                            <TableCell>{markers.find(m => m.value === entry.marker)?.label}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="flex gap-2 items-center w-fit">
                                                    <span className={cn("w-3 h-3 rounded-full", getLevelConfig(entry.level).color)}></span>
                                                    <span>{entry.level}</span>
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete this log entry.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(entry.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={4} className="text-center h-24">No results logged yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
