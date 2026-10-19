'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, HelpCircle, ArrowRight, BookOpen, UserCheck, 
  AlertTriangle, X, PanelLeftOpen, Plus, Mic, 
  Settings, Info, MessageSquare, ArrowUp, ChevronRight,
  WifiOff, Wifi, LogOut, ChevronDown, Sparkles, ListTodo, Home
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { PERSONAS_SEED, Persona } from '@/lib/seed-data';
import { useOffline } from '@/hooks/useOffline';
import { initializeCachedGuides } from '@/lib/offline-cache';

import ThemeToggle from '@/components/ThemeToggle';
import OfflineBanner from '@/components/OfflineBanner';
import OfflineDirectory from '@/components/OfflineDirectory';
import Toast from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingPage() {
  const router = useRouter();
  
  // Core States
  const { isOffline, setIsOffline } = useOffline();
  const { user, loading: loadingUser, signOut } = useAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(false); // Navigation sidebar (left)
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [aboutActiveTab, setAboutActiveTab] = useState<'overview' | 'features' | 'privacy'>('overview');
  
  const [personasExpanded, setPersonasExpanded] = useState(false);
  
  // Toast Notification
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Load auth status and data privacy setting on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('showConsent') === 'true') {
        setShowConsentModal(true);
      }

      // Delay transitions until mount settles
      setTimeout(() => {
        setSidebarMounted(true);
      }, 100);
    }
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  // Chat Redirection Handlers
  const handleStartChat = (query = '') => {
    const url = query ? `/chat?q=${encodeURIComponent(query)}` : '/chat';
    router.push(url);
  };

  const handleSaveCache = async () => {
    if (typeof window !== 'undefined') {
      await initializeCachedGuides();
      setIsOfflineCached(true);
      alert("Naka-save na sa iyong browser! Maaari mo nang buksan ang Offline na Direktoryo kahit walang internet.");
    }
  };

  const handleLogout = async () => {
    await signOut();
    triggerToast('Naka-log out ka na.');
  };

  // Redirect to chat with the persona loaded
  const handleLoadPersona = (persona: Persona) => {
    // Auto Consent
    localStorage.setItem('clara-consent-agreed', 'true');
    router.push(`/chat?persona=${persona.persona_id}`);
  };

  return (
    <div className="flex h-screen w-screen bg-[var(--background)] text-[var(--text-primary)] overflow-hidden font-sans">
      
      {/* 1. Left Sidebar (Collapsible, ChatGPT Style) */}
      <aside 
        className={`fixed inset-y-0 left-0 md:relative h-full flex flex-col bg-[var(--surface-highlight)] border-r border-[var(--accent-border)] z-30 select-none flex-shrink-0
          ${sidebarMounted ? 'transition-all duration-300 ease-in-out' : ''}
          ${sidebarOpen ? 'w-[260px] opacity-100 visible' : 'w-0 opacity-0 invisible pointer-events-none overflow-hidden border-r-0'}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--accent-border)] flex-shrink-0">
          <div className="brand flex items-center gap-2">
            <img
              src="/logo.png"
              alt="CLARA Logo"
              className="w-[22px] h-[22px] object-contain select-none"
            />
            <span className="brand-title text-base md:text-lg font-bold tracking-tight select-none">
              CLARA
            </span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Isara ang Sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-2">
          <div className="mt-2 flex flex-col gap-1">
            <span className="px-3 text-[11px] md:text-xs font-bold text-[var(--text-disabled)] uppercase tracking-wider">
              Mga Opsyon
            </span>

            {/* New Chat Button */}
            <Link
              href="/chat"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full mb-1"
            >
              <MessageSquare size={15} />
              Public Chatbot
            </Link>

            {/* Collapsible Scenarios (Personas) */}
            <div className="flex flex-col">
              <button
                onClick={() => setPersonasExpanded(!personasExpanded)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <UserCheck size={15} />
                  Mga Senaryo (Personas)
                </span>
                <ChevronRight size={14} className={`text-[var(--text-disabled)] transition-transform duration-200 ${personasExpanded ? 'rotate-90' : ''}`} />
              </button>

              {personasExpanded && (
                <div className="pl-3 pr-1 py-1 flex flex-col gap-1.5 animate-message max-h-[260px] overflow-y-auto mt-1">
                  {PERSONAS_SEED.map((p) => (
                    <button 
                      key={p.persona_id}
                      onClick={() => handleLoadPersona(p)}
                      className="p-2 rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] text-xs md:text-sm text-left flex flex-col gap-0.5 w-full cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{p.avatar}</span>
                        <span className="truncate">{p.name}</span>
                      </div>
                      <span className="text-[10px] md:text-[11px] text-[var(--text-disabled)] line-clamp-1">{p.backstory}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setIsOffline(true);
                setSidebarOpen(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full cursor-pointer"
            >
              <BookOpen size={15} />
              Offline na Direktoryo
            </button>

            <button
              onClick={() => {
                setShowAboutModal(true);
                setAboutActiveTab('overview');
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full cursor-pointer"
            >
              <Info size={15} />
              Tungkol sa CLARA
            </button>

            {/* Collapsible Settings */}
            <div className="flex flex-col">
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <Settings size={15} />
                  Mga Setting
                </span>
                <ChevronRight size={14} className={`text-[var(--text-disabled)] transition-transform duration-200 ${settingsExpanded ? 'rotate-90' : ''}`} />
              </button>

              {settingsExpanded && (
                <div className="pl-6 pr-2 py-2.5 flex flex-col gap-2.5 bg-[var(--surface-highlight)]/40 rounded-lg border border-[var(--accent-border)]/40 mt-1 select-none animate-message">
                  <div className="flex items-center justify-between text-sm md:text-[15px]">
                    <span className="text-[var(--text-secondary)] font-semibold">Tema (Theme)</span>
                    <ThemeToggle />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowConsentModal(true)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full cursor-pointer"
            >
              <HelpCircle size={15} />
              Data Privacy & Tulong
            </button>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--accent-border)] flex flex-col gap-2">
            <span className="text-sm md:text-[15px] font-bold text-[var(--text-primary)] leading-tight">
              Gamitin Offline
            </span>
            <p className="text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed">
              I-download ang mga gabay sa iyong browser upang mabuksan ang direktoryo kahit walang internet.
            </p>
            <button 
              onClick={handleSaveCache}
              disabled={isOfflineCached}
              className={`w-full h-8 flex items-center justify-center text-white text-xs md:text-[15px] font-bold rounded-lg transition-colors active:scale-98 cursor-pointer
                ${isOfflineCached 
                  ? 'bg-emerald-600 cursor-default' 
                  : 'bg-[var(--primary-green)] hover:bg-[var(--primary-dark)]'
                }`}
            >
              {isOfflineCached ? '✓ Handa na Offline' : 'I-download ang Data'}
            </button>
          </div>

          {user && !loadingUser && (
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-red-500 hover:text-white hover:bg-red-500 transition-all text-left w-full cursor-pointer"
              >
                <LogOut size={15} />
                Mag-log Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Backdrop overlay on mobile for left sidebar */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-20 transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 2. Main Area (Center Layout) */}
      <div className="flex-grow flex flex-col h-full relative overflow-hidden bg-[var(--background)]">
        {/* Background Mesh Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[var(--primary-green)]/15 to-emerald-300/10 blur-[120px] opacity-35 pointer-events-none dark:opacity-10 z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-teal-400/10 to-[var(--primary-green)]/15 blur-[150px] opacity-35 pointer-events-none dark:opacity-10 z-0" />

        {/* Minimalist Dot Grid Background with Light Green Gradient */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
          {/* Light green gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary-green)]/[0.04] via-transparent to-[var(--primary-green)]/[0.02] dark:from-[var(--primary-green)]/[0.02]" />
          {/* Dots grid */}
          <div 
            className="absolute inset-0 opacity-[0.5] dark:opacity-[0.25]"
            style={{
              backgroundImage: 'radial-gradient(var(--primary-green) 1.2px, transparent 1.2px)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>
        
        {/* Header Bar */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-[var(--accent-border)] bg-[var(--background)]/85 backdrop-blur-md flex-shrink-0 z-20">
          <div className="flex items-center gap-2">
            {/* Sidebar toggle button (visible if sidebar is closed) */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer mr-1"
                title="Buksan ang Sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>
            )}

            {/* Version dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-[var(--surface-highlight)] font-bold text-sm tracking-tight text-[var(--text-primary)] cursor-pointer select-none transition-all active:scale-98"
              >
                CLARA v1.0
                <ChevronDown size={14} className={`text-[var(--text-secondary)] transition-transform duration-200 ${showVersionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showVersionDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowVersionDropdown(false)} />
                  <div className="absolute left-0 mt-1.5 w-64 bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl shadow-[var(--shadow-card)] p-3.5 z-50 animate-message flex flex-col gap-2 select-none">
                    <span className="text-[10px] font-bold text-[var(--primary-green)] uppercase tracking-wider">Civil Legal & Registry Assistant</span>
                    <h4 className="text-xs font-bold text-[var(--text-primary)] leading-tight">CLARA Assistant Engine</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      Nagbibigay ng malinaw na patnubay sa pag-proseso at pagwawasto ng mga dokumentong sibil (civic documents) at mga kaugnay na alituntunin sa Pilipinas.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Toggle Online/Offline Badge */}
          <button
            onClick={() => setIsOffline(!isOffline)}
            className={`px-3 py-1 rounded-full flex items-center gap-1 text-[10px] font-bold border transition-all cursor-pointer select-none
              ${isOffline 
                ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400' 
                : 'border-[var(--primary-green)] bg-[var(--chip-bg)] text-[var(--primary-green)]'
              }`}
            title={isOffline ? "I-click para mag-online." : "I-click para mag-offline."}
          >
            {isOffline ? (
              <>
                <WifiOff size={11} />
                Offline Mode
              </>
            ) : (
              <>
                <Wifi size={11} />
                Online
              </>
            )}
          </button>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-3">
            {loadingUser ? (
              <div className="w-20 h-9 rounded-lg bg-[var(--surface-highlight)] animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/chat"
                  className="h-9 px-4 rounded-full bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs flex items-center justify-center transition-all select-none shadow-sm active:scale-95"
                >
                  <MessageSquare size={14} className="mr-1.5" />
                  Buksan ang Iyong Chatbox
                </Link>
                
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 cursor-pointer active:scale-95 transition-all"
                  title="Mag-log Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 select-none">
                <Link 
                  href="/login" 
                  className="h-9 px-4 rounded-full bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold flex items-center justify-center transition-all shadow-sm active:scale-95"
                >
                  Log In
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Offline Banner */}
        <OfflineBanner isOffline={isOffline} />

        {/* Core Workspace Area */}
        <div className="flex-grow flex flex-col overflow-hidden relative">
          {isOffline ? (
            <div className="flex-grow overflow-y-auto mt-2">
              <OfflineDirectory />
            </div>
          ) : (
            <div className="flex-grow flex flex-col overflow-hidden">
              
              {/* Welcome Screen */}
              <main className="flex-grow overflow-y-auto no-scrollbar flex flex-col items-center px-4 max-w-[800px] w-full mx-auto py-12 text-center select-none animate-message relative z-10 justify-center">

                {/* Meaning of CLARA Tag */}
                <div className="flex w-fit mx-auto px-3.5 py-1 bg-[var(--chip-bg)] border border-[var(--primary-green)]/10 rounded-full text-[10px] sm:text-xs font-bold text-[var(--primary-green)] tracking-wide items-center gap-1.5 mb-5 shadow-sm">
                  <ShieldCheck size={13} className="animate-pulse" />
                  Civil Legal and Registry Assistant
                </div>

                {/* Centered Heading */}
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4 leading-tight bg-gradient-to-r from-[var(--primary-green)] to-[#5ebf9d] dark:from-[#76c2a8] dark:to-[#4db590] bg-clip-text text-transparent animate-fade-in select-none">
                  Ano ang maitutulong ko sa iyo ngayon?
                </h1>
                <h2 className="text-sm sm:text-base font-semibold text-[var(--text-secondary)] max-w-[620px] mb-8 select-none leading-relaxed">
                  Magtanong tungkol sa mga dokumento tulad ng Birth Certificate, Late Registration, o RA 9048.
                </h2>

                {/* Button to Go to Public Chatbot */}
                <button
                  onClick={() => router.push('/chat')}
                  className="flex items-center gap-2.5 px-8 py-4 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white font-extrabold text-sm sm:text-base rounded-full shadow-lg hover:shadow-xl hover:shadow-[var(--primary-green)]/20 active:scale-95 transition-all cursor-pointer group select-none"
                >
                  <MessageSquare size={19} className="group-hover:scale-110 transition-transform" />
                  Pumunta sa Public Chatbot
                  <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                </button>

              </main>

            </div>
          )}
        </div>

        {/* Bottom Page Footer (Disclaimer) */}
        <footer className="w-full text-center py-4 border-t border-[var(--accent-border)] bg-[var(--background)]/85 backdrop-blur-md flex-shrink-0 z-10">
          <p className="text-[10px] text-[var(--text-disabled)] max-w-[550px] mx-auto leading-relaxed px-4">
            Ang CLARA ay AI. By using it, you agree to our Terms & Privacy Policy (RA 10173). Chats may be reviewed and used to improve our AI models. CLARA is an initiative under AI4Gov and is not a government agency.
          </p>
        </footer>

      </div>

      {/* 3. Consent Dialog Modal (RA 10173 Compliance) */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div 
            className="drawer-overlay"
            onClick={() => setShowConsentModal(false)}
          />
          <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl shadow-[var(--shadow-card)] p-6 w-full max-w-[480px] z-50 animate-message flex flex-col gap-5">
            <div className="flex gap-3 text-[var(--primary-green)]">
              <ShieldCheck size={28} className="flex-shrink-0 mt-0.5" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">Data Privacy & Security (RA 10173)</h2>
            </div>
            
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Ang CLARA ay sumusunod sa mga panuntunan ng <strong>Data Privacy Act (RA 10173)</strong>. Upang masiguro ang inyong seguridad, awtomatikong tinatanggal (sanitize) ng aming system ang anumang sensitibong impormasyon kagaya ng SSS, TIN, PhilSys, numero ng telepono, at petsa ng kapanganakan bago ito iproseso ng AI.
              <br /><br />
              Hindi rin kami nagtatabi o nag-a-archive ng mga opisyal na identification documents na inyong ibinabahagi. Ang lahat ng impormasyong pinoproseso ay ginagamit lamang upang magsilbing gabay sa inyong civil registration.
            </p>

            <div className="flex justify-end mt-2">
              <button
                onClick={() => setShowConsentModal(false)}
                className="px-6 py-2 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                Isara
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. About CLARA Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div 
            className="drawer-overlay"
            onClick={() => setShowAboutModal(false)}
          />
          <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl shadow-[var(--shadow-card)] w-full max-w-[560px] z-50 animate-message flex flex-col overflow-hidden">
            {/* Header with gradient */}
            <div className="relative p-6 bg-gradient-to-r from-[var(--primary-green)]/10 to-teal-500/5 border-b border-[var(--accent-border)] flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--accent-border)] flex items-center justify-center shadow-sm flex-shrink-0">
                  <img
                    src="/logo.png"
                    alt="CLARA Logo"
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-primary)] leading-tight">Tungkol sa CLARA</h2>
                  <span className="text-[11px] font-bold text-[var(--primary-green)] uppercase tracking-wider">Civil Legal and Registry Assistant</span>
                </div>
              </div>
              <button 
                onClick={() => setShowAboutModal(false)}
                className="p-1 rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                title="Isara"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[var(--accent-border)] bg-[var(--surface-highlight)]/30 px-4">
              <button
                onClick={() => setAboutActiveTab('overview')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center cursor-pointer
                  ${aboutActiveTab === 'overview'
                    ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                Pangkalahatan
              </button>
              <button
                onClick={() => setAboutActiveTab('features')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center cursor-pointer
                  ${aboutActiveTab === 'features'
                    ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                Mga Kakayahan
              </button>
              <button
                onClick={() => setAboutActiveTab('privacy')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center cursor-pointer
                  ${aboutActiveTab === 'privacy'
                    ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                Privacy & Tech
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="p-6 overflow-y-auto max-h-[380px] flex flex-col gap-4 text-left">
              {aboutActiveTab === 'overview' && (
                <div className="flex flex-col gap-3.5 animate-message">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Ang <strong>CLARA</strong> (Civil Legal and Registry Assistant) ay isang matalinong katulong (AI Assistant) na binuo upang mapadali ang pagkuha ng impormasyon at gabay ukol sa mga proseso ng <strong>Civil Registry</strong> sa Pilipinas.
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Layunin ng CLARA na isalin ang mga kumplikadong legal na regulasyon at alituntunin sa simpleng pananalita (plain language) upang mas madaling maunawaan ng karaniwang mamamayan ang kanilang mga karapatan at mga hakbang sa pag-aayos ng kanilang dokumento.
                  </p>
                  <div className="p-4 rounded-xl bg-[var(--surface-highlight)] border border-[var(--accent-border)] flex items-start gap-3">
                    <Sparkles size={18} className="text-[var(--primary-green)] flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-extrabold text-[var(--text-primary)]">Inisyatiba ng AI4Gov</span>
                      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                        Ang CLARA ay bahagi ng AI4Gov project, isang inisyatiba na naglalayong gamitin ang Artificial Intelligence upang mapahusay ang serbisyo-publiko at pamamahala. Ito ay hindi isang opisyal na ahensya ng gobyerno.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {aboutActiveTab === 'features' && (
                <div className="flex flex-col gap-4 animate-message">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center flex-shrink-0">
                      <BookOpen size={16} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Late Registration of Birth</span>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        Nagbibigay ng malinaw na listahan ng mga kailangang dokumento, multa, at hakbang kapag ang rehistro ng kapanganakan ay lumampas na sa 30-araw na limitasyon.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center flex-shrink-0">
                      <Settings size={16} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Correction of Clerical Error (RA 9048)</span>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        Patnubay sa pagwawasto ng maling baybay (spelling), petsa, o kasarian sa birth/marriage/death certificate sa ilalim ng Republic Act 9048 nang hindi gumagamit ng abogado.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center flex-shrink-0">
                      <UserCheck size={16} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Indigenous Peoples Registration (IPRA RA 8371)</span>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        Mga partikular at sensitibong gabay para sa pagpaparehistro ng dokumento ng mga katutubong pamayanan (IPs) batay sa magkasanib na kautusan ng NCIP at PSA.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center flex-shrink-0">
                      <ListTodo size={16} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Smart Checklist Generator</span>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        Kusa itong gumagawa ng interactive checklist habang ka-chat ka upang matulungan kang subaybayan ang iyong mga inihahandang papel at requirements.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {aboutActiveTab === 'privacy' && (
                <div className="flex flex-col gap-3.5 animate-message">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center flex-shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Data Privacy Act (RA 10173) Compliance</span>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        Bago ipadala ang inyong mga mensahe sa AI, awtomatikong inaalis o sinasanitize ang anumang sensitibong personal na impormasyon (PII) upang protektahan ang inyong privacy.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center flex-shrink-0">
                      <WifiOff size={16} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Offline Directory & Cache Support</span>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        Maaari mong i-download ang kabuuang direktoryo ng mga gabay. Kapag naka-save na, mababasa mo ang lahat ng guidelines kahit wala kang koneksyon sa internet.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-950/40 bg-amber-500/5 text-xs text-[var(--text-secondary)] leading-relaxed flex items-start gap-2.5 mt-2">
                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <strong className="text-[var(--text-primary)]">Paalala sa Paggamit ng AI:</strong> Ang CLARA ay isang AI assistant. Bagama't nagsusumikap kaming maging tumpak ang gabay, palaging i-verify ang mga opisyal na kinakailangan sa inyong Local Civil Registry Office (LCRO) o sa Philippine Statistics Authority (PSA).
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--accent-border)] bg-[var(--surface-highlight)]/10 flex items-center justify-between gap-4">
              <span className="text-[10px] text-[var(--text-disabled)] font-semibold">CLARA Engine v1.0</span>
              <button
                onClick={() => setShowAboutModal(false)}
                className="px-6 py-2 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                Isara
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast 
        message={toastMessage} 
        isVisible={showToast} 
        onClose={() => setShowToast(false)} 
      />

    </div>
  );
}