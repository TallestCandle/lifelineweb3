
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Loader } from '../ui/loader';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Bot, User, Check, X, Pencil, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Consultation {
  id: string;
  userId: string;
  userName: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  createdAt: string;
  userInput: {
    symptoms: string;
    vitals?: string;
    imageDataUri?: string;
  };
  aiAnalysis: {
    analysisSummary: string;
    potentialConditions: { condition: string; probability: number; reasoning: string; }[];
    suggestedTreatmentPlan: { medications: string[]; lifestyleChanges: string[]; furtherTests: string[]; };
    justification: string;
    urgency: 'Low' | 'Medium' | 'High' | 'Critical';
    followUpPlan: string;
  };
}

export function DoctorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const doctorName = user?.displayName || user?.email?.split('@')[0] || "Doctor";

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<Consultation | null>(null);
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedPlan, setModifiedPlan] = useState('');
  
  useEffect(() => {
    const fetchConsultations = async () => {
      setIsLoading(true);
      const q = query(collection(db, "consultations"), where("status", "==", "pending_review"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation));
      setConsultations(fetched);
      setIsLoading(false);
    };
    fetchConsultations();
  }, []);

  const handleUpdateStatus = async (consultationId: string, status: 'approved' | 'rejected', finalPlan?: string) => {
    const consultationRef = doc(db, "consultations", consultationId);
    try {
      await updateDoc(consultationRef, { 
          status, 
          finalTreatmentPlan: finalPlan || selectedCase?.aiAnalysis.suggestedTreatmentPlan,
          reviewedAt: new Date().toISOString(),
          reviewedBy: user?.uid,
      });
      setConsultations(prev => prev.filter(c => c.id !== consultationId));
      setSelectedCase(null);
      setIsModifying(false);
      toast({ title: 'Case Updated', description: `The consultation has been ${status}.` });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update consultation status.' });
    }
  };

  const openReviewDialog = (consultation: Consultation) => {
    setSelectedCase(consultation);
    setModifiedPlan(JSON.stringify(consultation.aiAnalysis.suggestedTreatmentPlan, null, 2));
    setIsModifying(false);
  };

  const renderVitals = (vitalsString?: string) => {
    if (!vitalsString) return <p className="text-sm text-muted-foreground">No vitals provided.</p>;
    try {
      const vitals = JSON.parse(vitalsString);
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(vitals).map(([key, value]) => (
            <div key={key}>
              <span className="font-bold capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>{String(value)}
            </div>
          ))}
        </div>
      );
    } catch {
      return <p className="text-sm">{vitalsString}</p>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground/90">Welcome, Dr. {doctorName}.</h1>
        <p className="text-muted-foreground">Here are the AI-flagged consultations awaiting your review.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews ({consultations.length})</CardTitle>
          <CardDescription>Consultations requiring your professional expertise and approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Loader /> : (
            <div className="space-y-4">
              {consultations.length > 0 ? consultations.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary">
                  <div>
                    <p className="font-bold">Case for {c.userName || 'Anonymous User'}</p>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true })}
                    </p>
                    <p className="text-sm font-bold text-primary">Urgency: {c.aiAnalysis.urgency}</p>
                  </div>
                  <Button onClick={() => openReviewDialog(c)}>Review Case <ArrowRight className="ml-2"/></Button>
                </div>
              )) : (
                <p className="text-center text-muted-foreground py-8">No pending reviews. Well done!</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCase && (
        <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Review Case: {selectedCase.userName}</DialogTitle>
              <DialogDescription>Submitted {formatDistanceToNow(parseISO(selectedCase.createdAt), { addSuffix: true })}. Urgency: {selectedCase.aiAnalysis.urgency}</DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto p-4">
              {/* User Input Column */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><User/>Patient's Submission</h3>
                <Card>
                  <CardHeader><CardTitle className="text-base">Symptoms</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-line">{selectedCase.userInput.symptoms}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Vitals</CardTitle></CardHeader>
                  <CardContent>{renderVitals(selectedCase.userInput.vitals)}</CardContent>
                </Card>
                {selectedCase.userInput.imageDataUri && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Submitted Image</CardTitle></CardHeader>
                    <CardContent>
                      <Image src={selectedCase.userInput.imageDataUri} alt="User submission" width={300} height={300} className="rounded-md border"/>
                    </CardContent>
                  </Card>
                )}
              </div>
              {/* AI Analysis Column */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Bot/>AI's Analysis</h3>
                <Alert variant={selectedCase.aiAnalysis.urgency === 'Critical' ? 'destructive' : 'default'}>
                  <AlertTitle>AI Summary & Justification</AlertTitle>
                  <AlertDescription>{selectedCase.aiAnalysis.analysisSummary} <br/><br/> <strong>Justification:</strong> {selectedCase.aiAnalysis.justification}</AlertDescription>
                </Alert>
                <Card>
                    <CardHeader><CardTitle className="text-base">Potential Conditions</CardTitle></CardHeader>
                    <CardContent>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {selectedCase.aiAnalysis.potentialConditions.map(p => (
                                <li key={p.condition}><strong>{p.condition}</strong> ({p.probability}%): {p.reasoning}</li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="text-base m-0">Suggested Treatment Plan</CardTitle>
                      {!isModifying && <Button variant="ghost" size="sm" onClick={() => setIsModifying(true)}><Pencil className="mr-2"/>Modify</Button>}
                  </CardHeader>
                  <CardContent>
                    {isModifying ? (
                      <Textarea value={modifiedPlan} onChange={(e) => setModifiedPlan(e.target.value)} className="min-h-[200px]"/>
                    ) : (
                      <div className="text-sm space-y-2">
                        <div><strong>Medications:</strong><ul className="list-disc list-inside ml-4">{selectedCase.aiAnalysis.suggestedTreatmentPlan.medications.map(m => <li key={m}>{m}</li>)}</ul></div>
                        <div><strong>Lifestyle:</strong><ul className="list-disc list-inside ml-4">{selectedCase.aiAnalysis.suggestedTreatmentPlan.lifestyleChanges.map(l => <li key={l}>{l}</li>)}</ul></div>
                        <div><strong>Tests:</strong><ul className="list-disc list-inside ml-4">{selectedCase.aiAnalysis.suggestedTreatmentPlan.furtherTests.map(t => <li key={t}>{t}</li>)}</ul></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button variant="destructive" onClick={() => handleUpdateStatus(selectedCase.id, 'rejected')}><X className="mr-2"/>Reject Plan</Button>
              {isModifying ? (
                 <Button onClick={() => handleUpdateStatus(selectedCase.id, 'approved', modifiedPlan)}><Check className="mr-2"/>Save & Approve</Button>
              ) : (
                <Button onClick={() => handleUpdateStatus(selectedCase.id, 'approved')}><Check className="mr-2"/>Approve AI Plan</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
