'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, BookOpen, AlertCircle } from 'lucide-react';
import { Guide } from '../lib/seed-data';
import { getCachedGuides } from '../lib/offline-cache';
import GuideModal from './GuideModal';

export default function OfflineDirectory() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicLanguages, setSelectedTopicLanguages] = useState<Guide[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function loadGuides() {
      const cached = await getCachedGuides();
      setGuides(cached);

      // Check query parameter to auto-open guide
      if (typeof window !== 'undefined' && cached && cached.length > 0) {
        const params = new URLSearchParams(window.location.search);
        const openKbId = params.get('open');
        if (openKbId) {
          const kbIdNum = parseInt(openKbId, 10);
          const topicGuides = cached.filter(g => g.kb_id === kbIdNum);
          if (topicGuides.length > 0) {
            setSelectedTopicLanguages(topicGuides);
            setIsModalOpen(true);
          }
        }
      }
    }
    loadGuides();
  }, []);

  // Group guides by kb_id
  const groupedGuidesMap: { [kb_id: number]: Guide[] } = {};
  guides.forEach((g) => {
    if (!groupedGuidesMap[g.kb_id]) {
      groupedGuidesMap[g.kb_id] = [];
    }
    groupedGuidesMap[g.kb_id].push(g);
  });

  const uniqueKbIds = Array.from(new Set(guides.map(g => g.kb_id)));

  const filteredTopics = uniqueKbIds.map(kbId => {
    const topicGuides = groupedGuidesMap[kbId] || [];
    // Try to find Filipino as base guide for title, default to first available
    const baseGuide = topicGuides.find(g => g.language === 'fil') || topicGuides[0];
    return {
      kbId,
      baseGuide,
      allLanguages: topicGuides
    };
  }).filter(({ allLanguages }) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    return allLanguages.some(guide => 
      guide.title.toLowerCase().includes(query) ||
      (guide.tips && guide.tips.toLowerCase().includes(query)) ||
      guide.requirements_json.some(req => req.toLowerCase().includes(query)) ||
      guide.category.toLowerCase().includes(query)
    );
  });

  const handleOpenGuide = (topicGuides: Guide[]) => {
    setSelectedTopicLanguages(topicGuides);
    setIsModalOpen(true);
  };

  return (
    <div className="offline-directory flex flex-col gap-5 max-w-[640px] w-full mx-auto p-4 select-none">
      
      {/* Search Input */}
      <div className="relative search-wrapper">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[var(--text-secondary)] pointer-events-none">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="I-type para maghanap ng gabay (e.g. RA 9048, Late Registration)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input w-full h-12 rounded-xl pl-10 pr-4 border border-[var(--accent-border)] hover:border-[var(--primary-green)]/40 bg-[var(--background)] text-[var(--text-primary)] text-sm font-medium outline-none transition-all duration-200"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="directory-title text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest leading-none">
          Mga Gabay na Magagamit Offline ({filteredTopics.length})
        </h2>

        {filteredTopics.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[var(--accent-border)] rounded-xl text-center gap-2">
            <AlertCircle size={24} className="text-[var(--text-disabled)]" />
            <span className="text-xs text-[var(--text-secondary)]">Walang gabay na nahanap para sa iyong hinanap.</span>
          </div>
        ) : (
          <div className="directory-list flex flex-col gap-3">
            {filteredTopics.map(({ kbId, baseGuide, allLanguages }) => (
              <div
                key={kbId}
                onClick={() => handleOpenGuide(allLanguages)}
                className="directory-card flex items-center justify-between p-4 bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl hover:bg-[var(--surface-highlight)] hover:-translate-y-0.5 cursor-pointer transition-all duration-150 shadow-sm"
              >
                <div className="directory-card-content flex items-center gap-3.5 pr-4 flex-grow">
                  <div className="w-9 h-9 rounded-lg bg-[var(--chip-bg)] text-[var(--primary-green)] flex items-center justify-center flex-shrink-0">
                    <BookOpen size={18} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="directory-card-title text-sm font-bold text-[var(--text-primary)] leading-snug">
                      {baseGuide.title}
                    </span>
                    <span className="directory-card-desc text-xs text-[var(--text-secondary)]">
                      Kategorya: {baseGuide.category}
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className="directory-caret text-[var(--text-disabled)] flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guide Details Modal */}
      <GuideModal
        allLanguages={selectedTopicLanguages}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

    </div>
  );
}
