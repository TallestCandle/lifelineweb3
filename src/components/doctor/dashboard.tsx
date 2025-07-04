
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Bot, User, Check, X, Pencil, ArrowRight, TestTube, Pill, Salad } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


type InvestigationStatus = 'pending_review' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected';

interface Investigation {
  id: string;
  userId: string;
  userName: string;
  status: InvestigationStatus;
  createdAt: string;
  steps: InvestigationStep[];
  doctorPlan?: {
      preliminaryMedications: string[];
      suggestedLabTests: string[];
  };
  finalTreatmentPlan?: any;
  finalDiagnosis?: any;
}

interface InvestigationStep {
    type: 'initial_submission' | 'lab_result_submission';
    timestamp: string;
    userInput: any;
    aiAnalysis: any;
}


const UrgencyConfig: Record<string, { color: string; text: string }> = {
    'Low': { color: 'bg-blue-500', text: 'Low' },
    'Medium': { color: 'bg-yellow-500', text: 'Medium' },
    'High': { color: 'bg-orange-500', text: 'High' },
    'Critical': { color: 'bg-red-600', text: 'Critical' },
};

export function DoctorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const doctorName = user?.displayName || user?.email?.split('@')[0] || "Doctor";

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<Investigation | null>(null);
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedPlan, setModifiedPlan] = useState('');
  
  useEffect(() => {
    setIsLoading(true);
    const q = query(
        collection(db, "investigations"), 
        where("status", "in", ["pending_review", "pending_final_review"]), 
        orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation));
        setInvestigations(fetched);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching investigations: ", error);
        setIsLoading(false);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch investigations.' });
    });

    return () => unsubscribe();
  }, [toast]);

  const handleApprovePlan = () => {
    if (!selectedCase) return;

    const isFinalReview = selectedCase.status === 'pending_final_review';
    const newStatus = isFinalReview ? 'completed' : 'awaiting_lab_results';
    const latestStep = selectedCase.steps[selectedCase.steps.length - 1];
    
    let planToSubmit;

    if (isModifying) {
        try {
            planToSubmit = JSON.parse(modifiedPlan);
        } catch (e) {
            console.error("JSON parsing error:", e);
            toast({
                variant: 'destructive',
                title: 'Invalid Plan Format',
                description: 'The modified plan has a syntax error. Please correct it or approve the original plan without modification.',
            });
            return;
        }
    } else {
        planToSubmit = isFinalReview 
            ? latestStep.aiAnalysis.finalTreatmentPlan 
            : latestStep.aiAnalysis.suggestedNextSteps;
    }
    
    const finalDiagnosisToSubmit = isFinalReview ? latestStep.aiAnalysis.finalDiagnosis : undefined;
    handleUpdateStatus(selectedCase.id, newStatus, planToSubmit, finalDiagnosisToSubmit);
  };

  const handleUpdateStatus = async (investigationId: string, status: InvestigationStatus, plan?: any, finalDiagnosis?: any) => {
    const investigationRef = doc(db, "investigations", investigationId);
    try {
      const updateData: any = { 
          status, 
          reviewedAt: new Date().toISOString(),
          reviewedBy: user?.uid,
      };

      if (status === 'awaiting_lab_results' && plan) {
          updateData.doctorPlan = plan;
      } else if (status === 'completed' && plan) {
          updateData.finalTreatmentPlan = plan;
          if (finalDiagnosis) {
            updateData.finalDiagnosis = finalDiagnosis;
          }
      }

      await updateDoc(investigationRef, updateData);

      setInvestigations(prev => prev.filter(c => c.id !== investigationId));
      setSelectedCase(null);
      setIsModifying(false);
      toast({ title: 'Case Updated', description: `The investigation has been updated.` });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update investigation status.' });
    }
  };

  const openReviewDialog = (investigation: Investigation) => {
    setSelectedCase(investigation);
    const latestStep = investigation.steps[investigation.steps.length - 1];
    let planToModify;
    if (investigation.status === 'pending_review') {
        planToModify = latestStep.aiAnalysis.suggestedNextSteps;
    } else { // pending_final_review
        planToModify = latestStep.aiAnalysis.finalTreatmentPlan;
    }
    setModifiedPlan(JSON.stringify(planToModify, null, 2));
    setIsModifying(false);
  };

  const renderCaseCard = (c: Investigation) => {
    const latestStep = c.steps[c.steps.length-1];
    const urgency = latestStep.aiAnalysis.urgency || 'Medium';
    return (
        <div key={c.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
            <div className="mb-4 sm:mb-0">
            <p className="font-bold text-lg">Case for: {c.userName || 'Anonymous User'}</p>
            <p className="text-sm text-muted-foreground">
                Submitted {formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true })}
            </p>
            <Badge className={cn("mt-2 text-white", UrgencyConfig[urgency]?.color || "bg-gray-500")}>
                Urgency: {urgency}
            </Badge>
            </div>
            <Button onClick={() => openReviewDialog(c)}>Review Case <ArrowRight className="ml-2"/></Button>
        </div>
    );
  };

  const renderPlan = (plan: any, isFinal: boolean) => {
    if (!plan) return <p className="text-sm text-muted-foreground">No plan details available.</p>;

    const fields = isFinal 
        ? { meds: 'medications', lifestyle: 'lifestyleChanges' }
        : { meds: 'preliminaryMedications', tests: 'suggestedLabTests' };

    const medications = plan[fields.meds] || [];
    const labTests = plan[fields.tests] || [];
    const lifestyleChanges = plan[fields.lifestyle] || [];
    
    const hasContent = medications.length > 0 || labTests.length > 0 || lifestyleChanges.length > 0;

    if (!hasContent) {
        return <p className="text-sm text-muted-foreground">AI did not suggest specific items for this plan.</p>;
    }

    return (
        <div className="space-y-4 text-sm">
            {medications.length > 0 && (
                <div>
                    <h4 className="font-bold flex items-center gap-2"><Pill size={16}/> {isFinal ? 'Medications' : 'Preliminary Medications'}</h4>
                    <ul className="list-disc list-inside pl-4 text-muted-foreground">
                        {medications.map((med: string, i: number) => <li key={i}>{med}</li>)}
                    </ul>
                </div>
            )}
            {labTests.length > 0 && (
                 <div>
                    <h4 className="font-bold flex items-center gap-2"><TestTube size={16}/> Suggested Lab Tests</h4>
                    <ul className="list-disc list-inside pl-4 text-muted-foreground">
                        {labTests.map((test: string, i: number) => <li key={i}>{test}</li>)}
                    </ul>
                </div>
            )}
            {lifestyleChanges.length > 0 && (
                 <div>
                    <h4 className="font-bold flex items-center gap-2"><Salad size={16}/> Lifestyle Changes</h4>
                    <ul className="list-disc list-inside pl-4 text-muted-foreground">
                        {lifestyleChanges.map((change: string, i: number) => <li key={i}>{change}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
  };


  const renderReviewDialog = () => {
    if (!selectedCase) return null;
    const latestStep = selectedCase.steps[selectedCase.steps.length - 1];
    const initialStep = selectedCase.steps[0];
    const isFinalReview = selectedCase.status === 'pending_final_review';

    return (
        <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{isFinalReview ? "Final Review" : "Initial Review"}: {selectedCase.userName}</DialogTitle>
                    <DialogDescription>Submitted {formatDistanceToNow(parseISO(selectedCase.createdAt), { addSuffix: true })}. Urgency: {latestStep.aiAnalysis.urgency}</DialogDescription>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto p-4">
                <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><User/>Patient's Submission</h3>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Interview Transcript</CardTitle></CardHeader>
                        <CardContent>
                            <ScrollArea className="h-40">
                                <p className="text-sm whitespace-pre-line">{initialStep.userInput.chatTranscript}</p>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    {initialStep.userInput.imageDataUri && (
                        <Card>
                        <CardHeader><CardTitle className="text-base">Initial Image</CardTitle></CardHeader>
                        <CardContent>
                            <Image src={initialStep.userInput.imageDataUri} alt="User submission" width={200} height={200} className="rounded-md border"/>
                        </CardContent>
                        </Card>
                    )}
                    {isFinalReview && latestStep.userInput.labResults && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Submitted Lab Results</CardTitle></CardHeader>
                            <CardContent>
                                <ScrollArea className="h-64 space-y-2">
                                    {latestStep.userInput.labResults.map((res: any, index: number) => (
                                        <div key={index}>
                                            <p className="font-semibold">{res.testName}</p>
                                            <Image src={res.imageDataUri} alt={res.testName} width={200} height={200} className="rounded-md border mt-1"/>
                                        </div>
                                    ))}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Bot/>AI's Analysis</h3>
                    <Alert variant={latestStep.aiAnalysis.urgency === 'Critical' ? 'destructive' : 'default'}>
                        <AlertTitle>AI Summary & Justification</AlertTitle>
                        <AlertDescription>{latestStep.aiAnalysis.analysisSummary || latestStep.aiAnalysis.refinedAnalysis} <br/><br/> <strong>Justification:</strong> {latestStep.aiAnalysis.justification}</AlertDescription>
                    </Alert>
                    <Card>
                        <CardHeader><CardTitle className="text-base">{isFinalReview ? 'Final Diagnosis' : 'Potential Conditions'}</CardTitle></CardHeader>
                        <CardContent>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                {(latestStep.aiAnalysis.potentialConditions || latestStep.aiAnalysis.finalDiagnosis).map((p:any) => (
                                    <li key={p.condition}><strong>{p.condition}</strong> ({p.probability}%): {p.reasoning}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                    <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-base m-0">{isFinalReview ? "Final Treatment Plan" : "Suggested Next Steps"}</CardTitle>
                        {!isModifying && <Button variant="ghost" size="sm" onClick={() => setIsModifying(true)}><Pencil className="mr-2"/>Modify</Button>}
                    </CardHeader>
                    <CardContent>
                        {isModifying ? (
                        <Textarea value={modifiedPlan} onChange={(e) => setModifiedPlan(e.target.value)} className="min-h-[200px] font-mono text-xs"/>
                        ) : (
                            renderPlan(isFinalReview ? latestStep.aiAnalysis.finalTreatmentPlan : latestStep.aiAnalysis.suggestedNextSteps, isFinalReview)
                        )}
                    </CardContent>
                    </Card>
                </div>
                </div>
                <DialogFooter>
                <Button variant="destructive" onClick={() => handleUpdateStatus(selectedCase.id, 'rejected')}><X className="mr-2"/>Reject & Close</Button>
                <Button onClick={handleApprovePlan}>
                    <Check className="mr-2"/>Approve Plan
                </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground/90">Doctor's Dashboard</h1>
        <p className="text-lg text-muted-foreground">Welcome, {doctorName}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Investigation Queue</CardTitle>
          <CardDescription>AI-assisted investigations awaiting your professional review and action.</CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="pending_review">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending_review">
                        Initial Review ({investigations.filter(c => c.status === 'pending_review').length})
                    </TabsTrigger>
                    <TabsTrigger value="pending_final_review">
                        Final Review ({investigations.filter(c => c.status === 'pending_final_review').length})
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="pending_review" className="pt-4">
                    {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                        <div className="space-y-4">
                        {investigations.filter(c => c.status === 'pending_review').length > 0 ? 
                            investigations.filter(c => c.status === 'pending_review').map(renderCaseCard) : 
                            <p className="text-center text-muted-foreground py-12">No new investigations to review.</p>
                        }
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="pending_final_review" className="pt-4">
                    {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                        <div className="space-y-4">
                        {investigations.filter(c => c.status === 'pending_final_review').length > 0 ? 
                            investigations.filter(c => c.status === 'pending_final_review').map(renderCaseCard) : 
                            <p className="text-center text-muted-foreground py-12">No cases awaiting final review.</p>
                        }
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      
      {renderReviewDialog()}

    </div>
  );
}
