'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/auth-provider';

interface PaymentRecord {
  id: string;
  amount: number;
  memo: string;
  status: string;
  txid: string;
  createdAt: Date;
  userId: string;
}

export function PaymentHistory() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const paymentsRef = collection(db, 'payments');
    const q = query(
      paymentsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPayments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as PaymentRecord[];
      
      setPayments(newPayments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  if (loading) {
    return <div>Loading payments...</div>;
  }

  if (payments.length === 0) {
    return <div>No payment history found.</div>;
  }

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-4">Payment History</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount (Pi)</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Transaction ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                {format(payment.createdAt, 'MMM d, yyyy HH:mm')}
              </TableCell>
              <TableCell>{payment.amount.toFixed(2)}</TableCell>
              <TableCell>{payment.memo}</TableCell>
              <TableCell>
                <Badge 
                  variant={
                    payment.status === 'completed' ? 'default' :
                    payment.status === 'pending' ? 'secondary' :
                    'destructive'
                  }
                >
                  {payment.status}
                </Badge>
              </TableCell>
              <TableCell className="font-mono">
                {payment.txid.slice(0, 8)}...{payment.txid.slice(-8)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
