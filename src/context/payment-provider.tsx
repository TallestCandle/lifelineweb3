'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './auth-provider';
import { PiPaymentService } from '@/lib/pi-payment';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface PaymentContextType {
  makePayment: (amount: number, memo: string, metadata?: any) => Promise<void>;
  processing: boolean;
  currentPaymentId: string | null;
  error: Error | null;
}

const PaymentContext = createContext<PaymentContextType | null>(null);

export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const savePaymentToFirestore = async (payment: any) => {
    if (!user?.uid) return;

    try {
      const paymentRef = doc(db, 'payments', payment.identifier);
      await setDoc(paymentRef, {
        userId: user.uid,
        amount: payment.amount,
        memo: payment.memo,
        status: 'completed',
        txid: payment.transaction?.txid || '',
        metadata: payment.metadata || {},
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error saving payment to Firestore:', err);
    }
  };

  const makePayment = useCallback(async (amount: number, memo: string, metadata?: any) => {
    if (!user) {
      throw new Error('User must be authenticated to make payments');
    }

    setProcessing(true);
    setError(null);

    try {
      // Ensure the amount is valid
      if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      const paymentService = PiPaymentService.getInstance();
      const payment = await paymentService.createPayment({
        amount,
        memo,
        metadata: {
          ...metadata,
          userId: user.uid,
        },
      });

      setCurrentPaymentId(payment.identifier);

      // Save initial payment record
      await savePaymentToFirestore({
        ...payment,
        status: 'pending',
      });

      // Wait for payment completion
      const completedPayment = await paymentService.waitForPaymentCompletion(payment.identifier);

      // Update payment record
      await savePaymentToFirestore(completedPayment);

      toast({
        title: "Payment Successful",
        description: `Successfully paid ${amount} Pi`,
      });

      return completedPayment;
    } catch (err: any) {
      setError(err);
      toast({
        title: "Payment Failed",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setProcessing(false);
      setCurrentPaymentId(null);
    }
  }, [user, toast]);

  const value = {
    makePayment,
    processing,
    currentPaymentId,
    error,
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
}
