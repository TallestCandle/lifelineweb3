'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export const themes = [
    { id: 'theme-cool-flash', name: 'Cool Flash' },
    { id: 'theme-serene-sky', name: 'Serene Sky' },
    { id: 'theme-forest-whisper', name: 'Forest Whisper' },
    { id: 'theme-midnight-bloom', name: 'Midnight Bloom' },
    { id: 'theme-sunset-glow', name: 'Sunset Glow' },
    { id: 'theme-oceanic-deep', name: 'Oceanic Deep' },
    { id: 'theme-minimalist-mono', name: 'Minimalist Mono' },
    { id: 'theme-vintage-paper', name: 'Vintage Paper' },
    { id: 'theme-cyberpunk-city', name: 'Cyberpunk City' },
    { id: 'theme-coral-reef', name: 'Coral Reef' },
    { id: 'theme-minty-fresh', name: 'Minty Fresh' },
    { id: 'theme-royal-amethyst', name: 'Royal Amethyst' },
] as const;

type ThemeId = typeof themes[number]['id'];

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'nexus-lifeline-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('theme-cool-flash');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (storedTheme && themes.some(t => t.id === storedTheme)) {
      setThemeState(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      document.documentElement.className = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme, isMounted]);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  if (!isMounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
