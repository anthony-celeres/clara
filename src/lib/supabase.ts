import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { GUIDES_SEED, Guide } from './seed-data';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Check if we have real Supabase keys (allows explicit mock override via NEXT_PUBLIC_FORCE_MOCK)
const isLiveSupabase = 
  process.env.NEXT_PUBLIC_FORCE_MOCK !== 'true' &&
  Boolean(
    supabaseUrl && 
    supabaseUrl !== 'your_supabase_url' && 
    supabaseAnonKey && 
    supabaseAnonKey !== 'your_supabase_anon_key'
  );

// Define the real Supabase client if keys are present.
// In the BROWSER, use createBrowserClient (@supabase/ssr) so the auth session is
// stored in COOKIES — the server proxy (src/proxy.ts uses createServerClient)
// reads the session from cookies, and plain createClient only writes
// localStorage, which the server can't see (admin routes would bounce to /login).
// On the SERVER (route handlers importing this module), fall back to plain
// createClient so module load doesn't touch `document`.
export const supabase = isLiveSupabase
  ? (typeof window !== 'undefined'
      ? createBrowserClient(supabaseUrl, supabaseAnonKey)
      : createClient(supabaseUrl, supabaseAnonKey))
  : (createMockSupabaseClient() as any);

export function getSupabaseMode(): 'live' | 'mock' {
  return isLiveSupabase ? 'live' : 'mock';
}

// Client-Side Mock Database Implementation
function createMockSupabaseClient() {
  console.log("CLARA: Running in Supabase MOCK mode. All auth and database actions will save to browser LocalStorage.");

  // Helper to get/set localStorage data
  const getStorageItem = <T>(key: string, defaultValue: T): T => {
    if (typeof window === 'undefined') return defaultValue;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  };

  const setStorageItem = (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  };

  // Mirror the mock session into a cookie so the admin route proxy
  // (proxy.ts) can gate /admin/* in MOCK mode. The proxy only needs
  // `role`. In LIVE mode this is unused — real Supabase SSR/session
  // cookies replace it (see docs/handoff).
  const setSessionCookie = (user: any | null) => {
    if (typeof document === 'undefined') return;
    if (user) {
      const payload = encodeURIComponent(
        JSON.stringify({ id: user.id, email: user.email, role: user.role })
      );
      document.cookie = `clara-mock-session=${payload}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      document.cookie = 'clara-mock-session=; path=/; max-age=0; SameSite=Lax';
    }
  };

  const mockAuth = {
    signUp: async ({ email, password }: any) => {
      const users = getStorageItem<any[]>('clara_mock_users', []);
      if (users.find(u => u.email === email)) {
        return { data: { user: null }, error: { message: 'User already exists' } };
      }
      const role = email.includes('admin') 
        ? 'admin' 
        : (email.includes('lcro') || email.includes('luffy')) 
          ? 'lcro' 
          : 'community';
          
      const newUser = {
        id: Math.random().toString(36).substring(2, 15),
        email,
        password_hash: password, // In-memory prototype only
        role,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      setStorageItem('clara_mock_users', users);
      
      // Auto sign in
      setStorageItem('clara_mock_session', newUser);
      setSessionCookie(newUser);
      return { data: { user: newUser }, error: null };
    },

    signInWithPassword: async ({ email, password }: any) => {
      const users = getStorageItem<any[]>('clara_mock_users', []);
      let user = users.find(u => u.email === email && u.password_hash === password);
      
      if (!user) {
        // Auto-seed default accounts on first sign-in attempt
        const defaultAccounts = [
          { email: 'admin@clara.gov', password_hash: 'admin123', role: 'admin' },
          { email: 'lcro@clara.gov', password_hash: 'lcro123', role: 'lcro' },
          { email: 'community@clara.gov', password_hash: 'community123', role: 'community' },
          { email: 'sharmaine@clara.gov', password_hash: 'sharmaine123', role: 'community' },
          { email: 'luffy@clara.gov', password_hash: 'luffy123', role: 'lcro' }
        ];

        const match = defaultAccounts.find(a => a.email === email && a.password_hash === password);
        if (match) {
          const seededUser = {
            id: `mock-${match.role}-${Math.random().toString(36).substring(2, 7)}`,
            email: match.email,
            password_hash: match.password_hash,
            role: match.role,
            created_at: new Date().toISOString()
          };
          users.push(seededUser);
          setStorageItem('clara_mock_users', users);
          user = seededUser;
        }
      }

      if (!user) {
        return { data: { user: null }, error: { message: 'Invalid email or password' } };
      }

      setStorageItem('clara_mock_session', user);
      setSessionCookie(user);
      return { data: { user }, error: null };
    },

    signOut: async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('clara_mock_session');
      }
      setSessionCookie(null);
      return { error: null };
    },

    getUser: async () => {
      const user = getStorageItem<any>('clara_mock_session', null);
      setSessionCookie(user);
      return { data: { user }, error: null };
    },

    getSession: async () => {
      const user = getStorageItem<any>('clara_mock_session', null);
      if (!user) return { data: { session: null }, error: null };
      return { 
        data: { 
          session: { 
            user, 
            access_token: 'mock-jwt-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600 
          } 
        }, 
        error: null 
      };
    },
    
    onAuthStateChange: (callback: any) => {
      // Prototype trigger on page load
      const user = getStorageItem<any>('clara_mock_session', null);
      callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  };

  // Chainable Query Builder
  const from = (table: string) => {
    let data: any[] = [];

    // Load table data
    if (table === 'guides') {
      data = getStorageItem<Guide[]>('clara_mock_guides', GUIDES_SEED);
    } else if (table === 'checklists') {
      data = getStorageItem<any[]>('clara_mock_checklists', []);
    } else if (table === 'sessions') {
      data = getStorageItem<any[]>('clara_mock_sessions', []);
    } else if (table === 'messages') {
      data = getStorageItem<any[]>('clara_mock_messages', []);
    } else if (table === 'users') {
      data = getStorageItem<any[]>('clara_mock_users', []);
    }

    let filters: ((item: any) => boolean)[] = [];
    let singleRow = false;
    let opType: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let opPayload: any = null;

    const queryBuilder = {
      select: (columns = '*') => {
        opType = 'select';
        return queryBuilder;
      },
      eq: (column: string, value: any) => {
        filters.push((item) => item[column] === value);
        return queryBuilder;
      },
      single: () => {
        singleRow = true;
        return queryBuilder;
      },
      insert: (rows: any | any[]) => {
        opType = 'insert';
        opPayload = rows;
        return queryBuilder;
      },
      update: (updates: any) => {
        opType = 'update';
        opPayload = updates;
        return queryBuilder;
      },
      delete: () => {
        opType = 'delete';
        return queryBuilder;
      },
      // Execute the query
      then: (resolve: any) => {
        try {
          if (opType === 'select') {
            let result = data.filter((item) => filters.every(f => f(item)));
            if (singleRow) {
              resolve({ data: result[0] || null, error: result.length === 0 ? { message: 'Row not found' } : null });
            } else {
              resolve({ data: result, error: null });
            }
          } else if (opType === 'insert') {
            const insertRows = Array.isArray(opPayload) ? opPayload : [opPayload];
            const newRows = insertRows.map(row => ({
              ...row,
              // Generate IDs if missing
              ...(row.checklist_id ? {} : row.checklist_id === null || table === 'checklists' ? { checklist_id: Math.random().toString(36).substring(2, 15) } : {}),
              ...(row.session_id ? {} : row.session_id === null || table === 'sessions' ? { session_id: Math.random().toString(36).substring(2, 15) } : {}),
              ...(row.message_id ? {} : row.message_id === null || table === 'messages' ? { message_id: Math.random().toString(36).substring(2, 15) } : {}),
              created_at: row.created_at || new Date().toISOString(),
              last_updated: row.last_updated || new Date().toISOString()
            }));

            data = [...data, ...newRows];
            setStorageItem(`clara_mock_${table}`, data);
            resolve({ data: singleRow ? newRows[0] : newRows, error: null });
          } else if (opType === 'update') {
            data = data.map((item) => {
              const matches = filters.every(f => f(item));
              if (matches) {
                return {
                  ...item,
                  ...opPayload,
                  last_updated: new Date().toISOString()
                };
              }
              return item;
            });

            setStorageItem(`clara_mock_${table}`, data);
            const updated = data.filter(item => filters.every(f => f(item)));
            resolve({ data: singleRow ? updated[0] : updated, error: null });
          } else if (opType === 'delete') {
            const toDelete = data.filter(item => filters.every(f => f(item)));
            data = data.filter(item => !filters.every(f => f(item)));
            setStorageItem(`clara_mock_${table}`, data);
            resolve({ data: toDelete, error: null });
          }
        } catch (e: any) {
          resolve({ data: null, error: { message: e.message || 'Error executing mock operation' } });
        }
      }
    };

    return queryBuilder;
  };

  const rpc = async (_fnName: string, _args?: any) => {
    return { data: [], error: null };
  };

  return {
    auth: mockAuth,
    from,
    rpc
  };
}
