import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "corp_theme";

function readTheme() {
  try { return localStorage.getItem(THEME_KEY) || "light"; } catch { return "light"; }
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
