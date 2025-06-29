'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-provider';
import { Loader } from '@/components/ui/loader';
import { usePathname, useRouter } from 'next/navigation';

export interface Profile {
  id: string;
  name: string;
  age: string;
  gender: 'Male' | 'Female' | 'Other';
}

interface ProfileContextType {
  profiles: Profile[];
  activeProfile: Profile | null;
  loading: boolean;
  addProfile: (profileData: Omit<Profile, 'id'>) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  updateProfile: (profileId: string, profileData: Omit<Profile, 'id'>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  const getProfilesKey = useCallback(() => user ? `nexus-lifeline-${user.uid}-profiles` : null, [user]);
  const getActiveProfileKey = useCallback(() => user ? `nexus-lifeline-${user.uid}-active-profile-id` : null, [user]);

  useEffect(() => {
    if (authLoading) return;

    setLoading(true);
    if (!user) {
      setProfiles([]);
      setActiveProfile(null);
      setLoading(false);
      return;
    }

    try {
      const profilesKey = getProfilesKey();
      const activeProfileIdKey = getActiveProfileKey();

      if (!profilesKey || !activeProfileIdKey) {
        setLoading(false);
        return;
      }
      
      const storedProfiles = window.localStorage.getItem(profilesKey);
      const allProfiles: Profile[] = storedProfiles ? JSON.parse(storedProfiles) : [];
      setProfiles(allProfiles);
      
      const activeProfileId = window.localStorage.getItem(activeProfileIdKey);
      const currentActiveProfile = allProfiles.find(p => p.id === activeProfileId) || allProfiles[0] || null;

      setActiveProfile(currentActiveProfile);

      if (!currentActiveProfile && allProfiles.length > 0) {
        window.localStorage.setItem(activeProfileIdKey, allProfiles[0].id);
      }

    } catch (error) {
      console.error("Failed to load profile data from local storage", error);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, getProfilesKey, getActiveProfileKey]);


  const switchProfile = async (profileId: string) => {
    const profileToSwitch = profiles.find(p => p.id === profileId);
    if (profileToSwitch) {
      setActiveProfile(profileToSwitch);
      const activeProfileKey = getActiveProfileKey();
      if(activeProfileKey) window.localStorage.setItem(activeProfileKey, profileId);
      
      if (pathname === '/profiles') {
        router.push('/');
        // Brief delay to allow router to push before reload
        setTimeout(() => window.location.reload(), 100);
      } else {
        window.location.reload();
      }
    }
  };

  useEffect(() => {
    // Redirect to profile creation if no profiles exist for the logged-in user
    if (!loading && !authLoading && user && profiles.length === 0 && pathname !== '/profiles' && pathname !== '/auth') {
      router.push('/profiles');
    }

  }, [loading, authLoading, user, profiles, pathname, router]);

  const addProfile = async (profileData: Omit<Profile, 'id'>) => {
    if (profiles.length >= 3) {
      throw new Error("Maximum of 3 profiles reached.");
    }
    const newProfile: Profile = { ...profileData, id: `profile-${Date.now()}` };
    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);
    
    const profilesKey = getProfilesKey();
    if(profilesKey) window.localStorage.setItem(profilesKey, JSON.stringify(updatedProfiles));
    
    // Set as active profile if it's the first one, then switch
    if (profiles.length === 0) {
      await switchProfile(newProfile.id);
    }
  };


  const deleteProfile = async (profileId: string) => {
    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    setProfiles(updatedProfiles);

    const profilesKey = getProfilesKey();
    if(profilesKey) window.localStorage.setItem(profilesKey, JSON.stringify(updatedProfiles));

    if (activeProfile?.id === profileId) {
      const newActiveProfile = updatedProfiles[0] || null;
      const activeProfileKey = getActiveProfileKey();
      
      if (activeProfileKey) {
          if (newActiveProfile) {
            await switchProfile(newActiveProfile.id);
          } else {
            setActiveProfile(null);
            window.localStorage.removeItem(activeProfileKey);
            router.push('/profiles'); // force to creation page
          }
      }
    }
  };

  const updateProfile = async (profileId: string, profileData: Omit<Profile, 'id'>) => {
    const updatedProfiles = profiles.map(p => p.id === profileId ? { ...profileData, id: profileId } : p);
    setProfiles(updatedProfiles);
    const profilesKey = getProfilesKey();
    if (profilesKey) window.localStorage.setItem(profilesKey, JSON.stringify(updatedProfiles));

    if (activeProfile?.id === profileId) {
      setActiveProfile({ ...profileData, id: profileId });
    }
  };

  if (authLoading || (loading && user)) {
    return <Loader />;
  }
  
  // If there are no profiles and we are not on the profiles page, show loader until redirect happens.
  if (user && profiles.length === 0 && pathname !== '/profiles') {
      return <Loader />;
  }
  
  const value = { profiles, activeProfile, loading, addProfile, switchProfile, deleteProfile, updateProfile };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === null) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
