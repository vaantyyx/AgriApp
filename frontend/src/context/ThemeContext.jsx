// @ts-check
import { createContext, useState, useEffect, useContext } from 'react';

/** @typedef {{ theme: string, toggleTheme: () => void }} ThemeContextValue */

/** @type {import('react').Context<ThemeContextValue|null>} */
const ThemeContext = createContext(null);

/** @param {{ children: import('react').ReactNode }} props */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('sougra_theme') || 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    try {
      localStorage.setItem('sougra_theme', theme);
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- context + its hook are colocated by design
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
