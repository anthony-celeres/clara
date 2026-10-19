'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Menu, X, Send, Wifi, WifiOff, ListTodo, LogOut, ChevronRight, 
  Sparkles, CheckSquare, Settings, User, AlertCircle, FileJson, Trash2,
  PanelLeftOpen, Search, BookOpen, UserCheck, Plus, Mic, ArrowRight,
  Info, MessageSquare, ChevronDown, ShieldCheck, ArrowUp, HelpCircle,
  AlertTriangle, SunMoon, Home
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { logAnalyticsEvent } from '@/lib/firebase';
import { scrubPII } from '@/lib/pii-scrubber';
import { GUIDES_SEED, PERSONAS_SEED, Persona } from '@/lib/seed-data';
import { useTheme } from '@/hooks/useTheme';
import { useOffline } from '@/hooks/useOffline';
import { useChecklist } from '@/hooks/useChecklist';
import { clearLocalChecklists, initializeCachedGuides } from '@/lib/offline-cache';

import ThemeToggle from '@/components/ThemeToggle';
import OfflineBanner from '@/components/OfflineBanner';
import ChatBubble from '@/components/ChatBubble';
import ChecklistCard from '@/components/ChecklistCard';
import SuggestionChips from '@/components/SuggestionChips';
import OfflineDirectory from '@/components/OfflineDirectory';
import MobileDrawer from '@/components/MobileDrawer';
import Toast from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  checklistTitle?: string;
  checklistItems?: { text: string; checked: boolean }[];
}

interface RecentChat {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: string;
}

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 1. Core States
  const { isOffline, setIsOffline } = useOffline();
  const { user, loading: loadingUser, signOut } = useAuth(); // ✅ Use global auth
  const [sidebarOpen, setSidebarOpen] = useState(false); // Checklist sidebar (right)
  const [navSidebarOpen, setNavSidebarOpen] = useState(false); // Navigation sidebar (left)
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [personasExpanded, setPersonasExpanded] = useState(false); // Personas accordion
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [aboutActiveTab, setAboutActiveTab] = useState<'overview' | 'features' | 'privacy'>('overview');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);

  // ✅ Auth is now handled globally – no need for local auth useEffect

  // Set mount state to enable transitions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Delay transitions until mount settles
      setTimeout(() => {
        setSidebarMounted(true);
      }, 100);
    }
  }, []);

  const handleLogout = async () => {
    await signOut();
    triggerToast('Naka-log out ka na.');
    router.push('/');
  };

  // 3. Checklist Integration Hook
  const userId = user?.id || null;
  const { checklists, createChecklist, deleteChecklist, toggleItem, reloadChecklists } = useChecklist(userId, isOffline);

  // 4. Manual Chat State (replaces incompatible useChat hook)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Send messages to /api/chat and parse the streamed response
  const sendChatMessage = useCallback(async (userContent: string) => {
    if (!userContent.trim()) return;

    let chatId = currentChatId;
    if (!chatId) {
      chatId = `chat-${Date.now()}`;
      setCurrentChatId(chatId);
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = `assistant-${Date.now()}`;

      // Add placeholder assistant message
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Parse Vercel AI SDK v3 text stream format: "0:\"text\"\n"
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const textContent = JSON.parse(line.slice(2));
              assistantContent += textContent;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            } catch {
              // Non-JSON chunk, append raw
              assistantContent += line.slice(2);
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          }
        }
      }

      // Post-stream processing
      if (user) {
        checkForChecklistTriggers(assistantContent);
      } else {
        const match = assistantContent.match(/\[CHECKLIST:\s*([^\]]+)\]/);
        if (match) {
          const guideTitle = match[1].trim();
          const guide = GUIDES_SEED.find(g => g.title.toLowerCase() === guideTitle.toLowerCase());
          if (guide) {
            setMessages(prev =>
              prev.map(m => m.id === assistantId ? {
                ...m,
                checklistTitle: guide.title,
                checklistItems: guide.requirements_json.map(text => ({ text, checked: false }))
              } : m)
            );
            triggerToast(`May bagong checklist na binuo: "${guide.title}".`);
          }
        }
      }
      logAnalytics(assistantContent);
    } catch (err: any) {
      console.error('Chat streaming error:', err);
      triggerToast('Hindi makakonekta sa AI server. Subukan muli.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentChatId, user]);

  // 4b. Handle initialization from URL query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      
      // Handle query parameter q
      const query = searchParams.get('q');
      if (query) {
        setTimeout(() => {
          sendChatMessage(query);
        }, 200);
      }

      // Handle persona parameter
      const personaId = searchParams.get('persona');
      if (personaId) {
        const found = PERSONAS_SEED.find(p => p.persona_id === Number(personaId));
        if (found) {
          setTimeout(() => {
            handleLoadPersona(found);
          }, 200);
        }
      }

      // Handle view parameter
      const view = searchParams.get('view');
      if (view === 'personas') {
        setNavSidebarOpen(true);
        setPersonasExpanded(true);
      } else if (view === 'offline') {
        setIsOffline(true);
      } else if (view === 'checklists') {
        setSidebarOpen(true);
      }

      // Handle settings parameter
      const settings = searchParams.get('settings');
      if (settings === 'open') {
        setShowSettingsModal(true);
      }

      // Clean the query parameters from URL to avoid re-triggering on reload
      const newUrl = window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [sendChatMessage, setIsOffline, setSidebarOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage(input);
  };

  const append = useCallback((msg: { role: string; content: string }) => {
    sendChatMessage(msg.content);
  }, [sendChatMessage]);

  // 5. Toast Helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    await deleteChecklist(checklistId);
    triggerToast("Matagumpay na nabura ang checklist.");
  };

  const handleToggleLocalChecklist = (msgId: string, itemText: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId && m.checklistItems) {
        const updatedItems = m.checklistItems.map(item => {
          if (item.text === itemText) {
            return { ...item, checked: !item.checked };
          }
          return item;
        });
        return {
          ...m,
          checklistItems: updatedItems
        };
      }
      return m;
    }));
  };


  // Scroll to bottom on message updates
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Handle auto-scroll on input focus
  const handleInputFocus = () => {
    setTimeout(scrollToBottom, 150);
  };

  // 6. Checklist Extraction Parser
  const checkForChecklistTriggers = useCallback((content: string) => {
    if (!content) return;
    // Look for format: [CHECKLIST: Title]
    const match = content.match(/\[CHECKLIST:\s*([^\]]+)\]/);
    if (match) {
      const guideTitle = match[1].trim();
      const guide = GUIDES_SEED.find(g => g.title.toLowerCase() === guideTitle.toLowerCase());
      if (guide) {
        const exists = checklists.some(c => c.title === guide.title);
        if (!exists) {
          triggerToast(`May bagong checklist na binuo: "${guide.title}". I-save ito sa ibaba upang masubaybayan.`);
        }
      }
    }
  }, [checklists]);

  // Helper to strip [CHECKLIST: ...] text block from display messages
  const cleanMessageText = (text: string) => {
    if (!text) return "";
    return text.replace(/\[CHECKLIST:\s*[^\]]+\]/g, "").trim();
  };

  // Log search/queries for analytics
  const logAnalytics = async (botResponse: string) => {
    try {
      const locations = [
        { region: "National Capital Region", province: "Manila" },
        { region: "National Capital Region", province: "Quezon City" },
        { region: "CALABARZON (Region IV-A)", province: "Laguna" },
        { region: "CALABARZON (Region IV-A)", province: "Batangas" },
        { region: "Central Visayas (Region VII)", province: "Cebu" },
        { region: "Western Visayas (Region VI)", province: "Iloilo" },
        { region: "Northern Mindanao (Region X)", province: "Misamis Oriental" },
        { region: "Davao (Region XI)", province: "Davao del Sur" },
        { region: "Central Luzon (Region III)", province: "Pampanga" },
        { region: "Cordillera Administrative Region (CAR)", province: "Benguet" }
      ];
      const loc = locations[Math.floor(Math.random() * locations.length)];

      await logAnalyticsEvent({
        session_id: 'chat-session-uuid',
        event_type: 'query',
        // Scrub PII BEFORE truncating (RA 10173): same scrubber as the Gemini
        // path. Truncating first could split an SSS/TIN/phone across char 50 and
        // leak a partial identifier past the regex.
        query_preview: scrubPII(input).substring(0, 50),
        language: 'fil', // detected language
        offline_mode: isOffline,
        response_time_ms: 600,
        region: loc.region,
        province: loc.province
      });
    } catch (e) {
      console.error("Failed to log analytics:", e);
    }
  };

  // 7. Load Scenario / Persona Helper
  const handleLoadPersona = (persona: Persona) => {
    setActivePersona(persona);
    setMessages([]);
    
    // Auto Consent
    localStorage.setItem('clara-consent-agreed', 'true');

    // Auto-close persona sidebar on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setNavSidebarOpen(false);
    }
    
    if (user) {
      // Sync checklist local state for persona (authenticated only)
      clearLocalChecklists().then(() => {
        // Create checklist directly
        createChecklist(`${persona.name} - Checklist`, persona.checklist_items);
        triggerToast(`Naka-load na ang senaryo para kay ${persona.name}`);
        
        // Auto-append the test query
        append({
          role: 'user',
          content: persona.test_query
        });
      });
    } else {
      triggerToast(`Naka-load na ang senaryo para kay ${persona.name}`);
      append({
        role: 'user',
        content: persona.test_query
      });
    }
  };

  const handleSaveCache = async () => {
    if (typeof window !== 'undefined') {
      await initializeCachedGuides();
      setIsOfflineCached(true);
      alert("Naka-save na sa iyong browser! Maaari mo nang buksan ang Offline na Direktoryo kahit walang internet.");
    }
  };

  // New Chat Handler (Reset state)
  const handleNewChat = () => {
    setMessages([]);
    setActivePersona(null);
    setInput('');
    setCurrentChatId(null);
    setSidebarOpen(false);
    setNavSidebarOpen(false);
  };

  // Load recent chats from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('clara_recent_chats');
      if (stored) {
        try {
          setRecentChats(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse recent chats:", e);
        }
      }
    }
  }, []);

  // Save current chat session to recent chats list
  const saveChatToRecent = useCallback((chatId: string, msgs: ChatMessage[]) => {
    if (msgs.length === 0) return;
    
    const firstUserMsg = msgs.find(m => m.role === 'user')?.content || "Bagong Chat";
    const title = firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + "..." : firstUserMsg;

    setRecentChats(prev => {
      const existingIndex = prev.findIndex(c => c.id === chatId);
      let updated: RecentChat[];
      
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          messages: msgs,
          timestamp: new Date().toISOString()
        };
      } else {
        updated = [
          {
            id: chatId,
            title,
            messages: msgs,
            timestamp: new Date().toISOString()
          },
          ...prev
        ];
      }
      localStorage.setItem('clara_recent_chats', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Autosave chat whenever messages change
  useEffect(() => {
    if (user && currentChatId && messages.length > 0) {
      saveChatToRecent(currentChatId, messages);
    }
  }, [messages, currentChatId, saveChatToRecent, user]);

  // Load a historical chat
  const handleLoadRecentChat = (chat: RecentChat) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setNavSidebarOpen(false);
  };

  // Delete a historical chat
  const handleDeleteRecentChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentChats(prev => {
      const updated = prev.filter(c => c.id !== chatId);
      localStorage.setItem('clara_recent_chats', JSON.stringify(updated));
      return updated;
    });
    if (currentChatId === chatId) {
      handleNewChat();
    }
  };

  // 8. Suggestion Chips Selector
  const handleSelectChip = (chipText: string) => {
    if (isOffline) {
      triggerToast("Hindi magagamit ang AI Chat habang offline.");
      return;
    }
    append({
      role: 'user',
      content: chipText
    });
  };

  // 9. Compliance: Export & Delete Data
  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({
        user_profile: user || { role: 'public-mode' },
        checklists: checklists,
        chat_history: messages
      }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `clara_export_${user?.id || 'public'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Matagumpay na na-export ang iyong data.");
  };

  const handleDeleteData = async () => {
    if (confirm("Sigurado ka bang nais mong burahin ang lahat ng iyong account data? Ang desisyong ito ay permanente at hindi maaaring ibalik.")) {
      await clearLocalChecklists();
      if (user) {
        await supabase.from('checklists').delete().eq('user_id', user.id);
        await supabase.from('users').delete().eq('user_id', user.id);
        await supabase.auth.signOut();
      }
      localStorage.removeItem('clara-consent-agreed');
      triggerToast("Ang iyong data ay tuluyan nang binura.");
      router.push('/');
    }
  };

  // 10. Suggestions List
  const suggestionChips = [
    "Paano mag-correct ng apelyido sa Birth Certificate?",
    "Ano ang mga kailangan sa Late Registration?",
    "Libre ba ang pagpaparehistro ng Birth Certificate para sa Katutubo?",
    "Paano mag-file ng clerical correction kung proxy lang ako?"
  ];

  return (
    <div className="flex h-dvh w-screen bg-[var(--background)] overflow-hidden font-sans">
      
      {/* 1. Left Sidebar (ChatGPT-style main navigation) */}
      <aside 
        className={`fixed inset-y-0 left-0 md:relative h-full flex flex-col bg-[var(--surface-highlight)] border-r border-[var(--accent-border)] z-30 select-none flex-shrink-0
          ${sidebarMounted ? 'transition-all duration-300 ease-in-out' : ''}
          ${navSidebarOpen ? 'w-[260px] opacity-100 visible' : 'w-0 opacity-0 invisible pointer-events-none overflow-hidden border-r-0'}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--accent-border)] flex-shrink-0">
          <div className="brand flex items-center gap-2">
            <Link href="/" className="brand-logo w-[22px] h-[22px] flex items-center justify-center select-none" aria-label="Pumunta sa home">
              <img
                src="/logo.png"
                alt="CLARA Logo"
                className="w-[22px] h-[22px] object-contain"
              />
            </Link>
            <span className="brand-title text-base md:text-lg font-bold tracking-tight select-none">
              CLARA
            </span>
          </div>
          <button 
            onClick={() => setNavSidebarOpen(false)}
            className="p-1.5 rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Isara ang Sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-grow overflow-y-auto py-4 px-3 flex flex-col gap-2">
          <div className="mt-2 flex flex-col gap-1">
            <span className="px-3 text-[11px] md:text-xs font-bold text-[var(--text-disabled)] uppercase tracking-wider">
              Mga Opsyon
            </span>

            {/* Bagong Chat Button */}
            {user && !loadingUser && (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--accent-border)] bg-[var(--surface)] hover:bg-[var(--surface-highlight)] text-sm md:text-[15px] font-semibold text-[var(--text-primary)] transition-all text-left w-full cursor-pointer shadow-sm mb-2"
              >
                <Plus size={15} className="text-[var(--primary-green)]" />
                Bagong Chat
              </button>
            )}

            {!user && !loadingUser && (
              <Link
                href="/"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full mb-1"
              >
                <Home size={15} />
                Landing Page
              </Link>
            )}

            {/* Collapsible Scenarios (Personas) section */}
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

              {/* Personas listing */}
              {personasExpanded && (
                <div className="pl-3 pr-1 py-1 flex flex-col gap-1.5 animate-message max-h-[260px] overflow-y-auto mt-1">
                  {PERSONAS_SEED.map((p) => (
                    <button 
                      key={p.persona_id}
                      onClick={() => handleLoadPersona(p)}
                      className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all text-xs md:text-sm w-full cursor-pointer
                        ${activePersona?.persona_id === p.persona_id 
                          ? 'border-[var(--primary-green)] bg-[var(--chip-bg)] text-[var(--primary-green)]' 
                          : 'border-[var(--accent-border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-highlight)]'
                        }`}
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

            <Link
              href="/offline"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full"
            >
              <BookOpen size={15} />
              Offline na Direktoryo
            </Link>

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

            {/* Recent Chats Section */}
            {user && recentChats.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                <span className="px-3 text-[11px] md:text-xs font-bold text-[var(--text-disabled)] uppercase tracking-wider">
                  Mga Nakaraang Chat
                </span>
                <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto px-1 scrollbar-none">
                  {recentChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => handleLoadRecentChat(chat)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm md:text-[15px] font-medium cursor-pointer transition-all
                        ${currentChatId === chat.id 
                          ? 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--accent-border)]' 
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border border-transparent'
                        }`}
                    >
                      <span className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                        <MessageSquare size={13} className="text-[var(--text-disabled)] group-hover:text-[var(--text-primary)]" />
                        <span className="truncate">{chat.title}</span>
                      </span>
                      <button
                        onClick={(e) => handleDeleteRecentChat(chat.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-lg text-[var(--text-disabled)] hover:text-red-500 transition-opacity cursor-pointer flex-shrink-0"
                        title="Burahin ang chat"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible Settings */}
            {!user && (
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
                    {/* Theme settings block */}
                    <div className="flex items-center justify-between text-sm md:text-[15px] pb-2 border-b border-[var(--accent-border)]/20">
                      <span className="text-[var(--text-secondary)] font-semibold">Tema (Theme)</span>
                      <ThemeToggle />
                    </div>
                    
                    {/* Account / Data Settings Button */}
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      className="w-full text-left text-sm md:text-[15px] font-semibold text-[var(--primary-green)] hover:text-[var(--primary-dark)] cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <User size={13} />
                      Account & Data Settings
                    </button>
                  </div>
                )}
              </div>
            )}

            {!user && (
              <button
                onClick={() => setShowConsentModal(true)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all text-left w-full cursor-pointer"
              >
                <HelpCircle size={15} />
                Data Privacy & Tulong
              </button>
            )}
          </div>

          {!user && !loadingUser && (
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
          )}

        </div>

        {/* Sidebar Footer (permanently anchored to bottom) */}
        {user && !loadingUser && (
          <div className="relative p-3 border-t border-[var(--accent-border)] bg-[var(--surface-highlight)] flex-shrink-0">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center justify-between w-full p-2 rounded-xl hover:bg-[var(--surface)] hover:shadow-[var(--shadow-soft)] transition-all text-left cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--primary-green)] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                  {user.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm md:text-[15px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {user.email?.split('@')[0]}
                  </span>
                  <span className="text-xs md:text-sm text-[var(--text-disabled)] truncate">
                    {user.email}
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className={`text-[var(--text-disabled)] transition-transform duration-200 flex-shrink-0 ${userMenuOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>

            {/* Popover User Menu */}
            {userMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl shadow-[var(--shadow-card)] p-2 z-50 animate-message flex flex-col gap-0.5 select-none">
                  {/* Header row */}
                  <div className="flex items-center gap-2.5 p-2 border-b border-[var(--accent-border)] mb-1">
                    <div className="w-7 h-7 rounded-full bg-[var(--primary-green)] text-white font-bold text-[10px] flex items-center justify-center">
                      {user.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm md:text-[15px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                        {user.email?.split('@')[0]}
                      </span>
                      <span className="text-xs md:text-sm text-[var(--text-disabled)] truncate">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  {/* Theme Settings */}
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl text-sm md:text-[15px] font-medium text-[var(--text-secondary)]">
                    <span className="flex items-center gap-3">
                      <SunMoon size={15} />
                      Tema (Theme)
                    </span>
                    <ThemeToggle />
                  </div>

                  {/* Account & Data Settings */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowSettingsModal(true);
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] transition-colors text-left w-full cursor-pointer"
                  >
                    <User size={15} />
                    Mga Setting & Data
                  </button>

                  {/* Help & Privacy */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowConsentModal(true);
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm md:text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] transition-colors text-left w-full cursor-pointer"
                  >
                    <HelpCircle size={15} />
                    Data Privacy & Tulong
                  </button>

                  {/* Divider */}
                  <div className="h-[1px] bg-[var(--accent-border)] my-1" />

                  {/* Logout */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm md:text-[15px] font-medium text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 transition-colors text-left w-full cursor-pointer"
                  >
                    <LogOut size={15} />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </aside>

      {/* Backdrop overlay on mobile for left sidebar */}
      {navSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-20 transition-opacity duration-200"
          onClick={() => setNavSidebarOpen(false)}
        />
      )}

      {/* 2. Main Chat Window */}
      <section className="flex-grow flex flex-col bg-[var(--background)] overflow-hidden relative h-full">
        
        {/* Sticky Header Bar */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-[var(--accent-border)] bg-[var(--background)] flex-shrink-0 z-10">
          
          {/* Left Area (Sidebar toggle & Dropdown) */}
          <div className="flex items-center gap-2">
            {!navSidebarOpen && (
              <button
                onClick={() => setNavSidebarOpen(true)}
                className="p-1.5 rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title="Buksan ang Sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>
            )}

            {/* Brand Dropdown Swapper */}
            <div className="relative ml-1">
              <button 
                onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[var(--surface-highlight)] font-bold text-sm select-none cursor-pointer transition-all active:scale-98"
              >
                CLARA v1.0
                <ChevronDown size={12} className={`text-[var(--text-secondary)] transition-transform duration-200 ${showVersionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showVersionDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowVersionDropdown(false)} />
                  <div className="absolute left-0 mt-1.5 w-60 bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl shadow-[var(--shadow-card)] p-3 z-50 animate-message flex flex-col gap-1.5 select-none">
                    <span className="text-[9px] font-bold text-[var(--primary-green)] uppercase tracking-wider">Civil Legal & Registry Assistant</span>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      Nagbibigay ng malinaw na patnubay sa pag-proseso at pagwawasto ng mga dokumentong sibil (civic documents) at mga kaugnay na alituntunin sa Pilipinas.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Center Area (Offline Mode Indicator badge) */}
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

          {/* Right Area (Toolbar Controls) */}
          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="hidden md:flex w-10 h-10 items-center justify-center rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all"
                title="Account Settings"
              >
                <User size={18} />
              </button>
            ) : (
              <Link 
                href="/login" 
                className="h-9 px-4 rounded-full bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold flex items-center justify-center transition-all shadow-sm active:scale-95"
              >
                Log In
              </Link>
            )}

            {/* Checklist Toggles - Only visible if logged in and online */}
            {user && !isOffline && (
              <>
                {/* Checklist Mobile toggle button */}
                <button
                  onClick={() => setMobileDrawerOpen(true)}
                  className="flex md:hidden w-10 h-10 items-center justify-center rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all relative"
                  title="Aking Dokumento Checklists"
                >
                  <ListTodo size={18} />
                  {checklists.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full bg-[var(--primary-green)] text-[9px] font-bold text-white border-2 border-[var(--background)]">
                      {checklists.length}
                    </span>
                  )}
                </button>
                
                {/* Checklist Sidebar toggle button */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hidden md:flex w-10 h-10 items-center justify-center rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all"
                  title="Toggle Checklist Sidebar"
                >
                  <ListTodo size={18} />
                </button>
              </>
            )}
            
            {user && (
              <button
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 cursor-pointer hidden sm:flex active:scale-95 transition-all"
                title="Mag-log Out"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>

        {/* Core Workspace Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[var(--background)]">
          <OfflineBanner isOffline={isOffline} />

          {isOffline ? (
            // Offline Directory View
            <div className="flex-grow overflow-y-auto mt-2">
              <OfflineDirectory />
            </div>
          ) : (
            // Active Chat Stream View
            <div className="flex-grow flex flex-col overflow-hidden animate-fade-in">
              
              {messages.length === 0 ? (
                /* Centered Landing View matching ChatGPT Landing Page */
                <div className="flex-1 flex flex-col justify-center items-center px-4 max-w-[640px] w-full mx-auto gap-6 select-none animate-message">
                  <div className="text-center flex flex-col gap-2.5 max-w-[500px]">
                    <div className="hidden sm:flex w-fit mx-auto px-3 py-1 bg-[var(--chip-bg)] border border-[var(--chip-border)] rounded-full text-[10px] sm:text-xs font-semibold text-[var(--primary-green)] tracking-wide items-center gap-1.5 mb-1.5 shadow-sm">
                      <ShieldCheck size={14} />
                      Civil Legal & Registry Assistant
                    </div>
                    <h1 className="text-2xl sm:text-3.5xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
                      Ano ang maitutulong ko sa iyo ngayon?
                    </h1>
                    <h2 className="hidden sm:block text-xs sm:text-sm font-medium text-[var(--text-secondary)] leading-relaxed">
                      Magtanong tungkol sa mga dokumento tulad ng Birth Certificate, Late Registration, o RA 9048.
                    </h2>
                  </div>

                  <form 
                    onSubmit={handleSubmit}
                    className="w-full border border-[var(--accent-border)] rounded-full bg-[var(--surface)] hover:shadow-[var(--shadow-soft)] focus-within:shadow-[var(--shadow-soft)] focus-within:border-[var(--primary-green)] transition-all duration-200 pl-4 pr-1.5 py-1.5 flex items-center gap-2 text-left"
                  >
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(true)}
                      className="p-2 rounded-full hover:bg-[var(--surface-highlight)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors flex-shrink-0"
                      title="Settings & Data Controls"
                    >
                      <Plus size={18} />
                    </button>

                    <input
                      type="text"
                      placeholder="Magtanong kay CLARA..."
                      value={input}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      className="chat-input flex-grow bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-disabled)] py-2 px-1 h-10 min-w-0"
                      disabled={isLoading}
                    />

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        className="p-2 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] cursor-pointer transition-colors"
                        title="Boses na Pagtatanong"
                      >
                        <Mic size={18} />
                      </button>
                      
                      <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95
                          ${input.trim() 
                            ? 'bg-[var(--primary-green)] text-white hover:bg-[var(--primary-light)]' 
                            : 'bg-[var(--surface-highlight)] text-[var(--text-disabled)] cursor-not-allowed'
                          }`}
                      >
                        <ArrowUp size={16} />
                      </button>
                    </div>
                  </form>

                  {!isLoading && (
                    <div className="w-full">
                      <SuggestionChips 
                        chips={suggestionChips} 
                        onSelect={handleSelectChip} 
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Message Feed view with bottom input bar */
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
                    <div className="flex flex-col max-w-[640px] w-full mx-auto gap-4">
                      {messages.map((message) => {
                        const cleanText = cleanMessageText(message.content);
                        if (!cleanText && message.role === 'assistant') return null;

                        return (
                          <div key={message.id} className="flex flex-col gap-2">
                            <ChatBubble 
                              role={message.role} 
                              text={cleanText} 
                            />
                            
                            {/* Render checklist card inline in chat flow */}
                            {user && message.role === 'assistant' && message.content.includes('[CHECKLIST:') && (
                              (() => {
                                const match = message.content.match(/\[CHECKLIST:\s*([^\]]+)\]/);
                                if (match) {
                                  const title = match[1].trim();
                                  const list = checklists.find(c => c.title.toLowerCase() === title.toLowerCase());
                                  if (list) {
                                    // Already saved checklist
                                    return (
                                      <div className="pl-4 border-l-2 border-[var(--primary-green)] my-2">
                                        <ChecklistCard
                                          checklistId={list.checklist_id}
                                          title={list.title}
                                          items={list.items_json}
                                          doneCount={list.done_count}
                                          onToggle={toggleItem}
                                          onDelete={handleDeleteChecklist}
                                          lastUpdated={list.last_updated}
                                        />
                                      </div>
                                    );
                                  } else {
                                    // Preview checklist (not saved yet)
                                    const guide = GUIDES_SEED.find(g => g.title.toLowerCase() === title.toLowerCase());
                                    if (guide) {
                                      const previewItems = guide.requirements_json.map(text => ({ text, checked: false }));
                                      return (
                                        <div className="pl-4 border-l-2 border-[var(--primary-green)] my-2 opacity-95 animate-message">
                                          <ChecklistCard
                                            checklistId="preview"
                                            title={guide.title}
                                            items={previewItems}
                                            doneCount={0}
                                            onToggle={() => {
                                              triggerToast("I-save muna ang checklist upang masubaybayan ang iyong progress.");
                                            }}
                                            onSave={async () => {
                                              await createChecklist(guide.title, guide.requirements_json);
                                              triggerToast("Matagumpay na na-save ang checklist sa Aking Dokumento!");
                                            }}
                                          />
                                        </div>
                                      );
                                    }
                                  }
                                }
                                return null;
                              })()
                            )}

                            {/* Render local checklist card inline for public guest users */}
                            {!user && message.role === 'assistant' && message.checklistTitle && message.checklistItems && (
                              <div className="pl-4 border-l-2 border-[var(--primary-green)] my-2">
                                <ChecklistCard
                                  checklistId={message.id}
                                  title={message.checklistTitle}
                                  items={message.checklistItems}
                                  doneCount={message.checklistItems.filter(i => i.checked).length}
                                  onToggle={handleToggleLocalChecklist}
                                />
                                <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 ml-2 font-medium flex items-center gap-1 animate-pulse">
                                  <Info size={11} className="text-[var(--primary-green)]" />
                                  Guest Mode: Hindi maaaring i-save online. I-download bilang txt file kung kinakailangan.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {isLoading && (
                        <div className="typing-indicator flex items-center gap-1 self-start ml-2 select-none animate-pulse">
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Chat Input Bar */}
                  <div className="flex-shrink-0 bg-[var(--background)] px-4 pb-4 pt-2 transition-colors flex flex-col items-center">
                    <form 
                      onSubmit={handleSubmit}
                      className="w-full max-w-[640px] border border-[var(--accent-border)] rounded-full bg-[var(--surface)] hover:shadow-[var(--shadow-soft)] focus-within:shadow-[var(--shadow-soft)] focus-within:border-[var(--primary-green)] transition-all duration-200 pl-4 pr-1.5 py-1.5 flex items-center gap-2 text-left"
                    >
                      <button
                        type="button"
                        onClick={() => setShowSettingsModal(true)}
                        className="p-2 rounded-full hover:bg-[var(--surface-highlight)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors flex-shrink-0"
                        title="Settings & Data Controls"
                      >
                        <Plus size={18} />
                      </button>

                      <input
                        type="text"
                        placeholder="Magtanong kay CLARA..."
                        value={input}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        className="chat-input flex-grow bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-disabled)] py-2 px-1 h-10 min-w-0"
                        disabled={isLoading}
                      />

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          className="p-2 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] cursor-pointer transition-colors"
                          title="Boses na Pagtatanong"
                        >
                          <Mic size={18} />
                        </button>
                        
                        <button
                          type="submit"
                          disabled={isLoading || !input.trim()}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95
                            ${input.trim() 
                              ? 'bg-[var(--primary-green)] text-white hover:bg-[var(--primary-light)]' 
                              : 'bg-[var(--surface-highlight)] text-[var(--text-disabled)] cursor-not-allowed'
                            }`}
                        >
                          <ArrowUp size={16} />
                        </button>
                      </div>
                    </form>
                    <div className="text-[10px] text-[var(--text-disabled)] mt-2 select-none text-center">
                      Ang CLARA ay isang AI prototype. Suriin ang mahahalagang impormasyon.
                    </div>
                  </div>
                </>
              )}

            </div>
          )}
        </div>

      </section>

      {/* 3. Right Sidebar Panel - Checklist View (Desktop ≥900px) */}
      {sidebarOpen && (
        <aside className="hidden md:flex w-[340px] xl:w-[360px] border-l border-[var(--accent-border)] bg-[var(--surface)] p-4 flex-col gap-4 overflow-y-auto flex-shrink-0 z-10 select-none transition-all animate-message">
          <div className="flex items-center justify-between border-b border-[var(--accent-border)] pb-2">
            <span className="text-xs md:text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Aking Dokumento Checklists
            </span>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {checklists.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 border border-dashed border-[var(--accent-border)] rounded-xl text-center gap-2 mt-4">
              <ListTodo size={20} className="text-[var(--text-disabled)]" />
              <span className="text-xs md:text-sm text-[var(--text-secondary)]">Walang aktibong checklist sa kasalukuyan.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-2">
              {checklists.map((list) => (
                <ChecklistCard
                  key={list.checklist_id}
                  checklistId={list.checklist_id}
                  title={list.title}
                  items={list.items_json}
                  doneCount={list.done_count}
                  onToggle={toggleItem}
                  onDelete={handleDeleteChecklist}
                  isSidebar={true}
                  lastUpdated={list.last_updated}
                />
              ))}
            </div>
          )}
        </aside>
      )}

      {/* Mobile Drawer (Checklist view on mobile) */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        title="Aking Dokumento Checklists"
      >
        {checklists.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 border border-dashed border-[var(--accent-border)] rounded-xl text-center gap-2">
            <ListTodo size={20} className="text-[var(--text-disabled)]" />
            <span className="text-xs text-[var(--text-secondary)]">Walang aktibong checklist sa kasalukuyan.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {checklists.map((list) => (
              <ChecklistCard
                key={list.checklist_id}
                checklistId={list.checklist_id}
                title={list.title}
                items={list.items_json}
                doneCount={list.done_count}
                onToggle={toggleItem}
                onDelete={handleDeleteChecklist}
                isSidebar={true}
                lastUpdated={list.last_updated}
              />
            ))}
          </div>
        )}
      </MobileDrawer>

      {/* Settings Dialog (Compliance Actions - Export / Delete Account) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="drawer-overlay" onClick={() => setShowSettingsModal(false)} />
          <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl shadow-[var(--shadow-card)] p-6 w-full max-w-[420px] z-50 animate-message flex flex-col gap-5 select-none">
            <div className="flex gap-2.5 items-center justify-between border-b border-[var(--accent-border)] pb-3">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-[var(--primary-green)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Account & Data Settings</h2>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="font-bold text-[var(--text-primary)]">Naka-log in bilang:</span>
              <p className="px-3 py-2 bg-[var(--surface-highlight)] rounded-lg border border-[var(--accent-border)] font-semibold text-[var(--text-primary)] overflow-hidden text-ellipsis">
                {user ? user.email : 'Public Guest Mode'}
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <button
                onClick={handleExportData}
                className="w-full h-11 border border-[var(--primary-green)] text-[var(--primary-green)] hover:bg-[var(--chip-bg)] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <FileJson size={14} />
                I-export ang aking Data (JSON)
              </button>

              <button
                onClick={handleDeleteData}
                className="w-full h-11 border border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Trash2 size={14} />
                Burahin ang Aking Account at Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consent Dialog Modal (RA 10173 Compliance) */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Overlay */}
          <div 
            className="drawer-overlay"
            onClick={() => setShowConsentModal(false)}
          />
          {/* Modal Container */}
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

      {/* About CLARA Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Overlay */}
          <div 
            className="drawer-overlay"
            onClick={() => setShowAboutModal(false)}
          />
          {/* Modal Container */}
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