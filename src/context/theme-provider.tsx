
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export const themes = [
    { id: 'theme-cool-flash', name: 'Cool Flash (Dark)' },
    { id: 'theme-serene-sky', name: 'Serene Sky (Light)' },
] as const;

export type ThemeId = typeof themes[number]['id'];

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>('theme-cool-flash');

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

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
