import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Icon from '../components/Icon';

const KEY = 'ecotrackify_theme';
const ThemeContext = createContext({ theme: 'light', toggle: () => {} });

const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const saved = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

// Light or dark. Starts from the saved choice, otherwise the device setting.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => saved() || systemTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    // Colours fade between themes instead of switching abruptly (styles only; removed right after)
    const root = document.documentElement;
    root.classList.add('theme-switching');
    clearTimeout(window.__themeFade);
    window.__themeFade = setTimeout(() => root.classList.remove('theme-switching'), 500);
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeToggle({ withLabel = false }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className={`theme-toggle ${withLabel ? 'with-label' : ''}`} onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
      {withLabel && <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
    </button>
  );
}
