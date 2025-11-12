import React, { createContext, useContext, useState, useCallback } from 'react';

interface ScorecardContextType {
  openNextHole: () => void;
  registerOpenNextHole: (handler: () => void) => void;
  hasNextHole: boolean;
  setHasNextHole: (hasNext: boolean) => void;
}

const ScorecardContext = createContext<ScorecardContextType | null>(null);

export function ScorecardProvider({ children }: { children: React.ReactNode }) {
  const [openNextHoleHandler, setOpenNextHoleHandler] = useState<(() => void) | null>(null);
  const [hasNextHole, setHasNextHole] = useState<boolean>(false);

  const registerOpenNextHole = useCallback((handler: () => void) => {
    setOpenNextHoleHandler(() => handler);
  }, []);

  const openNextHole = useCallback(() => {
    if (openNextHoleHandler) {
      openNextHoleHandler();
    }
  }, [openNextHoleHandler]);

  return (
    <ScorecardContext.Provider value={{ openNextHole, registerOpenNextHole, hasNextHole, setHasNextHole }}>
      {children}
    </ScorecardContext.Provider>
  );
}

export function useScorecard() {
  const context = useContext(ScorecardContext);
  if (!context) {
    return { openNextHole: () => {}, registerOpenNextHole: () => {}, hasNextHole: false, setHasNextHole: () => {} };
  }
  return context;
}

