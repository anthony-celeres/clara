'use client';

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();

  return (
    <button
      onClick={cycleTheme}
      className="btn-toggle w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] active:scale-95 transition-all duration-200 cursor-pointer"
      aria-label={`Palitan ang tema, kasalukuyang naka-${theme === 'light' ? 'Light Mode' : theme === 'dark' ? 'Dark Mode' : 'System Mode'}`}
      aria-live="polite"
      title={`Cycle theme: ${theme}`}
    >
      <div id="theme-icon-svg" className="transition-transform duration-300">
        {theme === 'light' && <Sun size={16} className="text-[var(--primary-green)]" />}
        {theme === 'dark' && <Moon size={16} className="text-[var(--primary-light)]" />}
        {theme === 'system' && <Monitor size={16} className="text-[var(--text-secondary)]" />}
      </div>
    </button>
  );
}
