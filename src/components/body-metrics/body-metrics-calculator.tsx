
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
import { Ruler, FileClock, Trash2, ArrowLeft, Loader2, HelpCircle, Activity, Sigma } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

// --- Schemas & Types ---
const waistCircSchema = z.object({
  waist: z.string().min(1, "Required"),
  gender: z.enum(['Male', 'Female'], { required_error: "Gender is required" }),
});
const wthrSchema = z.object({
  waist: z.string().min(1, "Required"),
  height: z.string().min(1, "Required"),
});
const whrSchema = z.object({
  waist: z.string().min(1, "Required"),
  hip: z.string().min(1, "Required"),
  gender: z.enum(['Male', 'Female'], { required_error: "Gender is required" }),
});

type MetricType = 'waist_circumference' | 'wthr' | 'whr';

interface HistoryItem {
  id: string;
  date: string;
  type: MetricType;
  values: Record<string, any>;
  result?: {
    value: string;
    category: string;
  };
}

const metricOptions: { type: MetricType, title: string, icon: React.ElementType, schema: any, info: React.ReactNode }[] = [
    { 
        type: 'waist_circumference', title: 'Waist Circum.', icon: Activity, schema: waistCircSchema,
        info: "A simple measure of abdominal fat. High values are linked to increased risk of type 2 diabetes and heart disease."
    },
    { 
        type: 'wthr', title: 'Waist-to-Height', icon: Ruler, schema: wthrSchema,
        info: "Compares waist to height. A ratio above 0.5 suggests increased health risks, even in people with a normal BMI."
    },
    { 
        type: 'whr', title: 'Waist-to-Hip', icon: Sigma, schema: whrSchema,
        info: "Assesses fat distribution. A higher ratio (more \"apple-shaped\") indicates more fat around the abdomen, which is a key risk factor for various chronic diseases."
    },
];

// --- Main Component ---
export function BodyMetricsCalculator() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [activeForm, setActiveForm] = useState<typeof metricOptions[number] | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [infoDialogOpen, setInfoDialogOpen] = useState(false);

    const form = useForm({
        resolver: activeForm ? zodResolver(activeForm.schema) : undefined,
        defaultValues: { height: "", weight: "", waist: "", hip: "", gender: undefined },
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
                const collectionRef = collection(db, `users/${user.uid}/body_metrics`);
                const q = query(collectionRef, orderBy('date', 'desc'));
                const snapshot = await getDocs(q);
                setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryItem)));
            } catch (error) {
                console.error("Error fetching body metrics history:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your history.' });
            } finally {
                setIsHistoryLoading(false);
            }
        };
        fetchHistory();
    }, [user, toast]);
    
    const calculateResult = (type: MetricType, values: any) => {
        switch (type) {
            case 'waist_circumference':
                const waistCm = parseFloat(values.waist);
                let wcCategory: string;
                if (values.gender === 'Male') {
                    if (waistCm < 94) wcCategory = 'Low Risk';
                    else if (waistCm <= 102) wcCategory = 'Increased Risk';
                    else wcCategory = 'High Risk';
                } else {
                    if (waistCm < 80) wcCategory = 'Low Risk';
                    else if (waistCm <= 88) wcCategory = 'Increased Risk';
                    else wcCategory = 'High Risk';
                }
                return { value: `${waistCm} cm`, category: wcCategory };
            case 'wthr':
                const wthrRatio = parseFloat(values.waist) / parseFloat(values.height);
                let wthrCategory: string;
                if (wthrRatio < 0.5) wthrCategory = 'Low Risk';
                else if (wthrRatio < 0.6) wthrCategory = 'Increased Risk';
                else wthrCategory = 'High Risk';
                return { value: wthrRatio.toFixed(2), category: wthrCategory };
            case 'whr':
                const whrRatio = parseFloat(values.waist) / parseFloat(values.hip);
                let whrCategory: string;
                if (values.gender === 'Male') {
                    if (whrRatio < 0.9) whrCategory = 'Low Risk';
                    else whrCategory = 'Increased Risk';
                } else {
                    if (whrRatio < 0.85) whrCategory = 'Low Risk';
                    else whrCategory = 'Increased Risk';
                }
                return { value: whrRatio.toFixed(2), category: whrCategory };
            default:
                return undefined;
        }
    };

    const handleSave = async (data: any) => {
        if (!user || !activeForm) return;

        const date = new Date().toISOString();
        const collectionRef = collection(db, `users/${user.uid}/body_metrics`);
        const result = calculateResult(activeForm.type, data);
        
        try {
            const payload: Omit<HistoryItem, 'id'> = {
                date,
                type: activeForm.type,
                values: data,
                result
            };

            const docRef = await addDoc(collectionRef, payload);
            setHistory(prev => [{ ...payload, id: docRef.id }, ...prev]);
            toast({ title: 'Data Saved', description: `${activeForm.title} has been logged.` });
            setActiveForm(null);
        } catch (error) {
            console.error("Error saving data:", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the data.' });
        }
    };
    
    const deleteHistoryItem = async (item: HistoryItem) => {
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

        return (
            <>
                {Object.keys(activeForm.schema.shape).map(key => {
                    if (key === 'gender') {
                        return <FormField key={key} control={form.control} name="gender" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Gender</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />;
                    }
                    return <FormField key={key} control={form.control} name={key as any} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="capitalize">{key} (cm)</FormLabel>
                            <FormControl><Input placeholder={`Enter ${key}`} type="number" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />;
                })}
            </>
        );
    };

    return (
        <div className="space-y-8">
            <Card className="overflow-hidden">
                <AnimatePresence mode="wait">
                    {!activeForm ? (
                        <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <CardHeader>
                                <CardTitle>Log New Body Metric</CardTitle>
                                <CardDescription>What would you like to log today?</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {metricOptions.map((opt) => (
                                        <button key={opt.type} onClick={() => setActiveForm(opt)} className="group flex flex-col items-center justify-center p-4 aspect-square rounded-lg bg-secondary/50 hover:bg-secondary transition-all">
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
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveForm(null)}><ArrowLeft/></Button>
                                        <div>
                                            <CardTitle>Log {activeForm.title}</CardTitle>
                                            <CardDescription>Enter the values below.</CardDescription>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setInfoDialogOpen(true)}>
                                        <HelpCircle className="mr-2"/> What is this?
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{renderFormFields()}</div>
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
                                            <Ruler className="w-5 h-5 text-green-400"/>
                                            <div className="text-left">
                                                <p className="font-bold capitalize">{item.type.replace(/_/g, ' ')}</p>
                                                <p className="text-xs text-muted-foreground">{format(parseISO(item.date), 'MMM d, yyyy, h:mm a')}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pl-10 pr-2 space-y-4">
                                        <div className="text-sm space-y-2">
                                            {item.result && (
                                                <div className="flex justify-between p-2 rounded-md bg-secondary">
                                                    <span className="font-bold">Result</span>
                                                    <span className="font-bold">{item.result.value} ({item.result.category})</span>
                                                </div>
                                            )}
                                            {Object.entries(item.values).map(([key, value]) => (
                                                <div key={key} className="flex justify-between">
                                                    <span className="text-muted-foreground capitalize">{key}</span>
                                                    <span className="font-bold">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-end">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this log entry.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteHistoryItem(item)}>Delete</AlertDialogAction></AlertDialogFooter>
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

            <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>About {activeForm?.title}</DialogTitle>
                        <DialogDescription className="pt-4 text-sm">{activeForm?.info}</DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </div>
    );
}
