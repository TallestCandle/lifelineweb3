
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { Loader2, User, TestTube, Check, Upload, Home, ClipboardList, Phone } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { continueInvestigation } from '@/ai/flows/continue-investigation-flow';
import type { Profile } from '@/context/profile-provider';

type InvestigationStatus = 'pending_review' | 'awaiting_nurse_visit' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected';

interface Investigation {
  id: string;
  userId: string;
  userName: string;
  status: InvestigationStatus;
  createdAt: string;
  doctorPlan?: {
      preliminaryMedications: string[];
      suggestedLabTests: string[];
  };
}

interface PatientProfile extends Profile {
    address?: string;
}

export function NurseDashboard() {
    const { user } = useAuth();
    const { toast } = useToast();
    const nurseName = user?.displayName || "Nurse";

    const [dispatches, setDispatches] = useState<Investigation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDispatch, setSelectedDispatch] = useState<Investigation | null>(null);
    const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(false);

    const [labResultUploads, setLabResultUploads] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const q = query(
            collection(db, "investigations"), 
            where("status", "==", "awaiting_nurse_visit")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investigation));
            setDispatches(fetched);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching dispatches: ", error);
            setIsLoading(false);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch dispatch queue.' });
        });

        return () => unsubscribe();
    }, [toast]);
    
    useEffect(() => {
        if (!selectedDispatch) {
            setPatientProfile(null);
            return;
        }

        const fetchProfile = async () => {
            setIsProfileLoading(true);
            try {
                const profileDocRef = doc(db, 'profiles', selectedDispatch.userId);
                const docSnap = await getDoc(profileDocRef);
                if (docSnap.exists()) {
                    setPatientProfile(docSnap.data() as PatientProfile);
                } else {
                    toast({ variant: 'destructive', title: "Profile Not Found", description: "This patient has not completed their profile." });
                }
            } catch (err) {
                console.error("Error fetching patient profile:", err);
                toast({ variant: 'destructive', title: "Error", description: "Could not load patient profile." });
            } finally {
                setIsProfileLoading(false);
            }
        };

        fetchProfile();
    }, [selectedDispatch, toast]);

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

    const handleSubmitResults = async () => {
        if (!user || !selectedDispatch || !selectedDispatch.doctorPlan?.suggestedLabTests) return;

        const requiredTests = selectedDispatch.doctorPlan.suggestedLabTests;
        const uploadedTests = Object.keys(labResultUploads);
        if (requiredTests.some(test => !uploadedTests.includes(test))) {
            toast({ variant: 'destructive', title: 'Missing Results', description: 'Please upload all required lab test results.' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const labResults = requiredTests.map(testName => ({
                testName,
                imageDataUri: labResultUploads[testName],
            }));

            await continueInvestigation({
                userId: selectedDispatch.userId,
                investigationId: selectedDispatch.id,
                labResults,
            });
            
            toast({ title: "Lab Results Submitted", description: `Results for ${selectedDispatch.userName} sent for final analysis.` });
            setLabResultUploads({});
            setSelectedDispatch(null);

        } catch (error) {
            console.error("Error submitting lab results:", error);
            toast({ variant: 'destructive', title: "Submission Failed", description: "Could not submit the lab results." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderDispatchCard = (dispatch: Investigation) => (
        <Card key={dispatch.id} className="hover:bg-secondary/50 transition-colors">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><User/> {dispatch.userName}</CardTitle>
                <CardDescription>Dispatched {formatDistanceToNow(parseISO(dispatch.createdAt), { addSuffix: true })}</CardDescription>
            </CardHeader>
            <CardContent>
                <h4 className="font-bold text-sm mb-2">Required Tests:</h4>
                <ul className="list-disc list-inside text-muted-foreground text-sm">
                    {dispatch.doctorPlan?.suggestedLabTests.map((test, i) => <li key={i}>{test}</li>)}
                </ul>
            </CardContent>
            <CardFooter>
                 <Button className="w-full" onClick={() => setSelectedDispatch(dispatch)}>Complete Visit & Upload Results</Button>
            </CardFooter>
        </Card>
    );

    const renderVisitDialog = () => {
        if (!selectedDispatch) return null;

        return (
            <Dialog open={!!selectedDispatch} onOpenChange={() => setSelectedDispatch(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Complete Visit for: {selectedDispatch.userName}</DialogTitle>
                        <DialogDescription>Upload lab results and vitals for this patient.</DialogDescription>
                    </DialogHeader>
                     {isProfileLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
                        <div className="space-y-4 py-4">
                            {patientProfile?.address && (
                                <Alert>
                                    <Home className="h-4 w-4" />
                                    <AlertTitle>Patient Address</AlertTitle>
                                    <AlertDescription>{patientProfile.address}</AlertDescription>
                                </Alert>
                            )}
                            {patientProfile?.phone && (
                                <Alert>
                                    <Phone className="h-4 w-4" />
                                    <AlertTitle>Patient Phone</AlertTitle>
                                    <AlertDescription>{patientProfile.phone}</AlertDescription>
                                </Alert>
                            )}
                            <Card>
                                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList/> Required Lab Tests</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                     {selectedDispatch.doctorPlan?.suggestedLabTests.map((test, i) => (
                                        <div key={i} className="p-3 border rounded-md">
                                            <label htmlFor={`lab-upload-${i}`} className="font-semibold">{test}</label>
                                            <div className="flex items-center gap-4 mt-2">
                                                <Input id={`lab-upload-${i}`} type="file" accept="image/*,.pdf" onChange={(e) => handleLabResultUpload(test, e)} className="file:text-foreground flex-grow" />
                                                {labResultUploads[test] && <Check className="w-5 h-5 text-green-500"/>}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                     )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedDispatch(null)}>Cancel</Button>
                        <Button onClick={handleSubmitResults} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin"/> : <><Upload className="mr-2"/> Submit Results</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground/90">Nurse Dashboard</h1>
                <p className="text-lg text-muted-foreground">Welcome, {nurseName}.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Dispatched Visits ({dispatches.length})</CardTitle>
                    <CardDescription>Patients awaiting a home visit for sample collection and vitals check.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                        dispatches.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {dispatches.map(renderDispatchCard)}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-12">
                                <ClipboardList className="mx-auto w-12 h-12 text-gray-400" />
                                <h3 className="mt-2 text-lg font-semibold">All Caught Up!</h3>
                                <p>There are no patients awaiting a visit.</p>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>

            {renderVisitDialog()}
        </div>
    );
}
