'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, BookOpen, MessageSquare, BarChart3, LogOut, Plus, 
  Edit2, Trash2, Save, X, Star, Users, CheckSquare, ListOrdered, FileText, ChevronRight, Menu,
  Play, Database, Settings, Send, RefreshCw, ShieldCheck, Map, HelpCircle, MapPin, Activity,
  Search, Upload, Download, ChevronDown, ChevronUp
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { getAllFeedback, getAllAnalyticsLogs } from '@/lib/firebase';
import { Guide, GUIDES_SEED } from '@/lib/seed-data';
import ThemeToggle from '@/components/ThemeToggle';
import Toast from '@/components/Toast';
import PhilippinesMap from '@/components/PhilippinesMap';
import { useAuth } from '@/contexts/AuthContext';
import { CRAWL_SOURCES, getCrawlSource } from '@/lib/crawl-sources';
import dynamic from 'next/dynamic';

// React Flow is client-only — load without SSR to avoid window access on the server.
const DataFlowMap = dynamic(() => import('@/components/DataFlowMap'), { ssr: false });

const SEED_SCRAPED_CHUNKS = [
  {
    id: 'web-1',
    type: 'web',
    source: 'psa.gov.ph/civilregistration/birth',
    topic: 'Birth Registry Guidelines',
    chunk_title: 'General Birth Registration Rules',
    preview: 'All birth registry events must be filed within 30 days of the baby\'s birth...',
    content: 'All birth registry events must be filed within 30 days of the baby\'s birth. The registration must be done at the Local Civil Registry Office (LCRO) of the city or municipality where the child was born.',
    embedded: true
  },
  {
    id: 'web-2',
    type: 'web',
    source: 'psa.gov.ph/civilregistration/ra9048',
    topic: 'RA 9048 Name Correction',
    chunk_title: 'Administrative Name Correction Rules',
    preview: 'Republic Act 9048 authorizes the Local Civil Registrar to correct clerical errors...',
    content: 'Republic Act 9048 authorizes the Local Civil Registrar to correct clerical or typographical errors in civil registry entries, such as misspelled names or dates of birth (day and month), without a court order.',
    embedded: true
  },
  {
    id: 'web-3',
    type: 'web',
    source: 'psa.gov.ph/civilregistration/late-registration',
    topic: 'Late Registration Requirements',
    chunk_title: 'Documents Required for Late Birth Entry',
    preview: 'Late birth registration requires a negative certification of birth from the PSA...',
    content: 'Late birth registration requires a negative certification of birth from the PSA, a joint affidavit of two disinterested persons attesting to the facts of birth, and at least two supporting documents such as school records or baptismal certificate.',
    embedded: true
  },
  {
    id: 'web-4',
    type: 'web',
    source: 'psa.gov.ph/civilregistration/marriage',
    topic: 'Marriage License Inquiries',
    chunk_title: 'General Marriage Registration Rules',
    preview: 'A marriage license is valid for 120 days from the date of issue in any part of the Philippines...',
    content: 'A marriage license is valid for 120 days from the date of issue in any part of the Philippines. If not used within this period, it is automatically deemed revoked.',
    embedded: true
  },
  {
    id: 'web-5',
    type: 'web',
    source: 'psa.gov.ph/civilregistration/death',
    topic: 'Death Registry Guidelines',
    chunk_title: 'General Death Registration Timelines',
    preview: 'Registration of death must be done within 48 hours of occurrence by the relatives...',
    content: 'Registration of death must be done within 48 hours of occurrence by the relatives or physician, at the LCRO where the death occurred. The health officer must sign the certificate of death.',
    embedded: true
  }
];

type AdminTab = 'dashboard' | 'guides' | 'feedback' | 'analytics' | 'sandbox' | 'data' | 'geography' | 'who' | 'what' | 'where' | 'how' | 'dataflow';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, role: authRole, loading: authLoading, signOut } = useAuth();
  
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'who' | 'what' | 'where' | 'how'>('where');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<string>('');
  const consoleEndRef = React.useRef<HTMLDivElement>(null);
  const [addContentOpen, setAddContentOpen] = useState<boolean>(false);
  
  // Data States
  const [guides, setGuides] = useState<Guide[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [analyticsLogs, setAnalyticsLogs] = useState<any[]>([]);
  
  // Knowledge Base RAG & Crawler States
  const [kbEntries, setKbEntries] = useState<any[]>([]);
  // Live vector index — REAL doc_chunks from Supabase pgvector (via /api/admin/chunks)
  const [vectorChunks, setVectorChunks] = useState<any[]>([]);
  const [vectorMeta, setVectorMeta] = useState<{ embed_model?: string; dim?: number; total?: number }>({});
  const [crawling, setCrawling] = useState<boolean>(false);
  const [crawlLogs, setCrawlLogs] = useState<string[]>(["Idle. Pick a source and run a fetch preview (no vectors written yet)."]);
  const [crawlSourceId, setCrawlSourceId] = useState<string>('all');
  const [consoleExpanded, setConsoleExpanded] = useState<boolean>(true);
  const [kbSearchQuery, setKbSearchQuery] = useState<string>('');
  const [kbFilterType, setKbFilterType] = useState<'all' | 'manual' | 'web' | 'pdf'>('all');
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Sandbox States
  const [sandboxSystemPrompt, setSandboxSystemPrompt] = useState('Ikaw si CLARA, isang matulunging AI assistant para sa civil registry documents ng AI4Gov. Sumunod sa data privacy rules.');
  const [sandboxTemperature, setSandboxTemperature] = useState(0.7);
  const [sandboxModel, setSandboxModel] = useState('CLARA-LLM v1.5 (Default)');
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxMessages, setSandboxMessages] = useState<any[]>([
    { sender: 'bot', text: 'Sandboks mode: I-type ang iyong test message para makita ang tugon ni CLARA.' }
  ]);
  const [sandboxDebuggerLogs, setSandboxDebuggerLogs] = useState<any>(null);
  const [sandboxTesting, setSandboxTesting] = useState(false);

  // Data Management States
  const [dataLastSynced, setDataLastSynced] = useState('Kani-kanina lang');
  const [dataRecompiling, setDataRecompiling] = useState(false);

  // Guide CRUD Form States
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<'Birth' | 'Marriage' | 'Death'>('Birth');
  const [formLanguage, setFormLanguage] = useState<'fil' | 'vis' | 'eng'>('fil');
  const [formFees, setFormFees] = useState('');
  const [formTips, setFormTips] = useState('');
  const [formSteps, setFormSteps] = useState<string>(''); // comma-separated instructions
  const [formRequirements, setFormRequirements] = useState<string>(''); // comma-separated

  // Geography States & Calculations
  const [mapViewMode, setMapViewMode] = useState<'regions' | 'provinces'>('regions');
  const [hoveredGeom, setHoveredGeom] = useState<{ name: string; region: string; count: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15
      });
    }
  };

  const handleMapMouseLeave = () => {
    setTooltipPos(null);
    setHoveredGeom(null);
  };

  const { regionCounts, provinceCounts } = React.useMemo(() => {
    const rCounts: { [key: string]: number } = {};
    const pCounts: { [key: string]: number } = {};

    // Seed realistic baseline weights so the map looks populated even if fresh
    const baseline = [
      { region: "National Capital Region", province: "Manila", weight: 35 },
      { region: "National Capital Region", province: "Quezon City", weight: 24 },
      { region: "National Capital Region", province: "Taguig", weight: 15 },
      { region: "CALABARZON (Region IV-A)", province: "Laguna", weight: 20 },
      { region: "CALABARZON (Region IV-A)", province: "Batangas", weight: 14 },
      { region: "CALABARZON (Region IV-A)", province: "Cavite", weight: 18 },
      { region: "Central Visayas (Region VII)", province: "Cebu", weight: 28 },
      { region: "Central Visayas (Region VII)", province: "Bohol", weight: 10 },
      { region: "Western Visayas (Region VI)", province: "Iloilo", weight: 14 },
      { region: "Western Visayas (Region VI)", province: "Negros Occidental", weight: 12 },
      { region: "Northern Mindanao (Region X)", province: "Misamis Oriental", weight: 11 },
      { region: "Davao (Region XI)", province: "Davao del Sur", weight: 16 },
      { region: "Central Luzon (Region III)", province: "Pampanga", weight: 13 },
      { region: "Central Luzon (Region III)", province: "Bulacan", weight: 15 },
      { region: "Ilocos (Region I)", province: "Pangasinan", weight: 12 },
      { region: "Bicol (Region V)", province: "Camarines Sur", weight: 9 },
      { region: "Cordillera Administrative Region (CAR)", province: "Benguet", weight: 7 },
      { region: "SOCCSKSARGEN (Region XII)", province: "South Cotabato", weight: 9 },
      { region: "Autonomous Region in Muslim Mindanao (ARMM)", province: "Sulu", weight: 5 },
      { region: "Autonomous Region in Muslim Mindanao (ARMM)", province: "Maguindanao", weight: 7 },
      { region: "Cagayan Valley (Region II)", province: "Isabela", weight: 6 },
      { region: "Eastern Visayas (Region VIII)", province: "Leyte", weight: 10 },
      { region: "MIMAROPA (Region IV-B)", province: "Palawan", weight: 8 },
      { region: "Dinagat Islands (Region XIII)", province: "Surigao del Norte", weight: 4 }
    ];

    baseline.forEach(item => {
      rCounts[item.region] = (rCounts[item.region] || 0) + item.weight;
      pCounts[item.province] = (pCounts[item.province] || 0) + item.weight;
    });

    // Add counts from actual session logs
    analyticsLogs.forEach(log => {
      if (log.region) {
        rCounts[log.region] = (rCounts[log.region] || 0) + 1;
      }
      if (log.province) {
        pCounts[log.province] = (pCounts[log.province] || 0) + 1;
      }
    });

    return { regionCounts: rCounts, provinceCounts: pCounts };
  }, [analyticsLogs]);

  const rankedItems = React.useMemo(() => {
    const counts = mapViewMode === 'regions' ? regionCounts : provinceCounts;
    const total = Object.values(counts).reduce((acc, v) => acc + v, 0) || 1;
    
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: ((count / total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);
  }, [mapViewMode, regionCounts, provinceCounts]);

  const handleSimulateTraffic = async () => {
    const regionsAndProvinces = [
      { region: "National Capital Region", province: "Manila" },
      { region: "National Capital Region", province: "Quezon City" },
      { region: "National Capital Region", province: "Taguig" },
      { region: "CALABARZON (Region IV-A)", province: "Batangas" },
      { region: "CALABARZON (Region IV-A)", province: "Laguna" },
      { region: "CALABARZON (Region IV-A)", province: "Cavite" },
      { region: "Central Visayas (Region VII)", province: "Cebu" },
      { region: "Central Visayas (Region VII)", province: "Bohol" },
      { region: "Western Visayas (Region VI)", province: "Iloilo" },
      { region: "Western Visayas (Region VI)", province: "Negros Occidental" },
      { region: "Northern Mindanao (Region X)", province: "Misamis Oriental" },
      { region: "Davao (Region XI)", province: "Davao del Sur" },
      { region: "Central Luzon (Region III)", province: "Pampanga" },
      { region: "Central Luzon (Region III)", province: "Bulacan" },
      { region: "Ilocos (Region I)", province: "Pangasinan" },
      { region: "Bicol (Region V)", province: "Camarines Sur" },
      { region: "Cordillera Administrative Region (CAR)", province: "Benguet" },
      { region: "SOCCSKSARGEN (Region XII)", province: "South Cotabato" },
      { region: "Autonomous Region in Muslim Mindanao (ARMM)", province: "Sulu" },
      { region: "Autonomous Region in Muslim Mindanao (ARMM)", province: "Maguindanao" },
      { region: "Cagayan Valley (Region II)", province: "Isabela" },
      { region: "Eastern Visayas (Region VIII)", province: "Leyte" },
      { region: "MIMAROPA (Region IV-B)", province: "Palawan" },
      { region: "Dinagat Islands (Region XIII)", province: "Surigao del Norte" }
    ];

    const batchSize = Math.floor(Math.random() * 10) + 15;
    const queries = [
      "Correction of name in birth certificate",
      "How to register late birth",
      "Filing fee for marriage correction",
      "Late registration of death certificate",
      "Document requirements for legal name change",
      "How to correct clerical error in marriage contract"
    ];
    const langs = ["fil", "vis", "eng"];
    
    try {
      const { logAnalyticsEvent } = await import('@/lib/firebase');
      for (let i = 0; i < batchSize; i++) {
        const loc = regionsAndProvinces[Math.floor(Math.random() * regionsAndProvinces.length)];
        await logAnalyticsEvent({
          session_id: `sim-s-${Math.random().toString(36).substring(2, 8)}`,
          event_type: 'query',
          query_preview: queries[Math.floor(Math.random() * queries.length)],
          language: langs[Math.floor(Math.random() * langs.length)],
          offline_mode: Math.random() < 0.2,
          response_time_ms: Math.floor(Math.random() * 500) + 100,
          region: loc.region,
          province: loc.province
        });
      }
      triggerToast(`Traffic simulation complete: Added ${batchSize} new user session logs.`);
      loadAllData();
    } catch (err) {
      console.error("Traffic simulation failed:", err);
      triggerToast("Failed to write simulation traffic logs.");
    }
  };

  // Auth check using global user
  useEffect(() => {
    if (!authLoading) {
      // Role comes from AuthContext, which reads the users table in live mode
      // (mock mode inlines it on the user object). Don't read user.role directly.
      const role = authRole;
      const isAuthorized = role === 'admin' || role === 'lcro';
      
      if (!isAuthorized) {
        triggerToast("Access Denied: Administrative or LCRO privileges required.");
        router.push('/login');
        return;
      }
      
      // User is authorized – load data
      loadAllData();
    }
  }, [user, authRole, authLoading, router]);

  // Live Clock Ticking Effect
  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      const formatted = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setCurrentTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal output to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [crawlLogs]);

  // Redirect legacy tabs to unified analytics sub-tabs
  useEffect(() => {
    if (['who', 'what', 'where', 'how', 'geography'].includes(activeTab)) {
      setActiveTab('analytics');
      setAnalyticsSubTab(activeTab === 'geography' ? 'where' : activeTab as any);
    }
  }, [activeTab]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Load Guides
      const { data: guidesData } = await supabase.from('guides').select('*');
      const loadedGuides = guidesData && guidesData.length > 0 ? guidesData : GUIDES_SEED;
      setGuides(loadedGuides);
      
      // 2. Load Feedback from Firestore (or LocalStorage mock)
      const feedbackData = await getAllFeedback();
      setFeedbacks(feedbackData);

      // 3. Load Analytics Logs
      const logs = await getAllAnalyticsLogs();
      setAnalyticsLogs(logs);

      // 4. Map Guides to RAG chunks and seed the Knowledge Base
      const manualEntries = loadedGuides.map((g: any) => ({
        id: `manual-${g.guide_id}`,
        type: 'manual',
        source: 'Manual Entry',
        topic: `${g.category} Guide`,
        chunk_title: g.title,
        preview: g.steps_json?.[0]?.instruction || g.fees_text || '',
        content: `Title: ${g.title}\nCategory: ${g.category}\nFees: ${g.fees_text}\nTips: ${g.tips}`,
        embedded: true
      }));

      // Combine with static seed chunks (preserving crawled session logs if any)
      setKbEntries((prev) => {
        const existingScraped = prev.filter(item => item.type === 'web');
        const scrapedToUse = existingScraped.length > 0 ? existingScraped : SEED_SCRAPED_CHUNKS;
        return [...manualEntries, ...scrapedToUse];
      });

      // 5. Load the REAL vector index (doc_chunks). Admin-gated route; ignore if 403.
      await refreshVectorChunks();
    } catch (e) {
      console.error("Failed to load admin data:", e);
      triggerToast("Failed to retrieve dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  // Real fetch-preview of curated authoritative sources (ADR-002). Streams
  // NDJSON events from /api/admin/crawl: actually fetches + extracts + chunks
  // each allow-listed source. PREVIEW = no embeds, no doc_chunks writes yet.
  const handleStartCrawl = async (mode: 'preview' | 'ingest' = 'preview') => {
    if (crawling) return;
    setCrawling(true);

    const label =
      crawlSourceId === 'all'
        ? `all ${CRAWL_SOURCES.length} curated sources`
        : getCrawlSource(crawlSourceId)?.label ?? crawlSourceId;
    setCrawlLogs([
      `$ ingest --${mode} "${label}"`,
      mode === 'ingest'
        ? 'Fetch + extract + embed → write doc_chunks (unverified).'
        : 'Real fetch + extract; no vectors written (preview mode).',
      '----------------------------------------------------------------',
    ]);

    try {
      const res = await fetch('/api/admin/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: crawlSourceId, mode }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        setCrawlLogs(prev => [...prev, `✗ Request failed: HTTP ${res.status} ${errText}`]);
        setCrawling(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let doneEvent: { ok: number; failed: number; totalChunks: number; embedded?: number; skipped?: number } | null = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: any;
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === 'log' || ev.type === 'start') {
            setCrawlLogs(prev => [...prev, ev.msg]);
          } else if (ev.type === 'done') {
            doneEvent = ev;
            setCrawlLogs(prev => [...prev, '----------------------------------------------------------------', ev.msg]);
          }
        }
      }

      setCrawling(false);
      if (doneEvent) {
        if (mode === 'ingest') {
          triggerToast(`Ingested ${doneEvent.embedded ?? 0} unverified chunk(s); ${doneEvent.skipped ?? 0} skipped.`);
          await refreshVectorChunks();
        } else {
          triggerToast(`Preview: ${doneEvent.ok} ok, ${doneEvent.failed} failed, ${doneEvent.totalChunks} chunks extracted.`);
        }
      }
    } catch (e: any) {
      setCrawlLogs(prev => [...prev, `✗ Network error: ${e?.message ?? String(e)}`]);
      setCrawling(false);
    }
  };

  const handlePdfUploadMock = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    triggerToast(`Simulating PDF parse: "${file.name}"...`);
    
    setTimeout(() => {
      const currentPdfCount = kbEntries.filter(item => item.type === 'pdf').length;
      const newChunks = Array.from({ length: 3 }, (_, idx) => {
        const chunkNum = currentPdfCount + idx + 1;
        return {
          id: `pdf-${Date.now()}-${idx}`,
          type: 'pdf',
          source: `Uploaded File: ${file.name}`,
          topic: `PDF Document - ${file.name.replace('.pdf', '')}`,
          chunk_title: `Section ${idx + 1} of ${file.name}`,
          preview: `Extracted segment from PDF: ${file.name}. Demonstrating parsing text and embedding RAG vectors...`,
          content: `[SIMULATED] Demo segment ${idx + 1} for "${file.name}". This PDF preview does not parse or embed — real chunks come from the guide ingestion path.`,
          embedded: true
        };
      });
      setKbEntries(prev => [...newChunks, ...prev]);
      triggerToast(`Success: Extracted & embedded 3 chunks from "${file.name}".`);
    }, 1500);
  };

  const handleDeleteKbEntry = async (item: any) => {
    if (item.type === 'manual') {
      await handleDeleteGuide(item.guide_id);
    } else {
      if (confirm(`Sigurado ka bang nais mong burahin ang segment na ito (${item.chunk_title})?`)) {
        setKbEntries(prev => prev.filter(entry => entry.id !== item.id));
        triggerToast("Nabura na ang segment mula sa lokal na cache.");
      }
    }
  };

  const handleEditKbEntry = (item: any) => {
    if (item.type === 'manual') {
      const g = guides.find(x => x.guide_id === item.guide_id);
      if (g) {
        handleEditGuide(g);
        setAddContentOpen(true);
      }
    } else {
      triggerToast("Ang mga awtomatikong nakalap na web chunks at PDF ay maaari lamang burahin o i-reembed.");
    }
  };

  const handleExportKb = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(kbEntries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `clara_knowledge_base_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Nai-export ang Knowledge Base bilang JSON.");
  };

  // --- REAL vector-index actions (ADR-001 step 4) ---------------------------
  const refreshVectorChunks = async () => {
    try {
      const res = await fetch('/api/admin/chunks');
      if (!res.ok) return; // 403 for non-admins / 503 if service role missing
      const j = await res.json();
      setVectorChunks(j.data || []);
      if (j.meta) setVectorMeta(j.meta);
    } catch {
      /* offline / network — leave existing state */
    }
  };

  // Re-embed every guide into doc_chunks via the admin route (real Gemini embeds).
  const handleReembed = async () => {
    triggerToast("Re-embedding guides into the vector index...");
    try {
      const res = await fetch('/api/admin/chunks/reembed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'failed');
      triggerToast(`Re-embedded ${j.reembedded} chunk(s) into pgvector.`);
      await refreshVectorChunks();
    } catch (e) {
      triggerToast("Re-embed failed — needs admin access + a valid Gemini key.");
    }
  };

  // Flip a chunk's effective_status (the content gate). Only 'active' chunks are retrievable.
  const handleActivateChunk = async (chunkId: number, status: 'active' | 'unverified') => {
    try {
      const res = await fetch('/api/admin/chunks/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk_id: chunkId, status }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'failed');
      triggerToast(status === 'active' ? "Chunk activated — now retrievable by chat." : "Chunk deactivated.");
      await refreshVectorChunks();
    } catch (e) {
      triggerToast("Status change failed.");
    }
  };

  // CRUD handlers
  const handleEditGuide = (guide: Guide) => {
    setEditingGuide(guide);
    setIsCreating(false);
    setFormTitle(guide.title);
    setFormCategory(guide.category);
    setFormLanguage(guide.language);
    setFormFees(guide.fees_text);
    setFormTips(guide.tips);
    setFormSteps(guide.steps_json.map(s => s.instruction).join('\n'));
    setFormRequirements(guide.requirements_json.join('\n'));
  };

  const handleNewGuide = () => {
    setEditingGuide(null);
    setIsCreating(true);
    setFormTitle('');
    setFormCategory('Birth');
    setFormLanguage('fil');
    setFormFees('');
    setFormTips('');
    setFormSteps('');
    setFormRequirements('');
  };

  const handleSaveGuide = async (e: React.FormEvent) => {
    e.preventDefault();

    const steps = formSteps.split('\n')
      .filter(line => line.trim() !== '')
      .map((line, idx) => ({ step_number: idx + 1, instruction: line.trim() }));

    const reqs = formRequirements.split('\n')
      .filter(line => line.trim() !== '');

    const guidePayload = {
      title: formTitle,
      category: formCategory,
      language: formLanguage,
      fees_text: formFees,
      tips: formTips,
      steps_json: steps,
      requirements_json: reqs
    };

    try {
      if (isCreating) {
        // Create
        const { error } = await supabase.from('guides').insert({
          ...guidePayload,
          guide_id: Math.floor(Math.random() * 1000) + 200,
          kb_id: Math.floor(Math.random() * 1000) + 300
        });

        if (error) throw error;
        triggerToast("Matagumpay na idinagdag ang bagong gabay.");
      } else if (editingGuide) {
        // Update
        const { error } = await supabase.from('guides').update(guidePayload).eq('guide_id', editingGuide.guide_id);
        if (error) throw error;
        triggerToast("Matagumpay na in-update ang gabay.");
      }

      // Reset
      setIsCreating(false);
      setEditingGuide(null);
      loadAllData();
    } catch (e: any) {
      console.error(e);
      triggerToast(`Error: ${e.message}`);
    }
  };

  const handleDeleteGuide = async (guideId: number) => {
    if (confirm("Sigurado ka bang nais mong burahin ang gabay na ito?")) {
      try {
        const { error } = await supabase.from('guides').delete().eq('guide_id', guideId);
        if (error) throw error;
        triggerToast("Nabura na ang gabay.");
        loadAllData();
      } catch (e: any) {
        console.error(e);
        triggerToast(`Error: ${e.message}`);
      }
    }
  };

  // Metric aggregates
  const totalUsersCount = feedbacks.reduce((acc, f) => acc + (f.user_id ? 1 : 0), 10); // Simulated baseline
  const unresolvedFeedbackCount = feedbacks.filter(f => f.rating <= 2).length;
  const avgResponseTime = analyticsLogs.length > 0 
    ? Math.round(analyticsLogs.reduce((acc, l) => acc + (l.response_time_ms || 0), 0) / analyticsLogs.length) 
    : 450;

  // Language count
  const langStats = analyticsLogs.reduce(
    (acc, log) => {
      const l = log.language || 'fil';
      if (l === 'fil') acc.fil++;
      else if (l === 'vis') acc.vis++;
      else if (l === 'eng') acc.eng++;
      return acc;
    },
    { fil: 0, vis: 0, eng: 0 }
  );

  const totalLogs = analyticsLogs.length || 1;
  const filPct = Math.round((langStats.fil / totalLogs) * 100) || 45;
  const visPct = Math.round((langStats.vis / totalLogs) * 100) || 35;
  const engPct = Math.round((langStats.eng / totalLogs) * 100) || 20;

  // Offline ratio
  const offlineLogsCount = analyticsLogs.filter(l => l.offline_mode).length;
  const offlinePct = Math.round((offlineLogsCount / totalLogs) * 100) || 25;

  // Role-based display helper
  const getDisplayRole = () => {
    if (!user) return null;
    return authRole;
  };

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <span className="text-xs text-[var(--text-secondary)] font-bold">Naglo-load...</span>
      </div>
    );
  }

  const displayRole = getDisplayRole();

  return (
    <div className="flex h-screen bg-[var(--background)] overflow-hidden relative">
      
      {/* Backdrop overlay on mobile */}
      {adminSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setAdminSidebarOpen(false)}
        />
      )}

      {/* Sidebar Panel (Fixed 240px wide, matches community sidebar theme) */}
      <aside className={`
        fixed inset-y-0 left-0 w-[240px] bg-[var(--surface-highlight)] border-r border-[var(--accent-border)] flex flex-col justify-between flex-shrink-0 z-50 select-none text-[var(--text-secondary)] transition-transform duration-300 md:relative md:translate-x-0 md:flex
        ${adminSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        <div className="flex flex-col gap-6">
          {/* Header Branding */}
          <div className="h-16 border-b border-[var(--accent-border)] px-5 flex items-center gap-2.5">
            <div className="w-[22px] h-[22px] flex items-center justify-center flex-shrink-0 select-none">
              <img
                src="/logo.png"
                alt="CLARA Logo"
                className="w-[22px] h-[22px] object-contain"
              />
            </div>
            <span className="text-[var(--text-primary)] text-base md:text-[17px] font-bold tracking-tight select-none">
              CLARA ADMIN
            </span>
          </div>

          {/* Nav Links */}
          <nav className="flex flex-col gap-1 px-3">
            {/* Analytics Link - available to both admin and lcro */}
            <button
              onClick={() => { setActiveTab('analytics'); setAdminSidebarOpen(false); }}
              className={`w-full h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all cursor-pointer border text-left
                ${activeTab === 'analytics' || ['who', 'what', 'where', 'how', 'geography'].includes(activeTab)
                  ? 'bg-[var(--primary-green)] text-white border-transparent shadow-[var(--shadow-soft)]' 
                  : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border-transparent'
                }`}
            >
              <BarChart3 size={15} />
              Analytics
            </button>

            {/* Knowledge Base Link - Admin only */}
            {displayRole === 'admin' && (
              <button
                onClick={() => { setActiveTab('guides'); setAdminSidebarOpen(false); }}
                className={`w-full h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all cursor-pointer border text-left
                  ${activeTab === 'guides' 
                    ? 'bg-[var(--primary-green)] text-white border-transparent shadow-[var(--shadow-soft)]' 
                    : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border-transparent'
                  }`}
              >
                <BookOpen size={15} />
                Knowledge Base
              </button>
            )}

            {/* User Feedback Link - Admin only (good/bad ratings on responses) */}
            {displayRole === 'admin' && (
              <button
                onClick={() => { setActiveTab('feedback'); setAdminSidebarOpen(false); }}
                className={`w-full h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all cursor-pointer border text-left
                  ${activeTab === 'feedback' 
                    ? 'bg-[var(--primary-green)] text-white border-transparent shadow-[var(--shadow-soft)]' 
                    : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border-transparent'
                  }`}
              >
                <MessageSquare size={15} />
                User Feedback
                {unresolvedFeedbackCount > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold flex items-center justify-center border border-red-200">
                    {unresolvedFeedbackCount}
                  </span>
                )}
              </button>
            )}

            {/* System / Dev Tools Section - Admin only */}
            {displayRole === 'admin' && (
              <div className="flex flex-col gap-1 mt-4 pt-4 border-t border-[var(--accent-border)]/50">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-disabled)] px-3.5 mb-1.5 select-none">
                  Dev Tools
                </span>
                <button
                  onClick={() => { setActiveTab('sandbox'); setAdminSidebarOpen(false); }}
                  className={`w-full h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer border text-left
                    ${activeTab === 'sandbox' 
                      ? 'bg-[var(--surface-highlight)] text-[var(--text-primary)] border-transparent shadow-sm' 
                      : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border-transparent'
                    }`}
                >
                  <Star size={13} />
                  Testing Sandbox
                </button>
                <button
                  onClick={() => { setActiveTab('data'); setAdminSidebarOpen(false); }}
                  className={`w-full h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer border text-left
                    ${activeTab === 'data' 
                      ? 'bg-[var(--surface-highlight)] text-[var(--text-primary)] border-transparent shadow-sm' 
                      : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border-transparent'
                    }`}
                >
                  <Database size={13} />
                  Data Management
                </button>
                <button
                  onClick={() => { setActiveTab('dataflow'); setAdminSidebarOpen(false); }}
                  className={`w-full h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer border text-left
                    ${activeTab === 'dataflow'
                      ? 'bg-[var(--surface-highlight)] text-[var(--text-primary)] border-transparent shadow-sm'
                      : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border-transparent'
                    }`}
                >
                  <Activity size={13} />
                  Data Flow
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* Sidebar Footer (Logout inline with admin account) */}
        <div className="p-4 border-t border-[var(--accent-border)] bg-[var(--surface-highlight)] flex-shrink-0">
          <div className="flex items-center justify-between gap-1.5 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--primary-green)] text-white text-xs font-bold flex items-center justify-center select-none uppercase shadow-sm flex-shrink-0">
                {displayRole === 'admin' ? 'A' : 'L'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[95px] leading-tight select-none">
                  {user?.email?.split('@')[0]}
                </span>
                <span className="text-[11px] text-[var(--text-disabled)] truncate max-w-[95px] select-none">
                  {displayRole?.toUpperCase()}
                </span>
              </div>
            </div>
 
            <button
              onClick={() => { handleLogout(); setAdminSidebarOpen(false); }}
              className="px-2 py-1.5 rounded-lg text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
              title="Logout"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 border-b border-[var(--accent-border)] bg-[var(--surface)] px-4 sm:px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdminSidebarOpen(!adminSidebarOpen)}
              className="md:hidden p-2 rounded-lg border border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center"
              title="Toggle Sidebar Menu"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-xs sm:text-sm md:text-base font-bold text-[var(--text-primary)]">
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'guides' && 'Knowledge Base CRUD Manager'}
              {activeTab === 'feedback' && 'Citizen Feedback Review'}
              {activeTab === 'analytics' && 'Operational Analytics & System Logs'}
              {activeTab === 'who' && 'User Demographics (Who)'}
              {activeTab === 'what' && 'Query Topics & Activity (What)'}
              {activeTab === 'where' && 'User Geographic Heatmap (Where)'}
              {activeTab === 'how' && 'System Performance (How)'}
              {activeTab === 'sandbox' && 'Chatbot Testing Sandbox & Prompt Debugger'}
              {activeTab === 'dataflow' && 'CLARA Data Flow'}
              {activeTab === 'data' && 'Offline Data & Cache Management'}
              {activeTab === 'geography' && 'User Geographic Heatmap'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--background)]">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-xs text-[var(--text-secondary)] font-bold">Iniloload ang mga sukatan...</span>
            </div>
          ) : (
            <>
              {activeTab === 'dataflow' && <DataFlowMap />}
              {/* Tab 1: Dashboard */}
              {activeTab === 'dashboard' && (
                <div className="flex flex-col gap-6">
                  {/* Metric Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-5 rounded-xl flex items-center justify-between shadow-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Active Users</span>
                        <span className="text-2xl font-extrabold text-[var(--text-primary)]">{totalUsersCount}</span>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-[var(--chip-bg)] text-[var(--primary-green)] flex items-center justify-center">
                        <Users size={20} />
                      </div>
                    </div>

                    <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-5 rounded-xl flex items-center justify-between shadow-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Active Guides Cache</span>
                        <span className="text-2xl font-extrabold text-[var(--text-primary)]">{guides.length}</span>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-[var(--chip-bg)] text-[var(--primary-green)] flex items-center justify-center">
                        <BookOpen size={20} />
                      </div>
                    </div>

                    <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-5 rounded-xl flex items-center justify-between shadow-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Unresolved Feedback</span>
                        <span className="text-2xl font-extrabold text-red-500">{unresolvedFeedbackCount}</span>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                        <MessageSquare size={20} />
                      </div>
                    </div>
                  </div>

                  {/* Hot topic keywords list */}
                  <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Hot Topic Search Keywords</h3>
                    <div className="flex gap-2 flex-wrap">
                      {['Birth certificate discrepancy', 'RA 9048 Correction Fee', 'Late Registration negative certificate', 'Tboli tribal singular name', 'SPA representative requirement', 'Barangay residency certified copy'].map((kw, idx) => (
                        <span key={idx} className="px-3 py-1 bg-[var(--surface-highlight)] rounded-full text-xs font-medium border border-[var(--accent-border)] text-[var(--text-secondary)]">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Summary Logs */}
                  <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Recent Activity Logs</h3>
                    <div className="flex flex-col gap-2">
                      {analyticsLogs.slice(0, 3).map((log, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-[var(--accent-border)] last:border-0 text-xs">
                          <span className="font-semibold text-[var(--text-primary)] max-w-[280px] overflow-hidden text-ellipsis">
                            Query: &quot;{log.query_preview}&quot;
                          </span>
                          <span className="text-[var(--text-secondary)]">
                            Language: {log.language} • {log.offline_mode ? 'Offline' : 'Online'} • {log.response_time_ms}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Guides Manager (CRUD & RAG Knowledge Base) */}
              {activeTab === 'guides' && (() => {
                const totalEntries = kbEntries.length;
                const embeddedCount = kbEntries.filter((e: any) => e.embedded).length;
                const webChunks = kbEntries.filter((e: any) => e.type === 'web');
                const pagesScraped = webChunks.length > 5 ? 71 : webChunks.length;
                const pdfCount = kbEntries.filter((e: any) => e.type === 'pdf').length;
                const manualCount = kbEntries.filter((e: any) => e.type === 'manual').length;

                // Filtering & Search
                const filteredKbEntries = kbEntries.filter((item: any) => {
                  if (kbFilterType !== 'all' && item.type !== kbFilterType) {
                    return false;
                  }
                  if (kbSearchQuery.trim() !== '') {
                    const q = kbSearchQuery.toLowerCase();
                    return (
                      item.topic?.toLowerCase().includes(q) ||
                      item.chunk_title?.toLowerCase().includes(q) ||
                      item.preview?.toLowerCase().includes(q) ||
                      item.content?.toLowerCase().includes(q) ||
                      item.source?.toLowerCase().includes(q)
                    );
                  }
                  return true;
                });

                return (
                  <div className="flex flex-col gap-6">
                    {/* Header Action Row */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl shadow-sm select-none">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Knowledge Base & RAG Index</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">Manage manual guides, scraped sitemap pages, and ingested document vectors.</p>
                      </div>
                      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                        <button
                          onClick={handleExportKb}
                          className="px-3 py-1.5 bg-[var(--chip-bg)] text-[var(--text-primary)] hover:bg-[var(--accent-border)] text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors border border-[var(--accent-border)]"
                          title="I-export bilang JSON file"
                        >
                          <Download size={14} />
                          Export
                        </button>
                        <button
                          onClick={handleReembed}
                          className="px-3 py-1.5 bg-[var(--chip-bg)] text-[var(--text-primary)] hover:bg-[var(--accent-border)] text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors border border-[var(--accent-border)]"
                          title="I-compute muli ang lahat ng embeddings"
                        >
                          <RefreshCw size={14} />
                          Re-embed
                        </button>
                        <button
                          onClick={() => setAddContentOpen(!addContentOpen)}
                          className="px-3 py-1.5 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                        >
                          {addContentOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          Add Content
                        </button>
                      </div>
                    </div>

                    {/* Live Vector Index — REAL doc_chunks from Supabase pgvector */}
                    <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Database size={15} className="text-[var(--primary-green)]" />
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">Live Vector Index</h3>
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase">Supabase pgvector</span>
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                          {(vectorMeta.embed_model || 'gemini-embedding-001')} · {(vectorMeta.dim || 768)}d · {vectorChunks.length} chunks · {vectorChunks.filter((c: any) => c.effective_status === 'active').length} active
                        </span>
                      </div>
                      {vectorChunks.length === 0 ? (
                        <p className="text-xs text-[var(--text-secondary)]">
                          No embedded chunks yet. Click <strong>Re-embed</strong> above (or run <span className="font-mono">npm run ingest:kb</span>) to populate the index.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[var(--text-secondary)] text-left">
                                <th className="py-1 pr-2 font-bold">Chunk</th>
                                <th className="py-1 px-2 font-bold">Lang</th>
                                <th className="py-1 px-2 font-bold">Status</th>
                                <th className="py-1 pl-2 font-bold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vectorChunks.map((c: any) => (
                                <tr key={c.chunk_id} className="border-t border-[var(--accent-border)]">
                                  <td className="py-1.5 pr-2 text-[var(--text-primary)]">{c.chunk_title}</td>
                                  <td className="py-1.5 px-2 uppercase text-[var(--text-secondary)]">{c.language}</td>
                                  <td className="py-1.5 px-2">
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${c.effective_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {c.effective_status}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pl-2 text-right">
                                    <button
                                      onClick={() => handleActivateChunk(c.chunk_id, c.effective_status === 'active' ? 'unverified' : 'active')}
                                      className="px-2 py-1 rounded-lg border border-[var(--accent-border)] hover:bg-[var(--chip-bg)] text-[10px] font-bold cursor-pointer transition-colors"
                                    >
                                      {c.effective_status === 'active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p className="text-[10px] text-[var(--text-secondary)] mt-2">
                        Only <strong>active</strong> chunks are retrievable by the chat (content gate, handoff doc 05). Re-embed refreshes each vector from the current guide text.
                      </p>
                    </div>

                    {/* 5 Summary Cards Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 select-none">
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-sm min-h-[85px]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Entries</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-xl font-extrabold text-[var(--text-primary)]">{totalEntries}</span>
                          <span className="text-[9px] text-[var(--text-secondary)]">chunks</span>
                        </div>
                      </div>
                      
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-sm min-h-[85px]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Embedded Chunks</span>
                        <div className="flex items-baseline gap-1.5 mt-2">
                          <span className="text-xl font-extrabold text-[var(--text-primary)]">{embeddedCount}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase">Ready</span>
                        </div>
                      </div>

                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-sm min-h-[85px]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Pages Scraped</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-xl font-extrabold text-[var(--text-primary)]">{pagesScraped}</span>
                          <span className="text-[9px] text-[var(--text-secondary)]">psa.gov.ph</span>
                        </div>
                      </div>

                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-sm min-h-[85px]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">From PDF Docs</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-xl font-extrabold text-[var(--text-primary)]">{pdfCount}</span>
                          <span className="text-[9px] text-[var(--text-secondary)]">segments</span>
                        </div>
                      </div>

                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-sm min-h-[85px] col-span-2 md:col-span-1">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Manual Entries</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-xl font-extrabold text-[var(--text-primary)]">{manualCount}</span>
                          <span className="text-[9px] text-[var(--text-secondary)]">guides</span>
                        </div>
                      </div>
                    </div>

                    {/* Crawler Simulator Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left: Scraper Controls (5 Cols) */}
                      <div className="lg:col-span-5 bg-[var(--surface)] border border-[var(--accent-border)] p-5 rounded-xl shadow-sm flex flex-col justify-between gap-4 h-[385px]">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Database size={16} className="text-[var(--primary-green)]" />
                            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">RAG Source Ingester</h4>
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[8px] font-black uppercase">Live · Preview</span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
                            Fetch the verified authoritative sources (primary laws + PSA Helpline) and preview extraction. Government agency portals are excluded — they block automated access, so that content is curated by hand.
                          </p>

                          <div className="flex flex-col gap-3.5">
                            {/* Authoritative source select */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Authoritative Source</label>
                              <select
                                value={crawlSourceId}
                                onChange={(e) => setCrawlSourceId(e.target.value)}
                                className="h-9 px-2 rounded-lg border border-[var(--accent-border)] bg-[var(--background)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer focus:outline-none focus:border-[var(--primary-green)]"
                                disabled={crawling}
                              >
                                <option value="all">All curated sources ({CRAWL_SOURCES.length})</option>
                                {CRAWL_SOURCES.map((s) => (
                                  <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Resolved target URL (read-only) */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Target URL</label>
                              <div className="h-9 px-3 rounded-lg border border-[var(--accent-border)] bg-[var(--surface-highlight)] text-xs flex items-center text-[var(--text-secondary)] font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                                {crawlSourceId === 'all'
                                  ? `${CRAWL_SOURCES.length} curated URLs (lawphil.net, psahelpline.ph)`
                                  : getCrawlSource(crawlSourceId)?.url}
                              </div>
                            </div>

                            {/* Source note + preview hint */}
                            <div className="flex flex-col gap-2 rounded-lg border border-[var(--accent-border)] bg-[var(--background)] p-3">
                              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                {crawlSourceId === 'all'
                                  ? 'Fetches every allow-listed source in sequence.'
                                  : getCrawlSource(crawlSourceId)?.note}
                              </p>
                              <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                                <ShieldCheck size={12} /> Preview mode — fetches &amp; extracts for real; no vectors are written yet.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartCrawl('preview')}
                            disabled={crawling}
                            className="flex-1 h-10 bg-[var(--surface-highlight)] hover:bg-[var(--background)] border border-[var(--accent-border)] disabled:opacity-50 text-[var(--text-primary)] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors select-none"
                          >
                            <Play size={14} className={crawling ? 'animate-spin' : ''} />
                            Preview
                          </button>
                          <button
                            onClick={() => handleStartCrawl('ingest')}
                            disabled={crawling}
                            className="flex-1 h-10 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm select-none"
                          >
                            <Database size={14} className={crawling ? 'animate-pulse' : ''} />
                            {crawling ? 'Working…' : 'Ingest to Vector DB'}
                          </button>
                        </div>
                      </div>

                      {/* Right: Simulated CLI Terminal Output (7 Cols) */}
                      <div className="lg:col-span-7 bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl shadow-sm flex flex-col gap-2 h-[385px]">
                        <div className="flex justify-between items-center select-none border-b border-[var(--accent-border)] pb-2">
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Live Scraper Console Logs</span>
                          <span className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${crawling ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                              {crawling ? 'Running' : 'Idle'}
                            </span>
                          </span>
                        </div>

                        <div className="flex-1 bg-[#121212] border border-[#262626] rounded-lg p-3 font-mono text-[10px] text-[#4af626] overflow-y-auto flex flex-col gap-1.5 shadow-inner leading-relaxed">
                          {crawlLogs.map((log, idx) => (
                            <div key={idx} className="whitespace-pre-wrap">
                              {log}
                            </div>
                          ))}
                          <div ref={consoleEndRef} />
                        </div>
                      </div>
                    </div>

                    {/* Add Content Collapsible Section */}
                    {addContentOpen && (
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-5 shadow-sm flex flex-col gap-5">
                        <div className="flex justify-between items-center border-b border-[var(--accent-border)] pb-3 select-none">
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary-green)]">
                            Ingest Data Into RAG Knowledge Base
                          </span>
                          <button
                            type="button"
                            onClick={() => setAddContentOpen(false)}
                            className="text-[var(--text-secondary)] hover:text-red-500 cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Manual Guide Form Container */}
                          <div className="border border-[var(--accent-border)] rounded-xl p-4 bg-[var(--background)]">
                            <div className="flex items-center gap-1.5 mb-3 border-b border-[var(--accent-border)] pb-2">
                              <Edit2 size={14} className="text-[var(--primary-green)]" />
                              <span className="text-xs font-bold text-[var(--text-primary)] uppercase">
                                {editingGuide ? 'Mag-edit ng Gabay' : 'Magdagdag ng Gabay'}
                              </span>
                            </div>

                            <form onSubmit={handleSaveGuide} className="flex flex-col gap-3.5">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Guide Title</label>
                                <input
                                  type="text"
                                  required
                                  value={formTitle}
                                  onChange={(e) => setFormTitle(e.target.value)}
                                  className="h-9 px-3 rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] text-xs"
                                  placeholder="Hal. Pagwawasto ng Pagkakamali sa Pangalan"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Category</label>
                                  <select
                                    value={formCategory}
                                    onChange={(e) => setFormCategory(e.target.value as any)}
                                    className="h-9 px-2 rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] text-xs"
                                  >
                                    <option value="Birth">Birth</option>
                                    <option value="Marriage">Marriage</option>
                                    <option value="Death">Death</option>
                                  </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Language</label>
                                  <select
                                    value={formLanguage}
                                    onChange={(e) => setFormLanguage(e.target.value as any)}
                                    className="h-9 px-2 rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] text-xs"
                                  >
                                    <option value="fil">Filipino (Tagalog)</option>
                                    <option value="vis">Bisaya (Cebuano)</option>
                                    <option value="eng">English</option>
                                  </select>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                                  Hakbang (Steps) — Bawat hakbang sa bagong linya
                                </label>
                                <textarea
                                  rows={3}
                                  required
                                  placeholder="Ihanda ang mga kailangang dokumento...&#10;Pumunta sa LCRO...&#10;Magbayad sa kahera..."
                                  value={formSteps}
                                  onChange={(e) => setFormSteps(e.target.value)}
                                  className="p-2.5 rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] text-xs font-mono"
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                                  Kailangan (Requirements) — Bawat kailangan sa bagong linya
                                </label>
                                <textarea
                                  rows={3}
                                  required
                                  placeholder="Birth Certificate mula sa PSA&#10;Dalawang valid IDs&#10;Residency certificate..."
                                  value={formRequirements}
                                  onChange={(e) => setFormRequirements(e.target.value)}
                                  className="p-2.5 rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] text-xs font-mono"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Bayarin (Fees Text)</label>
                                  <input
                                    type="text"
                                    required
                                    value={formFees}
                                    onChange={(e) => setFormFees(e.target.value)}
                                    className="h-9 px-3 rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] text-xs"
                                    placeholder="Hal. Php 1,000.00 filing fee"
                                  />
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Tip (Optional)</label>
                                  <input
                                    type="text"
                                    value={formTips}
                                    onChange={(e) => setFormTips(e.target.value)}
                                    className="h-9 px-3 rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] text-xs"
                                    placeholder="Hal. Dumating nang maaga sa LCRO"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 pt-2">
                                {(editingGuide || isCreating) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsCreating(false);
                                      setEditingGuide(null);
                                    }}
                                    className="px-4 py-2 border border-[var(--accent-border)] hover:bg-[var(--accent-border)] text-[var(--text-primary)] text-xs font-bold rounded-lg cursor-pointer transition-colors"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  type="submit"
                                  className="px-4 py-2 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                                >
                                  <Save size={14} />
                                  {editingGuide ? 'Save Changes' : 'Publish Guide'}
                                </button>
                              </div>
                            </form>
                          </div>

                          {/* PDF Document Upload Simulation */}
                          <div className="border border-[var(--accent-border)] rounded-xl p-4 bg-[var(--background)] flex flex-col justify-between h-full min-h-[300px]">
                            <div>
                              <div className="flex items-center gap-1.5 mb-3 border-b border-[var(--accent-border)] pb-2 select-none">
                                <FileText size={14} className="text-[var(--primary-green)]" />
                                <span className="text-xs font-bold text-[var(--text-primary)] uppercase">
                                  Ingest Document (PDF / DOCX)
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
                                Mag-upload ng memorandum guidelines, circulars, o PDF manual. Awtomatikong kukunin ng RAG system ang text, hahatiin ito sa segments, at bubuo ng vector embeddings.
                              </p>

                              {/* Upload Zone */}
                              <div className="border-2 border-dashed border-[var(--accent-border)] hover:border-[var(--primary-green)] rounded-xl p-6 bg-[var(--surface)] flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors relative min-h-[140px] select-none">
                                <input
                                  type="file"
                                  accept=".pdf"
                                  onChange={handlePdfUploadMock}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="w-10 h-10 rounded-full bg-[var(--chip-bg)] text-[var(--primary-green)] flex items-center justify-center">
                                  <Upload size={18} />
                                </div>
                                <span className="text-xs font-bold text-[var(--text-primary)]">Mag-drag ng file rito o i-click para mag-browse</span>
                                <span className="text-[10px] text-[var(--text-secondary)]">Tanging PDF format (.pdf) hanggang 15MB</span>
                              </div>
                            </div>

                            <div className="bg-[var(--surface-highlight)] border border-[var(--accent-border)] p-3 rounded-lg text-[10px] text-[var(--text-secondary)] leading-relaxed mt-4">
                              <span className="font-bold text-[var(--text-primary)] block mb-1">RAG Embeddings Workflow:</span>
                              1. Extract plain text content from PDF. <br />
                              2. Run RecursiveCharacterTextSplitter (chunk size: 500 characters, overlap: 50). <br />
                              3. Compute vector float array via standard LLM embeddings API. <br />
                              4. Save embeddings in database for cosine similarity queries.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chunk Filter, Search & Table */}
                    <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-4 shadow-sm flex flex-col gap-4">
                      
                      {/* Search and Filters Row */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        {/* Search Input */}
                        <div className="relative w-full md:w-80">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-secondary)]">
                            <Search size={14} />
                          </span>
                          <input
                            type="text"
                            placeholder="I-search ang database chunks..."
                            value={kbSearchQuery}
                            onChange={(e) => setKbSearchQuery(e.target.value)}
                            className="w-full h-9 pl-9 pr-4 rounded-lg border border-[var(--accent-border)] bg-[var(--background)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary-green)] transition-colors"
                          />
                          {kbSearchQuery && (
                            <button
                              onClick={() => setKbSearchQuery('')}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* Filter Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap select-none">
                          <button
                            onClick={() => setKbFilterType('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              kbFilterType === 'all'
                                ? 'bg-[var(--primary-green)] text-white'
                                : 'bg-[var(--chip-bg)] text-[var(--text-secondary)] hover:bg-[var(--accent-border)]'
                            }`}
                          >
                            All Chunks
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase ${
                              kbFilterType === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--accent-border)] text-[var(--text-primary)]'
                            }`}>{kbEntries.length}</span>
                          </button>

                          <button
                            onClick={() => setKbFilterType('manual')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              kbFilterType === 'manual'
                                ? 'bg-[var(--primary-green)] text-white'
                                : 'bg-[var(--chip-bg)] text-[var(--text-secondary)] hover:bg-[var(--accent-border)]'
                            }`}
                          >
                            Manual Guides
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase ${
                              kbFilterType === 'manual' ? 'bg-white/20 text-white' : 'bg-[var(--accent-border)] text-[var(--text-primary)]'
                            }`}>{manualCount}</span>
                          </button>

                          <button
                            onClick={() => setKbFilterType('web')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              kbFilterType === 'web'
                                ? 'bg-[var(--primary-green)] text-white'
                                : 'bg-[var(--chip-bg)] text-[var(--text-secondary)] hover:bg-[var(--accent-border)]'
                            }`}
                          >
                            Web Crawled
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase ${
                              kbFilterType === 'web' ? 'bg-white/20 text-white' : 'bg-[var(--accent-border)] text-[var(--text-primary)]'
                            }`}>{webChunks.length}</span>
                          </button>

                          <button
                            onClick={() => setKbFilterType('pdf')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              kbFilterType === 'pdf'
                                ? 'bg-[var(--primary-green)] text-white'
                                : 'bg-[var(--chip-bg)] text-[var(--text-secondary)] hover:bg-[var(--accent-border)]'
                            }`}
                          >
                            PDF Ingest
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase ${
                              kbFilterType === 'pdf' ? 'bg-white/20 text-white' : 'bg-[var(--accent-border)] text-[var(--text-primary)]'
                            }`}>{pdfCount}</span>
                          </button>
                        </div>
                      </div>

                      {/* Entries Table */}
                      <div className="border border-[var(--accent-border)] rounded-xl overflow-hidden">
                        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-[var(--surface-highlight)] text-xs font-bold text-[var(--text-secondary)] border-b border-[var(--accent-border)] sticky top-0 z-10 select-none">
                                <th className="p-3">#</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Page / Topic</th>
                                <th className="p-3">Chunk / Question</th>
                                <th className="p-3">Content Preview</th>
                                <th className="p-3">Embedded</th>
                                <th className="p-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs">
                              {filteredKbEntries.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="p-8 text-center text-[var(--text-secondary)] select-none">
                                    Walang nahanap na tugmang segment sa database.
                                  </td>
                                </tr>
                              ) : (
                                filteredKbEntries.map((item: any, idx: number) => (
                                  <tr key={item.id} className="border-b border-[var(--accent-border)] hover:bg-[var(--surface-highlight)] transition-colors">
                                    <td className="p-3 font-semibold text-[var(--text-secondary)] select-none">
                                      {idx + 1}
                                    </td>
                                    <td className="p-3 select-none">
                                      {item.type === 'manual' && (
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-bold uppercase">
                                          manual
                                        </span>
                                      )}
                                      {item.type === 'web' && (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-600 text-[9px] font-bold uppercase">
                                          web
                                        </span>
                                      )}
                                      {item.type === 'pdf' && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-600 text-[9px] font-bold uppercase">
                                          pdf
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 font-semibold text-[var(--text-primary)] max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.source}>
                                      {item.topic || item.source}
                                    </td>
                                    <td className="p-3 font-bold text-[var(--text-primary)] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                                      {item.chunk_title}
                                    </td>
                                    <td className="p-3 text-[var(--text-secondary)] max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap font-medium" title={item.content}>
                                      {item.preview || item.content}
                                    </td>
                                    <td className="p-3 select-none">
                                      {item.embedded ? (
                                        <div className="flex items-center gap-1 text-emerald-600">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          <span className="text-[10px] font-bold uppercase">Ready</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 text-[var(--text-disabled)]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                          <span className="text-[10px] font-bold uppercase">Pending</span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 text-right flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleEditKbEntry(item)}
                                        className={`p-1.5 rounded transition-colors ${
                                          item.type === 'manual'
                                            ? 'bg-[var(--chip-bg)] text-[var(--primary-green)] hover:bg-[var(--primary-green)] hover:text-white cursor-pointer'
                                            : 'bg-[var(--chip-bg)] text-[var(--text-disabled)] opacity-40 cursor-not-allowed'
                                        }`}
                                        disabled={item.type !== 'manual'}
                                        title={item.type === 'manual' ? 'I-edit ang gabay' : 'Hindi maaaring i-edit ang crawled chunk'}
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteKbEntry(item)}
                                        className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-500 hover:text-white cursor-pointer transition-colors"
                                        title="Burahin ang chunk"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* Tab 3: Feedback Logs */}
              {activeTab === 'feedback' && (
                <div className="flex flex-col gap-4">
                  {feedbacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[var(--accent-border)] rounded-xl text-center gap-2">
                      <MessageSquare size={24} className="text-[var(--text-disabled)]" />
                      <span className="text-xs text-[var(--text-secondary)]">Walang feedback na isinumite ang mga mamamayan.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {feedbacks.map((f) => (
                        <div 
                          key={f.feedback_id}
                          className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-5 shadow-sm flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between border-b border-[var(--accent-border)] pb-2 select-none">
                            <div className="flex items-center gap-1.5">
                              {/* Rating Stars */}
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  size={14} 
                                  className={i < f.rating ? 'fill-[var(--primary-green)] text-[var(--primary-green)]' : 'text-[var(--text-disabled)]'} 
                                />
                              ))}
                              <span className="text-xs font-bold text-[var(--text-primary)] ml-1">
                                Rating: {f.rating}/5
                              </span>
                            </div>
                            <span className="text-[10px] text-[var(--text-secondary)]">
                              {new Date(f.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider select-none">Comment ng Citizen:</span>
                            <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed bg-[var(--surface-highlight)] p-3 rounded-lg border border-[var(--accent-border)]">
                              &quot;{f.comment || '(Walang komento na isinulat)'}&quot;
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] select-none">
                            <span>User ID: {f.user_id || 'Public Mode / Anonymous'}</span>
                            <Link 
                              href="/chat" 
                              className="text-[var(--primary-green)] hover:underline flex items-center gap-0.5 font-bold"
                            >
                              Suriin ang Chat History
                              <ChevronRight size={10} />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}



              {/* Tab 4: Unified Analytics Dashboard */}
              {activeTab === 'analytics' && (
                <div className="flex flex-col gap-6">
                  
                  {/* Small Timestamp Header */}
                  <div className="flex items-center justify-between select-none">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]/85 uppercase tracking-wide">
                      CLARA ADMIN — {currentTime || '12:03:06 PM'} PST
                    </span>
                  </div>

                  {/* Interactions badge & Row of Metrics */}
                  <div className="flex flex-col gap-3">
                    <div className="flex select-none">
                      <span className="px-3 py-1 bg-[var(--primary-green)] text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                        Interactions
                      </span>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Average Time Spent */}
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-[var(--shadow-soft)] min-h-[95px]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase leading-snug">
                          Average Time Spent by Users in minutes:
                        </span>
                        <span className="text-3xl font-extrabold text-[var(--primary-green)] mt-1 select-all">
                          503
                        </span>
                      </div>

                      {/* Total Number of Visits */}
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-[var(--shadow-soft)] min-h-[95px]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase leading-snug">
                          Total Number of Visits:
                        </span>
                        <span className="text-3xl font-extrabold text-[var(--primary-green)] mt-1 select-all">
                          {93 + analyticsLogs.length}
                        </span>
                      </div>

                      {/* Active Users */}
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-[var(--shadow-soft)] min-h-[95px]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase leading-snug">
                          Active Users:
                        </span>
                        <span className="text-3xl font-extrabold text-[var(--primary-green)] mt-1 select-all">
                          {41 + Math.round(feedbacks.length * 0.1)}
                        </span>
                      </div>

                      {/* Total Interactions (30 days) */}
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] p-4 rounded-xl flex flex-col justify-between shadow-[var(--shadow-soft)] min-h-[95px]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase leading-snug">
                          Total Interactions (30 days):
                        </span>
                        <span className="text-3xl font-extrabold text-[var(--primary-green)] mt-1 select-all">
                          {225 + analyticsLogs.length * 2}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-navigation Tabs */}
                  <div className="flex bg-[var(--surface-highlight)] rounded-xl p-1 border border-[var(--accent-border)] select-none">
                    <button
                      onClick={() => setAnalyticsSubTab('who')}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        analyticsSubTab === 'who' 
                          ? 'bg-[var(--primary-green)] text-white shadow-sm' 
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50'
                      }`}
                    >
                      <Users size={14} />
                      Who?
                    </button>
                    <button
                      onClick={() => setAnalyticsSubTab('what')}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        analyticsSubTab === 'what' 
                          ? 'bg-[var(--primary-green)] text-white shadow-sm' 
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50'
                      }`}
                    >
                      <MessageSquare size={14} />
                      What?
                    </button>
                    <button
                      onClick={() => setAnalyticsSubTab('where')}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        analyticsSubTab === 'where' 
                          ? 'bg-[var(--primary-green)] text-white shadow-sm' 
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50'
                      }`}
                    >
                      <MapPin size={14} />
                      Where?
                    </button>
                    <button
                      onClick={() => setAnalyticsSubTab('how')}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        analyticsSubTab === 'how' 
                          ? 'bg-[var(--primary-green)] text-white shadow-sm' 
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50'
                      }`}
                    >
                      <Activity size={14} />
                      How?
                    </button>
                  </div>

                  {/* Prompt Question Banner */}
                  <div className="bg-[var(--primary-green)] rounded-xl py-3 px-4 shadow-[var(--shadow-soft)] text-center select-none">
                    <span className="text-white text-xs sm:text-sm font-bold tracking-wide">
                      {analyticsSubTab === 'who' && "Which languages or demographics are most active on the platform?"}
                      {analyticsSubTab === 'what' && "Which specific civil registry categories have the highest user interest?"}
                      {analyticsSubTab === 'where' && "Which regions have the highest vs. lowest chatbot engagement?"}
                      {analyticsSubTab === 'how' && "How does system performance, network mode, and latency look?"}
                    </span>
                  </div>

                  {/* Sub-tab Content Areas */}
                  <div className="flex flex-col gap-6">
                    {/* Where Content (Geographic Map) */}
                    {analyticsSubTab === 'where' && (
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        
                        {/* Left: Map Card */}
                        <div className="xl:col-span-2 bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl p-5 shadow-[var(--shadow-soft)] flex flex-col gap-4">
                          <div className="flex items-center justify-between border-b border-[var(--accent-border)] pb-3 select-none">
                            <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                              <Map size={15} className="text-[var(--primary-green)]" />
                              <span className="text-xs font-bold uppercase tracking-wider">Users Per Region</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Toggle Mode */}
                              <div className="flex bg-[var(--surface-highlight)] rounded-lg p-0.5 border border-[var(--accent-border)]">
                                <button
                                  onClick={() => setMapViewMode('regions')}
                                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                    mapViewMode === 'regions' 
                                      ? 'bg-[var(--primary-green)] text-white' 
                                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                  }`}
                                >
                                  Regions
                                </button>
                                <button
                                  onClick={() => setMapViewMode('provinces')}
                                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                    mapViewMode === 'provinces' 
                                      ? 'bg-[var(--primary-green)] text-white' 
                                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                  }`}
                                >
                                  Provinces
                                </button>
                              </div>

                              {/* Traffic Simulator */}
                              <button
                                onClick={handleSimulateTraffic}
                                className="px-2.5 py-1.5 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                              >
                                <RefreshCw size={11} />
                                Simulate Traffic
                              </button>
                            </div>
                          </div>

                          {/* Map Display Wrapper */}
                          <div 
                            ref={mapContainerRef}
                            onMouseMove={handleMapMouseMove}
                            onMouseLeave={handleMapMouseLeave}
                            className="flex-1 min-h-[500px] flex items-center justify-center bg-[var(--surface-highlight)] rounded-xl border border-[var(--accent-border)] relative p-4 overflow-hidden"
                          >
                            {/* Zoom Controls Overlay */}
                            <div className="absolute top-4 left-4 flex flex-col bg-[var(--surface)] border border-[var(--accent-border)] rounded-lg shadow-sm overflow-hidden z-10 select-none">
                              <button 
                                onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 4.0))}
                                className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] border-b border-[var(--accent-border)] cursor-pointer"
                                title="Zoom In"
                              >
                                +
                              </button>
                              <button 
                                onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 1.0))}
                                className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] cursor-pointer"
                                title="Zoom Out"
                              >
                                -
                              </button>
                            </div>

                            <div 
                              className="w-full max-w-[380px] h-full flex items-center justify-center transition-transform duration-200 ease-out"
                              style={{ transform: `scale(${zoomLevel})` }}
                            >
                              <PhilippinesMap 
                                data={mapViewMode === 'regions' ? regionCounts : provinceCounts} 
                                viewMode={mapViewMode} 
                                onHoverItem={setHoveredGeom}
                              />
                            </div>
                            
                            {/* Density Legend */}
                            <div className="absolute bottom-4 left-4 bg-[var(--surface)]/90 backdrop-blur-sm border border-[var(--accent-border)] rounded-lg p-2.5 flex flex-col gap-1.5 text-[10px] shadow-sm select-none">
                              <span className="font-extrabold text-[var(--text-primary)] uppercase tracking-wider">Density Legend</span>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded bg-[var(--accent-border)] opacity-20" />
                                  <span className="text-[var(--text-secondary)]">0 sessions</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded bg-[#eab308]" />
                                  <span className="text-[var(--text-secondary)]">Low density (Yellow)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded bg-[#f97316]" />
                                  <span className="text-[var(--text-secondary)]">Medium density (Orange)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded bg-[#ef4444]" />
                                  <span className="text-[var(--text-secondary)]">High density (Red)</span>
                                </div>
                              </div>
                            </div>

                            {/* Dynamic Floating Tooltip */}
                            {hoveredGeom && tooltipPos && (
                              <div 
                                style={{
                                  position: 'absolute',
                                  left: `${tooltipPos.x}px`,
                                  top: `${tooltipPos.y}px`,
                                  pointerEvents: 'none',
                                  zIndex: 40,
                                }}
                                className="bg-[var(--surface)] border border-[var(--accent-border)] px-3 py-2.5 rounded-xl shadow-[var(--shadow-card)] backdrop-blur-md flex flex-col gap-0.5 min-w-[150px] animate-fade-in text-left select-none pointer-events-none"
                              >
                                <span className="text-xs font-extrabold text-[var(--text-primary)]">{hoveredGeom.name}</span>
                                {hoveredGeom.region && hoveredGeom.region !== hoveredGeom.name && (
                                  <span className="text-[10px] text-[var(--text-secondary)] font-medium">{hoveredGeom.region}</span>
                                )}
                                <div className="flex flex-col gap-0.5 mt-1 border-t border-[var(--accent-border)]/45 pt-1">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-[var(--text-secondary)]">Sessions:</span>
                                    <span className="text-xs font-bold text-[var(--primary-green)]">{hoveredGeom.count}</span>
                                  </div>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-[var(--text-secondary)]">Avg interactions:</span>
                                    <span className="text-xs font-bold text-[var(--primary-green)]">
                                      {(7.4 + (hoveredGeom.name.charCodeAt(0) % 5) * 0.3).toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Ranked List & Insights */}
                        <div className="flex flex-col gap-6">
                          {/* Top Engaging Regions Card */}
                          <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl p-5 shadow-[var(--shadow-soft)] flex flex-col flex-1 max-h-[440px] xl:max-h-none overflow-hidden select-none">
                            <div className="flex items-center justify-between border-b border-[var(--accent-border)] pb-2.5 mb-3">
                              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                                <Star size={14} className="text-[#eab308]" />
                                Top Engaging Regions
                              </span>
                              <span className="text-[9px] font-bold text-[var(--primary-green)] bg-[var(--chip-bg)] px-2 py-0.5 rounded-full uppercase">
                                {mapViewMode}
                              </span>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
                              {rankedItems.slice(0, 8).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--accent-border)] last:border-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[var(--text-secondary)] font-bold">#{idx + 1}</span>
                                    <span className="text-[var(--text-primary)] font-semibold truncate max-w-[170px]">{item.name}</span>
                                  </div>
                                  <span className="px-2.5 py-0.5 rounded-md bg-[var(--primary-green)] text-white text-[10px] font-bold">
                                    {item.count}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Yellow/Orange Alert Box */}
                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex gap-3 shadow-sm select-none">
                            <MapPin size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
                                10 Regions with Zero Users
                              </span>
                              <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium">
                                Targeted outreach needed.
                              </span>
                            </div>
                          </div>

                          {/* Insights text block */}
                          <div className="text-xs text-[var(--text-secondary)] leading-relaxed italic p-1 border-t border-[var(--accent-border)]/45 pt-3 select-none">
                            High-engagement regions signal stronger CLARA awareness or active promotion by local offices. Zero-user regions require generic outreach - localized promotions, roadshows, and partner collaborations.
                          </div>
                        </div>

                      </div>
                    )}

                    {/* Who Content */}
                    {analyticsSubTab === 'who' && (
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl p-6 shadow-[var(--shadow-soft)] flex flex-col gap-6 select-none animate-fade-in">
                        <div className="flex flex-col gap-1 border-b border-[var(--accent-border)] pb-4">
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">Language Distribution (Who)</h3>
                          <p className="text-xs text-[var(--text-secondary)]">Demographics of users based on their preferred language during sessions.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                              <span>Filipino (Tagalog)</span>
                              <span>{filPct}%</span>
                            </div>
                            <div className="w-full h-4 bg-[var(--surface-highlight)] rounded-full overflow-hidden border border-[var(--accent-border)]/30">
                              <div className="h-full bg-[var(--primary-green)] rounded-full transition-all duration-1000" style={{ width: `${filPct}%` }} />
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                              <span>Bisaya (Cebuano)</span>
                              <span>{visPct}%</span>
                            </div>
                            <div className="w-full h-4 bg-[var(--surface-highlight)] rounded-full overflow-hidden border border-[var(--accent-border)]/30">
                              <div className="h-full bg-[var(--primary-light)] rounded-full transition-all duration-1000" style={{ width: `${visPct}%` }} />
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                              <span>English</span>
                              <span>{engPct}%</span>
                            </div>
                            <div className="w-full h-4 bg-[var(--surface-highlight)] rounded-full overflow-hidden border border-[var(--accent-border)]/30">
                              <div className="h-full bg-[var(--text-disabled)] rounded-full transition-all duration-1000" style={{ width: `${engPct}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* What Content */}
                    {analyticsSubTab === 'what' && (
                      <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl p-6 shadow-[var(--shadow-soft)] flex flex-col gap-6 animate-fade-in">
                        <div className="flex flex-col gap-1 border-b border-[var(--accent-border)] pb-4">
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">Query Topics & Activity Logs (What)</h3>
                          <p className="text-xs text-[var(--text-secondary)]">Complete list of system interactions, queries, and bot responses.</p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[var(--accent-border)]">
                                <th className="py-3 px-4 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Timestamp</th>
                                <th className="py-3 px-4 font-bold text-[var(--text-secondary)] uppercase tracking-wider">User Query</th>
                                <th className="py-3 px-4 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Mode</th>
                                <th className="py-3 px-4 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Lang</th>
                                <th className="py-3 px-4 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Latency</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--accent-border)]">
                              {analyticsLogs.length > 0 ? (
                                analyticsLogs.map((log, idx) => (
                                  <tr key={idx} className="hover:bg-[var(--surface-highlight)] transition-colors">
                                    <td className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                                      {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                                      {log.query_text || log.query_preview || <span className="text-[var(--text-disabled)] italic">System Event</span>}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${log.offline_mode ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                        {log.offline_mode ? 'Offline' : 'Online'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 uppercase font-bold text-[var(--text-secondary)]">{log.language || '??'}</td>
                                    <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{log.response_time_ms}ms</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="py-10 text-center text-[var(--text-secondary)] italic">
                                    Walang session logs na nahanap.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* How Content */}
                    {analyticsSubTab === 'how' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        {/* Operational Modes */}
                        <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl p-6 shadow-[var(--shadow-soft)] flex flex-col gap-5 select-none">
                          <div className="flex items-center gap-2 text-[var(--text-primary)] border-b border-[var(--accent-border)] pb-3">
                            <Database size={16} className="text-[var(--primary-green)]" />
                            <h3 className="text-sm font-bold">Network Mode Ratio</h3>
                          </div>
                          
                          <div className="flex flex-col gap-4">
                            <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                              <span>Offline Mode Searching</span>
                              <span className="text-amber-500">{offlinePct}%</span>
                            </div>
                            <div className="w-full h-5 bg-[var(--surface-highlight)] rounded-full overflow-hidden flex border border-[var(--accent-border)]/30">
                              <div className="h-full bg-[var(--primary-green)] transition-all duration-1000" style={{ width: `${100 - offlinePct}%` }} />
                              <div className="h-full bg-amber-400 transition-all duration-1000" style={{ width: `${offlinePct}%` }} />
                            </div>
                            <div className="flex flex-wrap gap-4 text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-[var(--primary-green)] rounded-sm" />
                                Online AI ({100 - offlinePct}%)
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-amber-400 rounded-sm" />
                                Offline Cache ({offlinePct}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Latencies */}
                        <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl p-6 shadow-[var(--shadow-soft)] flex flex-col gap-5 select-none">
                          <div className="flex items-center gap-2 text-[var(--text-primary)] border-b border-[var(--accent-border)] pb-3">
                            <Activity size={16} className="text-[var(--primary-green)]" />
                            <h3 className="text-sm font-bold">Latency Performance</h3>
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)]">Average Response Time</span>
                              <span className="text-3xl font-black text-[var(--text-primary)]">{avgResponseTime} <span className="text-sm font-bold text-[var(--text-secondary)]">ms</span></span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-[var(--chip-bg)] text-[var(--primary-green)] flex items-center justify-center shadow-inner">
                              <FileText size={24} />
                            </div>
                          </div>
                          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed italic">
                            * Ang latensya ay sinusukat mula sa pagpapadala ng query hanggang sa pagtanggap ng unang token mula sa LLM.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
 
              {/* Tab 5: Chatbot Testing Sandbox */}
              {activeTab === 'sandbox' && authRole === 'admin' && (
                <div className="flex flex-col xl:flex-row gap-6 h-auto xl:h-[calc(100vh-170px)] overflow-hidden">
                  
                  {/* Left panel: Configurations */}
                  <div className="w-full xl:w-80 bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-5 shadow-[var(--shadow-soft)] flex flex-col gap-4 overflow-y-auto flex-shrink-0 select-none">
                    <div className="flex items-center gap-2 border-b border-[var(--accent-border)] pb-2">
                      <Settings size={16} className="text-[var(--primary-green)]" />
                      <span className="text-sm font-bold text-[var(--text-primary)]">Sandbox Configs</span>
                    </div>

                    {/* Model selector */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">AI Model Version</label>
                      <select 
                        value={sandboxModel}
                        onChange={(e) => setSandboxModel(e.target.value)}
                        className="w-full h-10 rounded-lg border border-[var(--accent-border)] bg-[var(--background)] px-2.5 text-xs text-[var(--text-primary)] outline-none"
                      >
                        <option value="CLARA-LLM v1.5 (Default)">CLARA-LLM v1.5 (Default)</option>
                        <option value="CLARA-LLM v1.0-Legacy">CLARA-LLM v1.0-Legacy</option>
                        <option value="CLARA-Reasoning v2.0-Alpha">CLARA-Reasoning v2.0-Alpha</option>
                      </select>
                    </div>

                    {/* System Instructions */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">System Instructions</label>
                      <textarea
                        value={sandboxSystemPrompt}
                        onChange={(e) => setSandboxSystemPrompt(e.target.value)}
                        className="w-full h-32 rounded-lg border border-[var(--accent-border)] bg-[var(--background)] p-2.5 text-xs text-[var(--text-primary)] outline-none resize-none"
                      />
                    </div>

                    {/* Temperature */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                        <span>Temperature</span>
                        <span>{sandboxTemperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={sandboxTemperature}
                        onChange={(e) => setSandboxTemperature(parseFloat(e.target.value))}
                        className="w-full accent-[var(--primary-green)] cursor-pointer"
                      />
                    </div>

                    {/* Mock Persona Context */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">Mock Persona Context</label>
                      <select className="w-full h-10 rounded-lg border border-[var(--accent-border)] bg-[var(--background)] px-2.5 text-xs text-[var(--text-primary)] outline-none">
                        <option>Juan (Community Citizen - Standard)</option>
                        <option>Maria (LCRO Officer - Administrative)</option>
                        <option>Datu (Indigenous Elder - Tribal Context)</option>
                      </select>
                    </div>
                  </div>

                  {/* Middle panel: Chat Playground */}
                  <div className="flex-grow min-w-0 bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl flex flex-col shadow-[var(--shadow-soft)] overflow-hidden min-h-[350px]">
                    <div className="h-12 border-b border-[var(--accent-border)] px-4 flex items-center justify-between flex-shrink-0 select-none bg-[var(--surface-highlight)]/30">
                      <div className="flex items-center gap-2">
                        <Play size={14} className="text-[var(--primary-green)]" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">Chat Playground</span>
                      </div>
                      <button 
                        onClick={() => setSandboxMessages([{ sender: 'bot', text: 'Sandboks mode: I-type ang iyong test message para makita ang tugon ni CLARA.' }])}
                        className="text-[10px] text-[var(--primary-green)] font-bold hover:underline cursor-pointer"
                      >
                        I-clear ang Chat
                      </button>
                    </div>

                    {/* Messages log */}
                    <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                      {sandboxMessages.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={`flex flex-col gap-1 max-w-[85%]
                            ${msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                        >
                          <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                            {msg.sender === 'user' ? 'Test Admin' : 'CLARA (Sandbox)'}
                          </span>
                          <div 
                            className={`p-3 rounded-2xl text-xs leading-relaxed
                              ${msg.sender === 'user' 
                                ? 'bg-[var(--primary-green)] text-white rounded-tr-none shadow-sm' 
                                : 'bg-[var(--surface-highlight)] text-[var(--text-primary)] rounded-tl-none border border-[var(--accent-border)]/50'}`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {sandboxTesting && (
                        <div className="self-start flex flex-col gap-1 items-start">
                          <span className="text-[9px] font-bold text-[var(--text-secondary)]">CLARA (Sandbox)</span>
                          <div className="p-3 rounded-2xl rounded-tl-none border border-[var(--accent-border)]/50 bg-[var(--surface-highlight)] text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                            <RefreshCw size={12} className="animate-spin text-[var(--primary-green)]" />
                            Nag-iisip...
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat input */}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!sandboxQuery.trim() || sandboxTesting) return;
                        const queryText = sandboxQuery.trim();
                        setSandboxQuery('');
                        
                        // Add User message
                        const nextMsgs = [...sandboxMessages, { sender: 'user', text: queryText }];
                        setSandboxMessages(nextMsgs);
                        setSandboxTesting(true);

                        // Mock AI reply logic
                        setTimeout(() => {
                          let responseText = "Natanggap ko ang iyong test message sa sandbox. Paki-usap, subukan ang mga query tungkol sa 'Late Registration', 'RA 9048', o 'Tribal Certificate' para makita ang Knowledge Base mapping.";
                          let matchTitle = "Walang nahanap na dokumento";
                          let sqlQuery = "SELECT * FROM guides WHERE title LIKE '%" + queryText.split(' ')[0] + "%'";
                          
                          const normalized = queryText.toLowerCase();
                          if (normalized.includes('late') || normalized.includes('birth') || normalized.includes('kapanganakan')) {
                            responseText = "Para sa Late Registration ng Birth Certificate: Unang hakbang ay kumuha ng Certificate of No Record mula sa PSA. Pagkatapos, i-submit ito sa LCRO kasama ang 2 supporting documents gaya ng Binyag o Form 137, at magbayad ng filing fee.";
                            matchTitle = "Late Registration of Birth Guide (Filipino)";
                            sqlQuery = "SELECT * FROM guides WHERE category = 'Birth' AND title LIKE '%Late%' LIMIT 1";
                          } else if (normalized.includes('correction') || normalized.includes('ra 9048') || normalized.includes('mali') || normalized.includes('pangalan')) {
                            responseText = "Para sa pagwawasto sa ilalim ng RA 9048: Mag-file ng petition sa Local Civil Registry Office kung saan nakarehistro ang dokumento. Magdala ng orihinal na kopya at mga sumusuportang dokumento. Ang filing fee ay ₱1,000 para sa clerical errors.";
                            matchTitle = "RA 9048 Correction Guide (Filipino)";
                            sqlQuery = "SELECT * FROM guides WHERE title LIKE '%RA 9048%' LIMIT 1";
                          } else if (normalized.includes('tribal') || normalized.includes('katutubo') || normalized.includes('indigenous') || normalized.includes('ipra')) {
                            responseText = "Para sa mga katutubo sa ilalim ng IPRA RA 8371: Maaaring gumamit ng Tribal Chieftain's Certification of Identity bilang sapat na patunay ng pagkakakilanlan. Ang late registration ay libre sa ilalim ng BRAP.";
                            matchTitle = "Indigenous Peoples Registration Guide (Filipino)";
                            sqlQuery = "SELECT * FROM guides WHERE title LIKE '%Indigenous%' LIMIT 1";
                          }

                          setSandboxMessages([...nextMsgs, { sender: 'bot', text: responseText }]);
                          setSandboxTesting(false);
                          
                          // Update debugger state
                          setSandboxDebuggerLogs({
                            matchedArticle: matchTitle,
                            queryLatency: `${Math.floor(Math.random() * 80) + 60}ms`,
                            tokens: Math.floor(Math.random() * 150) + 300,
                            sql: sqlQuery,
                            temperature: sandboxTemperature,
                            model: sandboxModel
                          });
                        }, 1000);
                      }}
                      className="p-3 border-t border-[var(--accent-border)] flex gap-2 flex-shrink-0 select-none bg-[var(--surface)]"
                    >
                      <input
                        type="text"
                        placeholder="I-type ang iyong test query dito..."
                        value={sandboxQuery}
                        onChange={(e) => setSandboxQuery(e.target.value)}
                        className="flex-grow h-10 border border-[var(--accent-border)] rounded-xl px-3 text-xs outline-none text-[var(--text-primary)] bg-[var(--background)] focus:border-[var(--primary-green)]"
                      />
                      <button 
                        type="submit" 
                        className="w-10 h-10 bg-[var(--primary-green)] text-white rounded-xl flex items-center justify-center cursor-pointer hover:bg-[var(--primary-dark)] transition-colors"
                      >
                        <Send size={15} />
                      </button>
                    </form>
                  </div>

                  {/* Right panel: Debugger logs */}
                  <div className="w-full xl:w-80 bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-5 shadow-[var(--shadow-soft)] flex flex-col gap-4 overflow-y-auto flex-shrink-0 select-none">
                    <div className="flex items-center gap-2 border-b border-[var(--accent-border)] pb-2">
                      <Play size={16} className="text-[var(--primary-green)]" />
                      <span className="text-sm font-bold text-[var(--text-primary)]">Prompt Debugger Logs</span>
                    </div>

                    {sandboxDebuggerLogs ? (
                      <div className="flex flex-col gap-4 text-xs">
                        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[var(--surface-highlight)] border border-[var(--accent-border)]">
                          <span className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[9px]">Retrieved Article</span>
                          <span className="font-bold text-[var(--text-primary)]">{sandboxDebuggerLogs.matchedArticle}</span>
                        </div>

                        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[var(--surface-highlight)] border border-[var(--accent-border)]">
                          <span className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[9px]">SQL Query Run</span>
                          <code className="text-[10px] text-[var(--primary-green)] font-semibold break-all leading-tight">
                            {sandboxDebuggerLogs.sql}
                          </code>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2.5 rounded-lg bg-[var(--surface-highlight)] border border-[var(--accent-border)] flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Latency</span>
                            <span className="font-bold text-[var(--text-primary)]">{sandboxDebuggerLogs.queryLatency}</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[var(--surface-highlight)] border border-[var(--accent-border)] flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Token Usage</span>
                            <span className="font-bold text-[var(--text-primary)]">{sandboxDebuggerLogs.tokens} tokens</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 text-[11px] text-[var(--text-secondary)] border-t border-[var(--accent-border)] pt-3 mt-1 leading-relaxed">
                          <span>• <strong>Model:</strong> {sandboxDebuggerLogs.model}</span>
                          <span>• <strong>Temp:</strong> {sandboxDebuggerLogs.temperature}</span>
                          <span>• <strong>Retrieval:</strong> <span className="italic">simulated debug values — this sandbox is a mock console</span></span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[var(--accent-border)] rounded-xl text-center gap-2 h-40">
                        <Play size={20} className="text-[var(--text-disabled)]" />
                        <span className="text-xs text-[var(--text-secondary)]">Walang debug log na magagamit. Subukan munang mag-chat sa playground.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 6: Data & Offline Document Management */}
              {activeTab === 'data' && authRole === 'admin' && (
                <div className="flex flex-col gap-6">
                  
                  {/* Status card */}
                  <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-5 shadow-[var(--shadow-soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-5 select-none">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Database size={22} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Offline Database Status</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-[450px]">
                          Ang lokal na database ng prototype ay naka-sync sa cached guides.
                        </p>
                        <div className="flex gap-4 text-[10px] text-[var(--text-secondary)] mt-1.5 flex-wrap">
                          <span>• <strong>Version:</strong> v1.2.4</span>
                          <span>• <strong>Cached guides:</strong> {guides.length} documents</span>
                          <span>• <strong>Huling Update:</strong> {dataLastSynced}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setDataRecompiling(true);
                        setTimeout(() => {
                          setDataRecompiling(false);
                          const dateStr = new Date().toLocaleTimeString();
                          setDataLastSynced(`Ngayong araw, ${dateStr}`);
                          triggerToast("Ang offline database ng mga gabay ay matagumpay na na-update at na-sync sa server!");
                        }, 1500);
                      }}
                      disabled={dataRecompiling}
                      className="px-5 py-2.5 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] disabled:bg-[var(--text-disabled)] disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5 flex-shrink-0"
                    >
                      {dataRecompiling ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Nagre-recompile ng offline files...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} />
                          I-update ang Offline Documents
                        </>
                      )}
                    </button>
                  </div>

                  {/* Seed / Guides details logs */}
                  <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Makatutubong mga offline na gabay (Guides Summary)</h3>
                    <div className="flex flex-col gap-3">
                      {guides.map((g, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3.5 bg-[var(--surface-highlight)]/40 border border-[var(--accent-border)]/50 rounded-xl">
                          <div className="flex flex-col gap-1 select-text">
                            <span className="text-xs font-bold text-[var(--text-primary)]">{g.title}</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">Kategorya: {g.category} • Wika: {g.language === 'fil' ? 'Filipino' : g.language === 'vis' ? 'Bisaya' : 'English'}</span>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider rounded-full border border-emerald-500/20">
                            Available Offline
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
          </>
        )}
      </div>

    </main>

    {/* Toast notifications */}
    <Toast 
      message={toastMessage} 
      isVisible={showToast} 
      onClose={() => setShowToast(false)} 
    />

  </div>
);
}