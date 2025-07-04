
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import Image from 'next/image';

// AI Flows
import { conductInterview } from '@/ai/flows/conduct-interview-flow';
import { startInvestigation } from '@/ai/flows/start-investigation-flow';
import { continueInvestigation } from '@/ai/flows/continue-investigation-flow';

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader } from '@/components/ui/loader';
import { Bot, User, PlusCircle, FileClock, Camera, Trash2, ShieldCheck, Send, AlertCircle, Sparkles, XCircle, Search, Pill, TestTube, Upload, Check, Salad } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

// Types
interface Message {
  role: 'user' | 'model';
  content: string;
}

type InvestigationStatus = 'pending_review' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected';

interface Investigation {
  id: string;
  status: InvestigationStatus;
  createdAt: string;
  steps: InvestigationStep[];
  doctorPlan?: {
      preliminaryMedications: string[];
      suggestedLabTests: string[];
  };
  finalTreatmentPlan?: any;
  finalDiagnosis?: any;
  doctorNote?: string;
}

interface InvestigationStep {
    type: 'initial_submission' | 'lab_result_submission';
    timestamp: string;
    userInput: any;
    aiAnalysis: any;
}


const statusConfig: Record<InvestigationStatus, { text: string; color: string }> = {
  pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
  awaiting_lab_results: { text: 'Awaiting Lab Results', color: 'bg-blue-500' },
  pending_final_review: { text: 'Doctor Reviewing Results', color: 'bg-yellow-500' },
  completed: { text: 'Investigation Complete', color: 'bg-green-500' },
  rejected: { text: 'Investigation Closed', color: 'bg-red-500' },
};

export function HealthInvestigation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [interviewState, setInterviewState] = useState<'not_started' | 'in_progress' | 'awaiting_upload' | 'submitting'>('not_started');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  
  // Lab result upload state
  const [labResultUploads, setLabResultUploads] = useState<Record<string, string>>({});
  const [isSubmittingLabs, setIsSubmittingLabs] = useState(false);


  // Scroll to bottom of chat
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.parentElement?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);
  
  // Fetch history
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "investigations"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setInvestigations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation)));
        setIsLoading(false);
    }, (err) => {
        console.error("Error fetching investigations: ", err);
        toast({variant: 'destructive', title: 'Error', description: 'Could not fetch past investigations.'});
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const startNewInvestigation = () => {
      setMessages([{ role: 'model', content: "Hello! I'm your AI Investigator. To get started, please briefly describe your main health concern." }]);
      setInterviewState('in_progress');
      setView('chat');
      setImageDataUri(null);
  };
  
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || isChatLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsChatLoading(true);

    try {
      const thinkingMessage: Message = { role: 'model', content: '' };
      setMessages([...newMessages, thinkingMessage]);

      const result = await conductInterview({ chatHistory: newMessages });
      
      setMessages([...newMessages, { role: 'model', content: result.nextQuestion }]);
      
      if (result.isFinalQuestion) {
        setInterviewState('awaiting_upload');
      }
    } catch (error) {
      console.error("AI chat failed:", error);
      toast({ variant: 'destructive', title: 'Chat Error', description: 'Could not get a response from the AI.' });
      setMessages([...newMessages, { role: 'model', content: "I'm sorry, I'm having trouble connecting. Please try again in a moment." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImageDataUri(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  
  const handleFinalSubmission = async () => {
      if (!user) return;
      setInterviewState('submitting');
      
      try {
        const chatTranscript = messages.map(m => `${m.role === 'user' ? 'Patient' : 'AI Investigator'}: ${m.content}`).join('\n\n');
        
        const result = await startInvestigation({
            userId: user.uid,
            userName: user.displayName || "User",
            chatTranscript,
            imageDataUri: imageDataUri || undefined,
        });

        if (result.success) {
            toast({ title: 'Investigation Submitted', description: 'Your case has been sent for review. A doctor will prescribe the next steps shortly.' });
            setInterviewState('not_started');
        } else {
             throw new Error("Submission failed on the server.");
        }
      } catch (error) {
          console.error("Failed to submit investigation:", error);
          toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your investigation. Please try again.' });
          setInterviewState('awaiting_upload');
      }
  };

  const handleLabResultUpload = (testName: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setLabResultUploads(prev => ({ ...prev, [testName]: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSubmitLabResults = async (investigation: Investigation) => {
    if (!user || !investigation.doctorPlan?.suggestedLabTests) return;

    const requiredTests = investigation.doctorPlan.suggestedLabTests;
    const uploadedTests = Object.keys(labResultUploads);
    if (requiredTests.some(test => !uploadedTests.includes(test))) {
        toast({ variant: 'destructive', title: 'Missing Results', description: 'Please upload all required lab test results.' });
        return;
    }
    
    setIsSubmittingLabs(true);
    try {
        const labResults = requiredTests.map(testName => ({
            testName,
            imageDataUri: labResultUploads[testName],
        }));

        await continueInvestigation({
            userId: user.uid,
            investigationId: investigation.id,
            labResults,
        });
        
        toast({ title: "Lab Results Submitted", description: "Your results have been sent for final analysis." });
        setLabResultUploads({});

    } catch (error) {
        console.error("Error submitting lab results:", error);
        toast({ variant: 'destructive', title: "Submission Failed", description: "Could not submit your lab results." });
    } finally {
        setIsSubmittingLabs(false);
    }
  };
  
  const ChatInterface = () => (
     interviewState === 'not_started' ? (
        <Card className="flex flex-col items-center justify-center text-center h-[70vh]">
            <CardHeader>
                <Search className="w-16 h-16 mx-auto text-primary/50" />
                <CardTitle className="mt-4">Start a New Health Investigation</CardTitle>
                <CardDescription>Click the "New Investigation" button in the history panel to begin chatting with our AI.</CardDescription>
            </CardHeader>
        </Card>
    ) : (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot/> AI Investigator</CardTitle>
                <CardDescription>The interview will have 15 questions to gather details.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[50vh] p-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.map((message, index) => (
                             <div key={index} className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center"><Bot size={20}/></div>}
                                <div className={`max-w-[90%] md:max-w-md rounded-lg p-3 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                    {isChatLoading && index === messages.length - 1 && message.role === 'model' ? (
                                        <div className="flex items-center justify-center gap-1.5 h-5">
                                            <span className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="h-2 w-2 rounded-full bg-current animate-bounce"></span>
                                        </div>
                                    ) : <p className="whitespace-pre-wrap">{message.content}</p>}
                                </div>
                                {message.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center"><User size={20}/></div>}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <CardFooter className="p-4 border-t">
                    {interviewState === 'in_progress' ? (
                        <form onSubmit={handleSendMessage} className="w-full flex items-center gap-2">
                            <Input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Type your message..." disabled={isChatLoading} />
                            <Button type="submit" disabled={isChatLoading || !userInput.trim()}><Send /></Button>
                        </form>
                    ) : interviewState === 'awaiting_upload' ? (
                        <div className="w-full space-y-4">
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Interview Complete!</AlertTitle>
                                <AlertDescription>You can now upload any relevant images (e.g., of a skin condition) for the doctor to review.</AlertDescription>
                            </Alert>
                             <div className="flex flex-col sm:flex-row items-center gap-4">
                                <Button variant="outline" className="w-full sm:w-auto" onClick={() => fileInputRef.current?.click()}><Camera className="mr-2"/> Upload Image</Button>
                                <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                {imageDataUri && (
                                    <div className="relative w-fit">
                                        <Image src={imageDataUri} alt="Preview" width={40} height={40} className="rounded-md border" />
                                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full h-6 w-6" onClick={() => setImageDataUri(null)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                )}
                                <div className="flex-grow"/>
                                <Button className="w-full sm:w-auto" onClick={handleFinalSubmission}>Submit for Initial Review</Button>
                            </div>
                        </div>
                    ) : (
                         <div className="w-full flex items-center justify-center h-10">
                            <Loader />
                            <p className="ml-4 text-muted-foreground">Submitting your case for review...</p>
                         </div>
                    )}
                </CardFooter>
            </CardContent>
        </Card>
    )
  );

  const HistoryPanel = () => (
    <Card>
        <CardHeader className="flex-row items-center justify-between">
            <CardTitle>History</CardTitle>
            <Button onClick={startNewInvestigation} size="sm"><PlusCircle className="mr-2"/> New</Button>
        </CardHeader>
        <CardContent>
            {isLoading ? <Loader /> : investigations.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                    {investigations.map(c => (
                        <AccordionItem value={c.id} key={c.id}>
                            <AccordionTrigger className="text-left">
                                <div className="flex justify-between items-center w-full pr-4 gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-3 h-3 rounded-full ${statusConfig[c.status]?.color || 'bg-gray-400'}`} />
                                        <div className="min-w-0">
                                            <p className="font-bold truncate">
                                                {format(parseISO(c.createdAt), 'MMM d, yyyy')}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="hidden sm:inline-flex">
                                        {statusConfig[c.status]?.text}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                 {c.status === 'awaiting_lab_results' && c.doctorPlan && (
                                    <Card className="bg-secondary/50">
                                        <CardHeader>
                                            <CardTitle className="text-lg">Next Steps from Your Doctor</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {c.doctorPlan?.preliminaryMedications?.length > 0 && (
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2"><Pill/> Preliminary Medications</h3>
                                                    <ul className="list-disc list-inside pl-4 mt-2 text-muted-foreground">
                                                        {c.doctorPlan.preliminaryMedications.map((med, i) => <li key={i}>{med}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {c.doctorPlan?.suggestedLabTests?.length > 0 && (
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2"><TestTube/> Required Lab Tests</h3>
                                                    <p className="text-sm text-muted-foreground mb-4">Please get these tests done and upload the results below.</p>
                                                    <div className="space-y-4">
                                                        {c.doctorPlan.suggestedLabTests.map((test, i) => (
                                                            <div key={i} className="p-3 border rounded-md">
                                                                <label htmlFor={`lab-upload-${i}`} className="font-semibold">{test}</label>
                                                                <div className="flex items-center gap-4 mt-2">
                                                                    <Input id={`lab-upload-${i}`} type="file" accept="image/*,.pdf" onChange={(e) => handleLabResultUpload(test, e)} className="file:text-foreground flex-grow" />
                                                                    {labResultUploads[test] && <Check className="w-5 h-5 text-green-500"/>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter>
                                            <Button onClick={() => handleSubmitLabResults(c)} disabled={isSubmittingLabs}>
                                                {isSubmittingLabs ? <Loader/> : <><Upload className="mr-2"/> Submit Lab Results</>}
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                )}
                                {c.status === 'completed' && (
                                    <Alert>
                                        <ShieldCheck className="h-4 w-4" />
                                        <AlertTitle>Diagnosis &amp; Treatment Plan</AlertTitle>
                                        <AlertDescription asChild>
                                            <div className="space-y-4 mt-2">
                                                {c.finalDiagnosis?.map((diag: any, i: number) => (
                                                    <div key={i} className="pb-2 border-b last:border-b-0">
                                                        <h4 className="font-bold text-foreground">Diagnosis: {diag.condition} ({diag.probability}%)</h4>
                                                        <p className="text-xs text-muted-foreground">{diag.reasoning}</p>
                                                    </div>
                                                ))}
                                                {c.finalTreatmentPlan?.medications?.length > 0 && (
                                                    <div>
                                                        <h4 className="font-bold flex items-center gap-2 text-foreground"><Pill size={16}/> Medications</h4>
                                                        <ul className="list-disc list-inside pl-4 text-xs text-muted-foreground">
                                                            {c.finalTreatmentPlan.medications.map((med: string, i: number) => <li key={i}>{med}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                {c.finalTreatmentPlan?.lifestyleChanges?.length > 0 && (
                                                    <div>
                                                        <h4 className="font-bold flex items-center gap-2 text-foreground"><Salad size={16}/> Lifestyle Changes</h4>
                                                        <ul className="list-disc list-inside pl-4 text-xs text-muted-foreground">
                                                            {c.finalTreatmentPlan.lifestyleChanges.map((change: string, i: number) => <li key={i}>{change}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {c.status === 'rejected' && (
                                    <Alert variant="destructive">
                                        <XCircle className="h-4 w-4"/>
                                        <AlertTitle>Investigation Closed by Doctor</AlertTitle>
                                        {c.doctorNote && <AlertDescription>{c.doctorNote}</AlertDescription>}
                                    </Alert>
                                )}
                                {(c.status === 'pending_review' || c.status === 'pending_final_review') && (
                                    <Alert>
                                        <Sparkles className="h-4 w-4"/>
                                        <AlertTitle>Under Review</AlertTitle>
                                        <AlertDescription>Your case is currently being reviewed by a doctor. You will be notified of the next steps.</AlertDescription>
                                    </Alert>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : (
                <p className="text-muted-foreground text-center py-4">You have no past investigations.</p>
            )}
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <CardTitle className="flex items-center gap-2"><Search /> Health Investigation</CardTitle>
                <CardDescription>Chat with our AI to analyze your symptoms, follow doctor-prescribed steps, and uncover the root cause.</CardDescription>
            </div>
            <Button onClick={() => setView(v => v === 'chat' ? 'history' : 'chat')} className="w-full sm:w-auto lg:hidden">
                {view === 'chat' ? <><FileClock className="mr-2"/> View History</> : <><Search className="mr-2"/> View Chat</>}
            </Button>
            </CardHeader>
        </Card>
        
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Desktop: Chat is col-span-2, History is col-span-1 */}
            {/* Mobile: Toggles between Chat and History full-width */}
            <div className={cn("lg:col-span-2", view === 'chat' ? 'block' : 'hidden lg:block')}>
                <ChatInterface />
            </div>
            <div className={cn("lg:col-span-1", view === 'history' ? 'block' : 'hidden lg:block')}>
                <HistoryPanel />
            </div>
        </div>
    </div>
  );
}
