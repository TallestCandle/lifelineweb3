

"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dna, Upload, Search, FileText, Loader2, Pause, Play, HelpCircle, Bot, RefreshCw, Send, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
    const [progress, setProgress] = useState(0);
    const isProcessingFile = useRef(false);
    const resumeFileInputRef = useRef<HTMLInputElement>(null);
    const sessionToResume = useRef<AnalysisSession | null>(null);

    // Analysis state
    const [analysisHistory, setAnalysisHistory] = useState<AnalysisSession[]>([]);
    const [activeAnalysis, setActiveAnalysis] = useState<AnalysisSession | null>(null);
    const [results, setResults] = useState<SnpLookupResult[]>([]);
    
    // Validation state
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidateSnpOutput | null>(null);
    
    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);

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

    const handleSingleLookup = async (data: z.infer<typeof rsidSchema>) => {
        setIsLoading(true);
        setActiveAnalysis(null);
        setResults([]);
        try {
            const formData = new FormData();
            formData.append('type', 'rsid');
            formData.append('data', JSON.stringify([{ rsid: data.rsid }]));
            const lookupResults = await performSnpLookup(formData);
            setResults(lookupResults);
            if (lookupResults.length === 0) {
                toast({ title: "No Results Found", description: "The provided SNP could not be found or has no significant annotations." });
            }
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Lookup Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    const parseRsidsFromFile = (fileContent: string): string[] => {
        const lines = fileContent.split('\n');
        const rsids = new Set<string>();
        for (const line of lines) {
            if (line.startsWith('#')) continue;
            const fields = line.split(/\s+/);
            const rsidField = fields.find(f => f.startsWith('rs') && /rs\d+/.test(f));
            if (rsidField && relevantSnps.has(rsidField)) {
                rsids.add(rsidField);
            }
        }
        return Array.from(rsids);
    };

    const processBatch = async (analysisId: string, rsidBatch: string[]) => {
        if (rsidBatch.length === 0) return [];
        const formData = new FormData();
        formData.append('type', 'rsid');
        formData.append('data', JSON.stringify(rsidBatch.map(rsid => ({ rsid }))));
        const batchResults = await performSnpLookup(formData);

        if (batchResults.length > 0 && user) {
            const batch = writeBatch(db);
            const resultsCollection = collection(db, `users/${user.uid}/genetic_analyses/${analysisId}/results`);
            batchResults.forEach(res => {
                batch.set(doc(resultsCollection, res.id), res);
            });
            await batch.commit();
        }
        return batchResults;
    };

    const runAnalysis = useCallback(async (session: AnalysisSession, rsidList: string[]) => {
        isProcessingFile.current = true;
        setIsLoading(true);
        setActiveAnalysis(session);
        setResults([]);
        setActiveChatSessionId(session.id); // Set the chat session ID
        setChatMessages([]); // Clear previous chat messages

        if (!user) return;
        
        const resultsSnapshot = await getDocs(collection(db, `users/${user.uid}/genetic_analyses/${session.id}/results`));
        const existingResults = resultsSnapshot.docs.map(d => d.data() as SnpLookupResult);
        setResults(existingResults);
        
        const processedRsids = new Set(session.processedRsids);
        const rsidsToProcess = rsidList.filter(id => !processedRsids.has(id));
        let processedInThisRun: string[] = [];

        const BATCH_SIZE = 10;
        for (let i = 0; i < rsidsToProcess.length; i += BATCH_SIZE) {
            if (!isProcessingFile.current) {
                toast({ title: "Processing Paused", description: "Your progress has been saved." });
                break;
            }
            const batch = rsidsToProcess.slice(i, i + BATCH_SIZE);
            try {
                const batchResults = await processBatch(session.id, batch);
                setResults(prev => [...prev, ...batchResults]);
                processedInThisRun = [...processedInThisRun, ...batch];

                const newProcessedCount = session.processedRsids.length + processedInThisRun.length;
                const newProgress = Math.round((newProcessedCount / session.totalVariants) * 100);
                setProgress(newProgress);
                
                const updatedSessionData = {
                    processedVariants: newProcessedCount,
                    processedRsids: [...session.processedRsids, ...processedInThisRun],
                    status: 'in_progress',
                };
                 setActiveAnalysis(prev => prev ? {...prev, ...updatedSessionData} : null);
                 await updateDoc(doc(db, `users/${user.uid}/genetic_analyses`, session.id), updatedSessionData);

            } catch (error) {
                console.error(`Error processing batch:`, error);
                toast({ variant: 'destructive', title: `Batch Failed`, description: `Could not process variants starting with ${batch[0]}.` });
            }
        }

        const finalStatus = isProcessingFile.current ? 'completed' : 'paused';
        const sessionDocRef = doc(db, `users/${user.uid}/genetic_analyses`, session.id);
        await updateDoc(sessionDocRef, { status: finalStatus });
        
        if (finalStatus === 'completed') {
            setActiveAnalysis(prev => prev ? { ...prev, status: 'completed' } : null);
            setChatMessages([{ role: 'model', content: "Your analysis is complete! Feel free to ask me anything about the annotated results below." }]);
        }

        toast({ title: `Analysis ${finalStatus}` });
        isProcessingFile.current = false;
        setIsLoading(false);
    }, [user, toast]);

    const handleFileSelect = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const file = fileInputRef.current?.files?.[0];
        if (!user || !file) {
            toast({ variant: 'destructive', title: 'No file selected', description: 'Please select a file to annotate.' });
            return;
        }

        const content = await file.text();
        const allRsids = parseRsidsFromFile(content);

        if (allRsids.length === 0) {
            toast({ 
                variant: 'destructive', 
                title: 'No Relevant SNPs Found',
                description: 'We scanned your file but did not find any of the medically relevant SNPs we currently track. Future updates will expand our database.'
            });
            return;
        }

        const newSessionData = {
            fileName: file.name,
            status: 'in_progress' as const,
            createdAt: new Date().toISOString(),
            totalVariants: allRsids.length,
            processedVariants: 0,
            processedRsids: [],
        };
        
        const docRef = await addDoc(collection(db, `users/${user.uid}/genetic_analyses`), newSessionData);
        runAnalysis({ ...newSessionData, id: docRef.id }, allRsids);

    }, [user, runAnalysis, toast]);
    
    const handleResumeFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !sessionToResume.current) return;

        const content = await file.text();
        const allRsids = parseRsidsFromFile(content);
        
        runAnalysis(sessionToResume.current, allRsids);

        sessionToResume.current = null;
        if(resumeFileInputRef.current) resumeFileInputRef.current.value = "";
    }, [runAnalysis]);

    const handleResume = (session: AnalysisSession) => {
        if (isLoading) return;
        sessionToResume.current = session;
        resumeFileInputRef.current?.click();
    };

    const handlePause = () => {
        isProcessingFile.current = false;
        if(activeAnalysis && user) {
            updateDoc(doc(db, `users/${user.uid}/genetic_analyses`, activeAnalysis.id), { status: 'paused' });
        }
        setIsLoading(false);
    };

    const handleValidation = async (data: z.infer<typeof validationSchema>) => {
        setIsValidating(true);
        setValidationResult(null);
        try {
            const result = await validateSnp(data as ValidateSnpInput);
            setValidationResult(result);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Validation Failed', description: error.message });
        } finally {
            setIsValidating(false);
        }
    };
    
    const handleDeleteSession = async (sessionId: string) => {
        if (!user) return;
        
        const resultsCollectionRef = collection(db, `users/${user.uid}/genetic_analyses/${sessionId}/results`);
        const resultsSnapshot = await getDocs(resultsCollectionRef);
        const batch = writeBatch(db);
        resultsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        const sessionDocRef = doc(db, `users/${user.uid}/genetic_analyses`, sessionId);
        await deleteDoc(sessionDocRef);
        
        if (activeChatSessionId === sessionId) {
            setActiveChatSessionId(null);
            setChatMessages([]);
            setResults([]);
            setActiveAnalysis(null);
        }

        toast({ title: "Analysis Deleted", description: "The session and its results have been removed." });
    };

    const handleChatSubmit = async (data: z.infer<typeof chatSchema>) => {
        if (!user || !activeChatSessionId) return;
        
        const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: data.message }];
        setChatMessages(newMessages);
        setIsChatting(true);
        chatForm.reset();

        try {
            const input: ChatWithGeneticsResultsInput = {
                userId: user.uid,
                analysisId: activeChatSessionId,
                chatHistory: newMessages,
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
        setValidationResult(null);

        const resultsSnapshot = await getDocs(collection(db, `users/${user.uid}/genetic_analyses/${session.id}/results`));
        const existingResults = resultsSnapshot.docs.map(d => d.data() as SnpLookupResult);
        setResults(existingResults);
        
        setActiveChatSessionId(session.id);
        setChatMessages(session.status === 'completed' ? [{ role: 'model', content: "Analysis results loaded. Ask me anything about them!" }] : []);
        
        setIsLoading(false);
    };

    const TooltipHeader = ({ children, tooltipText }: { children: React.ReactNode, tooltipText: string }) => (
        <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="flex items-center gap-1 cursor-help">{children}<HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></div></TooltipTrigger><TooltipContent><p>{tooltipText}</p></TooltipContent></Tooltip></TooltipProvider>
    );

    const ValidationRow = ({ label, result }: { label: string; result?: { isValid: boolean, databaseValue: string, explanation: string } }) => {
        if (!result) return null;
        return (
            <TableRow>
                <TableCell className="font-semibold">{label}</TableCell>
                <TableCell>
                    {result.isValid ? <CheckCircle className="text-green-500" /> : <XCircle className="text-destructive" />}
                </TableCell>
                <TableCell>{result.databaseValue}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{result.explanation}</TableCell>
            </TableRow>
        );
    };

    return (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Search /> New Lookup</CardTitle>
                            <CardDescription>Analyze your raw DNA data.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="annotate">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="annotate">Annotate File</TabsTrigger>
                                    <TabsTrigger value="validate">Validate SNP</TabsTrigger>
                                </TabsList>
                                <TabsContent value="annotate" className="mt-4">
                                    <form className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="dna-file">VCF or TXT file (.vcf, .txt)</Label>
                                            <Input id="dna-file" type="file" accept=".vcf,.txt" ref={fileInputRef} className="file:text-primary" />
                                        </div>
                                        <Button onClick={handleFileSelect} disabled={isLoading} className="w-full"><Upload className="mr-2 h-4 w-4" />Upload & Annotate</Button>
                                    </form>
                                </TabsContent>
                                <TabsContent value="validate" className="mt-4">
                                    <Form {...validationForm}>
                                        <form onSubmit={validationForm.handleSubmit(handleValidation)} className="space-y-3">
                                            <FormField control={validationForm.control} name="snpId" render={({ field }) => (<FormItem><FormLabel>SNP ID (rsID)</FormLabel><FormControl><Input placeholder="rs1801133" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={validationForm.control} name="consequence" render={({ field }) => (<FormItem><FormLabel>Consequence</FormLabel><FormControl><Input placeholder="missense_variant" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={validationForm.control} name="gene" render={({ field }) => (<FormItem><FormLabel>Gene (Optional)</FormLabel><FormControl><Input placeholder="MTHFR" {...field} /></FormControl></FormItem>)} />
                                            <Button type="submit" disabled={isValidating} className="w-full">{isValidating ? <Loader2 className="animate-spin mr-2"/> : 'Validate Data'}</Button>
                                        </form>
                                    </Form>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle>Past Analyses</CardTitle></CardHeader>
                        <CardContent>
                            <input
                                type="file"
                                ref={resumeFileInputRef}
                                onChange={handleResumeFileSelect}
                                className="hidden"
                                accept=".vcf,.txt"
                            />
                            <ScrollArea className="h-60">
                                <div className="space-y-2">
                                    {analysisHistory.length > 0 ? analysisHistory.map(session => (
                                        <div key={session.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                                            <div>
                                                <p className="font-bold text-sm truncate">{session.fileName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {session.status === 'in_progress' ? 'Running...' : session.status === 'paused' ? 'Paused' : 'Completed'} - {formatDistanceToNow(parseISO(session.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                {session.status !== 'in_progress' && <Button size="sm" variant="ghost" onClick={() => handleViewResults(session)}>View</Button>}
                                                {session.status === 'paused' && <Button size="sm" variant="ghost" onClick={() => handleResume(session)} disabled={isLoading}><RefreshCw className="mr-1 h-3 w-3"/>Resume</Button>}
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete the analysis session and all its annotated results.
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
                            <TabsTrigger value="results">Results</TabsTrigger>
                            <TabsTrigger value="chat" disabled={!activeChatSessionId || activeAnalysis?.status !== 'completed'}>Chat with Results</TabsTrigger>
                        </TabsList>
                        <TabsContent value="results">
                            <Card>
                                <CardHeader className="flex flex-row justify-between items-start">
                                    <div>
                                        <CardTitle>Annotation & Validation</CardTitle>
                                        <CardDescription>Results from your lookups will appear here.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isLoading && activeAnalysis && (
                                        <div className="flex items-center gap-4">
                                            <div className="w-full">
                                                <div className="flex justify-between mb-1">
                                                    <p className="text-sm font-bold">Processing file...</p>
                                                    <p className="text-sm">{progress}% ({activeAnalysis?.processedVariants}/{activeAnalysis?.totalVariants})</p>
                                                </div>
                                                <Progress value={progress} />
                                            </div>
                                            <Button variant="destructive" size="icon" onClick={handlePause}><Pause /></Button>
                                        </div>
                                    )}

                                    {isValidating && <div className="flex justify-center p-4"><Loader2 className="animate-spin" /> <p className="ml-2">AI is validating...</p></div>}
                                    
                                    {validationResult && (
                                        <div className="space-y-4">
                                            <Alert variant={validationResult.overallAssessment === 'Correct' ? 'default' : 'destructive'} className={cn(validationResult.overallAssessment === 'Correct' && 'border-green-500')}>
                                                {validationResult.overallAssessment === 'Correct' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                                <AlertTitle>Overall Assessment: {validationResult.overallAssessment}</AlertTitle>
                                                <AlertDescription>{validationResult.finalSummary}</AlertDescription>
                                            </Alert>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Field</TableHead><TableHead>Valid</TableHead><TableHead>Database Value</TableHead><TableHead>Explanation</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    <ValidationRow label="SNP ID" result={validationResult.validationDetails.snpId} />
                                                    <ValidationRow label="Consequence" result={validationResult.validationDetails.consequence} />
                                                    <ValidationRow label="Gene" result={validationResult.validationDetails.gene} />
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    {(results.length > 0) ? (
                                        <ScrollArea className="h-[500px] border rounded-md mt-4">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-secondary z-10">
                                                    <TableRow>
                                                        <TableHead><TooltipHeader tooltipText="The identifier for the SNP, usually an rsID.">SNP ID</TooltipHeader></TableHead>
                                                        <TableHead><TooltipHeader tooltipText="The most significant functional consequence of the SNP.">Consequence</TooltipHeader></TableHead>
                                                        <TableHead><TooltipHeader tooltipText="The gene in which the SNP is located.">Gene</TooltipHeader></TableHead>
                                                        <TableHead><TooltipHeader tooltipText="The Ensembl transcript this annotation applies to.">Transcript</TooltipHeader></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {results.map((res, index) => (
                                                        <TableRow key={`${res.id}-${index}`}>
                                                            <TableCell className="font-mono"><a href={`https://www.ncbi.nlm.nih.gov/snp/${res.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{res.id}</a></TableCell>
                                                            <TableCell>{res.most_severe_consequence}</TableCell>
                                                            <TableCell>{res.gene || 'N/A'}</TableCell>
                                                            <TableCell className="font-mono text-xs">{res.transcriptId || 'N/A'}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    ) : !isLoading && !isValidating && !validationResult && <p className="text-center text-muted-foreground py-16">No results to display.</p>}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="chat">
                             <Card className="flex flex-col h-[600px]">
                                <CardHeader>
                                    <CardTitle>Chat with AI Counselor</CardTitle>
                                    <CardDescription>Ask questions about your annotated results.</CardDescription>
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
                                                    <FormItem className="flex-grow"><FormControl><Input placeholder="e.g., What does rs1801133 mean?" {...field} /></FormControl></FormItem>
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
