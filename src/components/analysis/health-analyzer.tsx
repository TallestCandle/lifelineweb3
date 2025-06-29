
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';

import { analyzeHealth, type AnalyzeHealthInput, type AnalyzeHealthOutput } from '@/ai/flows/analyze-health-flow';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Beaker, PlusCircle, Trash2, HeartPulse, Thermometer, Scale, Droplets, Activity, Lightbulb, Save, Share2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import { useProfile } from '@/context/profile-provider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, addDoc, query, orderBy } from 'firebase/firestore';

const markers = [
    { value: "protein", label: "Protein" }, { value: "glucose", label: "Glucose" }, { value: "ketones", label: "Ketones" },
    { value: "blood", label: "Blood" }, { value: "nitrite", label: "Nitrite" }, { value: "ph", label: "pH" },
];

const generalLevels = ["Negative", "Trace", "+", "++", "+++"];
const phLevels = ["5.0", "6.0", "6.5", "7.0", "7.5", "8.0", "9.0"];

const analysisSchema = z.object({
  systolic: z.string().optional(), diastolic: z.string().optional(),
  bloodSugar: z.string().optional(), oxygenSaturation: z.string().optional(),
  temperature: z.string().optional(), weight: z.string().optional(),
  protein: z.string().optional(), glucose: z.string().optional(),
  ketones: z.string().optional(), blood: z.string().optional(),
  nitrite: z.string().optional(), ph: z.string().optional(),
});
type AnalysisFormValues = z.infer<typeof analysisSchema>;

interface HealthAnalysisRecord {
    id: string;
    timestamp: string;
    inputData: AnalyzeHealthInput;
    analysisResult: AnalyzeHealthOutput;
}

const UrgencyConfig = {
    'Good': { color: 'bg-green-500', text: 'Good' },
    'Mild': { color: 'bg-yellow-400', text: 'Mild' },
    'Moderate': { color: 'bg-orange-500', text: 'Moderate' },
    'Critical': { color: 'bg-red-600', text: 'Critical' },
};

export function HealthAnalyzer() {
    const { user } = useAuth();
    const { activeProfile } = useProfile();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeHealthOutput | null>(null);
    const [inputData, setInputData] = useState<AnalyzeHealthInput | null>(null);
    const [history, setHistory] = useState<HealthAnalysisRecord[]>([]);

    const form = useForm<AnalysisFormValues>({
        resolver: zodResolver(analysisSchema),
        defaultValues: {
            systolic: '', diastolic: '', bloodSugar: '', oxygenSaturation: '',
            temperature: '', weight: '', protein: '', glucose: '',
            ketones: '', blood: '', nitrite: '', ph: '',
        },
    });

    useEffect(() => {
        if (!user || !activeProfile) return;

        const fetchHistory = async () => {
            const historyCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/health_analyses`);
            const q = query(historyCollectionRef, orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthAnalysisRecord)));
        };
        fetchHistory();
    }, [user, activeProfile]);

    const onSubmit = async (data: AnalysisFormValues) => {
        setIsLoading(true);
        setAnalysisResult(null);

        const filledData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v && v !== '')
        ) as AnalyzeHealthInput;

        if (Object.keys(filledData).length === 0) {
            toast({ variant: 'destructive', title: "No Data Entered", description: "Please enter at least one health metric to analyze." });
            setIsLoading(false);
            return;
        }
        
        setInputData(filledData);

        try {
            const result = await analyzeHealth(filledData);
            setAnalysisResult(result);
        } catch (error) {
            console.error("AI analysis failed:", error);
            toast({
                variant: 'destructive',
                title: 'Analysis Failed',
                description: 'Unable to analyze. Please check your internet connection and try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const saveAnalysis = async () => {
        if (!analysisResult || !inputData || !user || !activeProfile) return;
        
        const record: Omit<HealthAnalysisRecord, 'id'> = {
            timestamp: new Date().toISOString(),
            inputData,
            analysisResult,
        };

        const historyCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/health_analyses`);
        const docRef = await addDoc(historyCollectionRef, record);
        
        setHistory(prev => [{ ...record, id: docRef.id }, ...prev]);
        setAnalysisResult(null); // Clear the result after saving
        setInputData(null);
        form.reset();
        
        toast({ title: 'Analysis Saved', description: 'The health evaluation has been saved to your history.' });
    };

    const shareAnalysis = (record: HealthAnalysisRecord) => {
        const { inputData, analysisResult, timestamp } = record;
        const reportText = `
Health Analysis Report
Date: ${format(parseISO(timestamp), 'MMM d, yyyy, h:mm a')}
Profile: ${activeProfile?.name}

Urgency: ${analysisResult.urgency}

Summary:
${analysisResult.summary}

Advice:
${analysisResult.advice}

--- Input Data ---
${Object.entries(inputData).map(([key, value]) => `${key}: ${value}`).join('\n')}
        `.trim();

        if (navigator.share) {
            navigator.share({ title: 'Health Analysis Report', text: reportText })
              .catch(err => console.error("Share failed", err));
        } else {
            navigator.clipboard.writeText(reportText).then(() => {
                toast({ title: "Copied to Clipboard", description: "Report text copied. You can now paste it." });
            });
        }
    };

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BrainCircuit className="w-8 h-8 text-primary" />
                        <span className="text-2xl">AI-Powered Health Analysis</span>
                    </CardTitle>
                    <CardDescription>Enter your current health data in one go and get an instant AI-powered analysis of your health status.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <section>
                                <h3 className="text-lg font-medium mb-2 flex items-center gap-2"><HeartPulse />Vitals</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="systolic" render={({ field }) => (<FormItem><FormLabel>Systolic (mmHg)</FormLabel><FormControl><Input placeholder="120" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="diastolic" render={({ field }) => (<FormItem><FormLabel>Diastolic (mmHg)</FormLabel><FormControl><Input placeholder="80" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="bloodSugar" render={({ field }) => (<FormItem><FormLabel>Blood Sugar (mg/dL)</FormLabel><FormControl><Input placeholder="100" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="oxygenSaturation" render={({ field }) => (<FormItem><FormLabel>Oxygen Sat. (%)</FormLabel><FormControl><Input placeholder="98" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="temperature" render={({ field }) => (<FormItem><FormLabel>Temperature (°F)</FormLabel><FormControl><Input placeholder="98.6" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight (lbs)</FormLabel><FormControl><Input placeholder="150" {...field} /></FormControl></FormItem>)} />
                                </div>
                            </section>
                            <section>
                                <h3 className="text-lg font-medium mb-2 flex items-center gap-2"><Beaker />Urine Test Strip</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {markers.map(marker => (
                                        <FormField
                                            key={marker.value}
                                            control={form.control}
                                            name={marker.value as keyof AnalysisFormValues}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{marker.label}</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {(marker.value === 'ph' ? phLevels : generalLevels).map(level => (
                                                                <SelectItem key={level} value={level}>{level}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </section>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? 'Analyzing...' : 'Submit & Analyze'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {analysisResult && (
                <Card className="bg-secondary">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Lightbulb className="w-6 h-6 text-primary"/>
                                AI Health Summary
                            </div>
                            <Badge className={cn("text-white", UrgencyConfig[analysisResult.urgency]?.color)}>
                                {UrgencyConfig[analysisResult.urgency]?.text}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertTitle>Summary</AlertTitle>
                            <AlertDescription>{analysisResult.summary}</AlertDescription>
                        </Alert>
                        <Alert>
                            <AlertTitle>Advice</AlertTitle>
                            <AlertDescription>{analysisResult.advice}</AlertDescription>
                        </Alert>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setAnalysisResult(null)}>Discard</Button>
                        <Button onClick={saveAnalysis}><Save className="mr-2"/>Save to History</Button>
                    </CardFooter>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Health Evaluations History</CardTitle>
                    <CardDescription>Review your past AI-powered health analyses. History is read-only.</CardDescription>
                </CardHeader>
                <CardContent>
                     {history.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {history.map(item => (
                                <AccordionItem value={item.id} key={item.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("w-3 h-3 rounded-full", UrgencyConfig[item.analysisResult.urgency]?.color)} />
                                                <span>{format(parseISO(item.timestamp), 'MMM d, yyyy, h:mm a')}</span>
                                            </div>
                                            <Badge variant="outline">{item.analysisResult.urgency}</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <p><strong className="font-medium">Summary:</strong> {item.analysisResult.summary}</p>
                                        <p><strong className="font-medium">Advice:</strong> {item.analysisResult.advice}</p>
                                        <details className="text-sm">
                                            <summary className="cursor-pointer font-medium">View Submitted Data</summary>
                                            <pre className="mt-2 p-2 bg-muted rounded-md text-xs whitespace-pre-wrap">
                                                {JSON.stringify(item.inputData, null, 2)}
                                            </pre>
                                        </details>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button variant="ghost" size="icon" onClick={() => shareAnalysis(item)}><Share2 className="w-4 h-4" /></Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                     ) : (
                        <p className="text-muted-foreground text-center py-4">No evaluations saved yet.</p>
                     )}
                </CardContent>
            </Card>
        </div>
    );
}
