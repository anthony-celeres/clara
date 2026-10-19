'use client';

import React from 'react';

interface ProgressBarProps {
  value: number; // current done items
  max: number; // total items
}

export default function ProgressBar({ value, max }: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-secondary)]">
        <span>Natapos: {value} / {max}</span>
        <span>{percentage}%</span>
      </div>
      <div className="progress-track w-full h-[4px] bg-[var(--surface-highlight)] rounded-full overflow-hidden">
        <div 
          className="progress-fill h-full bg-[var(--primary-green)] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
