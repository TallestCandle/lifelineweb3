
"use client";

import { useEffect, useState, useMemo } from 'react';
import { usePaystackPayment } from 'react-paystack';
import type { PaystackHookConfig } from 'react-paystack/dist/types';

import { useProfile } from '@/context/profile-provider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wallet, CreditCard, PlusCircle, MinusCircle } from "lucide-react";
import { useAuth } from '@/context/auth-provider';
import { Separator } from '../ui/separator';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  timestamp: string;
}

const predefinedAmounts = [500, 1000, 2500, 5000, 10000];

export function WalletManager() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [customAmount, setCustomAmount] = useState<number | string>(1000);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTxLoading, setIsTxLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');


  const amountInNaira = typeof customAmount === 'string' ? parseFloat(customAmount) || 0 : customAmount;

  const config: PaystackHookConfig = {
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    reference: (new Date()).getTime().toString(),
    email: user?.email || '',
    amount: amountInNaira * 100, // Amount in Kobo
    metadata: {
      user_id: user?.uid || '',
    },
    redirect: true,
  };

  const initializePayment = usePaystackPayment(config);

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
     if (amountInNaira < 100) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'The minimum top-up amount is ₦100.',
      });
      return;
    }
    
    // The onSuccess and onClose callbacks are not used in redirect flow
    initializePayment({onSuccess: () => {}, onClose: () => {}});
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

  const filteredTransactions = useMemo(() => {
    if (filter === 'all') {
      return transactions;
    }
    return transactions.filter(tx => tx.type === filter);
  }, [transactions, filter]);


  const payButtonDisabled = profileLoading || !process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet /> My Wallet</CardTitle>
          <CardDescription>Top up your wallet balance to use Lifeline's AI features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-secondary/50 flex justify-between items-center">
            <p className="text-muted-foreground">Available Balance</p>
            {profileLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold text-primary">₦{(profile?.balance ?? 0).toLocaleString()}</p>}
          </div>

          <Separator />

          <div className="space-y-4">
            <Label htmlFor="custom-amount">Select or Enter Amount (NGN)</Label>
             <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
              {predefinedAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => setCustomAmount(amount)}
                  className={cn(
                    amount === amountInNaira && "border-primary text-primary ring-2 ring-primary"
                  )}
                >
                  ₦{amount.toLocaleString()}
                </Button>
              ))}
            </div>
            <Input
              id="custom-amount"
              type="number"
              placeholder="e.g., 1500"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              min="100"
            />
          </div>

          <Button
            className="w-full"
            onClick={handlePayment}
            disabled={payButtonDisabled}
          >
            <CreditCard className="mr-2" />
            {`Proceed to Pay ₦${amountInNaira.toLocaleString()}`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your recent wallet top-ups and service payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="credit">Top-ups</TabsTrigger>
              <TabsTrigger value="debit">Payments</TabsTrigger>
            </TabsList>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {isTxLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md">
                    <div className="flex items-center gap-3">
                      {tx.type === 'credit' ? <PlusCircle className="w-5 h-5 text-green-500" /> : <MinusCircle className="w-5 h-5 text-red-500" />}
                      <div>
                        <p className="font-semibold text-sm">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{tx.timestamp ? format(parseISO(tx.timestamp), 'MMM d, yyyy, h:mm a') : 'Date unavailable'}</p>
                      </div>
                    </div>
                    <p className={cn("font-bold text-sm", tx.type === 'credit' ? 'text-green-500' : 'text-red-500')}>
                      {tx.type === 'credit' ? '+' : '-'}₦{Math.abs(tx.amount).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No {filter !== 'all' ? filter : ''} transactions found.</p>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
