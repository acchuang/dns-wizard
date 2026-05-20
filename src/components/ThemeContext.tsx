import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

type Theme = "light" | "dark" | "auto";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
}

const STORAGE_KEY = "dnswizard-theme";

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {}
  return "auto";
}

function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return t;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "auto",
  setTheme: () => {},
  resolved: "light",
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(getStoredTheme()));

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }, []);

  useEffect(() => {
    const resolvedValue = resolveTheme(theme);
    setResolved(resolvedValue);
    document.documentElement.setAttribute("data-theme", resolvedValue);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      setResolved(resolveTheme(theme));
      document.documentElement.setAttribute("data-theme", resolveTheme(theme));
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
