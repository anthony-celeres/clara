'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, ClipboardList, Info, HelpCircle } from 'lucide-react';
import { Guide } from '../lib/seed-data';

interface GuideModalProps {
  allLanguages: Guide[];
  isOpen: boolean;
  onClose: () => void;
}

export default function GuideModal({ allLanguages, isOpen, onClose }: GuideModalProps) {
  const [activeLang, setActiveLang] = useState<'fil' | 'eng' | 'vis'>('fil');

  // Reset active language to Filipino when modal is opened
  useEffect(() => {
    if (isOpen) {
      setActiveLang('fil');
    }
  }, [isOpen]);

  if (!isOpen || !allLanguages || allLanguages.length === 0) return null;

  // Find matching guide or fallback to first available
  const guide = allLanguages.find(g => g.language === activeLang) || allLanguages[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="drawer-overlay bg-black/50 absolute inset-0 cursor-pointer"
        onClick={onClose}
      />
      {/* Modal Container */}
      <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl shadow-[var(--shadow-card)] w-full max-w-[480px] max-h-[85dvh] z-50 animate-message flex flex-col relative select-text overflow-hidden">
        
        {/* Header (Fixed at top) */}
        <div className="p-6 pb-4 border-b border-[var(--accent-border)] relative flex-shrink-0">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            aria-label="Close guide modal"
          >
            <X size={20} />
          </button>

          {/* Title & Language Selector */}
          <div className="flex gap-2.5 items-start pr-8 select-none">
            <div className="w-8 h-8 rounded-lg bg-[var(--chip-bg)] text-[var(--primary-green)] flex items-center justify-center flex-shrink-0">
              <ClipboardList size={18} />
            </div>
            <div className="flex flex-col gap-1.5 flex-grow">
              <h2 className="text-base font-extrabold text-[var(--text-primary)] leading-tight">{guide.title}</h2>
              
              {/* Language Switcher Tabs */}
              <div className="flex gap-1 bg-[var(--surface-highlight)]/60 p-0.5 rounded-lg border border-[var(--accent-border)]/40 w-fit mt-1">
                {['fil', 'eng', 'vis'].map((langCode) => {
                  const guideInLang = allLanguages.find(g => g.language === langCode);
                  if (!guideInLang) return null;
                  return (
                    <button
                      key={langCode}
                      onClick={() => setActiveLang(langCode as any)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer
                        ${activeLang === langCode
                          ? 'bg-[var(--surface)] border border-[var(--accent-border)]/60 shadow-sm text-[var(--primary-green)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-highlight)]/80'
                        }`}
                    >
                      {langCode === 'fil' ? 'Filipino' : langCode === 'eng' ? 'English' : 'Bisaya'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 flex flex-col gap-5 custom-scrollbar">
          
          {/* Steps */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider select-none">Mga Hakbang (Steps):</span>
            <ol className="flex flex-col gap-2.5">
              {guide.steps_json.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-sm leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[var(--primary-green)] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 select-none">
                    {step.step_number}
                  </span>
                  <span>{step.instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-[var(--accent-border)] select-none"></div>

          {/* Requirements */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider select-none">Mga Kailangan (Requirements):</span>
            <ul className="flex flex-col gap-2">
              {guide.requirements_json.map((req, idx) => (
                <li key={idx} className="flex gap-2 text-sm leading-relaxed items-start">
                  <CheckSquare size={16} className="text-[var(--primary-green)] flex-shrink-0 mt-0.5 select-none" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-[var(--accent-border)] select-none"></div>

          {/* Fees */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider select-none flex items-center gap-1">
              <Info size={14} className="text-[var(--primary-green)]" />
              Bayarin (Fees):
            </span>
            <p className="text-xs text-[var(--text-primary)] leading-relaxed pl-5 font-medium">
              {guide.fees_text}
            </p>
          </div>

          {/* Tips */}
          {guide.tips && (
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[var(--chip-bg)] border border-[var(--chip-border)] text-xs leading-relaxed text-[var(--text-primary)]">
              <span className="font-bold text-[var(--primary-green)] flex items-center gap-1 select-none">
                <HelpCircle size={14} />
                Dagdag na Tip:
              </span>
              <p className="pl-5 font-medium">{guide.tips}</p>
            </div>
          )}

        </div>

        {/* Footer (Fixed at bottom) */}
        <div className="p-5 pt-3.5 border-t border-[var(--accent-border)] bg-[var(--surface)] flex-shrink-0 select-none">
          <button
            onClick={onClose}
            className="w-full h-11 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white text-sm font-bold rounded-xl transition-all duration-200 ease-out shadow-[0_2px_8px_rgba(78,156,129,0.15)] hover:shadow-[0_4px_16px_rgba(78,156,129,0.25)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer flex items-center justify-center"
          >
            Isara ang Gabay
          </button>
        </div>

      </div>
    </div>
  );
}
