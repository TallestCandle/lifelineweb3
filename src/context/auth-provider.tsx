
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserRole = 'patient' | 'doctor' | 'admin';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
        setLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // User is signed in, fetch their role from Firestore.
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setRole(docSnap.data().role as UserRole);
          } else {
            // This case might happen if user doc creation failed during signup.
            // Or if it's a very old account before roles were introduced.
            console.log("No such user document! Setting role to null.");
            setRole(null);
          }
        } catch (error) {
            console.error("Error fetching user role:", error);
            setRole(null);
        }
      } else {
        // User is signed out.
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = { user, role, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
