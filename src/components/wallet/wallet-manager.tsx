
"use client";

import { useEffect, useState, useCallback } from 'react';
import { usePaystackPayment } from 'react-paystack';
import type { PaystackHookConfig } from 'react-paystack/dist/types';

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

interface TopUpPackage {
  amount: number;
  credits: number;
  label: string;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  timestamp: string;
}

const topUpPackages: TopUpPackage[] = [
  { amount: 1000, credits: 100, label: '₦1,000 for 100 Credits' },
  { amount: 2500, credits: 300, label: '₦2,500 for 300 Credits (20% Bonus)' },
  { amount: 5000, credits: 750, label: '₦5,000 for 750 Credits (50% Bonus)' },
];

export function WalletManager() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<TopUpPackage>(topUpPackages[0]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTxLoading, setIsTxLoading] = useState(true);

  const config: PaystackHookConfig = {
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    reference: (new Date()).getTime().toString(),
    email: user?.email || '',
    amount: selectedPackage.amount * 100, // Amount in Kobo
    metadata: {
      user_id: user?.uid,
      credits_to_add: selectedPackage.credits,
    }
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = (transaction: { reference: string }) => {
    toast({
      title: "Payment Initiated!",
      description: "Your transaction is being processed. Your wallet will be updated shortly.",
    });
  };

  const onClose = () => {
    toast({
      variant: 'default',
      title: "Payment Cancelled",
      description: "You closed the payment window. No charge was made.",
    });
  };

  const handlePayment = () => {
    if (!user || !profile) {
      toast({variant: 'destructive', title: 'Error', description: 'Please wait for your profile to load.'});
      return;
    }
    if (!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) {
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Payment system is not available at the moment.',
      });
      return;
    }
    
    initializePayment(onSuccess, onClose);
  };

  useEffect(() => {
    if (!user) {
      setIsTxLoading(false);
      return;
    }

    setIsTxLoading(true);
    const txCollectionRef = collection(db, `users/${user.uid}/transactions`);
    const q = query(txCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp;
        return { 
          id: doc.id,
          ...data,
          timestamp,
        } as Transaction;
      }));
      setIsTxLoading(false);
    }, (error) => {
      console.error("Error fetching transactions: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch transaction history.' });
      setIsTxLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const payButtonDisabled = profileLoading || !process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet /> My Wallet</CardTitle>
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
                  className={cn(
                    'w-full p-3 rounded-md text-left transition-all border-2',
                    selectedPackage.amount === pkg.amount ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary/50 hover:bg-secondary'
                  )}
                >
                  <p className="font-bold">{pkg.label}</p>
                  <p className="text-sm text-muted-foreground">{pkg.credits} credits will be added to your wallet.</p>
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handlePayment}
            disabled={payButtonDisabled}
          >
            <CreditCard className="mr-2" />
            {`Pay ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedPackage.amount)} with Paystack`}
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
                      <p className="text-xs text-muted-foreground">{tx.timestamp ? format(parseISO(tx.timestamp), 'MMM d, yyyy, h:mm a') : 'Date unavailable'}</p>
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
