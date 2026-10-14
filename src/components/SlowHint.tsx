import React, { useEffect, useState } from 'react';

/** After 4 seconds of waiting, says that a slow answer is normal, so nobody closes the window or clicks twice. */
export const SlowHint: React.FC<{ busy: boolean }> = ({ busy }) => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) { setSlow(false); return; }
    const t = window.setTimeout(() => setSlow(true), 4000);
    return () => window.clearTimeout(t);
  }, [busy]);
  return busy && slow ? <span className="small text-muted me-2" role="status">Still working. This can take up to 30 seconds; please keep this window open.</span> : null;
};
