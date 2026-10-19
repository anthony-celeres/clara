'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface SuggestionChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
}

export default function SuggestionChips({ chips, onSelect }: SuggestionChipsProps) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className="suggestions-container flex flex-col sm:flex-row sm:flex-wrap justify-center gap-2.5 pb-2 w-full select-none">
      {chips.map((chip, index) => (
        <button
          key={index}
          onClick={() => onSelect(chip)}
          className="chip w-full sm:w-auto flex items-start gap-2.5 text-left"
        >
          <HelpCircle size={15} className="flex-shrink-0 mt-0.5 text-[var(--primary-green)]" />
          <span className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">{chip}</span>
        </button>
      ))}
    </div>
  );
}
