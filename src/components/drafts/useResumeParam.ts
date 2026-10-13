/**
 * @file useResumeParam.ts
 * @description `?resume=<what>` on a form's address means "open with my saved draft". The dashboard's Drafts list links here.
 * The form reads the value once, starts loading what it needs, and calls `done()` so a refresh does not repeat it.
 * `tab` is the tab the form lives on: several forms share one page, and only the one on the tab in the address may act on `resume`.
 */
import { useSearchParams } from 'react-router-dom';

export function useResumeParam(tab: string): { value: string; done: () => void } {
  const [params, setParams] = useSearchParams();
  return {
    value: params.get('tab') === tab ? params.get('resume') || '' : '',
    done: () => setParams(prev => { const next = new URLSearchParams(prev); next.delete('resume'); return next; }, { replace: true })
  };
}
