
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Loader2, LineChart, TableIcon, BrainCircuit } from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { Bot, User, Check, X, Pencil, ArrowRight, TestTube, Pill, Salad, ClipboardCheck, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart as RechartsLineChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


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
  doctorNote?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
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
};

const bpChartConfig = {
  systolic: { label: "Systolic", color: "hsl(var(--chart-1))" },
  diastolic: { label: "Diastolic", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const singleMetricChartConfig = (label: string, color: string) => ({
    value: { label, color },
}) satisfies ChartConfig;

function PatientAnalyticsView({ userId, userName }: { userId: string, userName: string }) {
    const [loading, setLoading] = useState(true);
    const [vitals, setVitals] = useState<any[]>([]);
    const [strips, setStrips] = useState<any[]>([]);
    const [analyses, setAnalyses] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const basePath = `users/${userId}`;
            const [vitalsSnap, stripsSnap, analysesSnap] = await Promise.all([
                getDocs(query(collection(db, `${basePath}/vitals`), orderBy('date', 'desc'))),
                getDocs(query(collection(db, `${basePath}/test_strips`), orderBy('date', 'desc'))),
                getDocs(query(collection(db, `${basePath}/health_analyses`), orderBy('timestamp', 'desc'))),
            ]);
            setVitals(vitalsSnap.docs.map(d => ({...d.data(), id: d.id})));
            setStrips(stripsSnap.docs.map(d => ({...d.data(), id: d.id})));
            setAnalyses(analysesSnap.docs.map(d => ({...d.data(), id: d.id})));
            setLoading(false);
        };
        fetchData();
    }, [userId]);

    const chartData = useMemo(() => {
        return vitals
          .map(entry => ({
            ...entry,
            dateObj: parseISO(entry.date),
          }))
          .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
          .map(entry => ({
            ...entry,
            date: format(entry.dateObj, 'MMM d'),
            systolic: entry.systolic ? Number(entry.systolic) : null,
            diastolic: entry.diastolic ? Number(entry.diastolic) : null,
            oxygenLevel: entry.oxygenLevel ? Number(entry.oxygenLevel) : null,
            temperature: entry.temperature ? Number(entry.temperature) : null,
            bloodSugar: entry.bloodSugar ? Number(entry.bloodSugar) : null,
            weight: entry.weight ? Number(entry.weight) : null,
          }));
    }, [vitals]);

    if(loading) return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    
    return (
        <ScrollArea className="h-full pr-6">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-2xl">Health Analytics: {userName}</DialogTitle>
                <DialogDescription>A comprehensive overview of the patient's recorded health history.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pb-6">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><LineChart/> Vitals History</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                         {chartData.length < 2 ? <p className="text-muted-foreground">Not enough data to display charts.</p> : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <ChartContainer config={bpChartConfig} className="min-h-[200px] w-full">
                                    <RechartsLineChart data={chartData} margin={{ left: 0, right: 10 }}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                        <YAxis domain={['dataMin - 10', 'dataMax + 10']} tickLine={false} axisLine={false}/>
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Line dataKey="systolic" type="monotone" stroke="var(--color-systolic)" strokeWidth={2} dot={false} />
                                        <Line dataKey="diastolic" type="monotone" stroke="var(--color-diastolic)" strokeWidth={2} dot={false} />
                                    </RechartsLineChart>
                                </ChartContainer>
                                <ChartContainer config={singleMetricChartConfig("O2%", "hsl(var(--chart-3))")} className="min-h-[200px] w-full">
                                    <RechartsLineChart data={chartData.filter(d => d.oxygenLevel)} margin={{ left: 0, right: 10 }}>
                                         <CartesianGrid vertical={false} />
                                         <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                         <YAxis domain={['dataMin - 2', 'dataMax + 2']} tickLine={false} axisLine={false}/>
                                         <Tooltip content={<ChartTooltipContent />} />
                                         <Line dataKey="oxygenLevel" name="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={false} />
                                    </RechartsLineChart>
                                </ChartContainer>
                            </div>
                         )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TableIcon/> Test Strip History</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Marker</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {strips.length > 0 ? strips.slice(0, 5).map((s: any) => (
                                    <TableRow key={s.id}>
                                        <TableCell>{format(parseISO(s.date), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{s.marker}</TableCell>
                                        <TableCell><Badge variant="outline">{s.level}</Badge></TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={3} className="text-center">No strip results.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BrainCircuit/> AI Analysis History</CardTitle></CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible>
                            {analyses.length > 0 ? analyses.slice(0, 5).map((a: any) => (
                                <AccordionItem value={a.id} key={a.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <span>{format(parseISO(a.timestamp), 'MMM d, yyyy, h:mm a')}</span>
                                            <Badge variant="outline">{a.analysisResult.urgency}</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p><strong>Summary:</strong> {a.analysisResult.summary}</p>
                                        <p><strong>Advice:</strong> {a.analysisResult.advice}</p>
                                    </AccordionContent>
                                </AccordionItem>
                            )) : <p className="text-muted-foreground text-center py-4">No past analyses.</p>}
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
        </ScrollArea>
    );
}


export function DoctorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const doctorName = user?.displayName || "Doctor";

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<Investigation | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{ userId: string; userName: string; } | null>(null);

  const [isModifying, setIsModifying] = useState(false);
  const [modifiedPlan, setModifiedPlan] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [doctorNote, setDoctorNote] = useState('');
  
  // Fetch investigation queue
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
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch investigation queue.' });
    });

    return () => unsubscribe();
  }, [toast]);

  // Fetch 'My Patients'
   useEffect(() => {
    if (!user) return;
    const q = query(
        collection(db, "investigations"),
        where("reviewedByUid", "==", user.uid),
        orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const patientMap = new Map<string, Patient>();
        snapshot.docs.forEach(doc => {
            const investigation = doc.data() as Investigation;
            if (!patientMap.has(investigation.userId)) {
                patientMap.set(investigation.userId, {
                    id: investigation.userId,
                    name: investigation.userName,
                    lastInteraction: investigation.createdAt
                });
            }
        });
        setMyPatients(Array.from(patientMap.values()));
    });
    return () => unsubscribe();
  }, [user]);


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
          setInvestigations(prev => prev.filter(c => c.id !== investigationId));
          setSelectedCase(null);
          toast({ title: 'Case Updated', description: `The investigation has been updated to: ${status}.` });
      } catch (error) {
        console.error("Error updating status:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update investigation status.' });
      }
  };

   const handleApprovePlan = () => {
        if (!selectedCase) return;
        const aiPlan = selectedCase.steps[selectedCase.steps.length - 1].aiAnalysis.suggestedNextSteps;
        let planToSubmit;

        if (isModifying) {
            try {
                planToSubmit = JSON.parse(modifiedPlan);
            } catch (e) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid Plan Format',
                    description: 'The modified plan has a syntax error. Please correct it.',
                });
                return;
            }
        } else {
            planToSubmit = aiPlan;
        }

        handleUpdateInvestigation(selectedCase.id, 'awaiting_lab_results', { doctorPlan: planToSubmit });
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

  const openReviewDialog = (investigation: Investigation) => {
    setSelectedCase(investigation);
    const latestStep = investigation.steps[investigation.steps.length - 1];
    let planToModify = latestStep.aiAnalysis.suggestedNextSteps;
    
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
        setModifiedPlan(JSON.stringify(planToModify, null, 2));
    }

    setIsModifying(false);
    setIsCompleting(false);
    setDoctorNote('');
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
    const isFinalStepSuggested = latestStep.aiAnalysis.isFinalDiagnosisPossible;

    const ActionButtons = () => {
        if (isCompleting) {
            return (
                <>
                    <Button variant="ghost" onClick={() => setIsCompleting(false)}>Cancel</Button>
                    <Button variant="secondary" onClick={handleCloseCase}>Close Case with Note</Button>
                    <Button onClick={handleCompleteCase}>Complete Investigation</Button>
                </>
            );
        }
        return (
            <>
                <Button variant="destructive" onClick={() => { setIsCompleting(true); setDoctorNote('Investigation closed.'); }}><X className="mr-2"/>Close/Complete</Button>
                <Button onClick={handleApprovePlan}><Check className="mr-2"/>Approve & Request Tests</Button>
            </>
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
                    {latestStep.type === 'lab_result_submission' && latestStep.userInput.labResults && (
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
                    {isFinalStepSuggested && !isCompleting && (
                         <Alert variant="default" className="border-primary">
                            <ClipboardCheck className="h-4 w-4" />
                            <AlertTitle>Ready for Final Diagnosis</AlertTitle>
                            <AlertDescription>The AI believes enough data exists to complete this investigation. You can modify the suggested final plan below and click "Close/Complete".</AlertDescription>
                        </Alert>
                    )}
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
                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle className="text-base m-0">{isCompleting ? 'Final Plan / Note' : 'Suggested Next Steps'}</CardTitle>
                             {!isCompleting && <Button variant="ghost" size="sm" onClick={() => setIsModifying(!isModifying)}><Pencil className="mr-2"/>{isModifying ? 'View Original' : 'Modify Plan'}</Button>}
                        </CardHeader>
                        <CardContent>
                            {isModifying && !isCompleting ? (
                                <div>
                                    <Textarea value={modifiedPlan} onChange={(e) => setModifiedPlan(e.target.value)} className="min-h-[200px] font-mono text-xs"/>
                                </div>
                            ) : isCompleting ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="font-bold text-sm">Final Plan (JSON format)</label>
                                        <Textarea value={modifiedPlan} onChange={(e) => setModifiedPlan(e.target.value)} className="min-h-[150px] font-mono text-xs"/>
                                    </div>
                                    <div>
                                        <label className="font-bold text-sm">Note for Patient</label>
                                        <Textarea value={doctorNote} onChange={(e) => setDoctorNote(e.target.value)} placeholder="e.g., Your results are normal. Please continue monitoring your symptoms."/>
                                    </div>
                                </div>
                            ) : (
                                renderPlan(latestStep.aiAnalysis.suggestedNextSteps, false)
                            )}
                        </CardContent>
                    </Card>
                </div>
                </div>
                <DialogFooter>
                    <ActionButtons />
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

       <Tabs defaultValue="queue">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="queue">Investigation Queue ({investigations.length})</TabsTrigger>
          <TabsTrigger value="patients">My Patients ({myPatients.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Investigation Queue</CardTitle>
              <CardDescription>AI-assisted investigations awaiting your professional review and action.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                    <div className="space-y-4">
                    {investigations.length > 0 ? 
                        investigations.map(renderCaseCard) : 
                        <div className="text-center text-muted-foreground py-12">
                            <MessageSquare className="mx-auto w-12 h-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-semibold">All Clear!</h3>
                            <p>There are no investigations waiting for your review.</p>
                        </div>
                    }
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="patients">
          <Card>
            <CardHeader>
              <CardTitle>My Patients</CardTitle>
              <CardDescription>Select a patient to view their detailed health analytics.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                {myPatients.length > 0 ? myPatients.map(patient => (
                    <button key={patient.id} onClick={() => setSelectedPatient({userId: patient.id, userName: patient.name})} className="w-full text-left flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                        <div>
                            <p className="font-bold">{patient.name}</p>
                            <p className="text-sm text-muted-foreground">Last interaction: {formatDistanceToNow(parseISO(patient.lastInteraction), { addSuffix: true })}</p>
                        </div>
                        <ArrowRight/>
                    </button>
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
        </TabsContent>
      </Tabs>
      
      {renderReviewDialog()}
      
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          {selectedPatient && <PatientAnalyticsView userId={selectedPatient.userId} userName={selectedPatient.userName} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
