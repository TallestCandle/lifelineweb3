
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { analyzeGenetics, type AnalyzeGeneticsOutput } from '@/ai/flows/analyze-genetics-flow';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Upload, Dna, TestTube, Pill, Heart, Sparkles, ShieldCheck, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GeneticAnalysisRecord {
    timestamp: string;
    analysisResult: AnalyzeGeneticsOutput;
}

const categoryIcons = {
    ancestryTraits: <Dna className="w-5 h-5 text-purple-400" />,
    healthMarkers: <Heart className="w-5 h-5 text-red-400" />,
    vitaminMetabolism: <Activity className="w-5 h-5 text-green-400" />,
    drugResponse: <Pill className="w-5 h-5 text-blue-400" />,
};

export function GeneticsProfile() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeGeneticsOutput | null>(null);

    // Fetch previous analysis on component mount
    useEffect(() => {
        if (!user) return;
        const fetchHistory = async () => {
            setIsLoading(true);
            const docRef = doc(db, `users/${user.uid}/genetics`, 'latest_analysis');
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setAnalysisResult(docSnap.data().analysisResult);
                }
            } catch (error) {
                console.error("Error fetching genetics history:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not fetch your genetic profile." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [user, toast]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type === 'text/plain' && selectedFile.size <= 50 * 1024 * 1024) { // 50MB limit
                setFile(selectedFile);
                setFileName(selectedFile.name);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Invalid File',
                    description: 'Please upload a .txt file that is 50MB or smaller.',
                });
                event.target.value = ''; // Reset the input
            }
        }
    };

    const handleAnalyze = async () => {
        if (!file || !user) {
            toast({ variant: 'destructive', title: 'No File Selected', description: 'Please select your DNA data file first.' });
            return;
        }

        setIsLoading(true);
        setAnalysisResult(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dnaData = e.target?.result as string;
            try {
                const result = await analyzeGenetics({ dnaData });
                setAnalysisResult(result);

                // Save result to Firestore
                const record: GeneticAnalysisRecord = {
                    timestamp: new Date().toISOString(),
                    analysisResult: result,
                };
                const docRef = doc(db, `users/${user.uid}/genetics`, 'latest_analysis');
                await setDoc(docRef, record);
                toast({ title: "Analysis Complete", description: "Your genetic profile has been generated." });

            } catch (error) {
                console.error("Genetics analysis failed:", error);
                toast({ variant: 'destructive', title: "Analysis Failed", description: "Could not analyze the DNA file. Please ensure it's a valid raw data file." });
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
             toast({ variant: 'destructive', title: "File Read Error", description: "Could not read the selected file." });
             setIsLoading(false);
        }
        reader.readAsText(file);
    };

    const renderResults = () => {
        if (!analysisResult) return null;
        
        const categories = [
            { key: 'ancestryTraits', title: 'Ancestry & Traits' },
            { key: 'healthMarkers', title: 'Health & Wellness' },
            { key: 'vitaminMetabolism', title: 'Vitamin Metabolism' },
            { key: 'drugResponse', title: 'Drug Response' },
        ];

        return (
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary" /> Your Genetic Insights</CardTitle>
                    <CardDescription>Explore your unique genetic makeup. This is for educational and wellness purposes only.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="ancestryTraits">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                            {categories.map(cat => (
                                <TabsTrigger key={cat.key} value={cat.key} className="flex-col h-14">
                                    {categoryIcons[cat.key as keyof typeof categoryIcons]}
                                    <span className="mt-1">{cat.title}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {categories.map(cat => (
                            <TabsContent key={cat.key} value={cat.key} className="pt-4">
                                <div className="space-y-4">
                                    {analysisResult[cat.key as keyof AnalyzeGeneticsOutput].map((item: any, index: number) => (
                                        <div key={index} className="p-4 rounded-lg bg-secondary/50">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-base">{item.marker}</h4>
                                                <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded">{item.genotype}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">{item.interpretation}</p>
                                        </div>
                                    ))}
                                    {analysisResult[cat.key as keyof AnalyzeGeneticsOutput].length === 0 && (
                                        <p className="text-center text-muted-foreground py-8">No specific markers found in this category from your data.</p>
                                    )}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                    <Alert variant="default" className="mt-8 border-accent bg-accent/10">
                        <ShieldCheck className="h-4 w-4 text-accent-foreground" />
                        <AlertTitle>Important Disclaimer</AlertTitle>
                        <AlertDescription>{analysisResult.summaryDisclaimer}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Dna className="w-6 h-6 text-primary" />
                        <span>Genetics Profile</span>
                    </CardTitle>
                    <CardDescription>
                        Upload your raw DNA data from a provider like 23andMe or AncestryDNA (.txt file) to get personalized wellness insights.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive" className="mb-6">
                        <ShieldCheck className="h-4 w-4" />
                        <AlertTitle>Privacy & Security</AlertTitle>
                        <AlertDescription>
                            Your genetic data is processed securely. We only analyze it to generate your report and do not share it. The file is not stored on our servers after analysis.
                        </AlertDescription>
                    </Alert>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-grow">
                            <label htmlFor="dna-upload" className="sr-only">Upload DNA File</label>
                            <Input id="dna-upload" type="file" onChange={handleFileChange} className="file:text-foreground h-12 text-base" />
                        </div>
                        <Button onClick={handleAnalyze} disabled={isLoading || !file} size="lg">
                            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
                            {isLoading ? 'Analyzing...' : 'Analyze My DNA'}
                        </Button>
                    </div>
                    {fileName && <p className="text-sm text-muted-foreground mt-2">Selected file: {fileName}</p>}
                </CardContent>
            </Card>

            {isLoading && !analysisResult && (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Our AI is analyzing your genetic data. This may take a moment...</p>
                </div>
            )}
            
            {analysisResult && renderResults()}
        </div>
    );
}
