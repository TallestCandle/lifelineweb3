
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DeprecatedNursePage() {
    return (
        <div className="flex items-center justify-center h-screen">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Feature Removed</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground mb-4">
                        The nurse dashboard has been removed in this version of the application.
                    </p>
                    <Button asChild>
                        <Link href="/">Back to Home</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
