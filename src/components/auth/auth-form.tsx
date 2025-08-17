
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bot } from 'lucide-react';
import { useAuth } from "@/context/auth-provider";
import { Loader2 } from "lucide-react";
import Link from 'next/link';

const PiLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4h12v2H6zM9 8h2v10H9zM13 8h2v10h-2zM15 8h2v2h-2z" fill="currentColor"/>
    </svg>
);


export function PiAuthForm() {
  const { signIn, loading } = useAuth();
  const { toast } = useToast();

  const handlePiSignIn = async () => {
    try {
      await signIn();
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Authentication Failed",
            description: error.message || "An error occurred during Pi authentication."
        });
    }
  };


  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
       <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--primary)/0.1)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]"></div>
      <Card className="w-full max-w-md mx-4 bg-card/80 backdrop-blur-sm border-primary/20 relative">
        <CardHeader className="text-center pt-16">
            <div className="flex justify-center items-center gap-2 mb-4">
                <Bot className="w-10 h-10 text-primary"/>
                <h1 className="text-3xl font-bold">Lifeline</h1>
            </div>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Authenticate with Pi Network to continue.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button 
                variant="default" 
                className="w-full h-12 text-lg" 
                onClick={handlePiSignIn} 
                disabled={loading}
            >
                {loading ? <Loader2 className="mr-2 h-6 w-6 animate-spin"/> : <PiLogo />}
                <span className="ml-2">Authenticate with Pi</span>
            </Button>
        </CardContent>
         <CardFooter className="text-center flex-col gap-2">
            <Button variant="link" size="sm" asChild>
                <Link href="/landing">Back to Home</Link>
            </Button>
         </CardFooter>
      </Card>
    </div>
  );
}
