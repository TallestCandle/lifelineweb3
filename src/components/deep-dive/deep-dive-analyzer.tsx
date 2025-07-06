
"use client";

import React, { useState } from 'react';
import { DateRange } from 'react-day-picker';
import {
  performComprehensiveAnalysis,
  type ComprehensiveAnalysisInput,
  type ComprehensiveAnalysisOutput,
} from '@/ai/flows/comprehensive-analysis-flow';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { addDays, format, startOfDay, subDays } from 'date-fns';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lightbulb, BrainCircuit, Calendar as CalendarIcon, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';


const UrgencyConfig: Record<string, { color: string; text: string }> = {
    'Mild': { color: 'bg-yellow-400', text: 'Mild' },
    'Moderate': { color: 'bg-orange-500', text: 'Moderate' },
    'Critical': { color: 'bg-red-600', text: 'Critical' },
};

export function DeepDiveAnalyzer() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [date, setDate] = useState<DateRange | undefined>({ from: subDays(new Date(), 7), to: new Date() });
    const [preset, setPreset] = useState('7d');
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ComprehensiveAnalysisOutput | null>(null);

    const handlePresetChange = (value: string) => {
        setPreset(value);
        const now = new Date();
        switch (value) {
            case '24h':
                setDate({ from: subDays(now, 1), to: now });
                break;
            case '7d':
                setDate({ from: subDays(now, 7), to: now });
                break;
            case '30d':
                setDate({ from: subDays(now, 30), to: now });
                break;
            case 'all':
                setDate({ from: new Date(2000, 0, 1), to: now });
                break;
        }
    };

    const handleRunAnalysis = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
            return;
        }
        if (!date || !date.from || !date.to) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a valid date range.' });
            return;
        }

        setIsLoading(true);
        setAnalysisResult(null);

        try {
            const startDate = startOfDay(date.from).toISOString();
            const endDate = startOfDay(addDays(date.to, 1)).toISOString(); // end of the selected day
            const basePath = `users/${user.uid}`;
            
            const vitalsQuery = query(collection(db, `${basePath}/vitals`), where('date', '>=', startDate), where('date', '<', endDate), orderBy('date', 'desc'));
            const stripsQuery = query(collection(db, `${basePath}/test_strips`), where('date', '>=', startDate), where('date', '<', endDate), orderBy('date', 'desc'));
            const analysesQuery = query(collection(db, `${basePath}/health_analyses`), where('timestamp', '>=', startDate), where('timestamp', '<', endDate), orderBy('timestamp', 'desc'));
            
            const [vitalsSnap, stripsSnap, analysesSnap] = await Promise.all([
                getDocs(vitalsQuery),
                getDocs(stripsQuery),
                getDocs(analysesQuery),
            ]);

            const input: ComprehensiveAnalysisInput = {
                vitalsHistory: JSON.stringify(vitalsSnap.docs.map(d => d.data())),
                testStripHistory: JSON.stringify(stripsSnap.docs.map(d => d.data())),
                previousAnalyses: JSON.stringify(analysesSnap.docs.map(d => d.data().analysisResult)),
            };

            if (vitalsSnap.empty && stripsSnap.empty && analysesSnap.empty) {
                toast({ variant: 'destructive', title: 'Not Enough Data', description: 'There is no historical data for the selected period.' });
                setIsLoading(false);
                return;
            }

            const result = await performComprehensiveAnalysis(input);
            setAnalysisResult(result);

        } catch (error) {
            console.error("Comprehensive analysis failed:", error);
            toast({
                variant: 'destructive', title: 'Analysis Failed',
                description: 'Could not perform the analysis. Please try again later.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap /> Deep Dive Health Analysis</CardTitle>
                    <CardDescription>Select a time frame and let our AI perform a comprehensive review of your entire health history to find hidden trends and insights.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
                    <Select onValueChange={handlePresetChange} value={preset}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Select a preset" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Last 24 Hours</SelectItem>
                            <SelectItem value="7d">Last 7 Days</SelectItem>
                            <SelectItem value="30d">Last 30 Days</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                    </Select>

                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-full sm:w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Pick a date range</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                        </PopoverContent>
                    </Popover>

                    <Button onClick={handleRunAnalysis} disabled={isLoading} className="w-full sm:w-auto ml-0 sm:ml-auto">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
                        Run Deep Analysis
                    </Button>
                </CardContent>
            </Card>

            {isLoading && (
                 <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Our AI is performing a deep dive on your data...</p>
                </div>
            )}

            {analysisResult && (
                <Card className="bg-secondary/50">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2"><BrainCircuit className="text-primary"/> Analysis Results</span>
                             <Badge className={cn("text-white", UrgencyConfig[analysisResult.urgency]?.color)}>
                                {UrgencyConfig[analysisResult.urgency]?.text}
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            A summary of insights found in your health data from the selected period.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="text-lg font-bold mb-2">Overall Assessment</h3>
                            <p className="text-sm text-muted-foreground">{analysisResult.overallAssessment}</p>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold mb-2">Key Observations</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                {analysisResult.keyObservations.map((obs, i) => <li key={i}>{obs}</li>)}
                            </ul>
                        </div>
                        
                        <div>
                            <h3 className="text-lg font-bold mb-2">Deep Insights</h3>
                            <div className="space-y-3">
                                {analysisResult.deepInsights.map((insight, i) => (
                                    <Alert key={i} className="bg-background/50">
                                        <Lightbulb className="h-4 w-4" />
                                        <AlertTitle>{insight.insight}</AlertTitle>
                                        <AlertDescription>
                                            <span className="font-bold">Supporting Data:</span> {insight.supportingData}
                                        </AlertDescription>
                                    </Alert>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
