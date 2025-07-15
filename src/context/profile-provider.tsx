
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import type { ThemeId } from './theme-provider';

export interface Profile {
  name: string;
  age: string;
  gender: 'Male' | 'Female';
  address: string;
  phone: string;
  theme: ThemeId;
  credits: number;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  createProfile: (data: Omit<Profile, 'theme' | 'credits'>) => Promise<void>;
  updateProfile: (data: Partial<Omit<Profile, 'theme' | 'credits'>>) => Promise<void>;
  updateProfileTheme: (theme: ThemeId) => Promise<void>;
  updateCredits: (amount: number) => Promise<void>;
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
    const profileDocRef = doc(db, 'profiles', user.uid);
    const unsubscribe = onSnapshot(profileDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setProfile(docSnap.data() as Profile);
        } else {
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

  const createProfile = useCallback(async (data: Omit<Profile, 'theme' | 'credits'>) => {
    if (!user) throw new Error("User not authenticated");
    const newProfile: Profile = {
      ...data,
      theme: 'theme-cool-flash', // Default theme
      credits: 100, // Welcome credits
    };
    const profileDocRef = doc(db, 'profiles', user.uid);
    await setDoc(profileDocRef, newProfile);
    setProfile(newProfile);
  }, [user]);

  const updateProfile = useCallback(async (data: Partial<Omit<Profile, 'theme' | 'credits'>>) => {
    if (!user || !profile) throw new Error("User or profile not available");
    const profileDocRef = doc(db, 'profiles', user.uid);
    await updateDoc(profileDocRef, data);
    setProfile(prev => ({ ...prev!, ...data }));
  }, [user, profile]);

  const updateProfileTheme = useCallback(async (theme: ThemeId) => {
    if (!user || !profile) throw new Error("User or profile not available");
    const profileDocRef = doc(db, 'profiles', user.uid);
    await updateDoc(profileDocRef, { theme });
    setProfile(prev => ({ ...prev!, theme }));
  }, [user, profile]);

  const updateCredits = useCallback(async (amount: number) => {
    if (!user) throw new Error("User not authenticated");
    const profileDocRef = doc(db, 'profiles', user.uid);
    await updateDoc(profileDocRef, {
        credits: increment(amount)
    });
    // The optimistic update is handled by the onSnapshot listener
  }, [user]);

  const value = {
    profile,
    loading: authLoading || loading,
    createProfile,
    updateProfile,
    updateProfileTheme,
    updateCredits,
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
