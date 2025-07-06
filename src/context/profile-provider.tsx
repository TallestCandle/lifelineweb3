
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { ThemeId } from './theme-provider';

export interface Profile {
  name: string;
  age: string;
  gender: 'Male' | 'Female';
  address: string;
  phone: string;
  theme: ThemeId;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  createProfile: (data: Omit<Profile, 'theme'>) => Promise<void>;
  updateProfile: (data: Partial<Omit<Profile, 'theme'>>) => Promise<void>;
  updateProfileTheme: (theme: ThemeId) => Promise<void>;
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
    getDoc(profileDocRef).then(docSnap => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as Profile);
      } else {
        setProfile(null);
      }
    }).catch(error => {
      console.error("Error fetching profile:", error);
      setProfile(null);
    }).finally(() => {
      setLoading(false);
    });
  }, [user, authLoading]);

  const createProfile = useCallback(async (data: Omit<Profile, 'theme'>) => {
    if (!user) throw new Error("User not authenticated");
    const newProfile: Profile = {
      ...data,
      theme: 'theme-cool-flash', // Default theme
    };
    const profileDocRef = doc(db, 'profiles', user.uid);
    await setDoc(profileDocRef, newProfile);
    setProfile(newProfile);
  }, [user]);

  const updateProfile = useCallback(async (data: Partial<Omit<Profile, 'theme'>>) => {
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

  const value = {
    profile,
    loading: authLoading || loading,
    createProfile,
    updateProfile,
    updateProfileTheme,
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
