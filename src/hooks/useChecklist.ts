import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  getLocalChecklists, 
  saveLocalChecklist, 
  addToOfflineQueue, 
  getOfflineQueue, 
  clearOfflineQueue,
  removeLocalChecklist
} from '../lib/offline-cache';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface Checklist {
  checklist_id: string;
  session_id?: string | null;
  user_id?: string | null;
  title: string;
  items_json: ChecklistItem[];
  done_count: number;
  last_updated: string;
}

export function useChecklist(userId: string | null, isOffline: boolean) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load checklists from server (authenticated) or localForage (public/offline)
  const loadChecklists = useCallback(async () => {
    setLoading(true);
    if (userId && !isOffline) {
      // Authenticated Mode Online
      try {
        const { data, error } = await supabase
          .from('checklists')
          .select('*')
          .eq('user_id', userId);
        
        if (data) {
          // Format checklists items if they are parsed
          const formatted: Checklist[] = data.map((item: any) => ({
            ...item,
            items_json: typeof item.items_json === 'string' 
              ? JSON.parse(item.items_json) 
              : item.items_json
          }));
          setChecklists(formatted);
          
          // Also mirror to local cache
          for (const list of formatted) {
            await saveLocalChecklist(list);
          }
        }
      } catch (e) {
        console.error("Failed to load checklists from Supabase:", e);
        // Fallback to local
        const local = await getLocalChecklists();
        setChecklists(local);
      }
    } else {
      // Public Mode or Offline Mode
      const local = await getLocalChecklists();
      setChecklists(local);
    }
    setLoading(false);
  }, [userId, isOffline]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  // Create a new checklist
  const createChecklist = async (title: string, itemTexts: string[], sessionId: string | null = null) => {
    const items: ChecklistItem[] = itemTexts.map(text => ({ text, checked: false }));
    const newChecklist: Checklist = {
      checklist_id: generateUUID(),
      session_id: sessionId,
      user_id: userId,
      title,
      items_json: items,
      done_count: 0,
      last_updated: new Date().toISOString()
    };

    // Update local state
    setChecklists(prev => [...prev.filter(c => c.title !== title), newChecklist]);
    await saveLocalChecklist(newChecklist);

    if (userId && !isOffline) {
      // Authenticated Sync Online
      try {
        await supabase.from('checklists').insert({
          ...newChecklist,
          items_json: newChecklist.items_json // Supabase handles JSONB
        });
      } catch (e) {
        console.error("Failed to insert checklist to Supabase, queueing offline:", e);
        await addToOfflineQueue({
          type: 'checklist-sync',
          payload: newChecklist
        });
      }
    } else if (userId && isOffline) {
      // Authenticated Sync Offline (Queue it)
      await addToOfflineQueue({
        type: 'checklist-sync',
        payload: newChecklist
      });
    }
  };

  // Delete a checklist
  const deleteChecklist = async (checklistId: string) => {
    // Update local state
    setChecklists(prev => prev.filter(c => c.checklist_id !== checklistId));
    
    // Remove from local cache
    await removeLocalChecklist(checklistId);

    if (userId && !isOffline) {
      // Authenticated Delete Online
      try {
        await supabase
          .from('checklists')
          .delete()
          .eq('checklist_id', checklistId);
      } catch (e) {
        console.error("Failed to delete checklist from Supabase, queueing offline:", e);
        await addToOfflineQueue({
          type: 'checklist-delete',
          payload: { checklist_id: checklistId }
        });
      }
    } else if (userId && isOffline) {
      // Authenticated Delete Offline (Queue it)
      await addToOfflineQueue({
        type: 'checklist-delete',
        payload: { checklist_id: checklistId }
      });
    }
  };

  // Toggle checklist item checked state
  const toggleItem = async (checklistId: string, itemText: string) => {
    const listIndex = checklists.findIndex(c => c.checklist_id === checklistId);
    if (listIndex === -1) return;

    const list = checklists[listIndex];
    const updatedItems = list.items_json.map(item => {
      if (item.text === itemText) {
        return { ...item, checked: !item.checked };
      }
      return item;
    });

    const doneCount = updatedItems.filter(item => item.checked).length;
    const updatedChecklist: Checklist = {
      ...list,
      items_json: updatedItems,
      done_count: doneCount,
      last_updated: new Date().toISOString()
    };

    // Update local state
    const updatedLists = [...checklists];
    updatedLists[listIndex] = updatedChecklist;
    setChecklists(updatedLists);

    // Save to localForage
    await saveLocalChecklist(updatedChecklist);

    if (userId && !isOffline) {
      try {
        await supabase
          .from('checklists')
          .update({
            items_json: updatedItems,
            done_count: doneCount,
            last_updated: updatedChecklist.last_updated
          })
          .eq('checklist_id', checklistId);
      } catch (e) {
        console.error("Failed to update checklist in Supabase, queueing offline:", e);
        await addToOfflineQueue({
          type: 'checklist-sync',
          payload: updatedChecklist
        });
      }
    } else if (userId && isOffline) {
      await addToOfflineQueue({
        type: 'checklist-sync',
        payload: updatedChecklist
      });
    }
  };

  // Sync queued items once we get online
  const syncQueue = useCallback(async () => {
    if (isOffline || !userId) return;
    const queue = await getOfflineQueue();
    if (queue.length === 0) return;

    console.log(`CLARA: Syncing ${queue.length} offline checklist updates to server...`);

    for (const item of queue) {
      if (item.type === 'checklist-sync') {
        const list = item.payload;
        try {
          // Check if checklist already exists on server
          const { data } = await supabase
            .from('checklists')
            .select('checklist_id')
            .eq('checklist_id', list.checklist_id)
            .single();

          if (data) {
            // Update
            await supabase
              .from('checklists')
              .update({
                items_json: list.items_json,
                done_count: list.done_count,
                last_updated: list.last_updated
              })
              .eq('checklist_id', list.checklist_id);
          } else {
            // Insert
            await supabase
              .from('checklists')
              .insert({
                ...list,
                user_id: userId // associate with the logged in user
              });
          }
        } catch (e) {
          console.error("Failed to sync checklist item:", item, e);
        }
      } else if (item.type === 'checklist-delete') {
        try {
          await supabase
            .from('checklists')
            .delete()
            .eq('checklist_id', item.payload.checklist_id);
        } catch (e) {
          console.error("Failed to sync checklist delete:", item, e);
        }
      }
    }

    await clearOfflineQueue();
    loadChecklists(); // reload state from server
  }, [isOffline, userId, loadChecklists]);

  // Sync queue when online status changes
  useEffect(() => {
    if (!isOffline && userId) {
      syncQueue();
    }
  }, [isOffline, userId, syncQueue]);

  return {
    checklists,
    loading,
    createChecklist,
    deleteChecklist,
    toggleItem,
    reloadChecklists: loadChecklists
  };
}
