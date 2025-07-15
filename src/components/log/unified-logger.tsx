
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';

import { useAuth } from '@/context/auth-provider';
import { useProfile } from '@/context/profile-provider';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HeartPulse, Droplets, Wind, Thermometer, Scale, Beaker, FileClock, Trash2, ArrowLeft, Loader2, BrainCircuit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { analyzeHealth, AnalyzeHealthInput } from '@/ai/flows/analyze-health-flow';

const ANALYSIS_COST = 10;

// --- Schemas & Types ---
const bpSchema = z.object({
    systolic: z.string().min(1, "Required"),
    diastolic: z.string().min(1, "Required"),
    pulseRate: z.string().optional(),
});
const singleValueSchema = (name: string) => z.object({ [name]: z.string().min(1, "Required") });

const testStripSchema = z.object({
    protein: z.string().optional(), glucose: z.string().optional(),
    ketones: z.string().optional(), blood: z.string().optional(),
    nitrite: z.string().optional(), ph: z.string().optional(),
}).refine(data => Object.values(data).some(v => v), { message: "At least one test strip value is required." });

type VitalType = 'blood_pressure' | 'blood_sugar' | 'oxygen_saturation' | 'temperature' | 'weight' | 'test_strip';

interface Vital { type: 'vitals'; id: string; date: string; systolic?: string; diastolic?: string; pulseRate?: string; bloodSugar?: string; oxygenSaturation?: string; temperature?: string; weight?: string; }
interface Strip { type: 'strips'; id: string; date: string; protein?: string; glucose?: string; ketones?: string; blood?: string; nitrite?: string; ph?: string; }
type HistoryItem = Vital | Strip;


const vitalOptions: { type: VitalType, title: string, icon: React.ElementType, schema: any }[] = [
    { type: 'blood_pressure', title: 'Blood Pressure', icon: HeartPulse, schema: bpSchema },
    { type: 'blood_sugar', title: 'Blood Sugar', icon: Droplets, schema: singleValueSchema('bloodSugar') },
    { type: 'oxygen_saturation', title: 'Oxygen Sat.', icon: Wind, schema: singleValueSchema('oxygenSaturation') },
    { type: 'temperature', title: 'Temperature', icon: Thermometer, schema: singleValueSchema('temperature') },
    { type: 'weight', title: 'Weight', icon: Scale, schema: singleValueSchema('weight') },
    { type: 'test_strip', title: 'Test Strip', icon: Beaker, schema: testStripSchema },
];

const stripMarkers = [
    { value: "protein", label: "Protein" }, { value: "glucose", label: "Glucose" }, { value: "ketones", label: "Ketones" },
    { value: "blood", label: "Blood" }, { value: "nitrite", label: "Nitrite" }, { value: "ph", label: "pH" },
];
const generalLevels = ["Negative", "Trace", "+", "++", "+++"];
const phLevels = ["5.0", "6.0", "6.5", "7.0", "7.5", "8.0", "9.0"];


// --- Main Component ---
export function UnifiedLogger() {
    const { user } = useAuth();
    const { profile, updateCredits } = useProfile();
    const { toast } = useToast();

    const [activeForm, setActiveForm] = useState<typeof vitalOptions[number] | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const form = useForm({
        resolver: activeForm ? zodResolver(activeForm.schema) : undefined,
        defaultValues: {
            systolic: "", diastolic: "", pulseRate: "",
            bloodSugar: "", oxygenSaturation: "", temperature: "", weight: "",
            protein: "", glucose: "", ketones: "", blood: "", nitrite: "", ph: "",
        },
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
                const vitalsSnap = await getDocs(query(collection(db, `${basePath}/vitals`), orderBy('date', 'desc')));
                const vitalsData = vitalsSnap.docs.map(doc => ({ type: 'vitals' as const, id: doc.id, ...doc.data() } as Vital));
                
                const stripsSnap = await getDocs(query(collection(db, `${basePath}/test_strips`), orderBy('date', 'desc')));
                const stripsData = stripsSnap.docs.map(doc => ({ type: 'strips' as const, id: doc.id, ...doc.data() } as Strip));

                const combinedHistory = [...vitalsData, ...stripsData].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
                setHistory(combinedHistory);

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
        const collectionName = activeForm.type === 'test_strip' ? 'test_strips' : 'vitals';
        const collectionRef = collection(db, `users/${user.uid}/${collectionName}`);
        
        try {
            const docRef = await addDoc(collectionRef, { ...data, date });
            const newItem: HistoryItem = { 
                type: collectionName as 'vitals' | 'strips', 
                id: docRef.id, 
                ...data, 
                date 
            };
            setHistory(prev => [newItem, ...prev].sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
            toast({ title: 'Data Saved', description: `${activeForm.title} has been logged.` });
            setActiveForm(null);
        } catch (error) {
            console.error("Error saving data:", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the data.' });
        }
    };

    const handleAnalyze = async () => {
        if (!user) return;
        
        setIsAnalyzing(true);
        try {
            await updateCredits(-ANALYSIS_COST);
            const recentVitals = history.filter(item => item.type === 'vitals').slice(0, 1)[0] as Vital | undefined;
            const recentStrips = history.filter(item => item.type === 'strips').slice(0, 1)[0] as Strip | undefined;

            const input: AnalyzeHealthInput = {
                systolic: recentVitals?.systolic,
                diastolic: recentVitals?.diastolic,
                bloodSugar: recentVitals?.bloodSugar,
                oxygenSaturation: recentVitals?.oxygenSaturation,
                temperature: recentVitals?.temperature,
                weight: recentVitals?.weight,
                protein: recentStrips?.protein,
                glucose: recentStrips?.glucose,
                ketones: recentStrips?.ketones,
                blood: recentStrips?.blood,
                nitrite: recentStrips?.nitrite,
                ph: recentStrips?.ph,
            };
            
            const result = await analyzeHealth(input);
            const analysesCol = collection(db, `users/${user.uid}/health_analyses`);
            await addDoc(analysesCol, {
                timestamp: new Date().toISOString(),
                inputData: input,
                analysisResult: result,
            });

            toast({ title: 'Analysis Complete!', description: 'Your AI health analysis has been saved.' });

        } catch (error) {
            console.error("Error running analysis:", error);
            toast({ variant: 'destructive', title: 'Analysis Failed' });
            await updateCredits(ANALYSIS_COST); // Refund credits on failure
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    const deleteHistoryItem = async (item: HistoryItem) => {
        if (!user) return;
        
        const collectionName = item.type === 'strips' ? 'test_strips' : 'vitals';
        const docRef = doc(db, `users/${user.uid}/${collectionName}`, item.id);
        
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

        switch (activeForm.type) {
            case 'blood_pressure':
                return <>
                    <FormField control={form.control} name="systolic" render={({ field }) => (<FormItem><FormLabel>Systolic (mmHg)</FormLabel><FormControl><Input placeholder="120" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="diastolic" render={({ field }) => (<FormItem><FormLabel>Diastolic (mmHg)</FormLabel><FormControl><Input placeholder="80" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="pulseRate" render={({ field }) => (<FormItem><FormLabel>Pulse Rate (BPM) (Optional)</FormLabel><FormControl><Input placeholder="70" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>;
            case 'blood_sugar':
                return <FormField control={form.control} name="bloodSugar" render={({ field }) => (<FormItem><FormLabel>Blood Sugar (mg/dL)</FormLabel><FormControl><Input placeholder="100" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />;
            case 'oxygen_saturation':
                return <FormField control={form.control} name="oxygenSaturation" render={({ field }) => (<FormItem><FormLabel>Oxygen Saturation (%)</FormLabel><FormControl><Input placeholder="98" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />;
            case 'temperature':
                return <FormField control={form.control} name="temperature" render={({ field }) => (<FormItem><FormLabel>Temperature (°F)</FormLabel><FormControl><Input placeholder="98.6" type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)} />;
            case 'weight':
                return <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight (lbs)</FormLabel><FormControl><Input placeholder="150" type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)} />;
            case 'test_strip':
                return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stripMarkers.map(marker => (
                        <FormField key={marker.value} control={form.control} name={marker.value as any} render={({ field }) => (
                            <FormItem>
                                <FormLabel>{marker.label}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {(marker.value === 'ph' ? phLevels : generalLevels).map(level => (
                                            <SelectItem key={level} value={level}>{level}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    ))}
                </div>;
            default: return null;
        }
    };

    const hasSufficientCredits = (profile?.credits ?? 0) >= ANALYSIS_COST;

    return (
        <div className="space-y-8">
            <Card className="overflow-hidden">
                <AnimatePresence mode="wait">
                    {!activeForm ? (
                        <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <CardHeader>
                                <CardTitle>Log New Vitals</CardTitle>
                                <CardDescription>What would you like to log today?</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {vitalOptions.map((opt) => (
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
                    <CardTitle className="flex items-center gap-2"><FileClock className="w-6 h-6"/>Log History & Analysis</CardTitle>
                    <CardDescription>View your previously logged data or run an AI analysis on your most recent entries.</CardDescription>
                </CardHeader>
                <CardContent>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button className="w-full mb-6" disabled={isAnalyzing || history.length === 0}>
                                {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
                                Run AI Analysis ({ANALYSIS_COST} Credits)
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Analysis</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will use {ANALYSIS_COST} credits from your wallet. The analysis will be performed on your most recent vital and test strip logs. Are you sure you want to proceed?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                             <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleAnalyze} disabled={!hasSufficientCredits}>
                                    {hasSufficientCredits ? 'Confirm & Run' : 'Insufficient Credits'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {isHistoryLoading ? <Loader2 className="mx-auto w-8 h-8 animate-spin text-primary" /> : history.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {history.map(item => (
                                <AccordionItem value={item.id} key={item.id}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-3">
                                            {item.type === 'vitals' ? <HeartPulse className="w-5 h-5 text-red-400"/> : <Beaker className="w-5 h-5 text-blue-400"/>}
                                            <div className="text-left">
                                                <p className="font-bold">{item.type === 'vitals' ? 'Vitals Log' : 'Test Strip Log'}</p>
                                                <p className="text-xs text-muted-foreground">{format(parseISO(item.date), 'MMM d, yyyy, h:mm a')}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pl-10 pr-2 space-y-4">
                                        <div className="text-sm space-y-2">
                                            {Object.entries(item).filter(([key, value]) => key !== 'id' && key !== 'type' && key !== 'date' && value).map(([key, value]) => (
                                                <div key={key} className="flex justify-between">
                                                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                    <span className="font-bold">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-end">
                                            <Button variant="destructive" size="sm" onClick={() => deleteHistoryItem(item)}><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
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
