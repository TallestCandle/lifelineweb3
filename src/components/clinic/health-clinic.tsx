
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/auth-provider';
import { useProfile } from '@/context/profile-provider';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, parseISO, isAfter } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Bot, User, PlusCircle, Camera, Trash2, ShieldCheck, Send, AlertCircle, Sparkles, X, Pill, TestTube, Upload, Check, Salad, MessageSquare, ClipboardList, FileText, Video, Share2, ChevronsUpDown, FileSpreadsheet } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const SUBMISSION_COST = 100;

// Types
interface Message {
  role: 'user' | 'model';
  content: string;
}

type InvestigationStatus = 'pending_review' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected' | 'awaiting_follow_up_visit';

interface Investigation {
  id: string;
  userId: string;
  status: InvestigationStatus;
  createdAt: string;
  steps: InvestigationStep[];
  doctorPlan?: {
      preliminaryMedications: { name: string; dosage: string }[];
      suggestedLabTests: string[];
  };
  followUpRequest?: {
    note: string;
    suggestedLabTests: string[];
  };
  finalTreatmentPlan?: any;
  finalDiagnosis?: any;
  doctorNote?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
}

interface InvestigationStep {
    type: 'initial_submission' | 'lab_result_submission' | 'follow_up_submission';
    timestamp: string;
    userInput: any;
    aiAnalysis: any;
    doctorRequest?: any;
}

const statusConfig: Record<InvestigationStatus, { text: string; color: string; icon: React.ElementType }> = {
  pending_review: { text: 'Awaiting Doctor Review', color: 'bg-yellow-500', icon: Sparkles },
  awaiting_lab_results: { text: 'Awaiting Lab Results', color: 'bg-blue-500', icon: TestTube },
  pending_final_review: { text: 'Doctor Reviewing Results', color: 'bg-yellow-500', icon: Sparkles },
  completed: { text: 'Case Complete', color: 'bg-green-500', icon: Check },
  rejected: { text: 'Case Closed', color: 'bg-red-500', icon: X },
  awaiting_follow_up_visit: { text: 'Follow-up Visit Pending', color: 'bg-cyan-500', icon: ClipboardList },
};

function CaseDetails({ investigation, onImageClick }: { investigation: Investigation, onImageClick: (url: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [labResultUploads, setLabResultUploads] = useState<Record<string, string>>({});
  const [isSubmittingLabs, setIsSubmittingLabs] = useState(false);

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
    if (!user) return;

    const plan = investigation.doctorPlan || investigation.followUpRequest;
    if (!plan) return;

    const requiredTests = plan.suggestedLabTests;
    const uploadedTests = Object.keys(labResultUploads);
    if (requiredTests.some((test: string) => !uploadedTests.includes(test))) {
      toast({ variant: 'destructive', title: 'Missing Results', description: 'Please upload all required lab test results.' });
      return;
    }

    setIsSubmittingLabs(true);
    try {
      const labResults = requiredTests.map((testName: string) => ({ testName, imageDataUri: labResultUploads[testName] }));
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

  return (
    <div className="space-y-4 pt-4" style={{ scrollBehavior: 'smooth' }}>
      {investigation.steps.map((step, index) => (
        <div key={index} className="relative pl-6">
          <div className="absolute left-2.5 top-1 w-0.5 h-full bg-border -translate-x-1/2"></div>
          <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-primary ring-4 ring-background -translate-x-1/2"></div>
          <p className="font-bold text-sm mb-1">{step.type === 'initial_submission' ? 'Initial Case Submission' : 'Follow-up'}</p>
          <p className="text-xs text-muted-foreground mb-2">{format(parseISO(step.timestamp), 'MMM d, yyyy, h:mm a')}</p>
          <div className="p-3 bg-secondary/50 rounded-lg space-y-4">
            {step.doctorRequest && (
              <Alert variant="default" className="border-primary/50">
                <ClipboardList className="h-4 w-4" />
                <AlertTitle>Doctor's Request</AlertTitle>
                <AlertDescription className="mt-2">{step.doctorRequest.note}</AlertDescription>
              </Alert>
            )}
            {step.type === 'initial_submission' && (
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm font-semibold hover:bg-secondary"><span>Your Symptoms & Interview</span><ChevronsUpDown className="h-4 w-4" /></CollapsibleTrigger>
                <CollapsibleContent className="pt-2"><p className="text-sm whitespace-pre-line rounded-md bg-background/50 p-2 text-muted-foreground">{step.userInput.chatTranscript}</p></CollapsibleContent>
              </Collapsible>
            )}
            {step.userInput.imageDataUri && (
              <div className="mt-4"><h4 className="font-semibold text-sm mb-1">Image Submitted</h4><button onClick={() => onImageClick(step.userInput.imageDataUri)} className="transition-transform hover:scale-105"><Image src={step.userInput.imageDataUri} alt="User submission" width={100} height={100} className="rounded-md border"/></button></div>
            )}
            {step.userInput.labResults && Array.isArray(step.userInput.labResults) && step.userInput.labResults.length > 0 && (
                <div>
                    <h4 className="font-semibold text-sm mb-2">Submitted Lab Results</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {step.userInput.labResults.map((res: any, i: number) => (
                            <div key={`lab-${i}`}>
                                <p className="font-semibold text-xs truncate">{res.testName}</p>
                                <button onClick={() => onImageClick(res.imageDataUri)} className="transition-transform hover:scale-105 mt-1">
                                    <Image src={res.imageDataUri} alt={res.testName} width={100} height={100} className="rounded-md border"/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      ))}

      <Separator />

      <div className="px-2">
        {(investigation.status === 'awaiting_lab_results' || investigation.status === 'awaiting_follow_up_visit') && (
          <Card className="bg-secondary/50">
            <CardHeader>
              <CardTitle className="text-lg">Next Steps from Your Doctor</CardTitle>
              {investigation.reviewedByName && investigation.reviewedByUid && (<CardDescription>Prescribed by <Link href={`/doctors?id=${investigation.reviewedByUid}`} className="font-bold text-primary hover:underline">{investigation.reviewedByName}</Link></CardDescription>)}
            </CardHeader>
            <CardContent className="space-y-6">
              {(investigation.doctorPlan?.preliminaryMedications?.length || 0) > 0 && (
                <div><h3 className="font-bold flex items-center gap-2"><FileSpreadsheet/> Preliminary Medications</h3>
                <p className="text-sm text-muted-foreground mb-2">Your doctor has prescribed the following medications. Click to view details and set reminders.</p>
                <Button onClick={() => router.push('/reminders')}><Pill className="mr-2"/> View Prescription Plan</Button>
                </div>
              )}
              {(investigation.doctorPlan?.suggestedLabTests?.length || 0) > 0 && (
                <div>
                  <h3 className="font-bold flex items-center gap-2"><TestTube/> Required Lab Tests</h3>
                  <div className="space-y-4 mt-4">
                    {(investigation.doctorPlan?.suggestedLabTests || []).map((test: string, i: number) => (
                      <div key={i} className="p-3 border rounded-md"><label htmlFor={`lab-upload-${i}`} className="font-semibold">{test}</label><div className="flex items-center gap-4 mt-2"><Input id={`lab-upload-${i}`} type="file" accept="image/*,.pdf" onChange={(e) => handleLabResultUpload(test, e)} className="file:text-foreground flex-grow" />{labResultUploads[test] && <Check className="w-5 h-5 text-green-500"/>}</div></div>
                    ))}
                    <Button onClick={() => handleSubmitLabResults(investigation)} disabled={isSubmittingLabs}>{isSubmittingLabs ? <Loader2 className="animate-spin mr-2"/> : <Upload className="mr-2"/>}Submit Lab Results</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {investigation.status === 'completed' && (
          <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Diagnosis & Treatment Plan</AlertTitle>{investigation.reviewedByName && investigation.reviewedByUid && (<p className="text-xs text-muted-foreground -mt-1 mb-2">Finalized by <Link href={`/doctors?id=${investigation.reviewedByUid}`} className="font-bold text-primary hover:underline">{investigation.reviewedByName}</Link></p>)}<AlertDescription asChild><div className="space-y-4 mt-2">{investigation.finalDiagnosis?.map((diag: any, i: number) => (<div key={i} className="pb-2 border-b last:border-b-0"><h4 className="font-bold text-foreground">Diagnosis: {diag.condition} ({diag.probability}%)</h4><p className="text-xs text-muted-foreground">{diag.reasoning}</p></div>))}{investigation.finalTreatmentPlan?.medications?.length > 0 && (<div><h4 className="font-bold flex items-center gap-2 text-foreground"><Pill size={16}/> Medications</h4><Button onClick={() => router.push('/reminders')} size="sm" variant="outline" className="mt-2">View Full Prescription</Button></div>)}{investigation.finalTreatmentPlan?.lifestyleChanges?.length > 0 && (<div><h4 className="font-bold flex items-center gap-2 text-foreground"><Salad size={16}/> Lifestyle Changes</h4><ul className="list-disc list-inside pl-4 text-xs text-muted-foreground">{investigation.finalTreatmentPlan.lifestyleChanges.map((change: string, i: number) => <li key={i}>{change}</li>)}</ul></div>)}</div></AlertDescription></Alert>
        )}
        {investigation.status === 'rejected' && (
          <Alert variant="destructive"><X className="h-4 w-4"/><AlertTitle>Case Closed by Doctor</AlertTitle>{investigation.doctorNote && <AlertDescription>{investigation.doctorNote}{investigation.reviewedByName && investigation.reviewedByUid && (<span className="italic">{' - '}<Link href={`/doctors?id=${investigation.reviewedByUid}`} className="font-bold hover:underline">{investigation.reviewedByName}</Link></span>)}</AlertDescription>}</Alert>
        )}
        {(investigation.status === 'pending_review' || investigation.status === 'pending_final_review') && (
          <Alert><Sparkles className="h-4 w-4"/><AlertTitle>Under Review</AlertTitle><AlertDescription>Your case is currently being reviewed by a doctor. You will be notified of the next steps.</AlertDescription></Alert>
        )}
      </div>
    </div>
  );
}

export function HealthClinic() {
  const { user } = useAuth();
  const { profile, updateCredits } = useProfile();
  const { toast } = useToast();
  
  const [activeView, setActiveView] = useState<'list' | 'chat'>('list');
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [interviewState, setInterviewState] = useState<'not_started' | 'in_progress' | 'awaiting_upload' | 'submitting'>('not_started');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  // Fetch history of investigations
  useEffect(() => {
    if (!user) {
      setIsLoadingHistory(false);
      return;
    }

    const q = query(collection(db, "investigations"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newInvestigations = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id,
          ...data,
        } as Investigation;
      });
      setInvestigations(newInvestigations);
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
    if (activeView === 'chat') {
        const parent = scrollAreaRef.current?.parentElement;
        if (parent) {
          parent.scrollTo({ top: parent.scrollHeight, behavior: 'smooth' });
        }
    }
  }, [messages, activeView]);

  const startNewAdmission = () => {
    setMessages([{ role: 'model', content: "Hello! I'm your AI Clinic Assistant. To start, please briefly describe your main health concern." }]);
    setInterviewState('in_progress');
    setActiveView('chat');
    setImageDataUri(null);
  };

  const cancelAdmission = () => {
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
      await updateCredits(-SUBMISSION_COST, `New Clinic Case`);
      const chatTranscript = messages.map(m => `${m.role === 'user' ? 'Patient' : 'AI Assistant'}: ${m.content}`).join('\n\n');
      const result = await startInvestigation({
        userId: user.uid,
        userName: user.displayName || "User",
        chatTranscript,
        imageDataUri: imageDataUri || undefined,
      });

      if (result.success) {
        toast({ title: 'Case Submitted for Review', description: 'A doctor will review your case and prescribe the next steps shortly.' });
        cancelAdmission();
        setOpenItemId(result.investigationId);
      } else {
        throw new Error("Submission failed on the server.");
      }
    } catch (error) {
      console.error("Failed to submit investigation:", error);
      await updateCredits(SUBMISSION_COST, `Refund for failed case submission`); // Refund
      toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your case. Please try again.' });
      setInterviewState('awaiting_upload');
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
  
  const hasSufficientCredits = (profile?.credits ?? 0) >= SUBMISSION_COST;

  const ChatInterface = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Bot/> New Clinic Case</CardTitle>
          <CardDescription>The AI will conduct an interview to gather details for the doctor.</CardDescription>
        </div>
        <Button variant="ghost" onClick={cancelAdmission} size="sm"><X className="mr-2 h-4 w-4"/> Cancel</Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[50vh]" viewportRef={scrollAreaRef}>
          <div className="space-y-4 p-4">
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button className="w-full sm:w-auto">Submit Case ({SUBMISSION_COST} Credits)</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Case Submission</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will use {SUBMISSION_COST} credits from your wallet to submit this case for a doctor's review. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleFinalSubmission} disabled={!hasSufficientCredits}>
                            {hasSufficientCredits ? 'Confirm & Submit' : 'Insufficient Credits'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

  const HistoryPanel = () => {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>My Clinic Cases</CardTitle>
            <CardDescription>Review your ongoing and past cases.</CardDescription>
          </div>
          <Button onClick={startNewAdmission}>
            <PlusCircle className="mr-2"/> New Case
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : investigations.length > 0 ? (
            <div className="space-y-4">
              {investigations.map((c) => {
                const StatusIcon = statusConfig[c.status]?.icon || Sparkles;

                return (
                  <Collapsible 
                    key={c.id} 
                    open={openItemId === c.id}
                    onOpenChange={(isOpen) => {
                        setOpenItemId(isOpen ? c.id : null);
                    }}
                  >
                    <Card className="overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className="p-3 sm:p-4 w-full text-left hover:bg-secondary/50 [&[data-state=open]]:bg-secondary/50">
                          <div className="flex justify-between items-center w-full gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center",
                                    statusConfig[c.status]?.color
                                  )}
                                >
                                  <StatusIcon className="w-5 h-5 text-white" />
                                </div>
                              <div className="min-w-0 text-left">
                                <p className="font-bold truncate">
                                  Case from {format(parseISO(c.createdAt), 'MMM d, yyyy')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <Badge variant="outline" className="hidden sm:inline-flex">
                                {statusConfig[c.status]?.text}
                              </Badge>
                              <ChevronsUpDown className="h-4 w-4" />
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CaseDetails investigation={c} onImageClick={setSelectedImage} />
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12" />
              <h3 className="mt-4 text-lg font-semibold">No Cases Yet</h3>
              <p className="mt-1 text-sm">Start a new case to begin your health journey.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8" style={{ scrollBehavior: 'smooth' }}>
      {activeView === 'list' ? <HistoryPanel /> : <ChatInterface />}
      <Dialog open={!!selectedImage} onOpenChange={(isOpen) => !isOpen && setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Image Viewer</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center p-4">{selectedImage && <Image src={selectedImage} alt="Enlarged view" width={800} height={800} className="rounded-md max-h-[70vh] w-auto object-contain"/>}</div>
          <DialogFooter><Button variant="outline" onClick={() => setSelectedImage(null)}>Close</Button><Button onClick={handleShareImage}><Share2 className="mr-2"/> Share / Print</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
