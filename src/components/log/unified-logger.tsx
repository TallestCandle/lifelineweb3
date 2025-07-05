
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
import { Loader } from '@/components/ui/loader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Camera, Sparkles, Save, RotateCcw, AlertCircle, HeartPulse, Beaker, Loader2, FileClock } from 'lucide-react';
import { cn } from '@/lib/utils';

const loggerSchema = z.object({
  userPrompt: z.string().optional(),
});
type LoggerFormValues = z.infer<typeof loggerSchema>;

interface Vital {
    type: 'vitals';
    id: string;
    date: string;
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
    date: string;
    protein?: string;
    glucose?: string;
    ketones?: string;
    blood?: string;
    nitrite?: string;
    ph?: string;
}

type HistoryItem = Vital | Strip;

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
        };

        const fetchHistory = async () => {
            setIsHistoryLoading(true);
            try {
                const basePath = `users/${user.uid}`;
                const vitalsCol = collection(db, `${basePath}/vitals`);
                const stripsCol = collection(db, `${basePath}/test_strips`);
                
                const [vitalsSnap, stripsSnap] = await Promise.all([
                    getDocs(query(vitalsCol, orderBy('date', 'desc'))),
                    getDocs(query(stripsCol, orderBy('date', 'desc'))),
                ]);

                const vitalsData = vitalsSnap.docs.map(doc => ({ type: 'vitals' as const, id: doc.id, ...doc.data() } as Vital));
                const stripsData = stripsSnap.docs.map(doc => ({ type: 'strips' as const, id: doc.id, ...doc.data() } as Strip));

                const combinedHistory = [...vitalsData, ...stripsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                setAiResult(null); // Reset AI result when new image is uploaded
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
        let savedItem: HistoryItem | null = null;

        try {
            if (aiResult.extractedVitals && Object.keys(aiResult.extractedVitals).length > 0) {
                const vitalsCollectionRef = collection(db, `users/${user.uid}/vitals`);
                const dataToSave = { ...aiResult.extractedVitals, date: new Date().toISOString() };
                const docRef = await addDoc(vitalsCollectionRef, dataToSave);
                savedItem = { type: 'vitals', id: docRef.id, ...dataToSave };
                saved = true;
            }
            if (aiResult.extractedTestStrip && Object.keys(aiResult.extractedTestStrip).length > 0) {
                const stripsCollectionRef = collection(db, `users/${user.uid}/test_strips`);
                const dataToSave = { ...aiResult.extractedTestStrip, date: new Date().toISOString() };
                const docRef = await addDoc(stripsCollectionRef, dataToSave);
                savedItem = { type: 'strips', id: docRef.id, ...dataToSave };
                saved = true;
            }

            if (saved && savedItem) {
                toast({ title: 'Data Saved', description: 'Your health data has been logged to your history.' });
                setHistory(prev => [savedItem!, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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

     const renderHistoryItemContent = (item: HistoryItem) => {
        const data = { ...item };
        delete (data as any).id;
        delete (data as any).type;
        delete (data as any).date;

        return (
            <div className="text-sm space-y-1">
                {Object.entries(data).map(([key, value]) => {
                    if (!value) return null;
                    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return (
                        <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground">{formattedKey}:</span>
                            <span className="font-bold">{value}</span>
                        </div>
                    );
                })}
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
                                        {renderHistoryItemContent(item)}
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
