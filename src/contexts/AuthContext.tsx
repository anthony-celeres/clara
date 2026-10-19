'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

// Optionally import localForage if you want to clear offline caches
// import localforage from 'localforage';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchRole(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('users').select('role').eq('user_id', userId).single();
    return data?.role ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session on mount
    const loadUser = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setRole(user ? await fetchRole(user.id) : null);
      setLoading(false);
    };
    loadUser();

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: any) => {
        const u = session?.user || null;
        setUser(u);
        setRole(u ? await fetchRole(u.id) : null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // 1. Terminate Supabase session
    await supabase.auth.signOut();

    // 2. Clear app-specific localStorage items (optional but recommended)
    if (typeof window !== 'undefined') {
      // Remove recent chats cache
      localStorage.removeItem('clara_recent_chats');
      // Remove consent flag (force re-consent on next visit)
      localStorage.removeItem('clara-consent-agreed');
      // Keep theme preference (user might want to keep their theme)
      // Keep any other non-sensitive data you want
    }

    // 3. (Optional) Clear offline caches (IndexedDB) – be careful not to delete guides
    // If you want to clear checklists and sync queue, uncomment:
    // try {
    //   const { clearLocalChecklists } = await import('@/lib/offline-cache');
    //   await clearLocalChecklists();
    //   // Also clear sync queue if desired
    //   const { clearOfflineQueue } = await import('@/lib/offline-cache');
    //   await clearOfflineQueue();
    // } catch (e) {
    //   console.warn('Could not clear offline caches:', e);
    // }

    // 4. The Auth state will be updated automatically via the listener,
    //    so we don't need to call setUser(null) here.
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}