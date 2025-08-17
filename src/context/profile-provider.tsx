
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import type { ThemeId } from './theme-provider';

// Profile now reflects the Pi user structure.
// Balance is removed as payments are direct.
export interface Profile {
  name: string;
  age: string;
  gender: 'Male' | 'Female';
  address: string;
  phone: string;
  theme: ThemeId;
  role: 'patient'; // Only patient role for now
  username: string; // From Pi
  uid: string; // From Pi
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (data: Partial<Omit<Profile, 'theme' | 'role' | 'username' | 'uid'>>) => Promise<void>;
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
    const profileDocRef = doc(db, 'users', user.uid);
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
  
  const updateProfile = useCallback(async (data: Partial<Omit<Profile, 'theme' | 'role' | 'username' | 'uid'>>) => {
    if (!user) throw new Error("User not authenticated");
    const profileDocRef = doc(db, 'users', user.uid);
    await updateDoc(profileDocRef, data);
  }, [user]);

  const updateProfileTheme = useCallback(async (theme: ThemeId) => {
    if (!user) throw new Error("User or profile not available");
    const profileDocRef = doc(db, 'users', user.uid);
    await updateDoc(profileDocRef, { theme });
  }, [user]);
  
  const value = {
    profile,
    loading: authLoading || loading,
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
