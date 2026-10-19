'use client';

import React, { useState } from 'react';
import ProgressBar from './ProgressBar';
import { Trash2, Download } from 'lucide-react';

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

interface ChecklistCardProps {
  checklistId: string;
  title: string;
  items: ChecklistItem[];
  doneCount: number;
  onToggle: (checklistId: string, itemText: string) => void;
  onSave?: () => void;
  onDelete?: (checklistId: string) => void;
  isSidebar?: boolean;
  lastUpdated?: string;
}

export default function ChecklistCard({
  checklistId,
  title,
  items,
  doneCount,
  onToggle,
  onSave,
  onDelete,
  isSidebar = false,
  lastUpdated
}: ChecklistCardProps) {
  const totalCount = items.length;
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDownload = () => {
    const percentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    
    let textContent = `${title}\n`;
    textContent += `========================================\n`;
    textContent += `Katayuan: ${doneCount} / ${totalCount} natapos (${percentage}%)\n`;
    textContent += `Huling Na-update: ${new Date(lastUpdated || new Date()).toLocaleString('fil-PH', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n`;
    textContent += `========================================\n\n`;
    textContent += `Mga Kailangang Dokumento at Hakbang:\n`;
    
    items.forEach((item) => {
      textContent += `${item.checked ? '[x]' : '[ ]'} ${item.text}\n`;
    });
    
    textContent += `\n\nBinuo gamit ang CLARA (Civil Legal & Registry Assistant)\n`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeFilename = title.replace(/[^a-z0-9\s-_]/gi, '').trim() || 'checklist';
    link.download = `${safeFilename}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className={`flex flex-col gap-3 bg-[var(--surface)] border border-[var(--accent-border)] shadow-[var(--shadow-soft)] animate-message relative group
        ${isSidebar 
          ? 'p-3.5 rounded-xl' 
          : 'p-4 rounded-xl w-full self-start max-w-[80%] mt-[-4px]'
        }`}
    >
      <div className="flex flex-col gap-2.5">
        <h3 className="text-sm md:text-base font-bold text-[var(--text-primary)] leading-tight">
          {title}
        </h3>
        <ProgressBar value={doneCount} max={totalCount} />
      </div>

      <div className="flex flex-col gap-0.5 mt-1" role="group" aria-label="Mga kailangang dokumento at hakbang">
        {items.map((item, index) => (
          <div
            key={index}
            onClick={() => onToggle(checklistId, item.text)}
            className={`checklist-item flex items-center gap-2.5 py-1 cursor-pointer select-none min-h-[32px] rounded-lg px-2 hover:bg-[var(--surface-highlight)] transition-colors duration-150
              ${item.checked ? 'checked' : ''}`}
            tabIndex={0}
            role="checkbox"
            aria-checked={item.checked}
            aria-label={item.text}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onToggle(checklistId, item.text);
              }
            }}
          >
            {/* Custom Checkbox */}
            <div className="checkbox-custom" aria-hidden="true">
              <svg 
                className="checkbox-svg" 
                viewBox="0 0 24 24"
              >
                <polyline points="20 6 9 17 4 12" className="animate-check" />
              </svg>
            </div>

            {/* Label */}
            <span className={`checklist-label text-xs md:text-sm leading-relaxed flex-1 transition-colors duration-150
              ${item.checked ? 'text-[var(--checklist-checked-text)] line-through' : 'text-[var(--checklist-unchecked-text)] font-medium'}`}>
              {item.text}
            </span>
          </div>
        ))}
      </div>

      {/* Footer Actions (Save, Download, Delete) */}
      <div className="flex items-center justify-between border-t border-[var(--accent-border)]/40 pt-2.5 mt-1 select-none">
        {onSave ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="checklist-action w-fit text-xs md:text-sm font-semibold text-[var(--primary-green)] hover:text-[var(--primary-light)] transition-colors duration-150 cursor-pointer text-left"
          >
            I-save ang Checklist
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Download Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title="I-download bilang Text File"
          >
            <Download size={15} />
          </button>

          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmDelete(true);
              }}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-all cursor-pointer"
              title="Burahin ang checklist"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {showConfirmDelete && onDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setShowConfirmDelete(false)} 
          />
          <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl shadow-[var(--shadow-card)] p-6 w-full max-w-[360px] z-[101] animate-message flex flex-col gap-4 select-none">
            <h4 className="text-base font-bold text-[var(--text-primary)]">
              Burahin ang Checklist?
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Sigurado ka bang nais mong burahin ang checklist na &quot;{title}&quot;? Hindi na ito maibabalik.
            </p>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 rounded-xl border border-[var(--accent-border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] transition-colors cursor-pointer"
              >
                Kanselahin
              </button>
              <button
                onClick={() => {
                  setShowConfirmDelete(false);
                  onDelete(checklistId);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Burahin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
