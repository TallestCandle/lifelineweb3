"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Loader2, LineChart, TableIcon, BrainCircuit, Bot, User, Check, X, Pencil, ArrowRight, TestTube, Pill, Salad, ClipboardCheck, MessageSquare, Send, Camera, Video, FileText, Trash2, Share2, ChevronsUpDown } from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart as RechartsLineChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
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


type InvestigationStatus = 'pending_review' | 'awaiting_nurse_visit' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected';
type RequiredFeedback = 'pictures' | 'videos' | 'text';

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
      nurseNote?: string;
      requiredFeedback?: RequiredFeedback[];
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

function PatientAnalyticsView({ userId }: { userId: string }) {
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
            oxygenSaturation: entry.oxygenSaturation ? Number(entry.oxygenSaturation) : null,
            temperature: entry.temperature ? Number(entry.temperature) : null,
            bloodSugar: entry.bloodSugar ? Number(entry.bloodSugar) : null,
            weight: entry.weight ? Number(entry.weight) : null,
          }));
    }, [vitals]);

    if(loading) return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    
    return (
        <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
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
                                    <RechartsLineChart data={chartData.filter(d => d.oxygenSaturation)} margin={{ left: 0, right: 10 }}>
                                         <CartesianGrid vertical={false} />
                                         <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                         <YAxis domain={['dataMin - 2', 'dataMax + 2']} tickLine={false} axisLine={false}/>
                                         <Tooltip content={<ChartTooltipContent />} />
                                         <Line dataKey="oxygenSaturation" name="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={false} />
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [editablePlan, setEditablePlan] = useState<{ preliminaryMedications: string[]; suggestedLabTests: string[]; } | null>(null);
  const [modifiedPlan, setModifiedPlan] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [doctorNote, setDoctorNote] = useState('');

  const [nurseNote, setNurseNote] = useState('');
  const [requiredFeedback, setRequiredFeedback] = useState<RequiredFeedback[]>([]);
  
  // Fetch investigations
  useEffect(() => {
    setIsLoading(true);
    const q = query(
        collection(db, "investigations"), 
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
  
  const investigationQueue = useMemo(() => investigations.filter(inv => inv.status === 'pending_review' || inv.status === 'pending_final_review'), [investigations]);
  const dispatchedCases = useMemo(() => investigations.filter(inv => inv.status === 'awaiting_nurse_visit'), [investigations]);


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

  const handleDispatchNurse = () => {
    if (!selectedCase || !editablePlan) return;
    
    const cleanedPlan = {
        suggestedLabTests: editablePlan.suggestedLabTests.filter(t => t.trim() !== ''),
        preliminaryMedications: editablePlan.preliminaryMedications.filter(m => m.trim() !== ''),
    };
    
    const planToSubmit = {
        ...cleanedPlan,
        nurseNote: nurseNote,
        requiredFeedback: requiredFeedback,
    };

    handleUpdateInvestigation(selectedCase.id, 'awaiting_nurse_visit', { doctorPlan: planToSubmit });
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
    }
    
    setEditablePlan({
        preliminaryMedications: planToModify?.preliminaryMedications || [],
        suggestedLabTests: planToModify?.suggestedLabTests || [],
    });

    setIsCompleting(false);
    setDoctorNote('');
    setNurseNote('');
    setRequiredFeedback([]);
  };

  const handleFeedbackCheckbox = (feedbackType: RequiredFeedback) => {
    setRequiredFeedback(prev => 
        prev.includes(feedbackType) 
        ? prev.filter(item => item !== feedbackType)
        : [...prev, feedbackType]
    );
  };
  
  const handlePlanChange = (type: 'suggestedLabTests' | 'preliminaryMedications', index: number, value: string) => {
    setEditablePlan(prev => {
        if (!prev) return null;
        const newPlan = { ...prev };
        newPlan[type][index] = value;
        return newPlan;
    });
  };

  const addPlanItem = (type: 'suggestedLabTests' | 'preliminaryMedications') => {
      setEditablePlan(prev => {
          if (!prev) return null;
          const newPlan = { ...prev };
          newPlan[type].push('');
          return newPlan;
      });
  };

  const removePlanItem = (type: 'suggestedLabTests' | 'preliminaryMedications', index: number) => {
      setEditablePlan(prev => {
          if (!prev) return null;
          const newPlan = { ...prev };
          newPlan[type].splice(index, 1);
          return newPlan;
      });
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

  const renderCaseCard = (c: Investigation, isDispatchView?: boolean) => {
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
            {!isDispatchView && <Button onClick={() => openReviewDialog(c)}>Review Case <ArrowRight className="ml-2"/></Button>}
        </div>
    );
  };

  const renderReviewDialog = () => {
    if (!selectedCase) return null;
    const latestStep = selectedCase.steps[selectedCase.steps.length - 1];
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
                <Button onClick={handleDispatchNurse}><Send className="mr-2"/>Dispatch Nurse</Button>
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
                        <h3 className="font-bold text-lg flex items-center gap-2"><User/>Patient Submission History</h3>
                        <ScrollArea className="h-[calc(70vh-100px)] pr-4">
                            <div className="space-y-4">
                                {selectedCase.steps.map((step, index) => (
                                    <Card key={index}>
                                        <CardHeader>
                                            <CardTitle className="text-base">{step.type === 'initial_submission' ? 'Initial Submission' : 'Follow-up Submission'}</CardTitle>
                                            <CardDescription>{format(parseISO(step.timestamp), 'MMM d, yyyy, h:mm a')}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
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
                                                <>
                                                    {step.userInput.nurseReport?.text && <p className="text-sm"><span className="font-semibold">Nurse Report:</span> {step.userInput.nurseReport.text}</p>}
                                                    <p className="text-sm font-semibold pt-2">Submitted Lab Results</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {step.userInput.labResults.map((res: any, i: number) => (
                                                            <div key={i}>
                                                                <p className="font-semibold text-xs truncate">{res.testName}</p>
                                                                <button onClick={() => setSelectedImage(res.imageDataUri)} className="transition-transform hover:scale-105 mt-1">
                                                                    <Image src={res.imageDataUri} alt={res.testName} width={150} height={150} className="rounded-md border"/>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
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
                            <CardHeader>
                                <CardTitle className="text-base m-0">{isCompleting ? 'Final Plan / Note' : 'Next Steps & Nurse Instructions'}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isCompleting ? (
                                    <div className="space-y-4">
                                        <div>
                                            <Label className="font-bold text-sm">Final Plan (JSON format)</Label>
                                            <Textarea value={modifiedPlan} onChange={(e) => setModifiedPlan(e.target.value)} className="min-h-[150px] font-mono text-xs"/>
                                        </div>
                                        <div>
                                            <Label className="font-bold text-sm">Note for Patient</Label>
                                            <Textarea value={doctorNote} onChange={(e) => setDoctorNote(e.target.value)} placeholder="e.g., Your results are normal. Please continue monitoring your symptoms."/>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {editablePlan && (
                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="font-bold">Suggested Lab Tests</Label>
                                                    <div className="space-y-2 mt-2">
                                                        {editablePlan.suggestedLabTests.map((test, index) => (
                                                            <div key={`test-${index}`} className="flex items-center gap-2">
                                                                <Input 
                                                                    value={test} 
                                                                    placeholder="e.g., Complete Blood Count"
                                                                    onChange={(e) => handlePlanChange('suggestedLabTests', index, e.target.value)} 
                                                                />
                                                                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removePlanItem('suggestedLabTests', index)}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <Button variant="outline" size="sm" className="mt-2" onClick={() => addPlanItem('suggestedLabTests')}>Add Test</Button>
                                                </div>
                                                <div>
                                                    <Label className="font-bold">Preliminary Medications</Label>
                                                    <div className="space-y-2 mt-2">
                                                        {editablePlan.preliminaryMedications.map((med, index) => (
                                                            <div key={`med-${index}`} className="flex items-center gap-2">
                                                                <Input 
                                                                    value={med}
                                                                    placeholder="e.g., Ibuprofen 200mg" 
                                                                    onChange={(e) => handlePlanChange('preliminaryMedications', index, e.target.value)} 
                                                                />
                                                                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removePlanItem('preliminaryMedications', index)}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <Button variant="outline" size="sm" className="mt-2" onClick={() => addPlanItem('preliminaryMedications')}>Add Medication</Button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="pt-4 border-t">
                                            <Label className="font-bold text-base">Instructions for Nurse</Label>
                                            <Textarea 
                                                value={nurseNote}
                                                onChange={(e) => setNurseNote(e.target.value)}
                                                placeholder="e.g., Please check for swelling in the lower limbs and record blood pressure on both arms."
                                                className="mt-2"
                                            />
                                            <div className="mt-4">
                                                <Label className="font-bold">Required Feedback from Nurse:</Label>
                                                <div className="flex items-center space-x-4 mt-2">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox id="feedback-text" onCheckedChange={() => handleFeedbackCheckbox('text')} checked={requiredFeedback.includes('text')} />
                                                        <Label htmlFor="feedback-text" className="font-normal flex items-center gap-1"><FileText size={16}/> Text Report</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox id="feedback-pictures" onCheckedChange={() => handleFeedbackCheckbox('pictures')} checked={requiredFeedback.includes('pictures')} />
                                                        <Label htmlFor="feedback-pictures" className="font-normal flex items-center gap-1"><Camera size={16}/> Pictures</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox id="feedback-videos" onCheckedChange={() => handleFeedbackCheckbox('videos')} checked={requiredFeedback.includes('videos')} />
                                                        <Label htmlFor="feedback-videos" className="font-normal flex items-center gap-1"><Video size={16}/> Videos</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
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

       <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Case Management</CardTitle>
              <CardDescription>Review new cases and track dispatched nurses.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="queue">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="queue">Review Queue ({investigationQueue.length})</TabsTrigger>
                        <TabsTrigger value="dispatched">Dispatched ({dispatchedCases.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="queue">
                        {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                            <div className="space-y-4 pt-4">
                            {investigationQueue.length > 0 ? 
                                investigationQueue.map(c => renderCaseCard(c)) : 
                                <div className="text-center text-muted-foreground py-12">
                                    <MessageSquare className="mx-auto w-12 h-12 text-gray-400" />
                                    <h3 className="mt-2 text-lg font-semibold">All Clear!</h3>
                                    <p>There are no investigations waiting for your review.</p>
                                </div>
                            }
                            </div>
                        )}
                    </TabsContent>
                     <TabsContent value="dispatched">
                        {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                            <div className="space-y-4 pt-4">
                            {dispatchedCases.length > 0 ? 
                                dispatchedCases.map(c => renderCaseCard(c, true)) : 
                                <div className="text-center text-muted-foreground py-12">
                                    <Send className="mx-auto w-12 h-12 text-gray-400" />
                                    <h3 className="mt-2 text-lg font-semibold">No Active Dispatches</h3>
                                    <p>Dispatch a nurse from the review queue to see cases here.</p>
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
        </div>
      </div>
      
      {renderReviewDialog()}
      
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          {selectedPatient && (
            <>
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="text-2xl">Health Analytics: {selectedPatient.userName}</DialogTitle>
                    <DialogDescription>A comprehensive overview of the patient's recorded health history.</DialogDescription>
                </DialogHeader>
                <PatientAnalyticsView userId={selectedPatient.userId} />
            </>
          )}
        </DialogContent>
      </Dialog>

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
