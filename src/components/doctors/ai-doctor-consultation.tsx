
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import Image from 'next/image';

// AI Flows
import { conductInterview } from '@/ai/flows/conduct-interview-flow';
import type { InitiateConsultationOutput } from '@/ai/flows/initiate-consultation-flow';
import { submitNewConsultation } from '@/ai/flows/initiate-consultation-flow';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader } from '@/components/ui/loader';
import { Bot, User, PlusCircle, FileClock, Camera, Trash2, ShieldCheck, Send, AlertCircle, Sparkles } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

// Types
interface Message {
  role: 'user' | 'model';
  content: string;
}

interface Consultation {
  id: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  createdAt: string;
  userInput: { chatTranscript: string; imageDataUri?: string; };
  aiAnalysis?: InitiateConsultationOutput;
  finalTreatmentPlan?: any;
}

const statusConfig = {
  pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
  approved: { text: 'Plan Approved', color: 'bg-green-500' },
  rejected: { text: 'Plan Rejected', color: 'bg-red-500' },
  in_progress: { text: 'Follow-up in Progress', color: 'bg-blue-500' },
  completed: { text: 'Consultation Completed', color: 'bg-gray-500' },
};


export function AiDoctorConsultation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'form' | 'history'>('history');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [interviewState, setInterviewState] = useState<'not_started' | 'in_progress' | 'awaiting_upload' | 'submitting'>('not_started');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.parentElement?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);
  
  // Fetch history
  useEffect(() => {
    if (view === 'history' && user) {
      setIsLoading(true);
      const q = query(collection(db, "consultations"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      getDocs(q).then(snapshot => {
        setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation)));
      }).catch(err => {
        console.error("Error fetching consultations: ", err);
        toast({variant: 'destructive', title: 'Error', description: 'Could not fetch past consultations.'});
      }).finally(() => {
          setIsLoading(false);
      });
    }
  }, [user, toast, view]);

  const startNewConsultation = () => {
      setMessages([{ role: 'model', content: "Hello! I'm your AI Doctor. To get started, please briefly describe your main health concern." }]);
      setInterviewState('in_progress');
      setView('form');
      setImageDataUri(null);
  };
  
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || isChatLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);
    const currentInput = userInput;
    setUserInput('');
    setIsChatLoading(true);

    try {
      // Optimistically add user message and temporary AI thinking message
      const thinkingMessage: Message = { role: 'model', content: '...' };
      setMessages([...newMessages, thinkingMessage]);

      const result = await conductInterview({ chatHistory: newMessages });
      
      // Replace thinking message with actual AI response
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
        const chatTranscript = messages.map(m => `${m.role === 'user' ? 'Patient' : 'AI Doctor'}: ${m.content}`).join('\n\n');
        
        const result = await submitNewConsultation({
            userId: user.uid,
            userName: user.displayName || "User",
            chatTranscript,
            imageDataUri: imageDataUri || undefined,
        });

        if (result.success) {
            toast({ title: 'Consultation Submitted', description: 'Your case has been sent for review. A doctor will approve your plan shortly.' });
            setInterviewState('not_started');
            setView('history');
        } else {
             throw new Error("Submission failed on the server.");
        }
      } catch (error) {
          console.error("Failed to submit consultation:", error);
          toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your consultation. Please try again.' });
          setInterviewState('awaiting_upload');
      }
  };
  
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles /> 24/7 AI Doctor Consultation</CardTitle>
            <CardDescription>Chat with our AI to analyze your symptoms. A licensed doctor reviews every case.</CardDescription>
          </div>
          <Button onClick={() => view === 'form' ? setView('history') : startNewConsultation()}>
            {view === 'form' ? <><FileClock className="mr-2"/> View History</> : <><PlusCircle className="mr-2"/> New Consultation</>}
          </Button>
        </CardHeader>
      </Card>
      
      {view === 'form' ? (
        <Card>
            <CardContent className="p-0">
                <ScrollArea className="h-[50vh] p-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.map((message, index) => (
                             <div key={index} className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center"><Bot size={20}/></div>}
                                <div className={`max-w-md rounded-lg p-3 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                                    {isChatLoading && index === messages.length - 1 && message.role === 'model' ? <div className="flex items-center gap-2"><span>Thinking</span><Loader className="w-4 h-4 border-2" /></div> : <p className="whitespace-pre-wrap">{message.content}</p>}
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
                                <AlertDescription>You can now upload any relevant lab results or images for the doctor to review.</AlertDescription>
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
                                <Button className="w-full sm:w-auto" onClick={handleFinalSubmission}>Submit to Doctor</Button>
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
      ) : (
        <Card>
            <CardHeader><CardTitle>Consultation History</CardTitle></CardHeader>
            <CardContent>
                {isLoading ? <Loader /> : consultations.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                        {consultations.map(c => (
                            <AccordionItem value={c.id} key={c.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between items-center w-full pr-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-3 h-3 rounded-full ${statusConfig[c.status]?.color || 'bg-gray-400'}`} />
                                            <div className="text-left">
                                                <p>Consultation from {format(parseISO(c.createdAt), 'MMM d, yyyy')}</p>
                                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true })}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline">{statusConfig[c.status]?.text}</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                     <div>
                                        <h4 className="font-bold mb-2">Interview Transcript</h4>
                                        <ScrollArea className="h-48 rounded-md border bg-secondary/50 p-3">
                                            <p className="text-xs whitespace-pre-wrap">{c.userInput.chatTranscript}</p>
                                        </ScrollArea>
                                    </div>
                                    {c.status === 'approved' && c.finalTreatmentPlan && (
                                        <Alert>
                                            <ShieldCheck className="h-4 w-4" />
                                            <AlertTitle>Doctor-Approved Treatment Plan</AlertTitle>
                                            <AlertDescription>
                                                <pre className="text-xs whitespace-pre-wrap font-mono bg-secondary p-2 rounded-md mt-2">
                                                    {typeof c.finalTreatmentPlan === 'string' ? c.finalTreatmentPlan : JSON.stringify(c.finalTreatmentPlan, null, 2)}
                                                </pre>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                     {c.status === 'pending_review' && (
                                        <Alert variant="default" className="bg-secondary">
                                            <AlertTitle>Awaiting Review</AlertTitle>
                                            <AlertDescription>An AI-generated plan is being reviewed by a licensed doctor. You will be notified upon approval.</AlertDescription>
                                        </Alert>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-muted-foreground text-center py-4">You have no past consultations.</p>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
