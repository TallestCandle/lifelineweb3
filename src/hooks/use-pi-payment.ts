'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/context/auth-provider';
import { PiPaymentService } from '@/lib/pi-payment';

export interface PaymentHookResult {
  makePayment: (amount: number, memo: string, metadata?: any) => Promise<void>;
  processing: boolean;
  error: Error | null;
}

export function usePiPayment(): PaymentHookResult {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const makePayment = useCallback(async (amount: number, memo: string, metadata?: any) => {
    if (!user) {
      throw new Error('User must be authenticated to make payments');
    }

    setProcessing(true);
    setError(null);

    try {
      const paymentService = PiPaymentService.getInstance();
      await paymentService.createPayment({
        amount,
        memo,
        metadata,
        uid: user.uid
      });
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [user]);

  return {
    makePayment,
    processing,
    error
  };
}
