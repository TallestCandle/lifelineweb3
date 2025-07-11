
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MessagesDashboard() {
    return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Feature Removed</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground mb-4">
                        The direct messaging feature has been removed.
                    </p>
                    <Button asChild>
                        <Link href="/doctor/dashboard">Back to Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
