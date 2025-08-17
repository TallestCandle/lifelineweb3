'use client';

import React, { useState } from 'react';
import { usePiPayment } from '@/hooks/use-pi-payment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface PiPaymentButtonProps {
  amount: number;
  memo: string;
  metadata?: any;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  className?: string;
}

export function PiPaymentButton({
  amount,
  memo,
  metadata,
  onSuccess,
  onError,
  disabled,
  className
}: PiPaymentButtonProps) {
  const { makePayment, processing } = usePiPayment();
  const { toast } = useToast();

  const handlePayment = async () => {
    try {
      await makePayment(amount, memo, metadata);
      toast({
        title: "Payment Successful",
        description: `Successfully paid ${amount} Pi`,
      });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      onError?.(error);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={disabled || processing}
      className={className}
    >
      {processing ? "Processing..." : `Pay ${amount} Pi`}
    </Button>
  );
}

interface PiPaymentFormProps {
  onSubmit: (amount: number) => void;
  minAmount?: number;
  maxAmount?: number;
  disabled?: boolean;
  className?: string;
}

export function PiPaymentForm({
  onSubmit,
  minAmount = 0.1,
  maxAmount = 1000,
  disabled,
  className
}: PiPaymentFormProps) {
  const [amount, setAmount] = useState("");
  const { processing } = usePiPayment();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < minAmount || numAmount > maxAmount) {
      return;
    }
    onSubmit(numAmount);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="amount">Amount (Pi)</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={minAmount}
            max={maxAmount}
            step="0.1"
            disabled={disabled || processing}
            placeholder="Enter amount in Pi"
            required
          />
        </div>
        <Button type="submit" disabled={disabled || processing}>
          {processing ? "Processing..." : "Continue"}
        </Button>
      </div>
    </form>
  );
}
