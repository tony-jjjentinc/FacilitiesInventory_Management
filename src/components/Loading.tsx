/**
 * @file Loading.tsx
 * @description App-wide loading indicator: a spinner with an optional label.
 *
 * The label can be:
 *  - animated (default): a typewriter that types each phrase, holds it, erases it, then moves to the next
 *  - static: one fixed text, no animation (`typewriter={false}` or a `label`)
 *  - hidden: spinner only (`showLabel={false}`)
 *
 * Examples:
 *   <Loading />                                                  centered panel loader, default phrases
 *   <Loading phrases={['Syncing...', 'Matching items...']} />    your own phrases, still animated
 *   <Loading typewriter={false} />                               static label (the first phrase)
 *   <Loading label="Loading the MRL…" variant="text" />          static label with your own wording
 *   <Loading showLabel={false} variant="button" />               spinner only, e.g. icon buttons
 *   <button disabled={busy}>{busy ? <Loading variant="button" label="Saving..." /> : 'Save'}</button>
 */
import React, { useEffect, useState } from 'react';

/** Phrases the typewriter cycles through when no `phrases` prop is given. */
export const LOADING_PHRASES = ['Fetching data...', 'Processing...', 'Loading...', 'Almost there...'];

/** Typewriter timing, in milliseconds. */
const TYPE_MS = 60;   // per typed character
const ERASE_MS = 25;  // per erased character
const HOLD_MS = 1000; // pause on a finished phrase

/**
 * Types each phrase out, holds it, erases it, then moves to the next one (looping).
 * @param phrases phrases to cycle through
 * @param active  false pauses the animation and avoids running timers (static label)
 * @returns `text` = the part typed so far, `phrase` = the full phrase being typed
 */
function useTypewriter(phrases: string[], active: boolean): { text: string; phrase: string } {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(0);
  const [erasing, setErasing] = useState(false);
  const phrase = phrases[index % phrases.length] || '';

  useEffect(() => {
    if (!active || phrases.length === 0) return;
    let delay = erasing ? ERASE_MS : TYPE_MS;
    if (!erasing && length === phrase.length) delay = HOLD_MS;
    const t = window.setTimeout(() => {
      if (!erasing && length < phrase.length) setLength(length + 1);
      else if (!erasing) setErasing(true);
      else if (length > 0) setLength(length - 1);
      else { setErasing(false); setIndex(i => (i + 1) % phrases.length); }
    }, delay);
    return () => window.clearTimeout(t);
  }, [active, phrases, phrase, length, erasing]);

  return { text: phrase.slice(0, length), phrase };
}

export interface LoadingProps {
  /**
   * Where it is used.
   * - `default`: centered block (spinner above the label) for a panel or page
   * - `text`: inline, next to other text, replaces a hand-written `<span spinner/> Loading…`
   * - `button`: inline, takes the button's text colour so it works on primary, secondary and light buttons
   */
  variant?: 'default' | 'text' | 'button';
  /** Show the label next to the spinner. `false` = spinner only. Default `true`. */
  showLabel?: boolean;
  /**
   * Turn the typewriter animation on or off. Default `true`.
   * When off, the label is static: `label` if given, otherwise the first of `phrases`.
   */
  typewriter?: boolean;
  /** One fixed label with exact wording (e.g. "Loading the MRL…"). Always static and wins over `phrases`. */
  label?: string;
  /** Replaces the default phrase series. Only used by the typewriter, or its first item when static. */
  phrases?: string[];
  /** Extra classes for the wrapper, e.g. spacing utilities. */
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  variant = 'default', showLabel = true, typewriter = true, label, phrases = LOADING_PHRASES, className = ''
}) => {
  // a fixed `label` or `typewriter={false}` means static text; only then no timers run
  const staticText = label ?? (typewriter ? undefined : phrases[0] ?? '');
  const animate = showLabel && staticText === undefined;
  const typed = useTypewriter(phrases, animate);

  const spinner = (
    <span className={`spinner-border ${variant === 'default' ? '' : 'spinner-border-sm'} ${variant === 'button' ? '' : 'text-primary'}`} aria-hidden="true"></span>
  );

  // the hidden full phrase reserves the width, so the typed text never shifts the spinner
  const shown = staticText ?? typed.text;
  const sizer = staticText ?? typed.phrase;
  const labelEl = showLabel && (
    <span className={variant === 'default' ? 'text-secondary small' : ''} style={{ display: 'inline-block', position: 'relative', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
      <span style={{ visibility: 'hidden' }} aria-hidden="true">{sizer}</span>
      <span style={{ position: 'absolute', left: 0, top: 0 }}>
        {shown}{animate && <span className="loading-caret" aria-hidden="true">|</span>}
      </span>
    </span>
  );

  if (variant === 'default') {
    return <div className={`d-flex flex-column align-items-center justify-content-center gap-2 py-4 text-center ${className}`} role="status" aria-label="Loading">{spinner}{labelEl}</div>;
  }
  return <span className={`d-inline-flex align-items-center justify-content-center align-middle gap-2 ${className}`} role="status" aria-label="Loading">{spinner}{labelEl}</span>;
};
