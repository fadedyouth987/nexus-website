'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SafeModeContextType {
  isSafeMode: boolean;
  toggleSafeMode: () => void;
}

const SafeModeContext = createContext<SafeModeContextType | undefined>(undefined);

export function SafeModeProvider({ children }: { children: ReactNode }) {
  const [isSafeMode, setIsSafeMode] = useState<boolean>(true); // Default to Safe Mode ON

  const toggleSafeMode = () => {
    setIsSafeMode(prevMode => !prevMode);
  };

  return (
    <SafeModeContext.Provider value={{ isSafeMode, toggleSafeMode }}>
      {children}
    </SafeModeContext.Provider>
  );
}

export function useSafeMode() {
  const context = useContext(SafeModeContext);
  if (context === undefined) {
    throw new Error('useSafeMode must be used within a SafeModeProvider');
  }
  return context;
}
