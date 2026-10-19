import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('system');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load initial preference
    const saved = localStorage.getItem('clara-theme-preference') as ThemeMode || 'system';
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    let effectiveTheme: 'light' | 'dark' = 'light';

    if (mode === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = systemDark ? 'dark' : 'light';
    } else {
      effectiveTheme = mode as 'light' | 'dark';
    }

    root.setAttribute('data-theme', effectiveTheme);
    localStorage.setItem('clara-theme-preference', mode);
  };

  const cycleTheme = () => {
    let nextTheme: ThemeMode = 'light';
    if (theme === 'light') nextTheme = 'dark';
    else if (theme === 'dark') nextTheme = 'system';
    else if (theme === 'system') nextTheme = 'light';

    setTheme(nextTheme);
    applyTheme(nextTheme);

    // Trigger 360-degree rotation animation on the button/icon
    const themeIcon = document.getElementById('theme-icon-svg');
    if (themeIcon) {
      themeIcon.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        themeIcon.style.transform = 'none';
      }, 300);
    }
  };

  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  return { theme, setTheme: (mode: ThemeMode) => { setTheme(mode); applyTheme(mode); }, cycleTheme };
}
