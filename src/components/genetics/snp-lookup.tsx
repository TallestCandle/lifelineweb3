

"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dna, Upload, Search, FileText, Loader2, Pause, Play, HelpCircle, Bot, RefreshCw, Send, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { type SnpLookupResult, performSnpLookup } from '@/app/actions/snp-lookup-action';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, doc, addDoc, updateDoc, getDocs, query, where, onSnapshot, orderBy, writeBatch, deleteDoc } from 'firebase/firestore';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { validateSnp, type ValidateSnpInput, type ValidateSnpOutput } from '@/ai/flows/validate-snp-flow';
import { chatWithGeneticsResults, type ChatWithGeneticsResultsInput } from '@/ai/flows/chat-with-genetics-results-flow';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { cn } from '@/lib/utils';
import { relevantSnps } from '@/lib/relevant-snps';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { analyzeGenetics } from '@/ai/flows/analyze-genetics-flow';
import type { AnalyzeGeneticsOutput } from '@/ai/flows/analyze-genetics-flow';


const rsidSchema = z.object({ rsid: z.string().regex(/^rs\d+$/, { message: "Invalid rsID format (e.g., rs12345)." }) });

const validationSchema = z.object({
  snpId: z.string().regex(/^rs\d+$/, { message: "Invalid rsID format." }),
  consequence: z.string().min(1, 'Consequence is required.'),
  gene: z.string().optional(),
  transcript: z.string().optional(),
  aminoAcidChange: z.string().optional(),
  codonChange: z.string().optional(),
  clinicalSignificance: z.string().optional(),
});

const chatSchema = z.object({
    message: z.string().min(1, "Message cannot be empty."),
});

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface AnalysisSession {
    id: string;
    fileName: string;
    status: 'in_progress' | 'paused' | 'completed';
    createdAt: string;
    totalVariants: number;
    processedVariants: number;
    processedRsids: string[];
}

export function SnpLookup() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    // Analysis state
    const [analysisHistory, setAnalysisHistory] = useState<AnalysisSession[]>([]);
    const [activeAnalysis, setActiveAnalysis] = useState<AnalysisSession | null>(null);
    const [fullAnalysisResult, setFullAnalysisResult] = useState<AnalyzeGeneticsOutput | null>(null);
    
    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    
    // Ref for the new file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    const rsidForm = useForm<z.infer<typeof rsidSchema>>({ 
        resolver: zodResolver(rsidSchema), 
        defaultValues: { rsid: '' } 
    });
    
    const validationForm = useForm<z.infer<typeof validationSchema>>({
        resolver: zodResolver(validationSchema),
        defaultValues: { 
            snpId: '', consequence: '', gene: '', transcript: '', 
            aminoAcidChange: '', codonChange: '', clinicalSignificance: '' 
        }
    });

    const chatForm = useForm<z.infer<typeof chatSchema>>({
        resolver: zodResolver(chatSchema),
        defaultValues: { message: "" },
    });

    // Fetch analysis history
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, `users/${user.uid}/genetic_analyses`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAnalysisHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnalysisSession)));
        });
        return () => unsubscribe();
    }, [user]);

    const handleFileSelect = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const file = fileInputRef.current?.files?.[0];
        if (!user || !file) {
            toast({ variant: 'destructive', title: 'No file selected', description: 'Please select a file to annotate.' });
            return;
        }

        setIsLoading(true);
        setFullAnalysisResult(null);

        try {
            const content = await file.text();
            
            // Filter the raw data for relevant SNPs only
            const lines = content.split('\n');
            const filteredData = lines.filter(line => {
                const parts = line.split(/\s+/);
                if (parts.length > 0) {
                    const rsid = parts.find(p => p.startsWith('rs'));
                    return rsid && relevantSnps.has(rsid);
                }
                return false;
            }).join('\n');

            if (!filteredData) {
                toast({ 
                    variant: 'destructive', 
                    title: 'No Relevant SNPs Found',
                    description: 'We scanned your file but did not find any of the medically relevant SNPs we currently track.'
                });
                setIsLoading(false);
                return;
            }

            const analysisResult = await analyzeGenetics({ dnaData: filteredData });
            setFullAnalysisResult(analysisResult);

            const newSessionData = {
                fileName: file.name,
                status: 'completed' as const,
                createdAt: new Date().toISOString(),
                totalVariants: filteredData.split('\n').length,
                processedVariants: filteredData.split('\n').length,
                processedRsids: [], // Not needed for this flow anymore
                analysisResult: analysisResult, // Save the result
            };
            
            const docRef = await addDoc(collection(db, `users/${user.uid}/genetic_analyses`), newSessionData);
            setActiveAnalysis({ ...newSessionData, id: docRef.id });
            
            // Prime the chat
            setChatMessages([{ role: 'model', content: "Your analysis is complete! Feel free to ask me anything about the results." }]);


        } catch (error: any) {
            console.error("Analysis failed:", error);
            toast({ variant: 'destructive', title: 'Analysis Failed', description: error.message });
        } finally {
            setIsLoading(false);
        }

    }, [user, toast]);

    const handleDeleteSession = async (sessionId: string) => {
        if (!user) return;
        
        const sessionDocRef = doc(db, `users/${user.uid}/genetic_analyses`, sessionId);
        await deleteDoc(sessionDocRef);
        
        if (activeAnalysis?.id === sessionId) {
            setActiveAnalysis(null);
            setChatMessages([]);
            setFullAnalysisResult(null);
        }

        toast({ title: "Analysis Deleted", description: "The session and its results have been removed." });
    };

    const handleChatSubmit = async (data: z.infer<typeof chatSchema>) => {
        if (!user || !activeAnalysis) return;
        
        const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: data.message }];
        setChatMessages(newMessages);
        setIsChatting(true);
        chatForm.reset();

        try {
            const input: ChatWithGeneticsResultsInput = {
                chatHistory: newMessages,
                annotatedSnps: JSON.stringify(fullAnalysisResult),
            };
            const result = await chatWithGeneticsResults(input);
            setChatMessages(prev => [...prev, { role: 'model', content: result.answer }]);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Chat Error', description: error.message || "The AI could not respond." });
            setChatMessages(prev => prev.slice(0, -1)); // Remove the user's message on error
        } finally {
            setIsChatting(false);
        }
    };

    const handleViewResults = async (session: AnalysisSession) => {
        if (!user) return;
        setIsLoading(true);
        setActiveAnalysis(session);
        
        const sessionDoc = await getDocs(query(collection(db, `users/${user.uid}/genetic_analyses`), where('createdAt', '==', session.createdAt)));
        if (!sessionDoc.empty) {
            const data = sessionDoc.docs[0].data();
            if (data.analysisResult) {
                setFullAnalysisResult(data.analysisResult as AnalyzeGeneticsOutput);
                setChatMessages([{ role: 'model', content: "Analysis results loaded. Ask me anything about them!" }]);
            } else {
                 setFullAnalysisResult(null);
                 setChatMessages([]);
            }
        }
        
        setIsLoading(false);
    };

    const ResultSection = ({ title, markers }: { title: string, markers: any[] }) => (
        <div>
            <h3 className="text-xl font-bold mb-2 text-primary">{title}</h3>
            {markers.length > 0 ? (
                <div className="space-y-4">
                    {markers.map((marker, index) => (
                        <div key={index} className="p-4 rounded-lg bg-secondary/50">
                            <div className="flex justify-between items-center">
                                <p className="font-bold text-base">{marker.marker}</p>
                                <span className="font-mono text-primary bg-primary/10 px-2 py-1 rounded-md text-sm">{marker.genotype}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{marker.interpretation}</p>
                        </div>
                    ))}
                </div>
            ) : <p className="text-sm text-muted-foreground">No relevant markers found in this category.</p>}
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Dna /> Full AI Analysis</CardTitle>
                            <CardDescription>Upload your raw DNA file (.txt or .vcf) for a comprehensive, AI-driven analysis of medically relevant markers.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <form className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="dna-file">VCF or TXT file (.vcf, .txt)</Label>
                                    <Input id="dna-file" type="file" accept=".vcf,.txt" ref={fileInputRef} className="file:text-primary" />
                                </div>
                                <Button onClick={handleFileSelect} disabled={isLoading} className="w-full"><Upload className="mr-2 h-4 w-4" />Analyze My DNA</Button>
                            </form>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle>Past Analyses</CardTitle></CardHeader>
                        <CardContent>
                            <ScrollArea className="h-60">
                                <div className="space-y-2">
                                    {analysisHistory.length > 0 ? analysisHistory.map(session => (
                                        <div key={session.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                                            <div>
                                                <p className="font-bold text-sm truncate">{session.fileName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Completed - {formatDistanceToNow(parseISO(session.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" onClick={() => handleViewResults(session)}>View</Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete the analysis session and its results.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteSession(session.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    )) : <p className="text-sm text-center text-muted-foreground py-4">No past analyses found.</p>}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="lg:col-span-2">
                    <Tabs defaultValue="results" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="results">AI Analysis</TabsTrigger>
                            <TabsTrigger value="chat" disabled={!activeAnalysis}>Chat with Results</TabsTrigger>
                        </TabsList>
                        <TabsContent value="results">
                            <Card>
                                <CardHeader className="flex flex-row justify-between items-start">
                                    <div>
                                        <CardTitle>Analysis Report</CardTitle>
                                        <CardDescription>Results from your AI analysis will appear here.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isLoading && <div className="flex justify-center p-4"><Loader2 className="animate-spin mr-2"/> <p>AI is analyzing your file...</p></div>}
                                    
                                    {fullAnalysisResult ? (
                                        <ScrollArea className="h-[60vh] pr-4">
                                            <div className="space-y-6">
                                                <ResultSection title="Health & Wellness Markers" markers={fullAnalysisResult.healthMarkers} />
                                                <ResultSection title="Drug & Substance Response" markers={fullAnalysisResult.drugResponse} />
                                                <ResultSection title="Vitamin Metabolism" markers={fullAnalysisResult.vitaminMetabolism} />
                                                <ResultSection title="Ancestry & Physical Traits" markers={fullAnalysisResult.ancestryTraits} />
                                                
                                                <Alert variant="default" className="border-accent bg-accent/10">
                                                    <AlertTriangle className="h-4 w-4 text-accent-foreground" />
                                                    <AlertTitle>Important Disclaimer</AlertTitle>
                                                    <AlertDescription>{fullAnalysisResult.summaryDisclaimer}</AlertDescription>
                                                </Alert>
                                            </div>
                                        </ScrollArea>
                                    ) : !isLoading && <p className="text-center text-muted-foreground py-16">No analysis results to display. Upload a file to get started.</p>}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="chat">
                             <Card className="flex flex-col h-[600px]">
                                <CardHeader>
                                    <CardTitle>Chat with AI Counselor</CardTitle>
                                    <CardDescription>Ask questions about your analysis results.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow overflow-hidden flex flex-col">
                                    <ScrollArea className="flex-grow pr-4">
                                        <div className="space-y-4">
                                            {chatMessages.map((msg, i) => (
                                                <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                                    {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Bot className="text-primary" size={20}/></div>}
                                                    <p className={`p-3 rounded-lg max-w-md ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                                        {msg.content}
                                                    </p>
                                                </div>
                                            ))}
                                            {isChatting && <div className="flex justify-start"><Loader2 className="animate-spin"/></div>}
                                        </div>
                                    </ScrollArea>
                                    <div className="mt-4 pt-4 border-t">
                                        <Form {...chatForm}>
                                            <form onSubmit={chatForm.handleSubmit(handleChatSubmit)} className="flex items-center gap-2">
                                                <FormField control={chatForm.control} name="message" render={({ field }) => (
                                                    <FormItem className="flex-grow"><FormControl><Input placeholder="e.g., Explain my result for caffeine..." {...field} /></FormControl></FormItem>
                                                )} />
                                                <Button type="submit" disabled={isChatting}><Send/></Button>
                                            </form>
                                        </Form>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
