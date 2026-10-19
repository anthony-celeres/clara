'use client';

// CLARA Data Flow — interactive Dev Tools visualizer (docs/architecture/data-flow.md).
// Curated architecture graph (not live telemetry). Compact hand-placed default
// layout grouped into flow bands; directional arrows; edge labels appear only when
// a single flow is isolated. The admin can drag nodes; positions persist to
// localStorage and survive reloads / flow switches until "Reset layout" is clicked.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Position, MarkerType,
  useNodesState, type Node, type Edge,
} from '@xyflow/react';
import { RotateCcw } from 'lucide-react';
import '@xyflow/react/dist/style.css';

type Kind = 'ui' | 'route' | 'lib' | 'store' | 'external' | 'gate';
type Layer = 'chat' | 'ingestion' | 'feedback' | 'auth';
type Flag = 'pii' | 'gate' | 'secret' | 'ssrf' | 'mocklive';

interface NodeDef { id: string; label: string; kind: Kind; file?: string; detail: string; layers: Layer[]; flags?: Flag[]; pos: { x: number; y: number }; }
interface EdgeDef { id: string; source: string; target: string; label: string; layers: Layer[]; flags?: Flag[]; }

const NODE_W = 170;
const STORAGE_KEY = 'clara-dataflow-positions-v1';

const KIND_STYLE: Record<Kind, { bg: string; border: string }> = {
  ui:       { bg: '#eff6ff', border: '#3b82f6' },
  route:    { bg: '#ecfdf5', border: '#16a34a' },
  lib:      { bg: '#f0fdfa', border: '#0d9488' },
  store:    { bg: '#faf5ff', border: '#9333ea' },
  external: { bg: '#fff7ed', border: '#ea580c' },
  gate:     { bg: '#fef2f2', border: '#e11d48' },
};

const FLAG_META: Record<Flag, { icon: string; label: string }> = {
  pii:      { icon: '🔒', label: 'PII scrubbed here (RA 10173)' },
  gate:     { icon: '🚪', label: 'Content gate — only active chunks retrievable' },
  secret:   { icon: '🔑', label: 'Server-only secret (never in client bundle)' },
  ssrf:     { icon: '🌐', label: 'SSRF allow-list (lawphil / psahelpline only)' },
  mocklive: { icon: '🔁', label: 'Mock/live seam — falls back to mock without env' },
};

const LAYERS: { id: Layer | 'all'; label: string }[] = [
  { id: 'all', label: 'All flows' },
  { id: 'chat', label: 'Chat query' },
  { id: 'ingestion', label: 'Ingestion' },
  { id: 'feedback', label: 'Feedback / analytics' },
  { id: 'auth', label: 'Auth / admin' },
];

// Compact hand layout: 5 columns × 4 flow bands (chat / ingestion / feedback / auth).
const NODES: NodeDef[] = [
  { id: 'chat-ui',  label: '/chat',                kind: 'ui',       file: 'src/app/chat/page.tsx',                       detail: 'Citizen chat UI — sends messages, renders streamed answers and checklist cards.', layers: ['chat', 'feedback'], pos: { x: 0, y: 90 } },
  { id: 'api-chat', label: '/api/chat',            kind: 'route',    file: 'src/app/api/chat/route.ts',                   detail: 'Orchestrates a query: scrub → detect language → retrieve → ground → stream.', layers: ['chat'], flags: ['secret'], pos: { x: 260, y: 90 } },
  { id: 'scrub',    label: 'scrubPII',             kind: 'lib',      file: 'src/lib/pii-scrubber.ts',                     detail: 'Redacts SSS/TIN/phone/email/DOB before text leaves the server.', layers: ['chat', 'feedback'], flags: ['pii'], pos: { x: 520, y: 0 } },
  { id: 'lang',     label: 'detectLanguage',       kind: 'lib',      file: 'src/lib/language-detect.ts',                  detail: 'Detects eng / fil / vis with franc-min.', layers: ['chat'], pos: { x: 520, y: 95 } },
  { id: 'embed',    label: 'embedText',            kind: 'lib',      file: 'src/lib/rag.ts',                              detail: 'Embeds text via Gemini (768-d, normalized) for query + ingestion.', layers: ['chat', 'ingestion'], flags: ['secret'], pos: { x: 520, y: 200 } },
  { id: 'rpc',      label: 'match_doc_chunks',     kind: 'store',    file: 'supabase/migrations/0002',                    detail: 'Cosine kNN RPC over ACTIVE chunks only, with a fil fallback.', layers: ['chat'], flags: ['gate'], pos: { x: 790, y: 0 } },
  { id: 'chunks',   label: 'doc_chunks',           kind: 'store',    file: 'supabase/migrations/0001',                    detail: 'pgvector store. effective_status (active/unverified) gates retrieval.', layers: ['chat', 'ingestion'], flags: ['gate'], pos: { x: 790, y: 200 } },
  { id: 'gemini',   label: 'Gemini',               kind: 'external',                                                      detail: 'Gemini API — embeddings + gemini-2.5-flash synthesis.', layers: ['chat', 'ingestion'], flags: ['secret', 'mocklive'], pos: { x: 1060, y: 95 } },
  { id: 'admin',    label: '/admin dashboard',     kind: 'ui',       file: 'src/app/admin/dashboard',                     detail: 'Admin dashboard — KB manager, ingestion, analytics, and this map.', layers: ['auth', 'ingestion', 'feedback'], pos: { x: 0, y: 370 } },
  { id: 'crawl',    label: '/api/admin/crawl',     kind: 'route',    file: 'src/app/api/admin/crawl/route.ts',            detail: 'Fetches allow-listed sources → extract → embed → write unverified.', layers: ['ingestion'], flags: ['secret', 'ssrf'], pos: { x: 260, y: 355 } },
  { id: 'ingest',   label: 'ingest-kb.mjs',        kind: 'lib',      file: 'scripts/ingest-kb.mjs',                       detail: 'Embeds the structured seed guides into doc_chunks.', layers: ['ingestion'], pos: { x: 520, y: 330 } },
  { id: 'gate',     label: 'doc-05 review',        kind: 'gate',     file: 'docs/handoff/05a-content-review-workflow.md', detail: 'Human reviewer flips unverified → active before content reaches citizens.', layers: ['ingestion'], flags: ['gate'], pos: { x: 790, y: 355 } },
  { id: 'websrc',   label: 'lawphil / psahelpline', kind: 'external', file: 'src/lib/crawl-sources.ts',                   detail: 'The only fetchable authoritative sources (gov portals 403 bots).', layers: ['ingestion'], pos: { x: 1060, y: 345 } },
  { id: 'fbadmin',  label: 'firebase-admin route', kind: 'route',    file: 'src/app/api/admin/feedback',                  detail: 'Server-side admin reads of Firestore (client reads are blocked).', layers: ['feedback'], flags: ['secret'], pos: { x: 260, y: 480 } },
  { id: 'firestore',label: 'Firestore',            kind: 'store',    file: 'src/lib/firebase.ts',                         detail: 'user_feedback + analytics_log (the source of truth for both).', layers: ['feedback'], flags: ['mocklive'], pos: { x: 790, y: 480 } },
  { id: 'login',    label: 'login / register',     kind: 'ui',       file: 'src/app/login',                               detail: 'Auth entry. Live Supabase auth or a localStorage mock.', layers: ['auth'], pos: { x: 0, y: 610 } },
  { id: 'supaauth', label: 'Supabase auth + DB',   kind: 'store',    file: 'src/lib/supabase.ts',                         detail: 'Auth + relational tables (users, sessions, checklists, guides…).', layers: ['auth', 'chat'], flags: ['mocklive'], pos: { x: 520, y: 610 } },
  { id: 'proxy',    label: 'proxy.ts',             kind: 'gate',     file: 'src/proxy.ts',                                detail: 'Middleware gating /admin/* and /api/admin/* by session cookie + role.', layers: ['auth'], pos: { x: 790, y: 610 } },
];

const EDGES: EdgeDef[] = [
  { id: 'e1', source: 'chat-ui', target: 'api-chat', label: 'message', layers: ['chat'] },
  { id: 'e2', source: 'api-chat', target: 'scrub', label: 'raw text', layers: ['chat'], flags: ['pii'] },
  { id: 'e3', source: 'scrub', target: 'lang', label: 'sanitized', layers: ['chat'] },
  { id: 'e4', source: 'lang', target: 'embed', label: 'query', layers: ['chat'] },
  { id: 'e5', source: 'embed', target: 'gemini', label: 'embed', layers: ['chat'] },
  { id: 'e6', source: 'gemini', target: 'rpc', label: 'query vector', layers: ['chat'] },
  { id: 'e7', source: 'rpc', target: 'chunks', label: 'kNN (active)', layers: ['chat'], flags: ['gate'] },
  { id: 'e8', source: 'chunks', target: 'api-chat', label: 'verbatim', layers: ['chat'] },
  { id: 'e9', source: 'api-chat', target: 'gemini', label: 'grounded prompt', layers: ['chat'] },
  { id: 'e10', source: 'gemini', target: 'chat-ui', label: 'stream', layers: ['chat'] },
  { id: 'e11', source: 'admin', target: 'crawl', label: 'trigger', layers: ['ingestion'] },
  { id: 'e12', source: 'crawl', target: 'websrc', label: 'fetch', layers: ['ingestion'], flags: ['ssrf'] },
  { id: 'e13', source: 'websrc', target: 'crawl', label: 'html', layers: ['ingestion'] },
  { id: 'e14', source: 'crawl', target: 'embed', label: 'chunks', layers: ['ingestion'] },
  { id: 'e15', source: 'ingest', target: 'embed', label: 'seed guides', layers: ['ingestion'] },
  { id: 'e16', source: 'embed', target: 'chunks', label: 'unverified write', layers: ['ingestion'], flags: ['gate'] },
  { id: 'e17', source: 'chunks', target: 'gate', label: 'pending', layers: ['ingestion'], flags: ['gate'] },
  { id: 'e18', source: 'gate', target: 'chunks', label: 'activate', layers: ['ingestion'], flags: ['gate'] },
  { id: 'e19', source: 'chat-ui', target: 'firestore', label: 'feedback / analytics', layers: ['feedback'], flags: ['pii'] },
  { id: 'e20', source: 'admin', target: 'fbadmin', label: 'view', layers: ['feedback'] },
  { id: 'e21', source: 'fbadmin', target: 'firestore', label: 'server read', layers: ['feedback'] },
  { id: 'e22', source: 'login', target: 'supaauth', label: 'credentials', layers: ['auth'] },
  { id: 'e23', source: 'supaauth', target: 'proxy', label: 'session cookie', layers: ['auth'] },
  { id: 'e24', source: 'proxy', target: 'admin', label: 'gated access', layers: ['auth'] },
];

function NodeBody({ n }: { n: NodeDef }) {
  return (
    <div className="text-left leading-tight">
      <div className="font-bold text-[12px]">{n.label}</div>
      <div className="text-[9px] uppercase tracking-wide opacity-60">
        {n.kind}{n.flags?.length ? ' · ' + n.flags.map((f) => FLAG_META[f].icon).join('') : ''}
      </div>
    </div>
  );
}

type PosMap = Record<string, { x: number; y: number }>;

function loadPositions(): PosMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PosMap) : null;
  } catch {
    return null;
  }
}

function savePositions(nodes: Node[]) {
  try {
    const map: PosMap = {};
    nodes.forEach((n) => { map[n.id] = n.position; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function nodeStyle(def: NodeDef, layer: Layer | 'all', selectedId: string | null) {
  const s = KIND_STYLE[def.kind];
  const on = layer === 'all' || def.layers.includes(layer as Layer);
  return {
    background: s.bg,
    border: `${selectedId === def.id ? 2.5 : 1.5}px solid ${s.border}`,
    borderRadius: 10,
    padding: '8px 12px',
    width: NODE_W,
    color: '#0f172a',
    opacity: on ? 1 : 0.14,
    boxShadow: selectedId === def.id ? `0 4px 14px ${s.border}55` : 'none',
  };
}

function buildNodes(positions: PosMap | null, layer: Layer | 'all', selectedId: string | null): Node[] {
  return NODES.map((n) => ({
    id: n.id,
    position: positions?.[n.id] ?? n.pos,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: <NodeBody n={n} /> },
    style: nodeStyle(n, layer, selectedId),
  } as Node));
}

export default function DataFlowMap() {
  const [layer, setLayer] = useState<Layer | 'all'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  const initialNodes = useMemo(() => buildNodes(loadPositions(), 'all', null), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const fn = () => setReduced(m.matches);
    m.addEventListener?.('change', fn);
    return () => m.removeEventListener?.('change', fn);
  }, []);

  // Re-style on flow/selection change WITHOUT touching positions (preserves drags).
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const def = NODES.find((x) => x.id === n.id);
        return def ? { ...n, style: nodeStyle(def, layer, selected) } : n;
      })
    );
  }, [layer, selected, setNodes]);

  // Persist positions when a drag ends (reads the fresh node array, no re-render).
  const onNodeDragStop = useCallback(() => {
    setNodes((nds) => { savePositions(nds); return nds; });
  }, [setNodes]);

  const resetLayout = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setNodes(buildNodes(null, layer, selected));
  }, [layer, selected, setNodes]);

  const edges: Edge[] = useMemo(
    () =>
      EDGES.map((e) => {
        const focused = layer !== 'all' && e.layers.includes(layer as Layer);
        const dim = layer !== 'all' && !focused;
        const stroke = focused ? '#16a34a' : dim ? '#cbd5e1' : '#94a3b8';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          label: focused ? e.label : '',
          animated: !reduced && focused,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke },
          style: { stroke, strokeWidth: focused ? 2 : 1.4, opacity: dim ? 0.18 : 1 },
          labelStyle: { fontSize: 9, fill: '#334155', fontWeight: 600 },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        } as Edge;
      }),
    [layer, reduced]
  );

  const onNodeClick = useCallback((_e: unknown, node: Node) => setSelected(node.id), []);
  const sel = NODES.find((n) => n.id === selected) || null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mr-1">Isolate flow</span>
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLayer(l.id)}
            className={`px-3 h-7 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
              layer === l.id
                ? 'bg-[var(--primary-green)] text-white border-transparent'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--accent-border)] hover:text-[var(--text-primary)]'
            }`}
          >
            {l.label}
          </button>
        ))}
        <button
          onClick={resetLayout}
          title="Restore the default node arrangement"
          className="ml-auto px-2.5 h-7 rounded-full text-[11px] font-semibold border border-[var(--accent-border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RotateCcw size={12} /> Reset layout
        </button>
      </div>

      <div className="flex gap-3" style={{ height: 640 }}>
        <div className="flex-1 rounded-xl border border-[var(--accent-border)] overflow-hidden bg-[var(--background)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelected(null)}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.3}
            maxZoom={1.75}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} color="#e2e8f0" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n) => KIND_STYLE[NODES.find((x) => x.id === n.id)?.kind ?? 'lib'].border} nodeStrokeWidth={2} />
          </ReactFlow>
        </div>

        <div className="w-60 flex-shrink-0 rounded-xl border border-[var(--accent-border)] bg-[var(--surface)] p-4 overflow-y-auto">
          {sel ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--text-primary)]">{sel.label}</span>
                <button onClick={() => setSelected(null)} className="text-[var(--text-disabled)] hover:text-[var(--text-primary)] text-xs cursor-pointer">✕</button>
              </div>
              <span className="text-[10px] uppercase tracking-wide font-bold" style={{ color: KIND_STYLE[sel.kind].border }}>{sel.kind}</span>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{sel.detail}</p>
              {sel.file && <code className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-highlight)] rounded px-1.5 py-1 break-all">{sel.file}</code>}
              <div className="text-[10px] text-[var(--text-secondary)]"><b>Flows:</b> {sel.layers.join(', ')}</div>
              {sel.flags?.length ? (
                <div className="flex flex-col gap-1 mt-1 border-t border-[var(--accent-border)] pt-2">
                  {sel.flags.map((f) => (
                    <div key={f} className="text-[10px] text-[var(--text-secondary)] flex items-start gap-1.5">
                      <span>{FLAG_META[f].icon}</span><span>{FLAG_META[f].label}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-[var(--text-primary)]">Legend</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(KIND_STYLE) as Kind[]).map((k) => (
                  <div key={k} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: KIND_STYLE[k].bg, border: `1.5px solid ${KIND_STYLE[k].border}` }} />
                    {k}
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--accent-border)] pt-2 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-disabled)]">Invariants (node badges)</span>
                {(Object.keys(FLAG_META) as Flag[]).map((f) => (
                  <div key={f} className="text-[10px] text-[var(--text-secondary)] flex items-start gap-1.5">
                    <span>{FLAG_META[f].icon}</span><span>{FLAG_META[f].label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--text-disabled)] border-t border-[var(--accent-border)] pt-2 leading-relaxed">
                Drag nodes to rearrange — your layout is saved automatically and persists across reloads. Use <b>Reset layout</b> to restore the default. Pick a flow chip to trace one path; click a node for its file + role.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
