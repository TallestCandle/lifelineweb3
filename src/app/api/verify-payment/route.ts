
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: Request) {
  const { transactionReference, userId, creditsToAdd, amountPaid } = await request.json();
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    console.error("Paystack secret key is not set in environment variables.");
    return NextResponse.json({ success: false, message: "Server configuration error." }, { status: 500 });
  }

  if (!transactionReference || !userId || !creditsToAdd || !amountPaid) {
    return NextResponse.json({ success: false, message: "Missing required parameters." }, { status: 400 });
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
      const errorBody = await response.text();
      console.error(`Paystack API returned status ${response.status}: ${errorBody}`);
      throw new Error(`Paystack API error: ${errorBody}`);
    }

    const verificationData = await response.json();

    if (verificationData.status !== true || !verificationData.data) {
      console.error("Paystack verification failed. Data:", verificationData);
      return NextResponse.json({ success: false, message: "Transaction verification failed." }, { status: 400 });
    }

    const { status, amount, currency } = verificationData.data;

    if (status !== 'success') {
      return NextResponse.json({ success: false, message: `Transaction was not successful. Status: ${status}` }, { status: 400 });
    }

    if (amount / 100 !== amountPaid) {
      return NextResponse.json({ success: false, message: `Amount paid (${amount / 100}) does not match expected amount (${amountPaid}).` }, { status: 400 });
    }

    if (currency !== 'NGN') {
      return NextResponse.json({ success: false, message: `Incorrect currency. Expected NGN, got ${currency}.` }, { status: 400 });
    }

    // All checks passed, update Firestore
    const profileDocRef = doc(db, 'profiles', userId);
    const txCollectionRef = collection(db, `users/${userId}/transactions`);

    await Promise.all([
      updateDoc(profileDocRef, {
        credits: increment(creditsToAdd),
      }),
      addDoc(txCollectionRef, {
        type: 'credit',
        amount: creditsToAdd,
        description: `Purchased ${creditsToAdd} credits via Paystack`,
        metadata: {
          reference: transactionReference,
          gateway: 'Paystack'
        },
        timestamp: serverTimestamp(),
      })
    ]);

    return NextResponse.json({ success: true, message: "Payment verified and credits awarded." });

  } catch (error: any) {
    console.error('Error during payment verification:', error);
    return NextResponse.json({ success: false, message: error.message || "An unknown error occurred." }, { status: 500 });
  }
}
