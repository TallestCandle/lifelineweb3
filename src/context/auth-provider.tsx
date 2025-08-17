
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

// Pi SDK Types
interface PiSDK {
  init(config: { version: string; sandbox: boolean }): void;
  authenticate(scopes: string[], onIncompletePayment?: (payment: any) => void): Promise<PiUser>;
}

interface PiPayment {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: any;
  from_address: string;
  to_address: string;
  direction: string;
  network: string;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction?: {
    txid: string;
    verified: boolean;
    _link: string;
  };
  created_at: string;
}

declare const Pi: PiSDK;

export interface PiUser {
  uid: string;
  username: string;
  accessToken?: string;
}

interface UserDocument {
  username: string;
  uid: string;
  createdAt: string;
  lastLoginAt: string;
  name: string;
  role: 'patient' | 'doctor' | 'admin';
  balance: number;
  isActive: boolean;
  profile?: {
    email?: string;
    phone?: string;
    avatar?: string;
  };
}

interface AuthContextType {
  user: PiUser | null;
  userData: UserDocument | null;
  loading: boolean;
  sdkLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  refreshUserData: () => Promise<void>;
}

// Custom errors
class PiAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PiAuthError';
  }
}

class FirestoreError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FirestoreError';
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

const PI_SDK_VERSION = '2.0';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PiUser | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [sdkLoading, setSdkLoading] = useState(true);
  const router = useRouter();

  // Initialize Pi SDK
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;
    const intervalTime = 500; // 0.5 seconds

    const initPiSdk = () => {
      if (typeof window !== 'undefined' && 'Pi' in window) {
        try {
          Pi.init({ version: PI_SDK_VERSION, sandbox: true });
          console.log('Pi SDK initialized successfully');
          setSdkLoading(false);
          return true;
        } catch (error) {
          console.error('Error initializing Pi SDK:', error);
          return false;
        }
      }
      return false;
    };

    if (initPiSdk()) {
      return;
    }

    const intervalId = setInterval(() => {
      attempts++;
      if (initPiSdk()) {
        clearInterval(intervalId);
      } else if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        console.error('Pi SDK failed to load after multiple attempts.');
        setSdkLoading(false); // Stop loading even if it fails
      }
    }, intervalTime);

    return () => clearInterval(intervalId);
  }, []);

  // Validate Pi user data
  const validatePiUser = (piUser: any): PiUser => {
    if (!piUser || typeof piUser !== 'object') {
      throw new PiAuthError('Invalid user data received from Pi Network', 'INVALID_USER_DATA');
    }
    
    if (!piUser.uid || typeof piUser.uid !== 'string') {
      throw new PiAuthError('Missing or invalid user ID', 'INVALID_USER_ID');
    }
    
    if (!piUser.username || typeof piUser.username !== 'string') {
      throw new PiAuthError('Missing or invalid username', 'INVALID_USERNAME');
    }

    return {
      uid: piUser.uid,
      username: piUser.username,
      accessToken: piUser.accessToken
    };
  };

  // Handle incomplete payments
  const onIncompletePaymentFound = useCallback((payment: PiPayment) => {
    console.log("Incomplete payment found:", payment);
    
    // Store incomplete payment info for later processing
    if (typeof window !== 'undefined') {
      const incompletePayments = JSON.parse(
        localStorage.getItem('incompletePayments') || '[]'
      );
      incompletePayments.push({
        ...payment,
        foundAt: new Date().toISOString()
      });
      localStorage.setItem('incompletePayments', JSON.stringify(incompletePayments));
    }
    
    // You can navigate to a payment resolution page or show a notification
    // router.push(`/payments/resolve?paymentId=${payment.identifier}`);
    
    return payment;
  }, []);

  // Refresh user data from Firestore
  const refreshUserData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        setUserData(docSnap.data() as UserDocument);
      } else {
        console.warn('User document not found in Firestore');
        setUserData(null);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      throw new FirestoreError('Failed to refresh user data', 'REFRESH_ERROR');
    }
  }, [user?.uid]);

  // Create or update user in Firestore
  const createOrUpdateUser = async (piUser: PiUser): Promise<UserDocument> => {
    try {
      const userDocRef = doc(db, 'users', piUser.uid);
      const docSnap = await getDoc(userDocRef);
      
      const now = new Date().toISOString();
      
      if (!docSnap.exists()) {
        // Create new user
        const newUserData: UserDocument = {
          username: piUser.username,
          uid: piUser.uid,
          createdAt: now,
          lastLoginAt: now,
          name: piUser.username,
          role: 'patient',
          balance: 0,
          isActive: true,
          profile: {}
        };
        
        await setDoc(userDocRef, {
          ...newUserData,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        });
        
        console.log('New user created in Firestore');
        return newUserData;
      } else {
        // Update existing user's last login
        const existingData = docSnap.data() as UserDocument;
        const updatedData = {
          ...existingData,
          lastLoginAt: now,
          username: piUser.username, // Update username in case it changed
          isActive: true
        };
        
        await setDoc(userDocRef, {
          lastLoginAt: serverTimestamp(),
          username: piUser.username,
          isActive: true
        }, { merge: true });
        
        console.log('User login time updated in Firestore');
        return updatedData;
      }
    } catch (error) {
      console.error('Error creating/updating user in Firestore:', error);
      throw new FirestoreError('Failed to save user data', 'FIRESTORE_SAVE_ERROR');
    }
  };

  // Sign in with Pi Network
  const signIn = useCallback(async () => {
    if (sdkLoading) {
      throw new PiAuthError('Pi SDK is still loading. Please wait a moment and try again.', 'SDK_LOADING');
    }

    if (typeof Pi === 'undefined') {
      throw new PiAuthError('Pi SDK not available. Please ensure you are using the Pi Browser.', 'SDK_NOT_AVAILABLE');
    }

    setLoading(true);
    
    try {
      // Authenticate with Pi Network
      const scopes = ['username', 'payments'];
      const piUserData = await Pi.authenticate(scopes, onIncompletePaymentFound);
      
      // Validate the received user data
      const validatedUser = validatePiUser(piUserData);
      
      // Create or update user in Firestore
      const userData = await createOrUpdateUser(validatedUser);
      
      // Update state
      setUser(validatedUser);
      setUserData(userData);
      
      // Navigate to main app
      router.push('/');
      
      console.log('User signed in successfully:', validatedUser.username);
      
    } catch (error: any) {
      console.error('Sign-in error:', error);
      
      // Clear user state on error
      setUser(null);
      setUserData(null);
      
      // Handle specific error types
      if (error instanceof PiAuthError || error instanceof FirestoreError) {
        throw error;
      }
      
      // Handle Pi Network specific errors
      if (error.message?.includes('User cancelled')) {
        throw new PiAuthError('Sign-in was cancelled', 'USER_CANCELLED');
      }
      
      if (error.message?.includes('Network')) {
        throw new PiAuthError('Network error. Please check your connection and try again.', 'NETWORK_ERROR');
      }
      
      // Generic error
      throw new PiAuthError('Sign-in failed. Please try again.', 'SIGN_IN_FAILED');
      
    } finally {
      setLoading(false);
    }
  }, [sdkLoading, onIncompletePaymentFound, router]);

  // Sign out
  const signOut = useCallback(() => {
    setUser(null);
    setUserData(null);
    
    // Clear any stored incomplete payments
    if (typeof window !== 'undefined') {
      localStorage.removeItem('incompletePayments');
    }
    
    router.push('/auth');
    console.log('User signed out');
  }, [router]);

  // Auto-refresh user data periodically
  useEffect(() => {
    if (!user?.uid) return;

    const interval = setInterval(() => {
      refreshUserData().catch(console.error);
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, [user?.uid, refreshUserData]);

  const value: AuthContextType = {
    user,
    userData,
    loading,
    sdkLoading,
    signIn,
    signOut,
    refreshUserData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper hook for checking authentication status
export const useAuthRequired = () => {
  const { user, loading, sdkLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !sdkLoading && !user) {
      router.push('/auth');
    }
  }, [user, loading, sdkLoading, router]);

  return { user, loading: loading || sdkLoading };
};

// Export error classes for use in components
export { PiAuthError, FirestoreError };
