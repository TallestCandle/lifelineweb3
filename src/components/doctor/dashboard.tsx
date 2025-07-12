
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, onSnapshot, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Loader2, User, Check, X, Pencil, ArrowRight, TestTube, Pill, ClipboardCheck, ClipboardList, Send, Camera, Video, FileText, Trash2, Share2, ChevronsUpDown, RefreshCw, Home, Phone, Sparkles, Repeat, HeartPulse, Beaker, BrainCircuit } from 'lucide-react';
import { formatDistanceToNow, parseISO, format, isAfter } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { type ChartConfig } from 'recharts';
import { performComprehensiveCaseReview, type ComprehensiveCaseReviewOutput } from '@/ai/flows/comprehensive-case-review-flow';
import { type ComprehensiveAnalysisOutput } from '@/ai/flows/comprehensive-analysis-flow';


type InvestigationStatus = 'pending_review' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected' | 'awaiting_follow_up_visit';

interface Medication {
    name: string;
    dosage: string;
}

interface Investigation {
  id: string;
  userId: string;
  userName: string;
  status: InvestigationStatus;
  createdAt: string;
  steps: InvestigationStep[];
  doctorPlan?: {
      preliminaryMedications: Medication[];
      suggestedLabTests: string[];
  };
  followUpRequest?: {
    note: string;
    suggestedLabTests: string[];
  };
  finalTreatmentPlan?: {
      medications: Medication[];
      lifestyleChanges: string[];
      followUp: string;
  };
  finalDiagnosis?: any;
  doctorNote?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  lastPatientReadTimestamp?: Date;
  lastDoctorReadTimestamp?: Date;
  lastMessageTimestamp?: Date;
}

interface InvestigationStep {
    type: 'initial_submission' | 'lab_result_submission';
    timestamp: string;
    userInput: any;
    aiAnalysis: any;
}

interface Patient {
    id: string;
    name: string;
    lastInteraction: string;
}

const UrgencyConfig: Record<string, { color: string; text: string }> = {
    'Low': { color: 'bg-blue-500', text: 'Low' },
    'Medium': { color: 'bg-yellow-500', text: 'Medium' },
    'High': { color: 'bg-orange-500', text: 'High' },
    'Critical': { color: 'bg-red-600', text: 'Critical' },
    'Mild': { color: 'bg-yellow-400', text: 'Mild' },
};

const vitalsChartConfig = {
  systolic: { label: "Systolic", color: "hsl(var(--chart-1))" },
  diastolic: { label: "Diastolic", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;


export function DoctorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const doctorName = user?.displayName || "Doctor";

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<Investigation | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // State for case review dialog
  const [editablePlan, setEditablePlan] = useState<{ preliminaryMedications: Medication[]; suggestedLabTests: string[]; } | null>(null);
  const [followUpTests, setFollowUpTests] = useState<string[]>([]);
  const [followUpNote, setFollowUpNote] = useState('');
  const [modifiedPlan, setModifiedPlan] = useState('');
  const [viewMode, setViewMode] = useState<'initial_review' | 'follow_up_request' | 'final_review'>('initial_review');
  const [isCompleting, setIsCompleting] = useState(false);
  const [doctorNote, setDoctorNote] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<ComprehensiveCaseReviewOutput | null>(null);

  const [analyticsPatient, setAnalyticsPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [strips, setStrips] = useState<any[]>([]);
  const [deepDives, setDeepDives] = useState<any[]>([]);
  
  // Fetch investigations
  useEffect(() => {
    setIsLoading(true);
    const q = query(
        collection(db, "investigations"), 
        orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            lastDoctorReadTimestamp: doc.data().lastDoctorReadTimestamp?.toDate(),
            lastMessageTimestamp: doc.data().lastMessageTimestamp?.toDate(),
        } as Investigation));
        setInvestigations(fetched);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching investigations: ", error);
        setIsLoading(false);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch investigation queue.' });
    });

    return () => unsubscribe();
  }, [toast]);

  // Derive patient list from investigations
  useEffect(() => {
    if (!user) return;
    const myReviewedCases = investigations.filter(inv => inv.reviewedByUid === user.uid);
    const patientMap = new Map<string, Patient>();
    myReviewedCases.forEach(investigation => {
        if (!patientMap.has(investigation.userId)) {
            patientMap.set(investigation.userId, {
                id: investigation.userId,
                name: investigation.userName,
                lastInteraction: investigation.createdAt
            });
        }
    });
    setMyPatients(Array.from(patientMap.values()));
  }, [investigations, user]);
  
  const investigationQueue = useMemo(() => investigations.filter(inv => inv.status === 'pending_review'), [investigations]);
  const patientUpdates = useMemo(() => investigations.filter(inv => inv.status === 'pending_final_review' && inv.reviewedByUid === user?.uid), [investigations, user]);


  const handleUpdateInvestigation = async (investigationId: string, status: InvestigationStatus, payload: object) => {
      const investigationRef = doc(db, "investigations", investigationId);
      try {
          const updateData = {
              status,
              reviewedAt: new Date().toISOString(),
              reviewedByUid: user?.uid,
              reviewedByName: user?.displayName,
              ...payload,
          };
          await updateDoc(investigationRef, updateData);
          setSelectedCase(null);
          toast({ title: 'Case Updated', description: `The investigation has been updated.` });
      } catch (error) {
        console.error("Error updating status:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update investigation status.' });
      }
  };
  
  const handleSendPlanToPatient = () => {
    if (!selectedCase || !editablePlan) return;
    
    const cleanedPlan = {
        suggestedLabTests: editablePlan.suggestedLabTests.filter(t => t.trim() !== ''),
        preliminaryMedications: editablePlan.preliminaryMedications.filter(m => m.name.trim() !== '' && m.dosage.trim() !== ''),
    };

    handleUpdateInvestigation(selectedCase.id, 'awaiting_lab_results', { doctorPlan: cleanedPlan });
  };
  
   const handleRequestFollowUp = () => {
        if (!selectedCase || followUpTests.length === 0 || !followUpNote.trim()) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please add at least one test and a reason for the follow-up request.' });
            return;
        }

        const followUpRequest = {
            note: followUpNote,
            suggestedLabTests: followUpTests.filter(t => t.trim() !== ''),
        };

        handleUpdateInvestigation(selectedCase.id, 'awaiting_follow_up_visit', { followUpRequest });
    };

  const handleCompleteCase = () => {
      if (!selectedCase || !doctorNote) {
          toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide a final diagnosis and treatment plan.' });
          return;
      }
      try {
          const finalPlan = JSON.parse(modifiedPlan);
          const payload = {
              finalDiagnosis: finalPlan.finalDiagnosis,
              finalTreatmentPlan: finalPlan.finalTreatmentPlan,
              doctorNote: `Final Diagnosis Summary: ${doctorNote}`,
          };
          handleUpdateInvestigation(selectedCase.id, 'completed', payload);
      } catch (e) {
          toast({
              variant: 'destructive', title: 'Invalid Plan Format', description: 'The plan has a syntax error.',
          });
      }
  };

  const handleCloseCase = () => {
    if (!selectedCase || !doctorNote) {
        toast({ variant: 'destructive', title: 'Missing Note', description: 'Please provide a closing note for the patient.' });
        return;
    }
    handleUpdateInvestigation(selectedCase.id, 'rejected', { doctorNote });
  };

  const openReviewDialog = async (investigation: Investigation) => {
    setSelectedCase(investigation);
    setViewMode('initial_review');
    const latestStep = investigation.steps[investigation.steps.length - 1];
    const planToModify = latestStep.aiAnalysis.suggestedNextSteps;
    
    if (latestStep.aiAnalysis.isFinalDiagnosisPossible) {
        const finalPlanSuggestion = {
            finalDiagnosis: latestStep.aiAnalysis.potentialConditions,
            finalTreatmentPlan: {
                medications: latestStep.aiAnalysis.suggestedNextSteps.preliminaryMedications,
                lifestyleChanges: [],
            }
        };
        setModifiedPlan(JSON.stringify(finalPlanSuggestion, null, 2));
    } else {
        setModifiedPlan('');
    }
    
    setEditablePlan({
        preliminaryMedications: planToModify?.preliminaryMedications || [],
        suggestedLabTests: planToModify?.suggestedLabTests || [],
    });

    setFollowUpTests(['']);
    setFollowUpNote('');
    setEvaluationResult(null);
    setIsCompleting(false);
    setDoctorNote('');

    // Mark as read
    const investigationDocRef = doc(db, 'investigations', investigation.id);
    await updateDoc(investigationDocRef, {
        lastDoctorReadTimestamp: serverTimestamp()
    });
  };

  const handlePlanChange = (index: number, field: 'name' | 'dosage', value: string) => {
      setEditablePlan(prev => {
          if (!prev) return null;
          const newMeds = [...prev.preliminaryMedications];
          if (newMeds[index]) {
              newMeds[index] = { ...newMeds[index], [field]: value };
          }
          return { ...prev, preliminaryMedications: newMeds };
      });
  };
  
    const handleFollowUpTestChange = (index: number, value: string) => {
        setFollowUpTests(prev => {
            const newTests = [...prev];
            newTests[index] = value;
            return newTests;
        });
    };

    const addPlanItem = (type: 'suggestedLabTests' | 'preliminaryMedications') => {
        setEditablePlan(prev => {
            if (!prev) return null;
            if (type === 'preliminaryMedications') {
                return { ...prev, preliminaryMedications: [...prev.preliminaryMedications, { name: '', dosage: '' }] };
            }
            return { ...prev, suggestedLabTests: [...prev.suggestedLabTests, ''] };
        });
    };

    const addFollowUpTest = () => {
        setFollowUpTests(prev => [...prev, '']);
    };


  const removePlanItem = (type: 'suggestedLabTests' | 'preliminaryMedications', index: number) => {
      setEditablePlan(prev => {
          if (!prev) return null;
          if (type === 'preliminaryMedications') {
              const meds = prev.preliminaryMedications.filter((_, i) => i !== index);
              return { ...prev, preliminaryMedications: meds };
          }
          const tests = prev.suggestedLabTests.filter((_, i) => i !== index);
          return { ...prev, suggestedLabTests: tests };
      });
  };
  
  const removeFollowUpTest = (index: number) => {
        setFollowUpTests(prev => prev.filter((_, i) => i !== index));
    };

  const handleEvaluateAll = async () => {
    if (!selectedCase) return;

    setIsEvaluating(true);
    setEvaluationResult(null);

    try {
      const result = await performComprehensiveCaseReview({ investigationId: selectedCase.id });
      setEvaluationResult(result);
      toast({ title: "Evaluation Complete", description: "AI has provided a final analysis." });
      
      if (result.isCaseResolvable) {
          const finalPlanSuggestion = {
            finalDiagnosis: result.finalDiagnosis,
            finalTreatmentPlan: result.suggestedTreatmentPlan,
          };
          setModifiedPlan(JSON.stringify(finalPlanSuggestion, null, 2));
          setDoctorNote(result.holisticSummary);
          setViewMode('final_review');
      }

    } catch (error) {
      console.error("Error during comprehensive evaluation:", error);
      toast({ variant: 'destructive', title: 'Evaluation Failed', description: 'Could not perform the final analysis.' });
    } finally {
      setIsEvaluating(false);
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

  const renderCaseCard = (c: Investigation) => {
    const latestStep = c.steps[c.steps.length-1];
    const urgency = latestStep.aiAnalysis.urgency || 'Medium';
    const hasUnread = c.lastMessageTimestamp && (!c.lastDoctorReadTimestamp || isAfter(c.lastMessageTimestamp, c.lastDoctorReadTimestamp));

    return (
        <div key={c.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
            <div className="mb-4 sm:mb-0">
            <div className="flex items-center gap-2">
                {hasUnread && <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>}
                <p className="font-bold text-lg">Case for: {c.userName || 'Anonymous User'}</p>
            </div>
            <p className="text-sm text-muted-foreground">
                Submitted {formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true })}
            </p>
            <div className="flex items-center gap-2 mt-2">
                <Badge className={cn("text-white", UrgencyConfig[urgency]?.color || "bg-gray-500")}>
                    Urgency: {urgency}
                </Badge>
            </div>
            </div>
            <Button onClick={() => openReviewDialog(c)}>Review Case <ArrowRight className="ml-2"/></Button>
        </div>
    );
  };

    const handleOpenAnalytics = (patient: Patient) => {
        setAnalyticsPatient(patient);
        const fetchData = async () => {
            const basePath = `users/${patient.id}`;
            const [vitalsSnap, stripsSnap, deepDivesSnap] = await Promise.all([
                getDocs(query(collection(db, `${basePath}/vitals`), orderBy('date', 'desc'), where('date', '!=', null))),
                getDocs(query(collection(db, `${basePath}/test_strips`), orderBy('date', 'desc'))),
                getDocs(query(collection(db, `${basePath}/deep_dives`), orderBy('timestamp', 'desc')))
            ]);
            setVitals(vitalsSnap.docs.map(d => ({...d.data(), date: format(parseISO(d.data().date), 'MMM d')})));
            setStrips(stripsSnap.docs.map(d => d.data()));
            setDeepDives(deepDivesSnap.docs.map(d => ({id: d.id, ...d.data()})));
        };
        fetchData();
    };


  const renderReviewDialog = () => {
    if (!selectedCase) return null;
    const latestStep = selectedCase.steps[selectedCase.steps.length - 1];
    
    const ActionButtons = () => {
        if (viewMode === 'final_review') {
            return (
                <>
                    <Button variant="ghost" onClick={() => setViewMode('initial_review')}>Cancel</Button>
                    <Button variant="secondary" onClick={handleCloseCase}>Close Case with Note</Button>
                    <Button onClick={handleCompleteCase}>Complete Investigation</Button>
                </>
            );
        }
        if (viewMode === 'follow_up_request') {
             return (
                <>
                    <Button variant="ghost" onClick={() => setViewMode('initial_review')}>Back</Button>
                    <Button onClick={handleRequestFollowUp}><Send className="mr-2"/>Request Follow-up</Button>
                </>
            );
        }
        
        const isInitialReview = selectedCase.status === 'pending_review';

        return (
            <div className="flex w-full justify-between items-center">
                 {isInitialReview ? <div/> : (
                    <Button variant="outline" onClick={handleEvaluateAll} disabled={isEvaluating}>
                        {isEvaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                        Evaluate All
                    </Button>
                )}
                <div className="flex gap-2">
                    <Button variant="destructive" onClick={() => setViewMode('final_review')}><X className="mr-2"/>Finalize</Button>
                    {!isInitialReview && <Button variant="secondary" onClick={() => setViewMode('follow_up_request')}><Repeat className="mr-2"/>Request More Tests</Button>}
                    {isInitialReview && <Button onClick={handleSendPlanToPatient}><Send className="mr-2"/>Send Initial Plan</Button>}
                </div>
            </div>
        )
    };

    return (
        <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Reviewing Case: {selectedCase.userName}</DialogTitle>
                    <DialogDescription>Submitted {formatDistanceToNow(parseISO(selectedCase.createdAt), { addSuffix: true })}. Urgency: {latestStep.aiAnalysis.urgency}</DialogDescription>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto p-4">
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><User/>Patient Submission History</h3>
                        <ScrollArea className="h-[calc(70vh-100px)] pr-4">
                            <div className="space-y-4">
                                {selectedCase.steps.map((step, index) => (
                                    <Card key={index}>
                                        <CardHeader>
                                            <CardTitle className="text-base">{step.type === 'initial_submission' ? 'Initial Submission' : 'Follow-up Submission'}</CardTitle>
                                            <CardDescription>{format(parseISO(step.timestamp), 'MMM d, yyyy, h:mm a')}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {step.type === 'initial_submission' && (
                                                <>
                                                    <Collapsible>
                                                        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm font-semibold hover:bg-secondary/50">
                                                            <span>Interview Transcript</span>
                                                            <ChevronsUpDown className="h-4 w-4" />
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent className="pt-2">
                                                            <p className="text-sm whitespace-pre-line rounded-md bg-background/50 p-2 text-muted-foreground">{step.userInput.chatTranscript}</p>
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                    
                                                    {step.userInput.imageDataUri && (
                                                        <div className="pt-2">
                                                          <p className="text-sm font-semibold">Submitted Image</p>
                                                          <button onClick={() => setSelectedImage(step.userInput.imageDataUri)} className="transition-transform hover:scale-105 mt-1">
                                                              <Image src={step.userInput.imageDataUri} alt="User submission" width={150} height={150} className="rounded-md border"/>
                                                          </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {step.type === 'lab_result_submission' && (
                                                <div className="space-y-4">
                                                    {step.userInput.nurseReport?.text && <p className="text-sm"><span className="font-semibold">Nurse Report:</span> {step.userInput.nurseReport.text}</p>}
                                                    
                                                    {step.userInput.labResults?.length > 0 && (
                                                        <div>
                                                            <p className="text-sm font-semibold">Submitted Lab Results</p>
                                                            <div className="grid grid-cols-2 gap-2 mt-1">
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
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 1.5L13.5 3.5L4.5 12.5L2.5 12.5L2.5 10.5L11.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9.5 3.5L11.5 5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 6.5L8.5 8.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 10.5L4.5 8.5" stroke="currentColor" strokeWidth="1.3"/><path d="M11.5 1.5L13.5 3.5" stroke="currentColor" strokeWidth="1.3"/></svg> AI's Analysis & Plan</h3>
                        
                        {isEvaluating && <div className="flex justify-center p-4"><Loader2 className="animate-spin" /> <p className="ml-2">Performing holistic analysis...</p></div>}
                        
                        {evaluationResult && (
                            <Card className="border-primary bg-primary/5">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2"><Sparkles className="text-primary"/> Comprehensive Evaluation</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div>
                                        <h4 className="font-bold">Holistic Summary</h4>
                                        <p className="text-muted-foreground">{evaluationResult.holisticSummary}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Suggested Final Diagnosis</h4>
                                        <ul className="list-disc list-inside space-y-1">
                                            {evaluationResult.finalDiagnosis.map((d: any, i:number) => (
                                                <li key={i}><strong>{d.condition}</strong> ({d.probability}%): {d.reasoning}</li>
                                            ))}
                                        </ul>
                                    </div>
                                     <div>
                                        <h4 className="font-bold">Suggested Treatment Plan</h4>
                                        <div className="text-muted-foreground space-y-2 mt-1">
                                            {evaluationResult.suggestedTreatmentPlan.medications.length > 0 && (
                                                <div>
                                                    <p className="font-semibold text-foreground/80">Medications:</p>
                                                    <ul className="list-disc list-inside pl-4">
                                                        {evaluationResult.suggestedTreatmentPlan.medications.map((m: Medication, i: number) => <li key={i}>{m.name} ({m.dosage})</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {evaluationResult.suggestedTreatmentPlan.lifestyleChanges.length > 0 && (
                                                 <div>
                                                    <p className="font-semibold text-foreground/80">Lifestyle Changes:</p>
                                                    <ul className="list-disc list-inside pl-4">
                                                        {evaluationResult.suggestedTreatmentPlan.lifestyleChanges.map((c: string, i: number) => <li key={i}>{c}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            <p><span className="font-semibold text-foreground/80">Follow-up:</span> {evaluationResult.suggestedTreatmentPlan.followUp}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Alert variant={latestStep.aiAnalysis.urgency === 'Critical' ? 'destructive' : 'default'}>
                            <AlertTitle>AI Summary & Justification</AlertTitle>
                            <AlertDescription>{latestStep.aiAnalysis.analysisSummary || latestStep.aiAnalysis.refinedAnalysis} <br/><br/> <strong>Justification:</strong> {latestStep.aiAnalysis.justification}</AlertDescription>
                        </Alert>
                        
                        <Card>
                            <CardHeader><CardTitle className="text-base">Potential Conditions</CardTitle></CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    {(latestStep.aiAnalysis.potentialConditions).map((p:any) => (
                                        <li key={p.condition}><strong>{p.condition}</strong> ({p.probability}%): {p.reasoning}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                        
                        {viewMode === 'final_review' && (
                             <Card><CardHeader><CardTitle className="text-base m-0">Final Plan / Note</CardTitle></CardHeader><CardContent className="space-y-4">
                                <div><Label className="font-bold text-sm">Final Plan (JSON format)</Label><Textarea value={modifiedPlan} onChange={(e) => setModifiedPlan(e.target.value)} className="min-h-[150px] font-mono text-xs"/></div>
                                <div><Label className="font-bold text-sm">Note for Patient</Label><Textarea value={doctorNote} onChange={(e) => setDoctorNote(e.target.value)} placeholder="e.g., Your results are normal. Please continue monitoring your symptoms."/></div>
                             </CardContent></Card>
                        )}

                        {viewMode === 'initial_review' && editablePlan && (
                            <Card>
                                <CardHeader><CardTitle className="text-base m-0">Initial Plan</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label className="font-bold">Preliminary Medications</Label>
                                        <div className="space-y-2 mt-2">
                                            {editablePlan.preliminaryMedications.map((med, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <Input value={med.name} placeholder="Medication Name" onChange={(e) => handlePlanChange(index, 'name', e.target.value)} />
                                                    <Input value={med.dosage} placeholder="Dosage" onChange={(e) => handlePlanChange(index, 'dosage', e.target.value)} />
                                                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removePlanItem('preliminaryMedications', index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() => addPlanItem('preliminaryMedications')}>Add Medication</Button>
                                    </div>
                                    <div>
                                        <Label className="font-bold">Suggested Lab Tests</Label>
                                        <div className="space-y-2 mt-2">
                                            {editablePlan.suggestedLabTests.map((test, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <Input value={test} placeholder="e.g., Complete Blood Count" onChange={(e) => setEditablePlan(prev => prev ? { ...prev, suggestedLabTests: prev.suggestedLabTests.map((t, i) => i === index ? e.target.value : t) } : null)} />
                                                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removePlanItem('suggestedLabTests', index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() => addPlanItem('suggestedLabTests')}>Add Test</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        
                        {viewMode === 'follow_up_request' && (
                             <Card><CardHeader><CardTitle className="text-base m-0">Request Follow-up Tests</CardTitle></CardHeader><CardContent className="space-y-4">
                                <div>
                                    <Label className="font-bold">Reason for Request</Label>
                                    <Textarea value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} placeholder="e.g., Based on the high glucose levels, I want to order a follow-up HbA1c test for a better long-term view."/>
                                </div>
                                <div>
                                    <Label className="font-bold">Additional Lab Tests</Label>
                                    <div className="space-y-2 mt-2">
                                        {followUpTests.map((test, index) => (
                                            <div key={index} className="flex items-center gap-2"><Input value={test} placeholder="e.g., HbA1c Test" onChange={(e) => handleFollowUpTestChange(index, e.target.value)} /><Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeFollowUpTest(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                                        ))}
                                    </div>
                                    <Button variant="outline" size="sm" className="mt-2" onClick={addFollowUpTest}>Add Test</Button>
                                </div>
                            </CardContent></Card>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <ActionButtons />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  }

  const renderAnalyticsDialog = () => {
    if (!analyticsPatient) return null;

    const testStripHistory = strips.map(strip => {
        const data = { ...strip };
        delete data.date;
        return {
            date: format(parseISO(strip.date), 'MMM d, yyyy'),
            results: Object.entries(data).map(([key, value]) => ({ key, value }))
        };
    });

    return (
        <Dialog open={!!analyticsPatient} onOpenChange={() => setAnalyticsPatient(null)}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Patient Analytics: {analyticsPatient.name}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto p-1">
                    <Tabs defaultValue="vitals">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="vitals"><HeartPulse className="mr-2"/>Vitals</TabsTrigger>
                            <TabsTrigger value="strips"><Beaker className="mr-2"/>Test Strips</TabsTrigger>
                            <TabsTrigger value="analyses"><BrainCircuit className="mr-2"/>Deep Dives</TabsTrigger>
                        </TabsList>
                        <TabsContent value="vitals" className="mt-4">
                             <Card>
                                <CardHeader>
                                    <CardTitle>Blood Pressure History (Last 30 entries)</CardTitle>
                                    <CardDescription>Visual trend of systolic and diastolic pressure.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ChartContainer config={vitalsChartConfig} className="w-full h-[300px]">
                                        <BarChart accessibilityLayer data={vitals.slice(0, 30).reverse()}>
                                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                            <YAxis />
                                            <ChartTooltip content={<ChartTooltipContent />} />
                                            <Bar dataKey="systolic" fill="var(--color-systolic)" radius={4} />
                                            <Bar dataKey="diastolic" fill="var(--color-diastolic)" radius={4} />
                                        </BarChart>
                                    </ChartContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="strips" className="mt-4">
                           <Card>
                                <CardHeader>
                                    <CardTitle>Urine Test Strip History</CardTitle>
                                    <CardDescription>Chronological log of submitted test strip results.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-[400px]">
                                        <div className="space-y-4">
                                            {testStripHistory.length > 0 ? testStripHistory.map((day, index) => (
                                                <div key={index}>
                                                    <p className="font-bold text-sm mb-2">{day.date}</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                                        {day.results.map(res => (
                                                            <div key={res.key} className="flex justify-between p-2 bg-secondary/50 rounded-md">
                                                                <span className="capitalize text-muted-foreground">{res.key}</span>
                                                                <span className="font-semibold">{String(res.value)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )) : <p className="text-center text-muted-foreground pt-8">No test strip data found.</p>}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="analyses" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Deep Dive Analysis History</CardTitle>
                                    <CardDescription>All AI-generated deep dive reports for this patient.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                     <ScrollArea className="h-[400px]">
                                        <Accordion type="single" collapsible className="w-full">
                                            {deepDives.map((item: { id: string; timestamp: string; analysisResult: ComprehensiveAnalysisOutput }) => (
                                                <AccordionItem value={item.id} key={item.id}>
                                                    <AccordionTrigger>{format(parseISO(item.timestamp), 'MMM d, yyyy, h:mm a')}</AccordionTrigger>
                                                    <AccordionContent className="space-y-3">
                                                        <div>
                                                            <h4 className="font-semibold">Overall Assessment</h4>
                                                            <p className="text-sm text-muted-foreground">{item.analysisResult.overallAssessment}</p>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold">Key Observations</h4>
                                                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                                                                {item.analysisResult.keyObservations.map((obs: string, i: number) => (
                                                                    <li key={i}>{obs}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold">Deep Insights</h4>
                                                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                                                                {item.analysisResult.deepInsights.map((insight, i: number) => (
                                                                    <li key={i}>{insight.insight}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                            {deepDives.length === 0 && <p className="text-center text-muted-foreground pt-8">No deep dive data found.</p>}
                                        </Accordion>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground/90">Doctor's Dashboard</h1>
        <p className="text-lg text-muted-foreground">Welcome, {doctorName}.</p>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Case Management</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="queue">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="queue">Review Queue ({investigationQueue.length})</TabsTrigger>
                        <TabsTrigger value="updates">Patient Updates ({patientUpdates.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="queue">
                        {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                            <div className="space-y-4 pt-4">
                            {investigationQueue.length > 0 ? 
                                investigationQueue.map(c => renderCaseCard(c)) : 
                                <div className="text-center text-muted-foreground py-12">
                                    <User className="mx-auto w-12 h-12 text-gray-400" />
                                    <h3 className="mt-2 text-lg font-semibold">All Clear!</h3>
                                    <p>There are no new cases waiting for your review.</p>
                                </div>
                            }
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="updates">
                        {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                            <div className="space-y-4 pt-4">
                            {patientUpdates.length > 0 ? 
                                patientUpdates.map(c => renderCaseCard(c)) : 
                                <div className="text-center text-muted-foreground py-12">
                                    <User className="mx-auto w-12 h-12 text-gray-400" />
                                    <h3 className="mt-2 text-lg font-semibold">No Patient Updates</h3>
                                    <p>New results from patients will appear here.</p>
                                </div>
                            }
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>My Patients ({myPatients.length})</CardTitle>
              <CardDescription>Select a patient to view their analytics.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                {myPatients.length > 0 ? myPatients.map(patient => (
                    <div key={patient.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                        <div>
                            <p className="font-bold">{patient.name}</p>
                            <p className="text-sm text-muted-foreground">Last interaction: {formatDistanceToNow(parseISO(patient.lastInteraction), { addSuffix: true })}</p>
                        </div>
                        <div className="flex gap-2">
                             <Button size="sm" variant="outline" onClick={() => handleOpenAnalytics(patient)}>Analytics</Button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center text-muted-foreground py-12">
                        <User className="mx-auto w-12 h-12 text-gray-400" />
                        <h3 className="mt-2 text-lg font-semibold">No Patients Yet</h3>
                        <p>Once you review a case from the queue, the patient will appear here.</p>
                    </div>
                )}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {renderReviewDialog()}
      
      {renderAnalyticsDialog()}
      
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
