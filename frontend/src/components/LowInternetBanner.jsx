import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';
import { isOffline, getOfflineCachedSchemes } from '../utils/offlineSync';

export default function LowInternetBanner() {
  const [offline, setOffline] = useState(false);
  const [cacheInfo, setCacheInfo] = useState(null);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => {
      setOffline(true);
      setCacheInfo(getOfflineCachedSchemes());
    };

    setOffline(isOffline());
    if (isOffline()) {
      setCacheInfo(getOfflineCachedSchemes());
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between sticky top-16 sm:top-20 z-40 shadow-md">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-slate-950 animate-pulse" />
        <span>Low-Internet / Offline Mode Active</span>
        {cacheInfo?.cachedAt && (
          <span className="font-normal opacity-90 hidden sm:inline">
            (Viewing schemes cached on {cacheInfo.cachedAt.toLocaleTimeString()})
          </span>
        )}
      </div>

      <button
        onClick={() => window.location.reload()}
        className="px-2.5 py-1 rounded bg-slate-950 text-white text-[11px] font-bold flex items-center gap-1 hover:bg-slate-900 transition"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Try Reconnecting</span>
      </button>
    </div>
  );
}
