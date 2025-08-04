
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface FeatureFlags {
  isClinicEnabled: boolean;
  isReportEnabled: boolean;
  isPrescriptionsEnabled: boolean;
}

export interface SignupControls {
  isPatientSignupDisabled: boolean;
  isDoctorSignupDisabled: boolean;
  isAdminSignupDisabled: boolean;
}

export interface SystemSettings {
  featureFlags: FeatureFlags;
  signupControls: SignupControls;
}

interface SettingsContextType {
  settings: SystemSettings | null;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const defaultSettings: SystemSettings = {
    featureFlags: {
        isClinicEnabled: true,
        isReportEnabled: true,
        isPrescriptionsEnabled: true,
    },
    signupControls: {
        isPatientSignupDisabled: false,
        isDoctorSignupDisabled: false,
        isAdminSignupDisabled: true,
    }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings | null>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const settingsDocRef = doc(db, 'system_settings', 'controls');
    
    const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            // Merge fetched data with defaults to avoid errors if some fields are missing
            const data = docSnap.data();
            setSettings({
                featureFlags: { ...defaultSettings.featureFlags, ...data.featureFlags },
                signupControls: { ...defaultSettings.signupControls, ...data.signupControls },
            });
        } else {
            // If the document doesn't exist, use the hardcoded defaults
            setSettings(defaultSettings);
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching system settings:", error);
        // Fallback to defaults on error
        setSettings(defaultSettings);
        setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const value = { settings, loading };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === null) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
