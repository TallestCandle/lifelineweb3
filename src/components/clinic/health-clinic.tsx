
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Bot, User, PlusCircle, Camera, Trash2, ShieldCheck, Send, AlertCircle, Sparkles, X, Pill, TestTube, Upload, Check, Salad, MessageSquare, ClipboardList, FileText, Video, Share2, ChevronsUpDown, Pencil } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '../ui/textarea';

// Types
interface Message {
  role: 'user' | 'model';
  content: string;
}

type InvestigationStatus = 'pending_review' | 'awaiting_nurse_visit' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected' | 'awaiting_follow_up_visit';
type RequiredFeedback = 'pictures' | 'videos' | 'text';

interface Investigation {
  id: string;
  status: InvestigationStatus;
  type: 'admission' | 'clinic';
  createdAt: string;
  steps: InvestigationStep[];
  doctorPlan?: {
      preliminaryMedications: string[];
      suggestedLabTests: string[];
      nurseNote?: string;
  };
  finalTreatmentPlan?: any;
  finalDiagnosis?: any;
  doctorNote?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
}

interface InvestigationStep {
    type: 'initial_submission' | 'lab_result_submission';
    timestamp: string;
    userInput: any;
    aiAnalysis: any;
    doctorRequest?: {
        note: string;
        requiredFeedback: RequiredFeedback[];
    };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'doctor';
  content: string;
  timestamp: string;
  authorId: string;
  authorName: string;
  edited?: boolean;
}


const statusConfig: Record<InvestigationStatus, { text: string; color: string }> = {
  pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500' },
  awaiting_nurse_visit: { text: 'Nurse Visit Pending', color: 'bg-cyan-500' },
  awaiting_lab_results: { text: 'Awaiting Lab Results', color: 'bg-blue-500' },
  pending_final_review: { text: 'Doctor Reviewing Results', color: 'bg-yellow-500' },
  completed: { text: 'Case Complete', color: 'bg-green-500' },
  rejected: { text: 'Case Closed', color: 'bg-red-500' },
  awaiting_follow_up_visit: { text: 'Follow-up Visit Pending', color: 'bg-cyan-500' },
};

function CaseChat({ investigationId, doctorName }: { investigationId: string, doctorName: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMessage, setEditingMessage] = useState<{id: string, content: string} | null>(null);

  useEffect(() => {
    const messagesCol = collection(db, `investigations/${investigationId}/messages`);
    const q = query(messagesCol, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
      setIsChatLoading(false);
    }, (error) => {
      console.error("Chat Error: ", error);
      setIsChatLoading(false);
    });

    return () => unsubscribe();
  }, [investigationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messagesCol = collection(db, `investigations/${investigationId}/messages`);
    await addDoc(messagesCol, {
      role: 'user',
      content: newMessage,
      timestamp: new Date().toISOString(),
      authorId: user.uid,
      authorName: user.displayName || 'Patient',
    });
    setNewMessage("");
  };

  const handleStartEdit = (message: ChatMessage) => {
    setEditingMessage({ id: message.id, content: message.content });
  };
  
  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleSaveEdit = async () => {
      if (!editingMessage || !user) return;
  
      const messageRef = doc(db, `investigations/${investigationId}/messages`, editingMessage.id);
      await updateDoc(messageRef, {
          content: editingMessage.content,
          edited: true,
          editedAt: new Date().toISOString(),
      });
  
      setEditingMessage(null);
  };

  return (
    <div className="mt-4">
      <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
        <MessageSquare size={16} /> Chat with Dr. {doctorName}
      </h4>
      <div className="border rounded-lg p-2 bg-background/50">
        <ScrollArea className="h-48 pr-4">
          <div className="space-y-4">
            {isChatLoading && <Loader2 className="animate-spin mx-auto"/>}
            {!isChatLoading && messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground pt-4">No messages yet. Say hello!</p>
            )}
            {messages.map((message) => {
              const isMyMessage = message.authorId === user?.uid;

              if (editingMessage?.id === message.id && isMyMessage) {
                return (
                  <div key={message.id} className={`flex items-end gap-2 w-full ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className="w-full max-w-[80%] space-y-2">
                        <Textarea 
                            value={editingMessage.content} 
                            onChange={(e) => setEditingMessage(prev => prev ? {...prev, content: e.target.value} : null)}
                            className="bg-background"
                            rows={3}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveEdit}>Save changes</Button>
                        </div>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center"><User size={20}/></div>
                  </div>
                )
              }

              return (
                <div key={message.id} className={`group flex items-end gap-2 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                  {isMyMessage && 
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleStartEdit(message)}>
                          <Pencil size={14} />
                          <span className="sr-only">Edit</span>
                      </Button>
                  }
                  {message.role === 'doctor' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center"><Bot size={20}/></div>}
                  <div className={`max-w-[80%] rounded-lg p-3 ${isMyMessage ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.edited && <span className="text-xs opacity-70 mt-1 block">(edited)</span>}
                  </div>
                  {isMyMessage && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center"><User size={20}/></div>}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2 border-t mt-2">
          <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." disabled={!!editingMessage} />
          <Button type="submit" size="icon" disabled={!!editingMessage}><Send /></Button>
        </form>
      </div>
    </div>
  );
}


export function HealthClinic() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeView, setActiveView] = useState<'list' | 'chat'>('list');
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  // Chat state
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [interviewState, setInterviewState] = useState<'not_started' | 'in_progress' | 'awaiting_upload' | 'submitting'>('not_started');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  
  // Lab result upload state
  const [labResultUploads, setLabResultUploads] = useState<Record<string, string>>({});
  const [isSubmittingLabs, setIsSubmittingLabs] = useState(false);

  // Image viewer state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch history of investigations
  useEffect(() => {
    if (!user) {
        setIsLoadingHistory(false);
        return;
    }

    const q = query(collection(db, "investigations"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setInvestigations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation)));
        setIsLoadingHistory(false);
    }, (err) => {
        console.error("Error fetching investigations: ", err);
        toast({variant: 'destructive', title: 'Error', description: 'Could not fetch past cases.'});
        setIsLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  // Scroll chat to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.parentElement?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const startNewClinicVisit = () => {
      setMessages([{ role: 'model', content: "Hello! I'm your AI Clinic Assistant. To start your virtual visit, please briefly describe your main health concern." }]);
      setInterviewState('in_progress');
      setActiveView('chat');
      setImageDataUri(null);
  };

  const cancelVisit = () => {
    setMessages([]);
    setInterviewState('not_started');
    setActiveView('list');
    setImageDataUri(null);
  }
  
  const handleSendMessage = async (currentInput: string) => {
    if (!currentInput.trim() || isChatLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: currentInput }];
    setMessages(newMessages);
    setIsChatLoading(true);

    try {
      setMessages([...newMessages, { role: 'model', content: '' }]); // Thinking indicator
      const result = await conductInterview({ chatHistory: newMessages });
      setMessages([...newMessages, { role: 'model', content: result.nextQuestion }]);
      if (result.isFinalQuestion) {
        setInterviewState('awaiting_upload');
      }
    } catch (error) {
      console.error("AI chat failed:", error);
      setMessages([...newMessages, { role: 'model', content: "I'm sorry, an error occurred. Please try again." }]);
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
        const chatTranscript = messages.map(m => `${m.role === 'user' ? 'Patient' : 'AI Assistant'}: ${m.content}`).join('\n\n');
        const result = await startInvestigation({
            userId: user.uid,
            userName: user.displayName || "User",
            chatTranscript,
            imageDataUri: imageDataUri || undefined,
            type: 'clinic',
        });

        if (result.success) {
            toast({ title: 'Case Submitted for Review', description: 'A doctor will review your case and prescribe the next steps shortly.' });
            cancelVisit();
        } else {
             throw new Error("Submission failed on the server.");
        }
      } catch (error) {
          console.error("Failed to submit investigation:", error);
          toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your case. Please try again.' });
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
        const labResults = requiredTests.map(testName => ({ testName, imageDataUri: labResultUploads[testName] }));
        await continueInvestigation({ userId: user.uid, investigationId: investigation.id, labResults });
        toast({ title: "Lab Results Submitted", description: "Your results have been sent for final analysis." });
        setLabResultUploads({});
    } catch (error) {
        console.error("Error submitting lab results:", error);
        toast({ variant: 'destructive', title: "Submission Failed", description: "Could not submit your lab results." });
    } finally {
        setIsSubmittingLabs(false);
    }
  };

  const handleShareImage = async () => {
    if (!selectedImage) return;

    try {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        const file = new File([blob], 'lifeline-image.png', { type: blob.type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Health Image',
                text: 'Image from Lifeline AI Case',
            });
        } else {
            const link = document.createElement('a');
            link.href = selectedImage;
            link.download = 'lifeline-image.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: "Image downloaded", description: "Sharing is not supported, the image has been downloaded instead." });
        }
    } catch (error) {
        console.error('Error sharing image:', error);
        toast({
            variant: 'destructive',
            title: 'Share Failed',
            description: 'Could not share the image.',
        });
    }
};

  const ChatInterface = () => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="flex items-center gap-2"><Bot/> New Clinic Visit</CardTitle>
                <CardDescription>The AI will ask 15 questions to gather details for the doctor.</CardDescription>
            </div>
            <Button variant="ghost" onClick={cancelVisit} size="sm"><X className="mr-2 h-4 w-4"/> Cancel</Button>
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
        </CardContent>
        <CardFooter className="p-4 border-t">
            {interviewState === 'in_progress' ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage((e.currentTarget.elements.namedItem('message') as HTMLInputElement).value); e.currentTarget.reset(); }} className="w-full flex items-center gap-2">
                    <Input name="message" placeholder="Type your message..." disabled={isChatLoading} autoComplete="off" />
                    <Button type="submit" disabled={isChatLoading}><Send /></Button>
                </form>
            ) : interviewState === 'awaiting_upload' ? (
                <div className="w-full space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Interview Complete!</AlertTitle>
                        <AlertDescription>Optionally, upload a relevant image (e.g., of a skin condition) before submitting for review.</AlertDescription>
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
                        <Button className="w-full sm:w-auto" onClick={handleFinalSubmission}>Submit Case for Review</Button>
                    </div>
                </div>
            ) : (
                 <div className="w-full flex items-center justify-center h-10">
                    <Loader2 className="animate-spin" />
                    <p className="ml-4 text-muted-foreground">Submitting your case for doctor's review...</p>
                 </div>
            )}
        </CardFooter>
    </Card>
  );

  const HistoryPanel = () => (
    <Card>
        <CardHeader className="flex-row items-center justify-between">
            <div>
                <CardTitle>My Clinic Cases</CardTitle>
                <CardDescription>Review your ongoing and past virtual clinic visits.</CardDescription>
            </div>
            <Button onClick={startNewClinicVisit}>
                <PlusCircle className="mr-2"/> New Clinic Visit
            </Button>
        </CardHeader>
        <CardContent>
            {isLoadingHistory ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : investigations.length > 0 ? (
                <Accordion type="single" collapsible className="w-full" defaultValue={investigations.find(c => c.type === 'clinic')?.id}>
                    {investigations.filter(c => c.type === 'clinic').map(c => (
                        <AccordionItem value={c.id} key={c.id}>
                            <AccordionTrigger className="text-left hover:no-underline">
                                <div className="flex justify-between items-center w-full pr-4 gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className={cn("w-3 h-3 rounded-full flex-shrink-0", statusConfig[c.status]?.color || 'bg-gray-400')} />
                                        <div className="min-w-0">
                                            <p className="font-bold truncate">Case from {format(parseISO(c.createdAt), 'MMM d, yyyy')}</p>
                                            <p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true })}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="hidden sm:inline-flex">{statusConfig[c.status]?.text}</Badge>
                                </div>
                            </AccordionTrigger>
                             <AccordionContent className="space-y-6 pt-4">
                                
                                {c.steps.map((step, index) => {
                                    return (
                                        <div key={index} className="relative pl-8">
                                            <div className="absolute left-3 top-1 w-0.5 h-full bg-border -translate-x-1/2"></div>
                                            <div className="absolute left-3 top-2 w-3 h-3 rounded-full bg-primary ring-4 ring-background -translate-x-1/2"></div>
                                            
                                            <p className="font-bold text-sm mb-1">
                                                {step.type === 'initial_submission' ? 'Initial Visit' : 'Follow-up Submission'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mb-2">
                                                {format(parseISO(step.timestamp), 'MMM d, yyyy, h:mm a')}
                                            </p>

                                            <div className="p-4 bg-secondary/50 rounded-lg space-y-4">
                                                {step.doctorRequest && (
                                                    <Alert variant="default" className="border-primary/50">
                                                        <ClipboardList className="h-4 w-4" />
                                                        <AlertTitle>Doctor's Request for This Visit</AlertTitle>
                                                        <AlertDescription className="mt-2 space-y-2">
                                                            {step.doctorRequest.note && <p>{step.doctorRequest.note}</p>}
                                                            {step.doctorRequest.requiredFeedback?.length > 0 && (
                                                                <div>
                                                                    <p className="font-semibold">Requested Feedback:</p>
                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                        {step.doctorRequest.requiredFeedback.map((fb: string, i: number) => <Badge key={i} variant="secondary" className="capitalize">{fb}</Badge>)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                {step.type === 'initial_submission' && (
                                                    <div>
                                                        <Collapsible>
                                                            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm font-semibold hover:bg-secondary">
                                                                <span>Your Symptoms & Interview</span>
                                                                <ChevronsUpDown className="h-4 w-4" />
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent className="pt-2">
                                                                <p className="text-sm whitespace-pre-line rounded-md bg-background/50 p-2 text-muted-foreground">{step.userInput.chatTranscript}</p>
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                        
                                                        {step.userInput.imageDataUri && (
                                                            <div className="mt-4">
                                                                <h4 className="font-semibold text-sm mb-1">Image Submitted</h4>
                                                                <button onClick={() => setSelectedImage(step.userInput.imageDataUri)} className="transition-transform hover:scale-105">
                                                                    <Image src={step.userInput.imageDataUri} alt="Initial submission" width={100} height={100} className="rounded-md border"/>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {step.type === 'lab_result_submission' && (
                                                    <div>
                                                        {step.userInput.nurseReport?.text && (
                                                            <Alert className="mb-4"><FileText className="h-4 w-4"/><AlertTitle>Nurse's Report</AlertTitle><AlertDescription>{step.userInput.nurseReport.text}</AlertDescription></Alert>
                                                        )}

                                                        {(step.userInput.labResults?.length > 0 || step.userInput.nurseReport?.pictures?.length > 0 || step.userInput.nurseReport?.videos?.length > 0) && (
                                                            <div className="space-y-4">
                                                                {step.userInput.labResults?.length > 0 && (
                                                                    <div>
                                                                        <h4 className="font-semibold text-sm mb-2">Lab Test Results</h4>
                                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                                            {step.userInput.labResults.map((res: any, i: number) => (
                                                                                <div key={`lab-${i}`}>
                                                                                    <p className="font-semibold text-xs truncate">{res.testName}</p>
                                                                                    <button onClick={() => setSelectedImage(res.imageDataUri)} className="transition-transform hover:scale-105 mt-1">
                                                                                        <Image src={res.imageDataUri} alt={res.testName} width={150} height={150} className="rounded-md border"/>
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                
                                                                {step.userInput.nurseReport?.pictures?.length > 0 && (
                                                                    <div>
                                                                        <h4 className="font-semibold text-sm mb-2">Pictures from Nurse</h4>
                                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                                            {step.userInput.nurseReport.pictures.map((pic: string, i: number) => (
                                                                                <div key={`pic-${i}`}>
                                                                                    <button onClick={() => setSelectedImage(pic)} className="transition-transform hover:scale-105 mt-1">
                                                                                        <Image src={pic} alt={`Nurse picture ${i+1}`} width={150} height={150} className="rounded-md border"/>
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {step.userInput.nurseReport?.videos?.length > 0 && (
                                                                    <div>
                                                                        <h4 className="font-semibold text-sm mb-2">Videos from Nurse</h4>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {step.userInput.nurseReport.videos.map((vid: string, i: number) => (
                                                                                <Badge key={`vid-${i}`} variant="secondary" className="flex items-center gap-1">
                                                                                    <Video className="w-3 h-3"/> Video {i+1}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}

                                <Separator />

                                <div className="px-4">
                                    {(c.status === 'awaiting_lab_results' || c.status === 'awaiting_nurse_visit') && c.doctorPlan && (
                                        <Card className="bg-secondary/50">
                                            <CardHeader>
                                                <CardTitle className="text-lg">Next Steps from Your Doctor</CardTitle>
                                                {c.reviewedByName && c.reviewedByUid && (<CardDescription>Prescribed by <Link href={`/doctors?id=${c.reviewedByUid}`} className="font-bold text-primary hover:underline">{c.reviewedByName}</Link></CardDescription>)}
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
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            {c.type === 'admission' 
                                                                ? 'A nurse has been dispatched to your location to collect samples for these tests.' 
                                                                : 'Please get these tests done at a local facility and upload the results below.'}
                                                        </p>
                                                         <ul className="list-disc list-inside pl-4 text-muted-foreground text-sm">
                                                            {c.doctorPlan.suggestedLabTests.map((test, i) => <li key={i}>{test}</li>)}
                                                        </ul>
                                                        {c.status === 'awaiting_lab_results' && (
                                                            <div className="space-y-4 mt-4">
                                                                {c.doctorPlan.suggestedLabTests.map((test, i) => (
                                                                    <div key={i} className="p-3 border rounded-md">
                                                                        <label htmlFor={`lab-upload-${i}`} className="font-semibold">{test}</label>
                                                                        <div className="flex items-center gap-4 mt-2">
                                                                            <Input id={`lab-upload-${i}`} type="file" accept="image/*,.pdf" onChange={(e) => handleLabResultUpload(test, e)} className="file:text-foreground flex-grow" />
                                                                            {labResultUploads[test] && <Check className="w-5 h-5 text-green-500"/>}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                <Button onClick={() => handleSubmitLabResults(c)} disabled={isSubmittingLabs}>
                                                                    {isSubmittingLabs ? <Loader2 className="animate-spin mr-2"/> : <Upload className="mr-2"/>}
                                                                    Submit Lab Results
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                    {c.status === 'completed' && (
                                        <Alert>
                                            <ShieldCheck className="h-4 w-4" />
                                            <AlertTitle>Diagnosis &amp; Treatment Plan</AlertTitle>
                                            {c.reviewedByName && c.reviewedByUid && (<p className="text-xs text-muted-foreground -mt-1 mb-2">Finalized by <Link href={`/doctors?id=${c.reviewedByUid}`} className="font-bold text-primary hover:underline">{c.reviewedByName}</Link></p>)}
                                            <AlertDescription asChild>
                                                <div className="space-y-4 mt-2">
                                                    {c.finalDiagnosis?.map((diag: any, i: number) => (
                                                        <div key={i} className="pb-2 border-b last:border-b-0"><h4 className="font-bold text-foreground">Diagnosis: {diag.condition} ({diag.probability}%)</h4><p className="text-xs text-muted-foreground">{diag.reasoning}</p></div>
                                                    ))}
                                                    {c.finalTreatmentPlan?.medications?.length > 0 && (
                                                        <div><h4 className="font-bold flex items-center gap-2 text-foreground"><Pill size={16}/> Medications</h4><ul className="list-disc list-inside pl-4 text-xs text-muted-foreground">{c.finalTreatmentPlan.medications.map((med: string, i: number) => <li key={i}>{med}</li>)}</ul></div>
                                                    )}
                                                    {c.finalTreatmentPlan?.lifestyleChanges?.length > 0 && (
                                                        <div><h4 className="font-bold flex items-center gap-2 text-foreground"><Salad size={16}/> Lifestyle Changes</h4><ul className="list-disc list-inside pl-4 text-xs text-muted-foreground">{c.finalTreatmentPlan.lifestyleChanges.map((change: string, i: number) => <li key={i}>{change}</li>)}</ul></div>
                                                    )}
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    {c.status === 'rejected' && (
                                        <Alert variant="destructive">
                                            <X className="h-4 w-4"/>
                                            <AlertTitle>Case Closed by Doctor</AlertTitle>
                                            {c.doctorNote && <AlertDescription>{c.doctorNote}{c.reviewedByName && c.reviewedByUid && (<span className="italic">{' - '}<Link href={`/doctors?id=${c.reviewedByUid}`} className="font-bold hover:underline">{c.reviewedByName}</Link></span>)}</AlertDescription>}
                                        </Alert>
                                    )}
                                    {(c.status === 'pending_review' || c.status === 'pending_final_review') && (
                                        <Alert>
                                            <Sparkles className="h-4 w-4"/>
                                            <AlertTitle>Under Review</AlertTitle>
                                            <AlertDescription>Your case is currently being reviewed by a doctor. You will be notified of the next steps.</AlertDescription>
                                        </Alert>
                                    )}

                                    {c.reviewedByUid && (c.status !== 'rejected' && c.status !== 'completed') && (
                                        <div className="pt-4 mt-4 border-t">
                                            <CaseChat investigationId={c.id} doctorName={c.reviewedByName || 'the Doctor'} />
                                        </div>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Cases Yet</h3>
                    <p className="mt-1 text-sm">Start a new clinic visit to begin your health journey.</p>
                </div>
            )}
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {activeView === 'list' ? <HistoryPanel /> : <ChatInterface />}

      <Dialog open={!!selectedImage} onOpenChange={(isOpen) => !isOpen && setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Image Viewer</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
                {selectedImage && <Image src={selectedImage} alt="Enlarged view" width={800} height={800} className="rounded-md max-h-[70vh] w-auto object-contain"/>}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedImage(null)}>Close</Button>
                <Button onClick={handleShareImage}>
                    <Share2 className="mr-2"/> Share / Print
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
