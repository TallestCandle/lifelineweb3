
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, query, where, getDocs, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import crypto from 'crypto';

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    console.error("Paystack secret key is not set in environment variables.");
    return new NextResponse("Server configuration error.", { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!signature) {
    console.warn("Webhook request missing signature.");
    return new NextResponse("Invalid signature.", { status: 400 });
  }

  // Verify the webhook signature
  const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
  if (hash !== signature) {
    console.warn("Webhook signature mismatch.");
    return new NextResponse("Invalid signature.", { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);

    // Process only successful charges
    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data;
      const userId = metadata?.user_id;

      if (!userId) {
        console.error("Webhook missing user_id in metadata.", metadata);
        return new NextResponse("Missing required metadata.", { status: 400 });
      }
      
      const amountInNaira = amount / 100; // Convert from kobo to Naira

      // Check if this transaction has already been processed to prevent double-crediting
      const txCollectionRef = collection(db, `users/${userId}/transactions`);
      const q = query(txCollectionRef, where("metadata.reference", "==", reference));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        console.log(`Transaction reference ${reference} already processed.`);
        return new NextResponse("Transaction already processed.", { status: 200 });
      }

      // Update user's balance and add to transaction history
      const profileDocRef = doc(db, 'profiles', userId);
      
      await Promise.all([
        updateDoc(profileDocRef, {
          balance: increment(amountInNaira),
        }),
        addDoc(txCollectionRef, {
          type: 'credit',
          amount: amountInNaira,
          description: `Wallet top-up via Paystack`,
          metadata: {
            reference: reference,
            gateway: 'Paystack'
          },
          timestamp: serverTimestamp(),
        })
      ]);

      console.log(`Successfully credited ₦${amountInNaira} to user ${userId}.`);
    }

    // Acknowledge the event
    return new NextResponse(null, { status: 200 });

  } catch (error: any) {
    console.error('Error processing Paystack webhook:', error);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 500 });
  }
}
