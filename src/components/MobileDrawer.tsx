'use client';

import React from 'react';
import { X } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function MobileDrawer({ isOpen, onClose, title, children }: MobileDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden select-none">
      {/* Overlay */}
      <div 
        className="drawer-overlay absolute inset-0 bg-black/40 cursor-pointer"
        onClick={onClose}
      />
      {/* Drawer Panel */}
      <div 
        className={`drawer-content fixed left-0 right-0 bottom-0 bg-[var(--surface)] border-t border-[var(--accent-border)] rounded-t-2xl shadow-[var(--shadow-card)] p-5 z-50 flex flex-col gap-4 max-h-[92dvh] overflow-y-auto transition-transform duration-300 ease-out open`}
      >
        {/* Drag handle indicator */}
        <div className="drawer-drag-handle w-10 h-1 bg-[var(--text-disabled)] rounded-full mx-auto mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--accent-border)] pb-3">
          <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
          <button 
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] cursor-pointer active:scale-95 transition-all"
            aria-label="Isara ang checklist"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
