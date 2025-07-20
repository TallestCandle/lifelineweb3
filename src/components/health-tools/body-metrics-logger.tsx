
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';

import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileClock, Trash2, ArrowLeft, Loader2, Ruler, Calculator } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// --- Schemas & Types ---
const bmiSchema = z.object({
  height: z.string().min(1, "Required"),
  weight: z.string().min(1, "Required"),
  bmi: z.string().optional(),
});
const waistHipSchema = z.object({
    waist: z.string().min(1, "Required"),
    hip: z.string().min(1, "Required"),
    whr: z.string().optional(),
});
const waistHeightSchema = z.object({
    waist: z.string().min(1, "Required"),
    height: z.string().min(1, "Required"),
    wthr: z.string().optional(),
});

type MetricType = 'bmi' | 'waist_hip_ratio' | 'waist_height_ratio';

interface MetricHistoryItem {
    id: string;
    date: string;
    type: MetricType;
    values: Record<string, any>;
}

const metricOptions: { type: MetricType, title: string, icon: React.ElementType, schema: any, fields: string[] }[] = [
    { type: 'bmi', title: 'BMI', icon: Calculator, schema: bmiSchema, fields: ['height', 'weight'] },
    { type: 'waist_hip_ratio', title: 'Waist-Hip Ratio', icon: Ruler, schema: waistHipSchema, fields: ['waist', 'hip'] },
    { type: 'waist_height_ratio', title: 'Waist-Height Ratio', icon: Ruler, schema: waistHeightSchema, fields: ['waist', 'height'] },
];

// --- Main Component ---
export function BodyMetricsLogger() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [activeForm, setActiveForm] = useState<typeof metricOptions[number] | null>(null);
    const [history, setHistory] = useState<MetricHistoryItem[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    const form = useForm({
        resolver: activeForm ? zodResolver(activeForm.schema) : undefined,
    });
    
    useEffect(() => {
        if (activeForm) {
            form.reset();
        }
    }, [activeForm, form]);

    useEffect(() => {
        if (!user) {
            setIsHistoryLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setIsHistoryLoading(true);
            try {
                const basePath = `users/${user.uid}`;
                const metricsSnap = await getDocs(query(collection(db, `${basePath}/body_metrics`), orderBy('date', 'desc')));
                const metricsData = metricsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MetricHistoryItem));
                setHistory(metricsData);
            } catch (error) {
                console.error("Error fetching log history:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your log history.' });
            } finally {
                setIsHistoryLoading(false);
            }
        };
        fetchHistory();
    }, [user, toast]);
    
    const handleSave = async (data: any) => {
        if (!user || !activeForm) return;

        const date = new Date().toISOString();
        const collectionRef = collection(db, `users/${user.uid}/body_metrics`);
        
        // Calculate derived values
        if (activeForm.type === 'bmi' && data.height && data.weight) {
            const heightM = parseFloat(data.height) / 100;
            const weightKg = parseFloat(data.weight);
            data.bmi = (weightKg / (heightM * heightM)).toFixed(1);
        }
        if (activeForm.type === 'waist_hip_ratio' && data.waist && data.hip) {
            data.whr = (parseFloat(data.waist) / parseFloat(data.hip)).toFixed(2);
        }
        if (activeForm.type === 'waist_height_ratio' && data.waist && data.height) {
            data.wthr = (parseFloat(data.waist) / parseFloat(data.height)).toFixed(2);
        }

        const payload: Omit<MetricHistoryItem, 'id'> = {
            date,
            type: activeForm.type,
            values: data
        }

        try {
            const docRef = await addDoc(collectionRef, payload);
            setHistory(prev => [{ ...payload, id: docRef.id }, ...prev].sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
            toast({ title: 'Data Saved', description: `${activeForm.title} has been logged.` });
            setActiveForm(null);
        } catch (error) {
            console.error("Error saving data:", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the data.' });
        }
    };
    
    const deleteHistoryItem = async (item: MetricHistoryItem) => {
        if (!user) return;
        
        const docRef = doc(db, `users/${user.uid}/body_metrics`, item.id);
        
        try {
            await deleteDoc(docRef);
            setHistory(prev => prev.filter(h => h.id !== item.id));
            toast({ title: 'Entry Deleted', description: 'The log entry has been removed.' });
        } catch (error) {
            console.error("Error deleting item:", error);
            toast({ variant: 'destructive', title: 'Delete Failed' });
        }
    };

    const renderFormFields = () => {
        if (!activeForm) return null;

        const fieldMap = {
            height: <FormField key="height" control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input placeholder="175" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />,
            weight: <FormField key="weight" control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input placeholder="70" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />,
            waist: <FormField key="waist" control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist (cm)</FormLabel><FormControl><Input placeholder="85" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />,
            hip: <FormField key="hip" control={form.control} name="hip" render={({ field }) => (<FormItem><FormLabel>Hip (cm)</FormLabel><FormControl><Input placeholder="95" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />,
        };

        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeForm.fields.map(fieldName => (fieldMap as any)[fieldName])}
        </div>
    };

    return (
        <div className="space-y-8">
            <Card className="overflow-hidden">
                <AnimatePresence mode="wait">
                    {!activeForm ? (
                        <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {metricOptions.map((opt) => (
                                        <button key={opt.type} onClick={() => setActiveForm(opt)} className="group flex flex-col items-center justify-center p-4 h-32 rounded-lg bg-secondary/50 hover:bg-secondary transition-all">
                                            <opt.icon className="w-10 h-10 text-primary mb-2 transition-transform group-hover:scale-110" />
                                            <p className="font-bold text-sm text-center">{opt.title}</p>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </motion.div>
                    ) : (
                        <motion.div key="form" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ ease: "easeInOut", duration: 0.3 }}>
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveForm(null)}><ArrowLeft/></Button>
                                    <div>
                                        <CardTitle>Log {activeForm.title}</CardTitle>
                                        <CardDescription>Enter the values below.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                                        {renderFormFields()}
                                        {form.formState.errors.root && <FormMessage>{form.formState.errors.root.message}</FormMessage>}
                                        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                            {form.formState.isSubmitting ? <Loader2 className="animate-spin mr-2"/> : null}
                                            Save Log
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileClock className="w-6 h-6"/>Log History</CardTitle>
                    <CardDescription>View your previously logged body metrics.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isHistoryLoading ? <Loader2 className="mx-auto w-8 h-8 animate-spin text-primary" /> : history.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {history.map(item => (
                                <AccordionItem value={item.id} key={item.id}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-3">
                                            <Ruler className="w-5 h-5 text-purple-400"/>
                                            <div className="text-left">
                                                <p className="font-bold">{metricOptions.find(o => o.type === item.type)?.title} Log</p>
                                                <p className="text-xs text-muted-foreground">{format(parseISO(item.date), 'MMM d, yyyy, h:mm a')}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pl-10 pr-2 space-y-4">
                                        <div className="text-sm space-y-2">
                                            {Object.entries(item.values).map(([key, value]) => (
                                                <div key={key} className="flex justify-between">
                                                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                    <span className="font-bold">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-end">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete this log entry.
                                                    </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteHistoryItem(item)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : <p className="text-muted-foreground text-center py-8">No log history found.</p>}
                </CardContent>
            </Card>
        </div>
    );
}
