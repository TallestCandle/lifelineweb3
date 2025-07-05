"use client";

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { extractDataFromImage, type ExtractDataFromImageOutput } from '@/ai/flows/extract-data-from-image-flow';
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader } from '@/components/ui/loader';
import { Camera, Sparkles, Save, RotateCcw, AlertCircle, HeartPulse, Beaker, Loader2 } from 'lucide-react';

const loggerSchema = z.object({
  userPrompt: z.string().optional(),
});
type LoggerFormValues = z.infer<typeof loggerSchema>;

export function UnifiedLogger() {
    const { user } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [imageDataUri, setImageDataUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [aiResult, setAiResult] = useState<ExtractDataFromImageOutput | null>(null);

    const form = useForm<LoggerFormValues>({
        resolver: zodResolver(loggerSchema),
        defaultValues: { userPrompt: "" },
    });

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

        let saved = false;

        try {
            if (aiResult.extractedVitals && Object.keys(aiResult.extractedVitals).length > 0) {
                const vitalsCollectionRef = collection(db, `users/${user.uid}/vitals`);
                await addDoc(vitalsCollectionRef, { ...aiResult.extractedVitals, date: new Date().toISOString() });
                saved = true;
            }
            if (aiResult.extractedTestStrip && Object.keys(aiResult.extractedTestStrip).length > 0) {
                const stripsCollectionRef = collection(db, `users/${user.uid}/test_strips`);
                await addDoc(stripsCollectionRef, { ...aiResult.extractedTestStrip, date: new Date().toISOString() });
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
        <div className="space-y-8 max-w-2xl mx-auto">
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
                        <Button onClick={handleSave}><Save className="mr-2"/>Save to History</Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
