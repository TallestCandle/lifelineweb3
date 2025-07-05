
"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';

import { extractDataFromImage, type ExtractDataFromImageOutput } from '@/ai/flows/extract-data-from-image-flow';
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Camera, Sparkles, Save, RotateCcw, AlertCircle, HeartPulse, Beaker, Loader2, FileClock } from 'lucide-react';

// --- Form Schema and Types ---
const loggerSchema = z.object({
  userPrompt: z.string().optional(),
});
type LoggerFormValues = z.infer<typeof loggerSchema>;

interface Vital {
    type: 'vitals';
    id: string;
    date: string; // ISO String
    systolic?: string;
    diastolic?: string;
    bloodSugar?: string;
    oxygenSaturation?: string;
    temperature?: string;
    weight?: string;
}

interface Strip {
    type: 'strips';
    id: string;
    date: string; // ISO String
    protein?: string;
    glucose?: string;
    ketones?: string;
    blood?: string;
    nitrite?: string;
    ph?: string;
}

type HistoryItem = Vital | Strip;

// --- Helper Component for Rendering History Items ---
const HistoryItemContent = ({ item }: { item: HistoryItem }) => {
    // Define a mapping for display labels
    const displayLabels: Record<string, string> = {
        systolic: 'Systolic',
        diastolic: 'Diastolic',
        bloodSugar: 'Blood Sugar',
        oxygenSaturation: 'Oxygen Saturation',
        temperature: 'Temperature',
        weight: 'Weight',
        protein: 'Protein',
        glucose: 'Glucose',
        ketones: 'Ketones',
        blood: 'Blood',
        nitrite: 'Nitrite',
        ph: 'pH',
    };

    // Make a copy and remove properties we don't want to display dynamically
    const data = { ...item };
    delete (data as any).id;
    delete (data as any).type;
    delete (data as any).date;

    // Get a list of key-value pairs that have a valid value
    const entries = Object.entries(data).filter(([_, value]) => value != null && value !== '');

    if (entries.length === 0) {
        return <p className="text-muted-foreground text-sm">No specific data points were recorded for this entry.</p>;
    }

    return (
        <div className="text-sm space-y-1">
            {entries.map(([key, value]) => (
                <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{displayLabels[key] || key}</span>
                    <span className="font-bold">{String(value)}</span>
                </div>
            ))}
        </div>
    );
};


// --- Main Component ---
export function UnifiedLogger() {
    const { user } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [imageDataUri, setImageDataUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [aiResult, setAiResult] = useState<ExtractDataFromImageOutput | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    const form = useForm<LoggerFormValues>({
        resolver: zodResolver(loggerSchema),
        defaultValues: { userPrompt: "" },
    });

    useEffect(() => {
        if (!user) {
            setIsHistoryLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setIsHistoryLoading(true);
            try {
                const basePath = `users/${user.uid}`;
                
                // Fetch vitals
                const vitalsCol = collection(db, `${basePath}/vitals`);
                const vitalsQuery = query(vitalsCol, orderBy('date', 'desc'));
                const vitalsSnap = await getDocs(vitalsQuery);
                const vitalsData = vitalsSnap.docs.map(doc => ({ type: 'vitals' as const, id: doc.id, ...doc.data() } as Vital));

                // Fetch test strips
                const stripsCol = collection(db, `${basePath}/test_strips`);
                const stripsQuery = query(stripsCol, orderBy('date', 'desc'));
                const stripsSnap = await getDocs(stripsQuery);
                const stripsData = stripsSnap.docs.map(doc => ({ type: 'strips' as const, id: doc.id, ...doc.data() } as Strip));

                // Combine and sort history
                const combinedHistory = [...vitalsData, ...stripsData].sort((a, b) => 
                    parseISO(b.date).getTime() - parseISO(a.date).getTime()
                );
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

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageDataUri(reader.result as string);
                setAiResult(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async (data: LoggerFormValues) => {
        if (!imageDataUri) {
            toast({ variant: 'destructive', title: 'No Image', description: 'Please upload an image to analyze.' });
            return;
        }
        setIsLoading(true);
        setAiResult(null);
        try {
            const result = await extractDataFromImage({
                imageDataUri,
                userPrompt: data.userPrompt,
            });
            setAiResult(result);
        } catch (error) {
            console.error("AI analysis failed:", error);
            toast({ variant: 'destructive', title: 'Analysis Failed', description: 'The AI could not process the image.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSave = async () => {
        if (!user || !aiResult) return;
        
        setIsLoading(true);
        let saved = false;
        
        try {
            const dateToSave = { date: new Date().toISOString() };
            let logType: 'vitals' | 'strips' | null = null;
            let collectionRef;
            let dataPayload: any;

            if (aiResult.extractedVitals && Object.keys(aiResult.extractedVitals).some(key => (aiResult.extractedVitals as any)[key])) {
                logType = 'vitals';
                dataPayload = aiResult.extractedVitals;
                collectionRef = collection(db, `users/${user.uid}/vitals`);
            } else if (aiResult.extractedTestStrip && Object.keys(aiResult.extractedTestStrip).some(key => (aiResult.extractedTestStrip as any)[key])) {
                logType = 'strips';
                dataPayload = aiResult.extractedTestStrip;
                collectionRef = collection(db, `users/${user.uid}/test_strips`);
            }

            if (logType && collectionRef && dataPayload) {
                 const docRef = await addDoc(collectionRef, { ...dataPayload, ...dateToSave });
                 const newItem: HistoryItem = { type: logType, id: docRef.id, ...dataPayload, ...dateToSave };
                 setHistory(prev => [newItem, ...prev].sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
                 saved = true;
            }

            if (saved) {
                toast({ title: 'Data Saved', description: 'Your health data has been logged to your history.' });
                resetState();
            } else {
                toast({ variant: 'destructive', title: 'Nothing to Save', description: 'The AI did not extract any data to save.' });
            }
        } catch (error) {
             console.error("Error saving data:", error);
             toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the extracted data.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const resetState = () => {
        setAiResult(null);
        setImageDataUri(null);
        form.reset();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const renderExtractedData = () => {
        if (!aiResult) return null;
        const vitals = aiResult.extractedVitals;
        const strips = aiResult.extractedTestStrip;
        const hasVitals = vitals && Object.values(vitals).some(v => v);
        const hasStrips = strips && Object.values(strips).some(v => v);

        if (!hasVitals && !hasStrips) {
            return <p className="text-muted-foreground text-sm">The AI could not find any specific data to extract.</p>;
        }

        return (
            <div className="space-y-3 text-sm font-medium">
                {hasVitals && Object.entries(vitals!).map(([key, value]) => value && (
                    <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-bold">{value}</span>
                    </div>
                ))}
                {hasStrips && Object.entries(strips!).map(([key, value]) => value && (
                    <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key}</span>
                        <span className="font-bold">{value}</span>
                    </div>
                ))}
            </div>
        )
    };

    return (
        <div className="space-y-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3"><Camera /> AI-Powered Logger</CardTitle>
                        <CardDescription>Upload an image of your medical device (BP monitor, glucometer) or test strip. Our AI will read it and log the data for you.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAnalyze)} className="space-y-6">
                                <FormItem>
                                    <FormLabel>1. Upload Image</FormLabel>
                                    <FormControl>
                                        <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="file:text-foreground" />
                                    </FormControl>
                                </FormItem>
                                
                                {imageDataUri && (
                                    <div className="flex justify-center p-4 bg-secondary rounded-lg">
                                        <Image src={imageDataUri} alt="Preview" width={250} height={250} className="rounded-md border-2 border-primary/50 object-contain"/>
                                    </div>
                                )}

                                <FormField control={form.control} name="userPrompt" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>2. Give a Hint (Optional)</FormLabel>
                                        <FormControl><Input placeholder="e.g., 'blood pressure reading' or 'urine test strip'" {...field} /></FormControl>
                                    </FormItem>
                                )}/>
                                
                                <Button type="submit" className="w-full" disabled={isLoading || !imageDataUri}>
                                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : <><Sparkles className="mr-2"/> Analyze Image</>}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                {aiResult && (
                    <Card className="bg-secondary">
                        <CardHeader>
                            <CardTitle>Analysis Result</CardTitle>
                            <CardDescription>Please review the data our AI extracted before saving.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!aiResult.isConfident && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Low Confidence</AlertTitle>
                                    <AlertDescription>The AI is not confident about these results, possibly due to image quality. Please double-check the values.</AlertDescription>
                                </Alert>
                            )}
                            <Alert>
                                <AlertTitle className="flex items-center gap-2">
                                    {aiResult.extractedVitals && <HeartPulse />}
                                    {aiResult.extractedTestStrip && <Beaker />}
                                    Summary
                                </AlertTitle>
                                <AlertDescription>{aiResult.analysisSummary}</AlertDescription>
                            </Alert>
                            
                            <div className="p-4 bg-background rounded-lg">
                                <h4 className="font-bold mb-2">Extracted Data:</h4>
                                {renderExtractedData()}
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={resetState}><RotateCcw className="mr-2" /> Start Over</Button>
                            <Button onClick={handleSave} disabled={isLoading}><Save className="mr-2"/>Save to History</Button>
                        </CardFooter>
                    </Card>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileClock className="w-6 h-6"/>
                        <span>Log History</span>
                    </CardTitle>
                    <CardDescription>View your previously logged data.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isHistoryLoading ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : history.length > 0 ? (
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
                                    <AccordionContent className="pl-10">
                                       <HistoryItemContent item={item} />
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No log history found.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
