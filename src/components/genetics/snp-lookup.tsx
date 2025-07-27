

"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dna, Upload, Search, FileText, Loader2, Pause, Play, HelpCircle, MessageSquare, Bot, RefreshCw, MessageCircle, Send } from 'lucide-react';
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
import { collection, doc, addDoc, updateDoc, getDocs, query, where, onSnapshot, orderBy, writeBatch } from 'firebase/firestore';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { chatWithGeneticsResults } from '@/ai/flows/chat-with-genetics-results-flow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const rsidSchema = z.object({ rsid: z.string().regex(/^rs\d+$/, { message: "Invalid rsID format (e.g., rs12345)." }) });
const fileSchema = z.object({ file: z.instanceof(File).refine(file => file.size < 100 * 1024 * 1024, 'File size must be under 100MB.') });

interface AnalysisSession {
    id: string;
    fileName: string;
    status: 'in_progress' | 'paused' | 'completed';
    createdAt: string;
    totalVariants: number;
    processedVariants: number;
    processedRsids: string[];
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
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

    // Chat state
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);

    const rsidForm = useForm<z.infer<typeof rsidSchema>>({ resolver: zodResolver(rsidSchema), defaultValues: { rsid: '' } });
    const fileForm = useForm<z.infer<typeof fileSchema>>({
        resolver: zodResolver(fileSchema),
        defaultValues: { file: null },
    });
    const chatForm = useForm({ defaultValues: { query: '' } });

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
            if (rsidField) rsids.add(rsidField);
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
        }

        toast({ title: `Analysis ${finalStatus}` });
        isProcessingFile.current = false;
        setIsLoading(false);
    }, [user, toast]);

    const handleFileSelect = useCallback(async (file: File | null) => {
        if (!user || !file) return;

        const content = await file.text();
        const allRsids = parseRsidsFromFile(content);

        if (allRsids.length === 0) {
            toast({ variant: 'destructive', title: 'No rsIDs Found' });
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

    const handleChatQuery = async (data: { query: string }) => {
        if (!data.query.trim() || !activeAnalysis || !user) return;
        setIsChatLoading(true);
        const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: data.query }];
        setChatMessages(newMessages);

        try {
            const result = await chatWithGeneticsResults({
                analysisId: activeAnalysis.id,
                userId: user.uid,
                chatHistory: newMessages,
            });
            setChatMessages([...newMessages, { role: 'model', content: result.answer }]);
        } catch (error) {
            setChatMessages([...newMessages, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsChatLoading(false);
            chatForm.reset();
        }
    };
    
    const openChat = async (session: AnalysisSession) => {
        setActiveAnalysis(session);
        setIsChatLoading(true);
        setIsChatOpen(true);
        setChatMessages([]);
        setResults([]);
         if(user) {
            const snap = await getDocs(collection(db, `users/${user.uid}/genetic_analyses/${session.id}/results`));
            setResults(snap.docs.map(d => d.data() as SnpLookupResult));
         }
        setIsChatLoading(false);
    };

    const TooltipHeader = ({ children, tooltipText }: { children: React.ReactNode, tooltipText: string }) => (
        <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="flex items-center gap-1 cursor-help">{children}<HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></div></TooltipTrigger><TooltipContent><p>{tooltipText}</p></TooltipContent></Tooltip></TooltipProvider>
    );

    return (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Search /> New Lookup</CardTitle>
                            <CardDescription>Start a new analysis.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="rsid">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="rsid">by rsID</TabsTrigger>
                                    <TabsTrigger value="file">by File</TabsTrigger>
                                </TabsList>
                                <TabsContent value="rsid" className="mt-4">
                                    <Form {...rsidForm}>
                                        <form onSubmit={rsidForm.handleSubmit(handleSingleLookup)} className="flex items-end gap-4">
                                            <FormField control={rsidForm.control} name="rsid" render={({ field }) => (<FormItem className="flex-grow"><FormLabel>dbSNP ID</FormLabel><FormControl><Input placeholder="e.g., rs1801133" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <Button type="submit" disabled={isLoading}><Search className="mr-2 h-4 w-4" />Lookup</Button>
                                        </form>
                                    </Form>
                                </TabsContent>
                                <TabsContent value="file" className="mt-4">
                                     <Form {...fileForm}>
                                        <form onSubmit={fileForm.handleSubmit((data) => handleFileSelect(data.file))} className="space-y-4">
                                            <FormField control={fileForm.control} name="file" render={({ field: { onChange, ...rest } }) => (
                                                <FormItem><FormLabel>VCF or TXT file (.vcf, .txt)</FormLabel><FormControl><Input type="file" accept=".vcf,.txt" onChange={(e) => onChange(e.target.files?.[0])} {...rest} className="file:text-primary" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <Button type="submit" disabled={isLoading} className="w-full"><Upload className="mr-2 h-4 w-4" />Upload & Annotate</Button>
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
                                                {session.status === 'paused' && <Button size="sm" variant="ghost" onClick={() => handleResume(session)} disabled={isLoading}><RefreshCw className="mr-1 h-3 w-3"/>Resume</Button>}
                                                {(session.status === 'completed' || session.status === 'paused') && <Button size="sm" variant="ghost" onClick={() => openChat(session)}>Chat</Button>}
                                            </div>
                                        </div>
                                    )) : <p className="text-sm text-center text-muted-foreground py-4">No past analyses found.</p>}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-start">
                            <div>
                                <CardTitle>Annotation Results</CardTitle>
                                {activeAnalysis ? <CardDescription>Showing results for {activeAnalysis.fileName}</CardDescription> : <CardDescription>Results from your lookup will appear here.</CardDescription>}
                            </div>
                             {activeAnalysis?.status === 'completed' && (
                                <Button variant="outline" onClick={() => openChat(activeAnalysis)}>
                                    <MessageCircle className="mr-2 h-4 w-4"/> Chat with AI
                                </Button>
                            )}
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
                            {(results.length > 0 || (isLoading && activeAnalysis)) ? (
                                <ScrollArea className="h-[500px] border rounded-md">
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
                            ) : !isLoading && <p className="text-center text-muted-foreground py-16">No results to display.</p>}
                        </CardContent>
                    </Card>
                </div>
            </div>
            
            <AlertDialog open={isChatOpen} onOpenChange={setIsChatOpen}>
                <AlertDialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><Bot /> Chat with your results</AlertDialogTitle>
                        <AlertDialogDescription>Ask the AI questions about the results from "{activeAnalysis?.fileName}". This is not medical advice.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <ScrollArea className="h-80 pr-6 -mr-6">
                        <div className="space-y-4">
                            {isChatLoading && chatMessages.length === 0 ? <Loader2 className="mx-auto w-8 h-8 animate-spin text-primary"/> :
                            chatMessages.map((msg, i) => (
                                <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                    {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center"><Bot size={20}/></div>}
                                    <div className={`max-w-xl rounded-lg p-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm dark:prose-invert prose-p:my-0">{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isChatLoading && chatMessages.length > 0 && <div className="flex justify-start"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>}
                        </div>
                    </ScrollArea>
                    <Form {...chatForm}>
                        <form onSubmit={chatForm.handleSubmit(handleChatQuery)} className="flex gap-2">
                            <FormField control={chatForm.control} name="query" render={({ field }) => (<FormItem className="flex-grow"><FormControl><Input placeholder="e.g., Explain 'missense_variant'..." {...field} /></FormControl></FormItem>)}/>
                            <Button type="submit" disabled={isChatLoading}><Send /></Button>
                        </form>
                    </Form>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}



