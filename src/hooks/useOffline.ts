import { useEffect, useState } from 'react';

export function useOffline() {
  const [isOffline, setIsOffline] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOffline, setIsOffline };
}
