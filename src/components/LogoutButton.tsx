'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface LogoutButtonProps {
  className?: string;
  showLabel?: boolean;
  label?: string;
  onLogout?: () => void;
}

export default function LogoutButton({
  className = '',
  showLabel = true,
  label = 'Logout',
  onLogout,
}: LogoutButtonProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      if (onLogout) onLogout();
      // Redirect to home page
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Optionally show a toast notification
    } finally {
      setIsLoggingOut(false);
      setShowConfirm(false);
    }
  };

  const handleClick = () => {
    setShowConfirm(true);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <>
      {/* Logout trigger button */}
      <button
        onClick={handleClick}
        disabled={isLoggingOut}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors ${className}`}
        aria-label="Logout"
      >
        <LogOut size={18} />
        {showLabel && <span>{isLoggingOut ? 'Logging out...' : label}</span>}
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--accent-border)] rounded-2xl shadow-[var(--shadow-card)] p-6 w-full max-w-md animate-message">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              Mag-log Out?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
              Sigurado ka bang nais mong mag-log out? Maaari kang mag-log in muli anumang oras.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl border border-[var(--accent-border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] transition-colors"
              >
                Kanselahin
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? 'Naglo-logout...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}