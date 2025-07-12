
"use client";

import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileSpreadsheet } from "lucide-react";
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface Medication {
  name: string;
  dosage: string;
}

interface Prescription {
  caseId: string;
  createdAt: string; // ISO string of case creation
  medications: Medication[];
}

export function PrescriptionsList() {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch all data
    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch prescriptions from completed cases
                const investigationsCol = collection(db, 'investigations');
                const qCases = query(investigationsCol, where('userId', '==', user.uid));
                const casesSnap = await getDocs(qCases);
                
                const fetchedPrescriptions: Prescription[] = [];
                casesSnap.forEach(doc => {
                    const data = doc.data();
                    const planMeds = data.doctorPlan?.preliminaryMedications || [];
                    const finalMeds = data.finalTreatmentPlan?.medications || [];

                    const combinedMeds = [...planMeds, ...finalMeds].filter(m => m.name && m.dosage);

                    if (combinedMeds.length > 0) {
                        fetchedPrescriptions.push({
                            caseId: doc.id,
                            createdAt: data.createdAt,
                            medications: combinedMeds,
                        });
                    }
                });
                setPrescriptions(fetchedPrescriptions.sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()));

            } catch (error) {
                console.error("Error fetching data:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not load prescriptions data." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

    }, [user, toast]);
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <FileSpreadsheet className="w-8 h-8 text-primary" />
                        <span className="text-2xl">My Prescriptions</span>
                    </CardTitle>
                    <CardDescription>
                        View all medications prescribed from your clinic cases and their dosage plans.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Loading prescriptions...</p> : prescriptions.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full" defaultValue={prescriptions[0].caseId}>
                            {prescriptions.map(p => (
                                <AccordionItem value={p.caseId} key={p.caseId}>
                                    <AccordionTrigger>
                                        Prescription from {format(parseISO(p.createdAt), 'MMM d, yyyy')}
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <ul className="space-y-2">
                                            {p.medications.map((med, index) => (
                                                <li key={index} className="p-3 bg-secondary rounded-md">
                                                    <p className="font-bold">{med.name}</p>
                                                    <p className="text-sm text-muted-foreground">{med.dosage}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No prescriptions found.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
