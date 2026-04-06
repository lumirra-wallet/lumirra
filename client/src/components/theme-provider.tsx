import { createContext, useContext, useEffect, useState } from "react";
import { safeStorage } from "@/lib/safe-storage";

type Theme = "light" | "dark";

type ThemeProviderProps = {
  children: React.ReactNode;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setThemeFromDB: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = safeStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return getSystemTheme();
  });

  // Apply theme class to <html> element AND sync the browser/OS status-bar
  // colour (theme-color meta tag) so it always matches the app background.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);

    // #0F1E42 = dark navy visible on Chrome Android dark mode
    // #EEF3FC = light blue-gray
    const color = theme === "dark" ? "#0F1E42" : "#EEF3FC";

    // Single non-media-query meta keeps Chrome from picking the wrong variant
    // when the OS dark-mode setting differs from the user's chosen app theme
    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute("content", color);

    // iOS PWA: update the status-bar-style so text colour adapts to the theme.
    // "default" = dark text (suits light backgrounds), "black-translucent" = light text
    const iosBarStyle = theme === "dark" ? "black-translucent" : "default";
    const iosMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-status-bar-style"]'
    );
    if (iosMeta) {
      iosMeta.setAttribute("content", iosBarStyle);
    }
  }, [theme]);

  // Listen for system theme changes and follow them when no explicit preference is saved
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = safeStorage.getItem("theme");
      if (!savedTheme) {
        // No explicit user preference — follow the system
        setThemeState(e.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  // User explicitly sets a theme — persists to localStorage + DB
  const setTheme = (newTheme: Theme) => {
    safeStorage.setItem("theme", newTheme);
    setThemeState(newTheme);
    fetch("/api/user/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  };

  // DB sync — applies theme without writing to localStorage or DB
  const setThemeFromDB = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  };

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, setThemeFromDB, toggleTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
