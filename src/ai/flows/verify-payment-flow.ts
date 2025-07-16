
'use server';
/**
 * @fileOverview A secure backend flow for verifying Paystack payments.
 *
 * - verifyPayment - Verifies a transaction and awards credits if successful.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, collection, addDoc, updateDoc, increment } from 'firebase/firestore';

const VerifyPaymentInputSchema = z.object({
  transactionReference: z.string().describe("The transaction reference from Paystack."),
  userId: z.string().describe("The UID of the user to award credits to."),
  creditsToAdd: z.number().int().positive().describe("The number of credits to add upon successful verification."),
  amountPaid: z.number().int().positive().describe("The amount in NGN the user was supposed to pay."),
});
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentInputSchema>;

const VerifyPaymentOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});
export type VerifyPaymentOutput = z.infer<typeof VerifyPaymentOutputSchema>;

export async function verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentOutput> {
  return verifyPaymentFlow(input);
}

const verifyPaymentFlow = ai.defineFlow(
  {
    name: 'verifyPaymentFlow',
    inputSchema: VerifyPaymentInputSchema,
    outputSchema: VerifyPaymentOutputSchema,
  },
  async (input) => {
    const { transactionReference, userId, creditsToAdd, amountPaid } = input;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error("Paystack secret key is not set in environment variables.");
      return { success: false, message: "Server configuration error." };
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${transactionReference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Paystack API returned status ${response.status}`);
      }

      const verificationData = await response.json();

      // --- Security Checks ---
      if (verificationData.status !== true || !verificationData.data) {
        return { success: false, message: "Transaction verification failed." };
      }
      
      const { status, amount, currency } = verificationData.data;

      if (status !== 'success') {
        return { success: false, message: `Transaction was not successful. Status: ${status}` };
      }
      
      // Paystack returns amount in kobo, so we divide by 100
      if (amount / 100 !== amountPaid) {
        return { success: false, message: `Amount paid (${amount / 100}) does not match expected amount (${amountPaid}).` };
      }
      
      if (currency !== 'NGN') {
        return { success: false, message: `Incorrect currency. Expected NGN, got ${currency}.` };
      }
      
      // --- All checks passed, update Firestore ---
      const profileDocRef = doc(db, 'profiles', userId);
      const txCollectionRef = collection(db, `users/${userId}/transactions`);

      await Promise.all([
        updateDoc(profileDocRef, {
            credits: increment(creditsToAdd),
        }),
        addDoc(txCollectionRef, {
            type: 'credit',
            amount: creditsToAdd,
            description: `Purchased ${creditsToAdd} credits via Paystack (Ref: ${transactionReference})`,
            timestamp: new Date().toISOString(),
        })
      ]);
      
      return { success: true, message: "Payment verified and credits awarded." };

    } catch (error) {
      console.error('Error during Paystack verification:', error);
      return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred." };
    }
  }
);
