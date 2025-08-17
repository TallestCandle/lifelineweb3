
"use client";

import { useState } from 'react';
import { useAuth, PiUser } from '@/context/auth-provider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

declare const Pi: any;

interface PaymentDTO {
    amount: number;
    memo: string;
    metadata?: object;
}

export function WalletManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async (amount: number, memo: string) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please authenticate with Pi first.' });
      return;
    }

    setIsLoading(true);

    try {
      const paymentData: PaymentDTO = {
        amount: amount,
        memo: memo, // Memo for the user
        metadata: { service: memo }, // For your server's reference
      };

      Pi.createPayment(paymentData, {
        onReadyForServerApproval: function(paymentId: string) {
          // Here you would call your server to approve the payment.
          // For this sandbox example, we will assume it's approved.
          // Example: await server.post('/approvePayment', { paymentId });
          console.log("onReadyForServerApproval", paymentId);
          toast({ title: "Payment Ready", description: `Payment ID: ${paymentId}. Approving...` });
        },
        onReadyForServerCompletion: function(paymentId: string, txid: string) {
          // Here you would call your server to complete the payment.
          // Example: await server.post('/completePayment', { paymentId, txid });
          console.log("onReadyForServerCompletion", paymentId, txid);
          toast({ title: "Payment Complete", description: `Transaction ID: ${txid}` });
        },
        onCancel: function(paymentId: string) {
          toast({ variant: 'destructive', title: 'Payment Canceled', description: `Payment ${paymentId} was canceled.` });
          setIsLoading(false);
        },
        onError: function(error: Error, payment: any) {
          toast({ variant: 'destructive', title: 'Payment Error', description: error.message });
          setIsLoading(false);
        },
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setIsLoading(false);
    }
    // Note: setIsLoading(false) is handled in the callbacks
  };

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-white" />
          <p className="text-white mt-4 text-lg">
            Processing Pi Transaction...
          </p>
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet /> Pi Payments</CardTitle>
            <CardDescription>Use Pi from the sandbox to pay for premium services.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
                <AlertTitle>Pi Network Sandbox</AlertTitle>
                <AlertDescription>
                    This application is currently connected to the Pi Network Sandbox. All transactions use Test-Pi and do not involve real currency.
                </AlertDescription>
            </Alert>
            <div className="space-y-4">
                <div className="p-4 rounded-lg bg-secondary/50 flex justify-between items-center">
                    <div>
                        <p className="font-bold">Deep Dive Analysis</p>
                        <p className="text-sm text-muted-foreground">Find hidden trends in your health data.</p>
                    </div>
                    <Button onClick={() => handlePayment(0.5, "Deep Dive Analysis")} disabled={isLoading}>
                        Pay π0.5
                    </Button>
                </div>
                 <div className="p-4 rounded-lg bg-secondary/50 flex justify-between items-center">
                    <div>
                        <p className="font-bold">New Clinic Case</p>
                        <p className="text-sm text-muted-foreground">Get a doctor-reviewed diagnosis.</p>
                    </div>
                    <Button onClick={() => handlePayment(1.0, "New Clinic Case")} disabled={isLoading}>
                        Pay π1.0
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
