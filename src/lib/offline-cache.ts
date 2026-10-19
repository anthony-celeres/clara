import localforage from 'localforage';
import { GUIDES_SEED, Guide } from './seed-data';

// Initialize localForage instances
let guideStore: LocalForage | null = null;
let checklistStore: LocalForage | null = null;
let queueStore: LocalForage | null = null;

if (typeof window !== 'undefined') {
  guideStore = localforage.createInstance({
    name: 'clara-db',
    storeName: 'guides'
  });

  checklistStore = localforage.createInstance({
    name: 'clara-db',
    storeName: 'checklists'
  });

  queueStore = localforage.createInstance({
    name: 'clara-db',
    storeName: 'offline-queue'
  });
}

// 1. Guide Caching APIs
export async function initializeCachedGuides(): Promise<Guide[]> {
  if (!guideStore) return GUIDES_SEED;
  
  try {
    const cached = await guideStore.getItem<Guide[]>('clara-guides');
    if (cached && cached.length > 0) {
      return cached;
    }
    // Seed guide cache if empty
    await guideStore.setItem('clara-guides', GUIDES_SEED);
    await guideStore.setItem('clara-kb-version', 'clara-kb-v1.0.0');
    return GUIDES_SEED;
  } catch (e) {
    console.error('Failed to access guide cache:', e);
    return GUIDES_SEED;
  }
}

export async function getCachedGuides(): Promise<Guide[]> {
  if (!guideStore) return GUIDES_SEED;
  const cached = await guideStore.getItem<Guide[]>('clara-guides');
  return cached || GUIDES_SEED;
}

export async function saveGuidesToCache(guides: Guide[], version = 'clara-kb-v1.0.0'): Promise<void> {
  if (!guideStore) return;
  await guideStore.setItem('clara-guides', guides);
  await guideStore.setItem('clara-kb-version', version);
}

// 2. Checklist Local Storage APIs (Public Mode & Offline Fallback)
export interface LocalChecklist {
  checklist_id: string;
  title: string;
  items_json: { text: string; checked: boolean }[];
  done_count: number;
  last_updated: string;
}

export async function getLocalChecklists(): Promise<LocalChecklist[]> {
  if (!checklistStore) return [];
  const checklists = await checklistStore.getItem<LocalChecklist[]>('active-checklists');
  return checklists || [];
}

export async function saveLocalChecklist(checklist: LocalChecklist): Promise<void> {
  if (!checklistStore) return;
  const lists = await getLocalChecklists();
  const index = lists.findIndex((l) => l.checklist_id === checklist.checklist_id);
  if (index >= 0) {
    lists[index] = checklist;
  } else {
    lists.push(checklist);
  }
  await checklistStore.setItem('active-checklists', lists);
}

export async function removeLocalChecklist(checklistId: string): Promise<void> {
  if (!checklistStore) return;
  const lists = await getLocalChecklists();
  const updatedLists = lists.filter((l) => l.checklist_id !== checklistId);
  await checklistStore.setItem('active-checklists', updatedLists);
}

export async function clearLocalChecklists(): Promise<void> {
  if (!checklistStore) return;
  await checklistStore.removeItem('active-checklists');
}

// 3. Offline Queue Syncing APIs
export interface OfflineQueueItem {
  id: string;
  type: 'feedback' | 'checklist-sync' | 'checklist-delete';
  payload: any;
  timestamp: string;
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  if (!queueStore) return [];
  const queue = await queueStore.getItem<OfflineQueueItem[]>('sync-queue');
  return queue || [];
}

export async function addToOfflineQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp'>): Promise<void> {
  if (!queueStore) return;
  const queue = await getOfflineQueue();
  const newItem: OfflineQueueItem = {
    ...item,
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString()
  };
  queue.push(newItem);
  await queueStore.setItem('sync-queue', queue);
}

export async function clearOfflineQueue(): Promise<void> {
  if (!queueStore) return;
  await queueStore.removeItem('sync-queue');
}
