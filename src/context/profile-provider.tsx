
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
  updateProfile: (profileData: Partial<Omit<Profile, 'id'>>) => Promise<void>;
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
    if (authLoading) {
      return;
    }
    if (!user) {
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
            // Using a simpler path: /users/{userId}
            const profileDocRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(profileDocRef);
            
            if (docSnap.exists()) {
                setProfile({ id: docSnap.id, ...(docSnap.data() as Omit<Profile, 'id'>) });
            } else {
                setProfile(null);
                if (pathname !== '/profiles') {
                    router.replace('/profiles');
                }
            }
        } catch (error) {
            console.error("Failed to load profile from Firestore", error);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };
    
    loadProfile();
  }, [user, authLoading, pathname, router]);

  const createProfile = useCallback(async (profileData: Omit<Profile, 'id' | 'theme'>) => {
    if (!user || !db) throw new Error("User not authenticated or DB not available");
    
    const newProfileData = { 
        name: profileData.name,
        age: profileData.age,
        gender: profileData.gender,
        theme: 'theme-cool-flash' as ThemeId,
    };
    
    // Using a simpler path: /users/{userId}
    await setDoc(doc(db, 'users', user.uid), newProfileData);
    setProfile({ ...newProfileData, id: user.uid });
    router.push('/');
  }, [user, router]);

  const updateProfile = useCallback(async (profileData: Partial<Omit<Profile, 'id'>>) => {
    if (!user || !profile || !db) throw new Error("No profile to update or DB not available");
    // Using a simpler path: /users/{userId}
    const profileDocRef = doc(db, 'users', user.uid);
    await updateDoc(profileDocRef, profileData);
    setProfile(prev => prev ? { ...prev, ...profileData } as Profile : null);
  }, [user, profile]);
  
  const updateProfileTheme = useCallback(async (themeId: ThemeId) => {
    if (!user || !profile || !db) throw new Error("No profile to update or DB not available");
    await updateProfile({ theme: themeId });
  }, [user, profile, updateProfile]);
  
  if (authLoading || loading) {
    return <Loader />;
  }
  
  // While redirecting to /profiles, show a loader.
  if (user && !profile && pathname !== '/profiles') {
      return <Loader />;
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
