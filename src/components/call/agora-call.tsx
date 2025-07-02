
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AgoraCall() {
    return (
        <div className="flex items-center justify-center h-screen">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Feature Updated</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground mb-4">
                        Live video calls have been replaced by our new 24/7 AI Doctor Consultation service.
                    </p>
                    <Button asChild>
                        <Link href="/doctors">Start an AI Consultation</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
