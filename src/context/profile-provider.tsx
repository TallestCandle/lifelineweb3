
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ThemeId } from './theme-provider';

export interface Profile {
  name: string;
  age: string;
  gender: 'Male' | 'Female';
  address: string;
  phone: string;
  theme: ThemeId;
  balance: number;
  role: 'patient' | 'doctor'; // role is now part of the unified user document
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (data: Partial<Omit<Profile, 'theme' | 'balance' | 'role'>>) => Promise<void>;
  updateProfileTheme: (theme: ThemeId) => Promise<void>;
  updateBalance: (amount: number, description: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setLoading(false);
      setProfile(null);
      return;
    }
    
    setLoading(true);
    // Point to the 'users' collection instead of 'profiles'
    const profileDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(profileDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setProfile(docSnap.data() as Profile);
        } else {
            // This case might happen if the doc creation failed on signup, which should be rare.
            setProfile(null);
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching profile:", error);
        setProfile(null);
        setLoading(false);
    });
    
    return () => unsubscribe();

  }, [user, authLoading]);

  // createProfile is removed from here and is now handled directly in AuthForm on signup.
  
  const updateProfile = useCallback(async (data: Partial<Omit<Profile, 'theme' | 'balance' | 'role'>>) => {
    if (!user) throw new Error("User not authenticated");
    const profileDocRef = doc(db, 'users', user.uid);
    await updateDoc(profileDocRef, data);
    // Optimistic update handled by onSnapshot
  }, [user]);

  const updateProfileTheme = useCallback(async (theme: ThemeId) => {
    if (!user) throw new Error("User or profile not available");
    const profileDocRef = doc(db, 'users', user.uid);
    await updateDoc(profileDocRef, { theme });
    // Optimistic update handled by onSnapshot
  }, [user]);

  const updateBalance = useCallback(async (amount: number, description: string) => {
    if (!user) throw new Error("User not authenticated");
    
    // Log the transaction
    const txCollectionRef = collection(db, `users/${user.uid}/transactions`);
    await addDoc(txCollectionRef, {
        type: amount > 0 ? 'credit' : 'debit',
        amount: amount,
        description: description,
        timestamp: serverTimestamp()
    });
    
    // Update the profile balance in the 'users' collection
    const profileDocRef = doc(db, 'users', user.uid);
    await updateDoc(profileDocRef, {
        balance: increment(amount)
    });
    // The optimistic update is handled by the onSnapshot listener for the profile
  }, [user]);

  const value = {
    profile,
    loading: authLoading || loading,
    updateProfile,
    updateProfileTheme,
    updateBalance,
    // createProfile is removed
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === null) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
