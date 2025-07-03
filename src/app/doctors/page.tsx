"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DeprecatedDoctorsPage() {
    return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Feature Updated</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground mb-4">
                        The AI Doctor Consultation has been upgraded to our new 24/7 Health Investigation service.
                    </p>
                    <Button asChild>
                        <Link href="/investigation">Start an Investigation</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
