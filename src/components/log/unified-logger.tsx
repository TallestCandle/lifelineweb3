
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
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Camera, Sparkles, Save, RotateCcw, AlertCircle, HeartPulse, Beaker, Loader2, FileClock, Edit } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

// --- Form Schema and Types ---
const loggerSchema = z.object({
  userPrompt: z.string().optional(),
});
type LoggerFormValues = z.infer<typeof loggerSchema>;

type OtherData = { metricName: string; metricValue: string };

interface Vital {
    type: 'vitals';
    id: string;
    date: string; // ISO String
    systolic?: string;
    diastolic?: string;
    pulseRate?: string;
    bloodSugar?: string;
    oxygenSaturation?: string;
    temperature?: string;
    weight?: string;
    otherData?: OtherData[];
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
    otherData?: OtherData[];
}

type HistoryItem = Vital | Strip;

// --- Helper Component for Rendering History Items ---
const HistoryItemContent = ({ item }: { item: HistoryItem }) => {
    const displayLabels: Record<string, string> = {
        systolic: 'Systolic', diastolic: 'Diastolic', pulseRate: 'Pulse Rate',
        bloodSugar: 'Blood Sugar', oxygenSaturation: 'Oxygen Saturation',
        temperature: 'Temperature', weight: 'Weight', protein: 'Protein',
        glucose: 'Glucose', ketones: 'Ketones', blood: 'Blood',
        nitrite: 'Nitrite', ph: 'pH',
    };

    const data = { ...item };
    const otherData = (data as any).otherData as OtherData[] | undefined;
    
    // Clean up properties that shouldn't be displayed as data rows
    delete (data as any).id;
    delete (data as any).type;
    delete (data as any).date;
    delete (data as any).otherData;

    const mainEntries = Object.entries(data).filter(([_, value]) => value != null && value !== '');
    const otherEntries = otherData || [];

    if (mainEntries.length === 0 && otherEntries.length === 0) {
        return <p className="text-muted-foreground text-sm">No specific data points were recorded for this entry.</p>;
    }

    return (
        <div className="text-sm space-y-2">
            {mainEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{displayLabels[key] || key}</span>
                    <span className="font-bold">{String(value)}</span>
                </div>
            ))}
            
            {otherEntries.length > 0 && mainEntries.length > 0 && <Separator className="my-2" />}
            
            {otherEntries.length > 0 && (
                <div>
                    <h5 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-2">Other Metrics</h5>
                    <div className="space-y-2">
                        {otherEntries.map((metric, index) => (
                             <div key={index} className="flex justify-between">
                                <span className="text-muted-foreground capitalize">{metric.metricName.replace(/([A-Z])/g, ' $1')}</span>
                                <span className="font-bold">{String(metric.metricValue)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Define confidence level configuration
const confidenceConfig = (score: number) => {
    if (score > 90) return { text: 'High', color: 'bg-green-500 text-white' };
    if (score > 75) return { text: 'Medium', color: 'bg-yellow-400 text-black' };
    return { text: 'Low', color: 'bg-red-600 text-white' };
};


// --- Main Component ---
export function UnifiedLogger() {
    const { user } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [imageDataUri, setImageDataUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [aiResult, setAiResult] = useState<ExtractDataFromImageOutput | null>(null);
    const [editableResult, setEditableResult] = useState<ExtractDataFromImageOutput | null>(null);
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
                const vitalsCol = collection(db, `${basePath}/vitals`);
                const vitalsQuery = query(vitalsCol, orderBy('date', 'desc'));
                const vitalsSnap = await getDocs(vitalsQuery);
                const vitalsData = vitalsSnap.docs.map(doc => ({ type: 'vitals' as const, id: doc.id, ...doc.data() } as Vital));

                const stripsCol = collection(db, `${basePath}/test_strips`);
                const stripsQuery = query(stripsCol, orderBy('date', 'desc'));
                const stripsSnap = await getDocs(stripsQuery);
                const stripsData = stripsSnap.docs.map(doc => ({ type: 'strips' as const, id: doc.id, ...doc.data() } as Strip));

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
                setEditableResult(null);
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
        setEditableResult(null);
        try {
            const result = await extractDataFromImage({
                imageDataUri,
                userPrompt: data.userPrompt,
            });
            setAiResult(result);
            setEditableResult(JSON.parse(JSON.stringify(result))); // Deep copy for editing
        } catch (error) {
            console.error("AI analysis failed:", error);
            toast({ variant: 'destructive', title: 'Analysis Failed', description: 'The AI could not process the image.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFieldChange = (type: 'vitals' | 'strips' | 'other', key: string | number, value: string) => {
        setEditableResult(prev => {
            if (!prev) return null;
            const newResult = JSON.parse(JSON.stringify(prev));

            if (type === 'vitals' && newResult.extractedVitals) {
                newResult.extractedVitals[key as keyof typeof newResult.extractedVitals] = value;
            } else if (type === 'strips' && newResult.extractedTestStrip) {
                newResult.extractedTestStrip[key as keyof typeof newResult.extractedTestStrip] = value;
            } else if (type === 'other') {
                if (newResult.otherData && newResult.otherData[key as number]) {
                    newResult.otherData[key as number].metricValue = value;
                }
            }
            return newResult;
        });
    };
    
    const handleSave = async () => {
        if (!user || !editableResult) return;
        
        setIsLoading(true);
        let saved = false;
        
        try {
            const dateToSave = { date: new Date().toISOString() };
            const otherDataToSave = editableResult.otherData && editableResult.otherData.length > 0 ? { otherData: editableResult.otherData } : {};

            let logType: 'vitals' | 'strips' | null = null;
            let collectionRef;
            let dataPayload: any;

            const hasVitals = editableResult.extractedVitals && Object.values(editableResult.extractedVitals).some(v => v);
            const hasStrips = editableResult.extractedTestStrip && Object.values(editableResult.extractedTestStrip).some(v => v);

            if (hasVitals) {
                logType = 'vitals';
                dataPayload = editableResult.extractedVitals;
                collectionRef = collection(db, `users/${user.uid}/vitals`);
            } else if (hasStrips) {
                logType = 'strips';
                dataPayload = editableResult.extractedTestStrip;
                collectionRef = collection(db, `users/${user.uid}/test_strips`);
            } else if (Object.keys(otherDataToSave).length > 0) {
                 logType = 'vitals';
                 dataPayload = {};
                 collectionRef = collection(db, `users/${user.uid}/vitals`);
            }

            if (logType && collectionRef) {
                 const finalPayload = { ...dataPayload, ...otherDataToSave, ...dateToSave };
                 const docRef = await addDoc(collectionRef, finalPayload);
                 const newItem: HistoryItem = { type: logType, id: docRef.id, ...finalPayload };
                 setHistory(prev => [newItem, ...prev].sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
                 saved = true;
            }

            if (saved) {
                toast({ title: 'Data Saved', description: 'Your health data has been logged to your history.' });
                resetState();
            } else {
                toast({ variant: 'destructive', title: 'Nothing to Save', description: 'No data was available to save.' });
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
        setEditableResult(null);
        setImageDataUri(null);
        form.reset();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
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

                {editableResult && (
                    <Card className="bg-secondary">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>Analysis Result</CardTitle>
                                    <CardDescription>Please review and edit the data our AI extracted before saving.</CardDescription>
                                </div>
                                <Badge className={cn("ml-4 whitespace-nowrap", confidenceConfig(editableResult.confidenceScore).color)}>
                                    {editableResult.confidenceScore}% {confidenceConfig(editableResult.confidenceScore).text}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {editableResult.confidenceScore < 80 && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Low Confidence Reading</AlertTitle>
                                    <AlertDescription>The AI is not highly confident about these results, possibly due to image quality. Please carefully verify the values below.</AlertDescription>
                                </Alert>
                            )}
                            <Alert>
                                <AlertTitle>AI Summary</AlertTitle>
                                <AlertDescription>{editableResult.analysisSummary}</AlertDescription>
                            </Alert>
                            
                            <div className="p-4 bg-background rounded-lg">
                                <h4 className="font-bold mb-4 flex items-center gap-2"><Edit /> Review & Edit Extracted Data</h4>
                                 <div className="space-y-3 text-sm">
                                    {editableResult.extractedVitals && Object.entries(editableResult.extractedVitals).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between gap-4">
                                            <Label htmlFor={key} className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</Label>
                                            <Input
                                                id={key}
                                                value={value || ''}
                                                onChange={(e) => handleFieldChange('vitals', key, e.target.value)}
                                                className="h-8 max-w-[150px]"
                                            />
                                        </div>
                                    ))}
                                    {editableResult.extractedTestStrip && Object.entries(editableResult.extractedTestStrip).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between gap-4">
                                            <Label htmlFor={key} className="capitalize text-muted-foreground">{key}</Label>
                                            <Input
                                                id={key}
                                                value={value || ''}
                                                onChange={(e) => handleFieldChange('strips', key, e.target.value)}
                                                className="h-8 max-w-[150px]"
                                            />
                                        </div>
                                    ))}
                                    {editableResult.otherData && editableResult.otherData.length > 0 && (
                                        <Separator className="my-2"/>
                                    )}
                                    {editableResult.otherData?.map((metric, index) => (
                                        <div key={index} className="flex items-center justify-between gap-4">
                                            <Label htmlFor={`other-${index}`} className="capitalize text-muted-foreground">{metric.metricName.replace(/([A-Z])/g, ' $1')}</Label>
                                            <Input
                                                id={`other-${index}`}
                                                value={metric.metricValue}
                                                onChange={(e) => handleFieldChange('other', index, e.target.value)}
                                                className="h-8 max-w-[150px]"
                                            />
                                        </div>
                                    ))}
                                </div>
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
