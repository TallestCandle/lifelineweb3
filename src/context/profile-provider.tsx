
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-provider';
import { Loader } from '@/components/ui/loader';
import { usePathname, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { ThemeId } from './theme-provider';

export interface Profile {
  id: string;
  name: string;
  age: string;
  gender: 'Male' | 'Female' | 'Other';
  theme: ThemeId;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  createProfile: (profileData: Omit<Profile, 'id' | 'theme'>) => Promise<void>;
  updateProfile: (profileData: Partial<Omit<Profile, 'id' | 'theme'>>) => Promise<void>;
  updateProfileTheme: (themeId: ThemeId) => Promise<void>;
  activeProfile: Profile | null; // For compatibility
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      setProfile(null);
      return;
    }

    const loadProfile = async () => {
        setLoading(true);
        if (!db) {
            console.error("Firestore is not initialized.");
            setLoading(false);
            return;
        }

        try {
            const profileDocRef = doc(db, `users/${user.uid}/profiles/${user.uid}`);
            const docSnap = await getDoc(profileDocRef);
            
            if (docSnap.exists()) {
                setProfile({ id: docSnap.id, ...(docSnap.data() as Omit<Profile, 'id'>) });
            } else {
                setProfile(null);
            }
        } catch (error) {
            console.error("Failed to load profile from Firestore", error);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };
    
    loadProfile();
  }, [user, authLoading]);

  const createProfile = async (profileData: Omit<Profile, 'id' | 'theme'>) => {
    if (!user || !db) throw new Error("User not authenticated or DB not available");
    
    const newProfileData = { 
        name: profileData.name,
        age: profileData.age,
        gender: profileData.gender,
        theme: 'theme-cool-flash' as ThemeId,
    };
    
    await setDoc(doc(db, `users/${user.uid}/profiles/${user.uid}`), newProfileData);
    setProfile({ ...newProfileData, id: user.uid });
    router.push('/');
  };

  const updateProfile = async (profileData: Partial<Omit<Profile, 'id' | 'theme'>>) => {
    if (!user || !profile || !db) throw new Error("No profile to update or DB not available");
    const profileDocRef = doc(db, `users/${user.uid}/profiles/${user.uid}`);
    await updateDoc(profileDocRef, profileData);
    setProfile(prev => prev ? { ...prev, ...profileData } as Profile : null);
  };
  
  const updateProfileTheme = async (themeId: ThemeId) => {
    if (!user || !profile || !db) throw new Error("No profile to update or DB not available");
    
    setProfile(prev => (prev ? { ...prev, theme: themeId } : null));

    const profileDocRef = doc(db, `users/${user.uid}/profiles/${profile.id}`);
    await updateDoc(profileDocRef, { theme: themeId });
  };
  
  // If authentication or profile data is still loading, show a loader.
  if (authLoading || loading) {
    return <Loader />;
  }
  
  // If the user is logged in but has no profile, and they are not on the profile creation page,
  // redirect them. This is the main fix for the infinite load.
  if (user && !profile && pathname !== '/profiles') {
      router.replace('/profiles');
      return <Loader />; // Show a loader while redirecting
  }
  
  const value = { profile, loading, createProfile, updateProfile, updateProfileTheme, activeProfile: profile };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === null) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
