
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

declare const Pi: any;

export interface PiUser {
  uid: string;
  username: string;
}

interface AuthContextType {
  user: PiUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // This effect runs once on mount to check if Pi SDK is available
    // and to initialize it.
    if (typeof window !== 'undefined' && 'Pi' in window) {
      Pi.init({ version: "2.0", sandbox: true });
    }
    setLoading(false); // Initial load done
  }, []);

  const signIn = useCallback(async () => {
    if (typeof Pi === 'undefined') {
        throw new Error("Pi SDK not loaded. Please try again in a moment.");
    }

    setLoading(true);
    try {
      const scopes = ['username', 'payments'];
      const piUser: PiUser = await Pi.authenticate(scopes, onIncompletePaymentFound);
      setUser(piUser);
      
      // Check if user exists in Firestore, if not, create a new record
      const userDocRef = doc(db, 'users', piUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          username: piUser.username,
          uid: piUser.uid,
          createdAt: new Date().toISOString(),
          // Default profile fields
          name: piUser.username,
          role: 'patient',
          balance: 0, // No longer used for fiat, could be adapted for other purposes
        });
      }
      router.push('/');
    } catch (err: any) {
      console.error("Pi authentication error:", err);
      // Let the caller handle the toast message for specific errors.
      throw err;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const onIncompletePaymentFound = (payment: any) => {
    console.log("Incomplete payment found:", payment);
    // Here you would handle the incomplete payment, e.g., by navigating to a payment resolution page.
    return;
  };

  const signOut = useCallback(() => {
    setUser(null);
    router.push('/auth');
  }, [router]);

  const value = { user, loading, signIn, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
