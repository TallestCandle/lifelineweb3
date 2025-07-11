
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Pill } from "lucide-react";

export function RemindersList() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Pill /> Medications</CardTitle>
                <CardDescription>This feature has been updated. Please see your prescriptions in the Clinic section.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    All prescribed medications and dosage plans are now listed within each specific case on the Clinic page for easier management.
                </p>
            </CardContent>
        </Card>
    );
}
