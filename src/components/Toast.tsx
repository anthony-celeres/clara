'use client';

import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function Toast({ message, isVisible, onClose }: ToastProps) {
  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[var(--surface)]/95 border border-[var(--accent-border)] text-[var(--text-primary)] text-xs md:text-sm font-medium rounded-full shadow-[var(--shadow-card)] backdrop-blur-md transition-all duration-300 ease-out animate-message flex items-center gap-2 max-w-[90vw] select-none"
      role="status"
    >
      <CheckCircle2 size={16} className="text-[var(--primary-green)] flex-shrink-0" />
      <span className="leading-none">{message}</span>
    </div>
  );
}
