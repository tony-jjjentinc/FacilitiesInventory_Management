import React from 'react';
import { useSearchParams } from 'react-router-dom';

export interface TabDef {
  key: string;
  label: string;
  badge?: number;
}

interface Props {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
  label: string;
}

/** Underline tabs, scroll sideways on narrow screens. Styles in index.css (`.page-tabs`). */
export const Tabs: React.FC<Props> = ({ tabs, active, onChange, label }) => (
    <nav className="page-tabs" role="tablist" aria-label={label}>
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          className={`page-tab ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && <span className="page-tab-badge">{t.badge}</span>}
        </button>
      ))}
    </nav>
);

/** Page-level tabs: `Tabs` inside the page container. */
export const TabBar: React.FC<Props> = (props) => (
  <div className="container pt-3 px-3 px-md-4"><Tabs {...props} /></div>
);

/** The active tab lives in the URL (`?tab=`). The first key is the default and keeps the URL clean. */
export function useTabParam(keys: string[]): [string, (key: string) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') || '';
  const active = keys.indexOf(requested) !== -1 ? requested : keys[0];
  const setTab = (key: string) => {
    const next = new URLSearchParams();
    if (key !== keys[0]) next.set('tab', key);
    setParams(next, { replace: true });
  };
  return [active, setTab];
}
