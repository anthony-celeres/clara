'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, getSupabaseMode } from '../../lib/supabase';
import { Mail, Lock, ArrowLeft, Loader2, Sparkles, User, ShieldCheck, Key } from 'lucide-react';

import ThemeToggle from '../../components/ThemeToggle';

// Resolve the user's role for post-login redirect.
// MOCK mode puts `role` directly on the auth user object; LIVE Supabase does
// not — role lives in the `users` table keyed by user_id = auth user id (the
// same lookup AuthContext and the /admin proxy use). Reading user.role alone
// silently failed in live mode, sending admins to the community interface.
async function resolveUserRole(user: any): Promise<string | null> {
  // MOCK mode inlines the app role (admin/lcro/community) on the user object.
  // LIVE Supabase sets user.role to the Postgres auth role ("authenticated"),
  // which is NOT the app role — so it must be read from the users table.
  // Do NOT short-circuit on user.role being truthy: in live mode it's always
  // truthy ("authenticated") and would wrongly bypass the lookup.
  if (getSupabaseMode() === 'mock') return user?.role ?? null;
  if (!user?.id) return null;
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return data?.role ?? null;
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dbMode, setDbMode] = useState<'live' | 'mock'>('mock');

  useEffect(() => {
    setDbMode(getSupabaseMode());
    const mode = searchParams.get('mode');
    if (mode === 'signup') {
      setIsSignUp(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    if (!email || !password) {
      setErrorMsg('Paki-fill up ang lahat ng field.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (data?.user) {
          // In live mode, ensure the user record exists in public.users
          if (getSupabaseMode() === 'live') {
            try {
              await supabase.from('users').upsert({
                user_id: data.user.id,
                email: data.user.email ?? email,
                role: 'community',
                created_at: new Date().toISOString()
              }, { onConflict: 'user_id' });
            } catch (err) {
              console.warn('Could not populate users record:', err);
            }
          }
          // Success
          router.push('/chat');
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (data?.user) {
          // Check role for redirect (if admin or lcro, go to dashboard).
          // Role comes from the users table in live mode, not off the user object.
          const role = await resolveUserRole(data.user);
          if (role === 'admin' || role === 'lcro') {
            router.push('/admin/dashboard');
          } else {
            router.push('/chat');
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg('May naganap na error sa pagproseso.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (emailVal: string, passVal: string) => {
    setEmail(emailVal);
    setPassword(passVal);
    setErrorMsg('');
    setLoading(true);
    
    // Slight delay to simulate natural network roundtrip
    setTimeout(async () => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailVal,
          password: passVal,
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
        } else if (data?.user) {
          const role = await resolveUserRole(data.user);
          if (role === 'admin' || role === 'lcro') {
            router.push('/admin/dashboard');
          } else {
            router.push('/chat');
          }
        }
      } catch (e: any) {
        console.error(e);
        setErrorMsg('May naganap na error sa pagproseso.');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl shadow-[var(--shadow-card)] p-6 md:p-8 w-full max-w-[400px] z-10 animate-message flex flex-col gap-5 relative">
      
      {/* Top Header Row: Logo on Left, Badge on Right */}
      <div className="flex items-center justify-between select-none w-full border-b border-[var(--accent-border)]/60 pb-3">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="CLARA Logo" 
            className="w-[22px] h-[22px] object-contain select-none"
          />
          <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">
            CLARA
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] font-extrabold uppercase tracking-wider border border-emerald-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {dbMode} Mode
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="flex flex-col gap-1 select-none mt-1">
        <h2 className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
          {isSignUp ? 'Gumawa ng Account' : 'Mag-log In'}
        </h2>
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          {isSignUp 
            ? 'I-sync at i-save ang iyong mga checklist at chat history.' 
            : 'I-access ang iyong mga naka-sync na checklists at nakaraang usapan.'}
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-xs font-semibold text-[var(--error-color)] leading-tight">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mb-0.5">Email Address</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[var(--text-disabled)] pointer-events-none">
              <Mail size={15} />
            </span>
            <input
              type="email"
              placeholder="e.g. juan.delacruz@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-xl pl-10 pr-4 input-field border border-[var(--accent-border)] outline-none text-xs"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mb-0.5">Password</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[var(--text-disabled)] pointer-events-none">
              <Lock size={15} />
            </span>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 rounded-xl pl-10 pr-4 input-field border border-[var(--accent-border)] outline-none text-xs"
              required
            />
          </div>
        </div>

        {/* Separator and Quick Log In options */}
        {dbMode === 'mock' && !isSignUp && (
          <div className="flex flex-col gap-2.5 mt-1">
            <div className="relative flex py-1 items-center select-none">
              <div className="flex-grow border-t border-[var(--accent-border)]"></div>
              <span className="flex-shrink mx-3 text-[9px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest">Mabilisang Pag-access</span>
              <div className="flex-grow border-t border-[var(--accent-border)]"></div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('community@clara.gov', 'community123')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[var(--accent-border)] bg-[var(--surface-highlight)]/30 hover:bg-[var(--surface-highlight)] hover:border-[var(--primary-green)]/40 hover:text-[var(--primary-green)] transition-all cursor-pointer group select-none active:scale-[0.97] duration-150"
              >
                <div className="w-7 h-7 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform duration-150">
                  <User size={14} />
                </div>
                <span className="text-[10px] font-bold leading-tight text-[var(--text-primary)] group-hover:text-[var(--primary-green)]">Community</span>
                <span className="text-[8px] text-[var(--text-secondary)] mt-0.5 text-center">Citizen</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleQuickLogin('lcro@clara.gov', 'lcro123')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[var(--accent-border)] bg-[var(--surface-highlight)]/30 hover:bg-[var(--surface-highlight)] hover:border-[var(--primary-green)]/40 hover:text-[var(--primary-green)] transition-all cursor-pointer group select-none active:scale-[0.97] duration-150"
              >
                <div className="w-7 h-7 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform duration-150">
                  <ShieldCheck size={14} />
                </div>
                <span className="text-[10px] font-bold leading-tight text-[var(--text-primary)] group-hover:text-[var(--primary-green)]">LCRO</span>
                <span className="text-[8px] text-[var(--text-secondary)] mt-0.5 text-center">Analytics</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@clara.gov', 'admin123')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[var(--accent-border)] bg-[var(--surface-highlight)]/30 hover:bg-[var(--surface-highlight)] hover:border-[var(--primary-green)]/40 hover:text-[var(--primary-green)] transition-all cursor-pointer group select-none active:scale-[0.97] duration-150"
              >
                <div className="w-7 h-7 rounded-lg bg-[var(--primary-green)]/10 text-[var(--primary-green)] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform duration-150">
                  <Key size={14} />
                </div>
                <span className="text-[10px] font-bold leading-tight text-[var(--text-primary)] group-hover:text-[var(--primary-green)]">Admin</span>
                <span className="text-[8px] text-[var(--text-secondary)] mt-0.5 text-center">KB CRUD</span>
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-[var(--primary-green)] hover:bg-[var(--primary-dark)] disabled:bg-[var(--text-disabled)] disabled:cursor-not-allowed text-white font-extrabold uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow-[0_4px_12px_rgba(78,156,129,0.2)] transition-all duration-200 cursor-pointer active:scale-[0.98] mt-1"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Pinoproseso...
            </>
          ) : (
            isSignUp ? 'Gumawa ng Account' : 'Mag-log In'
          )}
        </button>
      </form>

      <div className="text-center text-xs text-[var(--text-secondary)] select-none">
        {isSignUp ? (
          <span>
            May account ka na?{' '}
            <button
              onClick={() => setIsSignUp(false)}
              className="text-[var(--primary-green)] font-semibold hover:underline cursor-pointer"
            >
              Mag-log in dito
            </button>
          </span>
        ) : (
          <span>
            Walang account?{' '}
            <button
              onClick={() => setIsSignUp(true)}
              className="text-[var(--primary-green)] font-semibold hover:underline cursor-pointer"
            >
              Gumawa ng account dito
            </button>
          </span>
        )}
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Header bar */}
      <header className="glass-header h-16 flex items-center justify-between px-4 sticky top-0 z-40 transition-colors duration-200">
        <Link 
          href="/" 
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          Bumalik
        </Link>
        <ThemeToggle />
      </header>

      {/* Auth Container */}
      <main className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-[var(--primary-green)]/10 blur-[80px] pointer-events-none z-0" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none z-0" />
        
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 size={32} className="animate-spin text-[var(--primary-green)]" />
            <span className="text-xs text-[var(--text-secondary)]">Naglo-load...</span>
          </div>
        }>
          <LoginFormContent />
        </Suspense>
      </main>
    </div>
  );
}
