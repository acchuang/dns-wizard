import { createContext, useContext, useState, ReactNode } from "react";

interface SimpleModeContextType {
  simpleMode: boolean;
  toggleSimpleMode: () => void;
}

const SimpleModeContext = createContext<SimpleModeContextType>({
  simpleMode: false,
  toggleSimpleMode: () => {},
});

export function SimpleModeProvider({ children }: { children: ReactNode }) {
  const [simpleMode, setSimpleMode] = useState(false);
  const toggleSimpleMode = () => setSimpleMode((prev) => !prev);
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