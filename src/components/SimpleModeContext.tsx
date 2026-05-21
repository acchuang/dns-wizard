import { createContext, useContext, useState, ReactNode } from "react";

interface SimpleModeContextType {
  simpleMode: boolean;
  toggleSimpleMode: () => void;
}

const STORAGE_KEY = "dnswizard-simple-mode";

function getStoredSimpleMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

const SimpleModeContext = createContext<SimpleModeContextType>({
  simpleMode: false,
  toggleSimpleMode: () => {},
});

export function SimpleModeProvider({ children }: { children: ReactNode }) {
  const [simpleMode, setSimpleMode] = useState(getStoredSimpleMode);
  const toggleSimpleMode = () => {
    setSimpleMode((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };
  return (
    <SimpleModeContext.Provider value={{ simpleMode, toggleSimpleMode }}>
      {children}
    </SimpleModeContext.Provider>
  );
}

export function useSimpleMode() {
  return useContext(SimpleModeContext);
}

export default SimpleModeContext;