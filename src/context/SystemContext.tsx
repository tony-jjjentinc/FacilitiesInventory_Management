import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SystemInfo } from '../types';
import { apiRequest } from '../services/api';

export const DEFAULT_SYSTEM_INFO: SystemInfo = {
  name: 'Facilities Inventory and Warehousing Management',
  service: 'Facilities Inventory and Warehousing Management',
  shortName: 'Facilities Inventory',
  subtitle: 'Management Dashboard',
  version: 'v1.0.0',
  status: 'HEALTHY'
};

const SYSTEM_INFO_CACHE_KEY = 'jjjei_system_info';

interface SystemContextValue {
  systemInfo: SystemInfo;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const SystemContext = createContext<SystemContextValue>({
  systemInfo: DEFAULT_SYSTEM_INFO,
  isLoading: false,
  error: null,
  refetch: async () => {}
});

function getInitialSystemInfo(): SystemInfo {
  try {
    const cached = localStorage.getItem(SYSTEM_INFO_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (typeof parsed.name === 'string' || typeof parsed.service === 'string')) {
        return {
          ...DEFAULT_SYSTEM_INFO,
          ...parsed,
          name: parsed.name || parsed.service || DEFAULT_SYSTEM_INFO.name
        };
      }
    }
  } catch (err) {
    console.warn('[SystemContext] Failed to read cached system info:', err);
  }
  return DEFAULT_SYSTEM_INFO;
}

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo>(getInitialSystemInfo);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSystemInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SystemInfo>('system:info');
      if (data && (data.name || data.service)) {
        const rawName = data.name || data.service || DEFAULT_SYSTEM_INFO.name;
        const normalized: SystemInfo = {
          name: rawName,
          service: rawName,
          shortName: data.shortName || (rawName.includes('•') ? rawName.split('•')[0].trim() : 'Facilities Inventory'),
          subtitle: data.subtitle || 'Management Dashboard',
          version: data.version
            ? (data.version.startsWith('v') ? data.version : `v${data.version}`)
            : DEFAULT_SYSTEM_INFO.version,
          status: data.status || 'HEALTHY',
          time: data.time || data.timestamp || new Date().toISOString(),
          timestamp: data.timestamp || data.time
        };
        setSystemInfo(normalized);
        localStorage.setItem(SYSTEM_INFO_CACHE_KEY, JSON.stringify(normalized));
      }
    } catch (err: any) {
      console.warn('[SystemContext] Failed to fetch system info from API, using fallback:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemInfo();
  }, [fetchSystemInfo]);

  return (
    <SystemContext.Provider value={{ systemInfo, isLoading, error, refetch: fetchSystemInfo }}>
      {children}
    </SystemContext.Provider>
  );
};

export function useSystemInfo(): SystemContextValue {
  return useContext(SystemContext);
}
