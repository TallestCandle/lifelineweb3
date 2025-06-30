
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-provider';
import { Loader } from '@/components/ui/loader';
import { usePathname, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, addDoc, deleteDoc, updateDoc, query, writeBatch, orderBy, where } from 'firebase/firestore';
import type { ThemeId } from './theme-provider';

export interface Profile {
  id: string;
  name: string;
  age: string;
  gender: 'Male' | 'Female' | 'Other';
  theme?: ThemeId;
}

interface ProfileContextType {
  profiles: Profile[];
  activeProfile: Profile | null;
  loading: boolean;
  addProfile: (profileData: Omit<Profile, 'id' | 'theme'>) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  updateProfile: (profileId: string, profileData: Omit<Profile, 'id' | 'theme'>) => Promise<void>;
  updateProfileTheme: (themeId: ThemeId) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

async function deleteCollection(collectionPath: string) {
    const collectionRef = collection(db, collectionPath);
    const q = query(collectionRef);
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  const getActiveProfileKey = useCallback(() => user ? `nexus-lifeline-${user.uid}-active-profile-id` : null, [user]);

  useEffect(() => {
    if (authLoading) return;

    const loadProfiles = async () => {
        setLoading(true);
        if (!user) {
            setProfiles([]);
            setActiveProfile(null);
            setLoading(false);
            return;
        }

        try {
            const profilesCollectionRef = collection(db, `users/${user.uid}/profiles`);
            const q = query(profilesCollectionRef, orderBy("name"));
            const querySnapshot = await getDocs(q);
            const allProfiles: Profile[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Profile, 'id'>) }));
            
            setProfiles(allProfiles);
            
            const activeProfileIdKey = getActiveProfileKey();
            const activeProfileId = activeProfileIdKey ? window.localStorage.getItem(activeProfileIdKey) : null;
            let currentActiveProfile = allProfiles.find(p => p.id === activeProfileId) || allProfiles[0] || null;

            setActiveProfile(currentActiveProfile);

            if (activeProfileIdKey && currentActiveProfile && activeProfileId !== currentActiveProfile.id) {
                window.localStorage.setItem(activeProfileIdKey, currentActiveProfile.id);
            }

        } catch (error) {
            console.error("Failed to load profiles from Firestore", error);
        } finally {
            setLoading(false);
        }
    };
    
    loadProfiles();
  }, [user, authLoading, getActiveProfileKey]);


  const switchProfile = async (profileId: string) => {
    const profileToSwitch = profiles.find(p => p.id === profileId);
    if (profileToSwitch) {
      const activeProfileKey = getActiveProfileKey();
      if(activeProfileKey) window.localStorage.setItem(activeProfileKey, profileId);
      
      // We reload here to ensure all data across the app refreshes for the new profile.
      window.location.reload();
    }
  };

  useEffect(() => {
    if (!loading && !authLoading && user && profiles.length === 0 && pathname !== '/profiles' && pathname !== '/auth') {
      router.push('/profiles');
    }
  }, [loading, authLoading, user, profiles, pathname, router]);

  const addProfile = async (profileData: Omit<Profile, 'id' | 'theme'>) => {
    if (!user) throw new Error("User not authenticated");
    if (profiles.length >= 3) {
      throw new Error("Maximum of 3 profiles reached.");
    }
    const profilesCollectionRef = collection(db, `users/${user.uid}/profiles`);
    const newProfileData = { ...profileData, theme: 'theme-cool-flash' as ThemeId };
    const docRef = await addDoc(profilesCollectionRef, newProfileData);
    const newProfile: Profile = { ...newProfileData, id: docRef.id };
    
    const updatedProfiles = [...profiles, newProfile].sort((a,b) => a.name.localeCompare(b.name));
    setProfiles(updatedProfiles);
    
    if (profiles.length === 0) {
      await switchProfile(newProfile.id);
    }
  };


  const deleteProfile = async (profileId: string) => {
    if (!user) throw new Error("User not authenticated");
    
    await deleteDoc(doc(db, `users/${user.uid}/profiles/${profileId}`));
    
    const subCollections = ['vitals', 'tasks', 'reminders', 'reminders_history', 'test_strips', 'alerts', 'guardians', 'bookmarked_tips', 'health_analyses', 'daily_diet_plans'];
    for (const sub of subCollections) {
        await deleteCollection(`users/${user.uid}/profiles/${profileId}/${sub}`);
    }
    
    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    setProfiles(updatedProfiles);

    if (activeProfile?.id === profileId) {
      const newActiveProfile = updatedProfiles[0] || null;
      const activeProfileKey = getActiveProfileKey();
      
      if (activeProfileKey) {
          if (newActiveProfile) {
            await switchProfile(newActiveProfile.id);
          } else {
            setActiveProfile(null);
            window.localStorage.removeItem(activeProfileKey);
            router.push('/profiles');
          }
      }
    }
  };

  const updateProfile = async (profileId: string, profileData: Omit<Profile, 'id' | 'theme'>) => {
    if (!user) throw new Error("User not authenticated");
    const profileDocRef = doc(db, `users/${user.uid}/profiles/${profileId}`);
    const existingProfile = profiles.find(p => p.id === profileId);
    const dataToUpdate = { ...profileData, theme: existingProfile?.theme || 'theme-cool-flash' };
    
    await updateDoc(profileDocRef, dataToUpdate);
    
    const updatedProfiles = profiles.map(p => p.id === profileId ? { ...dataToUpdate, id: profileId } : p).sort((a,b) => a.name.localeCompare(b.name));
    setProfiles(updatedProfiles);

    if (activeProfile?.id === profileId) {
      setActiveProfile({ ...dataToUpdate, id: profileId });
    }
  };

  const updateProfileTheme = async (themeId: ThemeId) => {
    if (!user || !activeProfile) {
      throw new Error("No active profile selected.");
    }
    // Update local state for immediate UI response
    setActiveProfile(prev => (prev ? { ...prev, theme: themeId } : null));

    // Persist to Firestore in the background
    const profileDocRef = doc(db, `users/${user.uid}/profiles/${activeProfile.id}`);
    await updateDoc(profileDocRef, { theme: themeId });
  };


  if (authLoading || (loading && user)) {
    return <Loader />;
  }
  
  if (user && profiles.length === 0 && pathname !== '/profiles') {
      return <Loader />;
  }
  
  const value = { profiles, activeProfile, loading, addProfile, switchProfile, deleteProfile, updateProfile, updateProfileTheme };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === null) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
