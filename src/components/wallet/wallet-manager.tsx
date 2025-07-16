
"use client";

import { useEffect, useState, useCallback } from 'react';
import { usePaystackPayment, type PaystackProps } from 'react-paystack';
import { useProfile } from '@/context/profile-provider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wallet, CreditCard, PlusCircle, MinusCircle, Loader2 } from "lucide-react";
import { useAuth } from '@/context/auth-provider';
import { Separator } from '../ui/separator';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { verifyPayment } from '@/ai/flows/verify-payment-flow';

interface TopUpPackage {
    amount: number;
    credits: number;
    label: string;
}

const topUpPackages: TopUpPackage[] = [
    { amount: 1000, credits: 100, label: '₦1,000 for 100 Credits' },
    { amount: 2500, credits: 300, label: '₦2,500 for 300 Credits (20% Bonus)' },
    { amount: 5000, credits: 750, label: '₦5,000 for 750 Credits (50% Bonus)' },
];

interface Transaction {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    timestamp: string;
}

export function WalletManager() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState(topUpPackages[0]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTxLoading, setIsTxLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const paystackConfig = {
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
      email: user?.email || '',
      amount: selectedPackage.amount * 100,
      metadata: {
        custom_fields: [
          {
            display_name: "User ID",
            variable_name: "user_id",
            value: user?.uid || ''
          },
          {
            display_name: "Package",
            variable_name: "package",
            value: selectedPackage.label
          }
        ]
      }
  };
  
  const initializePayment = usePaystackPayment(paystackConfig);

  const onSuccess = useCallback(async (transaction: { reference: string }) => {
    if (!user) return;
    setIsVerifying(true);
    try {
        const result = await verifyPayment({
            transactionReference: transaction.reference,
            userId: user.uid,
            creditsToAdd: selectedPackage.credits,
            amountPaid: selectedPackage.amount,
        });

        if (result.success) {
            toast({
                title: "Top-up Successful!",
                description: `${selectedPackage.credits} credits have been added to your wallet.`,
            });
        } else {
             throw new Error(result.message || "Verification failed on the server.");
        }

    } catch (error: any) {
        console.error("Verification error:", error);
        toast({ 
            variant: 'destructive', 
            title: "Verification Failed", 
            description: error.message || "Your payment could not be verified. Please contact support." 
        });
    } finally {
        setIsVerifying(false);
    }
  }, [user, selectedPackage, toast]);

  const onClose = useCallback(() => {
    // User closed the popup, no action needed
  }, []);
  
  useEffect(() => {
    if (!user) {
        setIsTxLoading(false);
        return;
    };
    
    setIsTxLoading(true);
    const txCollectionRef = collection(db, `users/${user.uid}/transactions`);
    const q = query(txCollectionRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        setIsTxLoading(false);
    }, (error) => {
        console.error("Error fetching transactions: ", error);
        toast({variant: 'destructive', title: 'Error', description: 'Could not fetch transaction history.'});
        setIsTxLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet/> My Wallet</CardTitle>
                <CardDescription>Top up your credits to use Lifeline's AI features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-secondary/50 flex justify-between items-center">
                    <p className="text-muted-foreground">Available Credits</p>
                    {profileLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold text-primary">{profile?.credits ?? '0'}</p>}
                </div>

                <Separator />
                
                <div>
                    <h3 className="font-bold mb-2">Top-up Packages</h3>
                    <div className="space-y-2">
                        {topUpPackages.map((pkg) => (
                            <button
                                key={pkg.amount}
                                onClick={() => setSelectedPackage(pkg)}
                                className={`w-full p-3 rounded-md text-left transition-all border-2 ${selectedPackage.amount === pkg.amount ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary/50 hover:bg-secondary'}`}
                            >
                                <p className="font-bold">{pkg.label}</p>
                                <p className="text-sm text-muted-foreground">{pkg.credits} credits will be added to your wallet.</p>
                            </button>
                        ))}
                    </div>
                </div>

                <Button
                    className="w-full"
                    onClick={() => initializePayment({onSuccess, onClose})}
                    disabled={!user?.email || profileLoading || isVerifying || !paystackConfig.publicKey}
                >
                    {isVerifying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <CreditCard className="mr-2"/>
                    )}
                    {isVerifying ? 'Verifying Payment...' : `Pay ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedPackage.amount)} with Paystack`}
                </Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Your recent credit top-ups and usage.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {isTxLoading ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : transactions.length > 0 ? (
                        transactions.map(tx => (
                            <div key={tx.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md">
                                <div className="flex items-center gap-3">
                                    {tx.type === 'credit' ? <PlusCircle className="w-5 h-5 text-green-500" /> : <MinusCircle className="w-5 h-5 text-red-500" />}
                                    <div>
                                        <p className="font-semibold text-sm">{tx.description}</p>
                                        <p className="text-xs text-muted-foreground">{format(parseISO(tx.timestamp), 'MMM d, yyyy, h:mm a')}</p>
                                    </div>
                                </div>
                                <p className={cn("font-bold text-sm", tx.type === 'credit' ? 'text-green-500' : 'text-red-500')}>
                                    {tx.type === 'credit' ? '+' : '-'}{Math.abs(tx.amount)}
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
