'use client';

import React from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineBannerProps {
  isOffline: boolean;
}

export default function OfflineBanner({ isOffline }: OfflineBannerProps) {
  if (!isOffline) return null;

  return (
    <div 
      className="offline-banner flex items-center gap-3 p-3 mx-4 mt-4 rounded-lg border border-[var(--offline-border)] bg-[var(--offline-bg)] text-[var(--offline-text)] transition-all duration-300 ease-out shadow-sm animate-message"
      role="alert"
    >
      <WifiOff size={18} className="flex-shrink-0 text-[var(--primary-green)]" />
      <span className="text-sm font-medium">
        Nasa offline mode ka. Pansamantalang hindi magagamit ang AI Chat. Maaari mong hanapin ang mga gabay sa ibaba.
      </span>
    </div>
  );
}
