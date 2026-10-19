'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, ShieldCheck, Wifi, RefreshCw, Download } from 'lucide-react';
import OfflineDirectory from '@/components/OfflineDirectory';
import ThemeToggle from '@/components/ThemeToggle';
import { initializeCachedGuides, getCachedGuides } from '@/lib/offline-cache';

export default function OfflinePage() {
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [cachingProgress, setCachingProgress] = useState(false);

  useEffect(() => {
    async function checkCache() {
      if (typeof window !== 'undefined') {
        const cached = await getCachedGuides();
        if (cached && cached.length > 0) {
          setIsOfflineCached(true);
        }
      }
    }
    checkCache();
  }, []);

  const handleSaveCache = async () => {
    if (typeof window !== 'undefined') {
      setCachingProgress(true);
      try {
        await initializeCachedGuides();
        setIsOfflineCached(true);
        alert("Naka-save na sa iyong browser! Maaari mo nang buksan ang direktoryong ito kahit offline.");
      } catch (error) {
        console.error(error);
        alert("Nagka-error sa pag-download ng data.");
      } finally {
        setCachingProgress(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text-primary)] relative overflow-hidden font-sans">
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[var(--primary-green)]/10 to-emerald-300/5 blur-[120px] opacity-30 pointer-events-none dark:opacity-10 z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-teal-400/5 to-[var(--primary-green)]/10 blur-[150px] opacity-30 pointer-events-none dark:opacity-10 z-0" />

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-4 border-b border-[var(--accent-border)] bg-[var(--header-bg)] backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center p-2 rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title="Bumalik sa Home"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="CLARA Logo"
              className="w-[22px] h-[22px] object-contain select-none"
            />
            <span className="text-sm font-bold tracking-tight">CLARA</span>
          </div>
        </div>

        <div className="flex items-center gap-3 select-none">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-[800px] w-full mx-auto px-4 py-8 flex flex-col gap-6 relative z-10">
        {/* Banner Title */}
        <div className="flex flex-col gap-1.5 text-center sm:text-left">
          <div className="flex w-fit mx-auto sm:mx-0 px-3 py-1 bg-[var(--chip-bg)] border border-[var(--primary-green)]/10 rounded-full text-[10px] sm:text-xs font-bold text-[var(--primary-green)] tracking-wide items-center gap-1.5 shadow-sm">
            <BookOpen size={13} />
            Offline na Direktoryo
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-[var(--text-primary)]">
            Direktoryo ng mga Gabay sa Dokumento
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-[640px]">
            Tingnan at hanapin ang mga requirements, hakbang, at tips para sa Late Registration ng Birth, RA 9048, at Indigenous Peoples Registration.
          </p>
        </div>

        {/* Cache status banner */}
        <div className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-[var(--shadow-soft)] relative overflow-hidden
          ${isOfflineCached
            ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.02] to-teal-500/[0.02] dark:from-emerald-500/[0.01] dark:to-teal-500/[0.01] bg-[var(--surface)]'
            : 'border-[var(--accent-border)] bg-[var(--surface)]'
          }`}
        >
          <div className="flex gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300
              ${isOfflineCached
                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                : 'bg-[var(--primary-green)]/10 text-[var(--primary-green)]'
              }`}
            >
              {isOfflineCached ? <ShieldCheck size={20} className="animate-pulse" /> : <Wifi size={20} />}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black tracking-tight text-[var(--text-primary)]">
                  {isOfflineCached ? 'Handa na para sa Offline Use' : 'I-download ang mga Gabay sa Browser'}
                </span>
                {isOfflineCached ? (
                  <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Naka-save
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 rounded-full border border-amber-500/20">
                    Hindi pa na-cache
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] leading-relaxed max-w-[480px]">
                {isOfflineCached
                  ? 'Ang mga gabay ay ligtas na nakaimbak sa iyong lokal na storage ng browser. Maaari mong ma-access ang buong direktoryo kahit walang internet.'
                  : 'I-download ang pinakabagong bersyon ng mga gabay upang magamit ang direktoryo kahit kailan mo kailangan, offline.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveCache}
            disabled={cachingProgress}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer flex-shrink-0 select-none shadow-sm active:scale-[0.98] border
              ${cachingProgress
                ? 'bg-[var(--surface-highlight)] border-[var(--accent-border)] text-[var(--text-disabled)] cursor-not-allowed'
                : isOfflineCached
                  ? 'border-emerald-500/25 text-emerald-600 hover:text-emerald-700 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08] dark:text-emerald-400 dark:hover:text-emerald-300 dark:bg-emerald-500/[0.02] dark:hover:bg-emerald-500/[0.06] hover:shadow-[0_2px_8px_rgba(16,185,129,0.1)]'
                  : 'bg-[var(--primary-green)] border-transparent hover:bg-[var(--primary-dark)] text-white hover:shadow-[0_4px_12px_rgba(78,156,129,0.2)]'
              }`}
          >
            {cachingProgress ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Paki-antay...
              </>
            ) : isOfflineCached ? (
              <>
                <RefreshCw size={14} />
                I-update ang Data
              </>
            ) : (
              <>
                <Download size={14} />
                I-download Ngayon
              </>
            )}
          </button>
        </div>

        {/* Directory Search & List */}
        <div className="flex flex-col bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl p-2 sm:p-4 shadow-[var(--shadow-soft)]">
          <OfflineDirectory />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 border-t border-[var(--accent-border)] bg-[var(--background)] flex-shrink-0 z-0">
        <p className="text-[10px] text-[var(--text-disabled)] max-w-[550px] mx-auto leading-relaxed px-4">
          Ang CLARA ay isang inisyatiba sa ilalim ng AI4Gov at hindi kaanib sa anumang opisyal na ahensya ng gobyerno. Sumusunod sa RA 10173 (Data Privacy Act).
        </p>
      </footer>
    </div>
  );
}
