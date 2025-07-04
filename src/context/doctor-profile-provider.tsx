
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-provider';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { updateProfile as updateAuthProfile } from 'firebase/auth';


export interface DoctorProfile {
  name: string;
  specialty: string;
}

interface DoctorProfileContextType {
  profile: DoctorProfile | null;
  loading: boolean;
  createProfile: (data: DoctorProfile) => Promise<void>;
  updateProfile: (data: Partial<DoctorProfile>) => Promise<void>;
}

const DoctorProfileContext = createContext<DoctorProfileContextType | null>(null);

export function DoctorProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
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
    const profileDocRef = doc(db, 'doctor_profiles', user.uid);
    getDoc(profileDocRef).then(docSnap => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as DoctorProfile);
      } else {
        setProfile(null);
      }
    }).catch(error => {
      console.error("Error fetching doctor profile:", error);
      setProfile(null);
    }).finally(() => {
      setLoading(false);
    });
  }, [user, authLoading]);

  const createProfile = useCallback(async (data: DoctorProfile) => {
    if (!user) throw new Error("User not authenticated");
    
    // Also update Auth profile displayName to match
    if (auth.currentUser) {
        await updateAuthProfile(auth.currentUser, { displayName: data.name });
    }

    const profileDocRef = doc(db, 'doctor_profiles', user.uid);
    await setDoc(profileDocRef, data);
    setProfile(data);
  }, [user]);

  const updateProfile = useCallback(async (data: Partial<DoctorProfile>) => {
    if (!user || !profile) throw new Error("User or profile not available");
    
    const profileDocRef = doc(db, 'doctor_profiles', user.uid);
    await updateDoc(profileDocRef, data);

    // Also update Auth profile displayName if name is changing
    if (data.name && auth.currentUser) {
        await updateAuthProfile(auth.currentUser, { displayName: data.name });
    }
    
    setProfile(prev => ({ ...prev!, ...data }));
  }, [user, profile]);


  const value = {
    profile,
    loading: authLoading || loading,
    createProfile,
    updateProfile,
  };

  return <DoctorProfileContext.Provider value={value}>{children}</DoctorProfileContext.Provider>;
}

export const useDoctorProfile = () => {
  const context = useContext(DoctorProfileContext);
  if (context === null) {
    throw new Error('useDoctorProfile must be used within a DoctorProfileProvider');
  }
  return context;
};
