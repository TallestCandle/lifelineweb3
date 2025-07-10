
"use client";

import React, { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import {
  performComprehensiveAnalysis,
  type ComprehensiveAnalysisOutput,
} from '@/ai/flows/comprehensive-analysis-flow';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, where, addDoc } from 'firebase/firestore';
import { useAuth } from '@/context/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { addDays, format, startOfDay, subDays, parseISO } from 'date-fns';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lightbulb, BrainCircuit, Calendar as CalendarIcon, Zap, FileClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

interface DeepDiveRecord {
    id: string;
    timestamp: string;
    dateRange: { from: string, to: string };
    analysisResult: ComprehensiveAnalysisOutput;
}

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
    const [history, setHistory] = useState<DeepDiveRecord[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [datePickerMode, setDatePickerMode] = useState<'preset' | 'custom'>('preset');

     useEffect(() => {
        if (!user) {
            setIsHistoryLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setIsHistoryLoading(true);
            const historyCollectionRef = collection(db, `users/${user.uid}/deep_dives`);
            const q = query(historyCollectionRef, orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeepDiveRecord)));
            setIsHistoryLoading(false);
        };
        fetchHistory();
    }, [user]);

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
            const startDate = startOfDay(date.from);
            const endDate = startOfDay(addDays(date.to, 1));
            const basePath = `users/${user.uid}`;
            
            const vitalsQuery = query(collection(db, `${basePath}/vitals`), where('date', '>=', startDate.toISOString()), where('date', '<', endDate.toISOString()), orderBy('date', 'desc'));
            const stripsQuery = query(collection(db, `${basePath}/test_strips`), where('date', '>=', startDate.toISOString()), where('date', '<', endDate.toISOString()), orderBy('date', 'desc'));
            const analysesQuery = query(collection(db, `${basePath}/health_analyses`), where('timestamp', '>=', startDate.toISOString()), where('timestamp', '<', endDate.toISOString()), orderBy('timestamp', 'desc'));
            
            const [vitalsSnap, stripsSnap, analysesSnap] = await Promise.all([
                getDocs(vitalsQuery),
                getDocs(stripsQuery),
                getDocs(analysesQuery),
            ]);

            const input = {
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

            // Save the result to history
            const newRecord: Omit<DeepDiveRecord, 'id'> = {
                timestamp: new Date().toISOString(),
                dateRange: { from: startDate.toISOString(), to: date.to.toISOString() },
                analysisResult: result
            };
            const historyCollectionRef = collection(db, `users/${user.uid}/deep_dives`);
            const docRef = await addDoc(historyCollectionRef, newRecord);
            setHistory(prev => [{ ...newRecord, id: docRef.id }, ...prev]);
            toast({ title: "Analysis Complete", description: "Your deep dive report has been generated and saved." });

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

    const renderResult = (result: ComprehensiveAnalysisOutput | null) => {
        if (!result) return null;
        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold mb-2">Overall Assessment</h3>
                    <p className="text-sm text-muted-foreground">{result.overallAssessment}</p>
                </div>
                <div>
                    <h3 className="text-lg font-bold mb-2">Key Observations</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        {result.keyObservations.map((obs, i) => <li key={i}>{obs}</li>)}
                    </ul>
                </div>
                <div>
                    <h3 className="text-lg font-bold mb-2">Deep Insights</h3>
                    <div className="space-y-3">
                        {result.deepInsights.map((insight, i) => (
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
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap /> Deep Dive Health Analysis</CardTitle>
                    <CardDescription>Select a time frame and let our AI perform a comprehensive review of your entire health history to find hidden trends and insights.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-center sm:items-end">
                     {datePickerMode === 'preset' ? (
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <Label htmlFor="preset-selector">Select Preset</Label>
                            <Select onValueChange={handlePresetChange} value={preset}>
                                <SelectTrigger id="preset-selector" className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Select a preset" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                                    <SelectItem value="7d">Last 7 Days</SelectItem>
                                    <SelectItem value="30d">Last 30 Days</SelectItem>
                                    <SelectItem value="all">All Time</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="link" onClick={() => setDatePickerMode('custom')} className="p-0 h-auto self-start text-sm">
                                Use Custom Range
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <Label htmlFor="date-picker">Custom Range</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date-picker"
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
                                    onSelect={(range) => {
                                        setDate(range);
                                        if (range) setPreset('');
                                    }}
                                    numberOfMonths={2}
                                />
                                </PopoverContent>
                            </Popover>
                            <Button 
                                variant="link" 
                                onClick={() => {
                                    setDatePickerMode('preset');
                                    handlePresetChange('7d');
                                }}
                                className="p-0 h-auto self-start text-sm"
                            >
                                Use Presets
                            </Button>
                        </div>
                    )}

                    <div className="flex-grow hidden sm:block" />

                    <Button onClick={handleRunAnalysis} disabled={isLoading} className="w-full sm:w-auto">
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
                            <span className="flex items-center gap-2"><BrainCircuit className="text-primary"/> Latest Analysis Results</span>
                             <Badge className={cn("text-white", UrgencyConfig[analysisResult.urgency]?.color)}>
                                {UrgencyConfig[analysisResult.urgency]?.text}
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            A summary of insights found in your health data for the selected period. This has been saved to your history.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                       {renderResult(analysisResult)}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileClock className="w-6 h-6"/>
                        <span>Past Deep Dives</span>
                    </CardTitle>
                    <CardDescription>Review your previously generated deep dive reports.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isHistoryLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
                    ) : history.length > 0 ? (
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
                                         <p className="text-xs text-muted-foreground">
                                            Report for period: {format(parseISO(item.dateRange.from), 'LLL d, y')} - {format(parseISO(item.dateRange.to), 'LLL d, y')}
                                        </p>
                                        {renderResult(item.analysisResult)}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                     ) : (
                        <p className="text-muted-foreground text-center py-4">No reports generated yet.</p>
                     )}
                </CardContent>
            </Card>

        </div>
    );
}
