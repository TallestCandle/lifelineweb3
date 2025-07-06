
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from "@/context/auth-provider";
import { db } from '@/lib/firebase';
import { collection, query, where, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Loader2, User, TestTube, Check, Upload, Home, ClipboardList, Phone, FileText, Camera, Video, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { continueInvestigation, type ContinueInvestigationClientInput } from '@/ai/flows/continue-investigation-flow';
import type { Profile } from '@/context/profile-provider';
import { Textarea } from '../ui/textarea';
import Image from 'next/image';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InvestigationStatus = 'pending_review' | 'awaiting_nurse_visit' | 'awaiting_lab_results' | 'pending_final_review' | 'completed' | 'rejected' | 'awaiting_follow_up_visit';
type RequiredFeedback = 'pictures' | 'videos' | 'text';

interface Investigation {
  id: string;
  userId: string;
  userName:string;
  status: InvestigationStatus;
  createdAt: string;
  doctorPlan?: {
      preliminaryMedications: string[];
      suggestedLabTests: string[];
      nurseNote?: string;
      requiredFeedback?: RequiredFeedback[];
  };
  followUpRequest?: {
      note: string;
      requiredFeedback: RequiredFeedback[];
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
    
    // Form state for nurse inputs
    const [labResultUploads, setLabResultUploads] = useState<Record<string, string>>({});
    const [nurseReportText, setNurseReportText] = useState('');
    const [nursePictures, setNursePictures] = useState<Record<string, string>>({}); // { filename: dataURI }
    const [nurseVideos, setNurseVideos] = useState<Record<string, string>>({});

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const q = query(
            collection(db, "investigations"), 
            where("status", "in", ["awaiting_nurse_visit", "awaiting_follow_up_visit"])
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

    const initialVisits = useMemo(() => dispatches.filter(d => d.status === 'awaiting_nurse_visit'), [dispatches]);
    const followUpVisits = useMemo(() => dispatches.filter(d => d.status === 'awaiting_follow_up_visit'), [dispatches]);
    
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

    const fileToDataUri = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handleFileUpload = async (files: FileList | null, type: 'picture' | 'video', testName?: string) => {
        if (!files) return;

        if (testName) { // Lab result upload
            const file = files[0];
            const dataUri = await fileToDataUri(file);
            setLabResultUploads(prev => ({ ...prev, [testName]: dataUri }));
        } else { // Nurse feedback upload
            for (const file of Array.from(files)) {
                const dataUri = await fileToDataUri(file);
                if (type === 'picture') {
                    setNursePictures(prev => ({ ...prev, [file.name]: dataUri }));
                } else {
                    setNurseVideos(prev => ({ ...prev, [file.name]: dataUri }));
                }
            }
        }
    };


    const handleSubmitResults = async () => {
        if (!user || !selectedDispatch) return;

        const isInitialVisit = selectedDispatch.status === 'awaiting_nurse_visit';
        const requiredTests = selectedDispatch.doctorPlan?.suggestedLabTests || [];
        
        if (isInitialVisit) {
            const uploadedTests = Object.keys(labResultUploads);
            if (requiredTests.some(test => !uploadedTests.includes(test))) {
                toast({ variant: 'destructive', title: 'Missing Results', description: 'Please upload all required lab test results.' });
                return;
            }
        }
        
        setIsSubmitting(true);
        try {
            const payload: ContinueInvestigationClientInput = {
                userId: selectedDispatch.userId,
                investigationId: selectedDispatch.id,
                labResults: isInitialVisit ? requiredTests.map(testName => ({
                    testName,
                    imageDataUri: labResultUploads[testName],
                })) : [],
                nurseReport: {
                    text: nurseReportText || undefined,
                    pictures: Object.values(nursePictures).length > 0 ? Object.values(nursePictures) : undefined,
                    videos: Object.values(nurseVideos).length > 0 ? Object.values(nurseVideos) : undefined,
                },
            };

            await continueInvestigation(payload);
            
            toast({ title: "Visit Data Submitted", description: `Data for ${selectedDispatch.userName} sent for final analysis.` });
            setLabResultUploads({});
            setNurseReportText('');
            setNursePictures({});
            setNurseVideos({});
            setSelectedDispatch(null);

        } catch (error) {
            console.error("Error submitting lab results:", error);
            toast({ variant: 'destructive', title: "Submission Failed", description: "Could not submit the visit data." });
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
                <h4 className="font-bold text-sm mb-2">Visit Type:</h4>
                 <Badge variant={dispatch.status === 'awaiting_follow_up_visit' ? "secondary" : "default"}>
                    {dispatch.status === 'awaiting_follow_up_visit' ? "Follow-up" : "Initial Visit"}
                </Badge>
            </CardContent>
            <CardFooter>
                 <Button className="w-full" onClick={() => setSelectedDispatch(dispatch)}>Complete Visit & Upload Data</Button>
            </CardFooter>
        </Card>
    );

    const renderVisitDialog = () => {
        if (!selectedDispatch) return;

        const isInitialVisit = selectedDispatch.status === 'awaiting_nurse_visit';
        const feedbackRequests = isInitialVisit ? selectedDispatch.doctorPlan?.requiredFeedback || [] : selectedDispatch.followUpRequest?.requiredFeedback || [];
        const doctorNote = isInitialVisit ? selectedDispatch.doctorPlan?.nurseNote : selectedDispatch.followUpRequest?.note;
        const requiredTests = selectedDispatch.doctorPlan?.suggestedLabTests || [];

        return (
            <Dialog open={!!selectedDispatch} onOpenChange={() => setSelectedDispatch(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Complete Visit for: {selectedDispatch.userName}</DialogTitle>
                        <DialogDescription>Upload lab results and other requested feedback.</DialogDescription>
                    </DialogHeader>
                     {isProfileLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
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
                            {doctorNote && (
                                <Alert variant='default' className='border-primary'>
                                    <ClipboardList className="h-4 w-4" />
                                    <AlertTitle>Note from Doctor</AlertTitle>
                                    <AlertDescription>{doctorNote}</AlertDescription>
                                </Alert>
                            )}
                            
                            {isInitialVisit && requiredTests.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><TestTube/> Required Lab Tests</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        {requiredTests.map((test, i) => (
                                            <div key={i} className="p-3 border rounded-md">
                                                <label htmlFor={`lab-upload-${i}`} className="font-semibold">{test}</label>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <Input id={`lab-upload-${i}`} type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e.target.files, 'picture', test)} className="file:text-foreground flex-grow" />
                                                    {labResultUploads[test] && <Check className="w-5 h-5 text-green-500"/>}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                             {feedbackRequests.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList/> Required Feedback</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        {feedbackRequests.includes('text') && (
                                            <div>
                                                <Label className="font-bold flex items-center gap-1 mb-2"><FileText size={16}/> Text Report</Label>
                                                <Textarea value={nurseReportText} onChange={(e) => setNurseReportText(e.target.value)} placeholder="Enter your observations..."/>
                                            </div>
                                        )}
                                        {feedbackRequests.includes('pictures') && (
                                             <div>
                                                <Label className="font-bold flex items-center gap-1 mb-2"><Camera size={16}/> Upload Pictures</Label>
                                                <Input type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(e.target.files, 'picture')} className="file:text-foreground"/>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {Object.keys(nursePictures).map(name => <Badge key={name} variant="secondary">{name}</Badge>)}
                                                </div>
                                            </div>
                                        )}
                                        {feedbackRequests.includes('videos') && (
                                             <div>
                                                <Label className="font-bold flex items-center gap-1 mb-2"><Video size={16}/> Upload Videos</Label>
                                                <Input type="file" accept="video/*" multiple onChange={(e) => handleFileUpload(e.target.files, 'video')} className="file:text-foreground"/>
                                                 <div className="flex flex-wrap gap-2 mt-2">
                                                    {Object.keys(nurseVideos).map(name => <Badge key={name} variant="secondary">{name}</Badge>)}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                        </div>
                     )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedDispatch(null)}>Cancel</Button>
                        <Button onClick={handleSubmitResults} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin"/> : <><Upload className="mr-2"/> Submit All</>}
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
                    <CardTitle>Dispatch Queue</CardTitle>
                    <CardDescription>Patients awaiting a home visit for sample collection and vitals check.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="initial">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="initial">Initial Visits ({initialVisits.length})</TabsTrigger>
                            <TabsTrigger value="follow-up">Follow-up Visits ({followUpVisits.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="initial" className="pt-4">
                             {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                                initialVisits.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {initialVisits.map(renderDispatchCard)}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground py-12">
                                        <ClipboardList className="mx-auto w-12 h-12 text-gray-400" />
                                        <h3 className="mt-2 text-lg font-semibold">No Initial Visits</h3>
                                        <p>There are no new patients awaiting a first visit.</p>
                                    </div>
                                )
                            )}
                        </TabsContent>
                         <TabsContent value="follow-up" className="pt-4">
                             {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                                followUpVisits.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {followUpVisits.map(renderDispatchCard)}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground py-12">
                                        <RefreshCw className="mx-auto w-12 h-12 text-gray-400" />
                                        <h3 className="mt-2 text-lg font-semibold">No Follow-ups</h3>
                                        <p>There are no patients awaiting a follow-up visit.</p>
                                    </div>
                                )
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {renderVisitDialog()}
        </div>
    );
}
