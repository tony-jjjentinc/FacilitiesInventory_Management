import React from 'react';
import { useSystemInfo } from '../context/SystemContext';

/** Minimal footer: company and system version, centered. */
export const Footer: React.FC = () => {
  const { systemInfo } = useSystemInfo();
  return (
    <footer className="mt-auto py-3 text-center small text-muted">
      Juan Jamora, Jr. Enterprises Inc.  • {systemInfo.name} {systemInfo.version}
    </footer>
  );
};
