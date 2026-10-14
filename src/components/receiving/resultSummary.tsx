/**
 * @file resultSummary.tsx
 * @description What happened after assigning, delegating or verifying an MRL, in plain sentences, so the person never has to open
 * other pages to find out where the stock went, which return voucher was made, or who holds the missing items.
 */
import React from 'react';
import type { MrlTask, TaskLine } from '../../types';

const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const q = (x: number) => Number(x.toLocaleString(undefined, { maximumFractionDigits: 3 })).toString();

export interface VerifyResult { transactionId?: string | null; mrtNumber?: string | null; followUpReceiptId?: string | null; over?: number }
export interface LineAnswer { recv: string; ret: string; shortRes: 'OPEN' | 'CLOSED' }

/** One sentence per line, then the vouchers and who holds what is still to arrive. */
export function verifySummary(task: MrlTask, lines: TaskLine[], answers: Record<string, LineAnswer>, where: string, res: VerifyResult, balanceHolder: string): React.ReactNode {
  const items: React.ReactNode[] = [];
  lines.forEach(l => {
    const a = answers[l.Receipt_Line_ID];
    const recv = num(a.recv); const ret = num(a.ret); const released = num(l.Released_Qty);
    const short = Math.max(0, released - recv - ret);
    const bits: string[] = [];
    if (recv > 0) bits.push(`${q(recv)} ${l.UOM} posted to ${where}`);
    if (ret > 0) bits.push(`${q(ret)} returned to ProcInv${res.mrtNumber ? ` on ${res.mrtNumber}` : ''}`);
    if (short > 0) bits.push(a.shortRes === 'CLOSED' ? `${q(short)} missing, closed (no more is coming)` : `${q(short)} still expected: ${balanceHolder} holds the missing items`);
    if (recv + ret > released) bits.push(`${q(recv + ret - released)} more than released, flagged for the Head`);
    items.push(<li key={l.Receipt_Line_ID}><strong>{l.Item_Name}</strong>: {bits.join('; ') || 'nothing received'}.</li>);
  });
  return (
    <>
      <div className="mb-2">MRL {task.Source_Reference} is verified.{res.transactionId ? ` Stock transaction ${res.transactionId}.` : ''}</div>
      <ul className="small mb-0 ps-3">{items}</ul>
    </>
  );
}

export const delegateSummary = (mrl: string, who: string, where: string): React.ReactNode =>
  <>MRL {mrl} is now with <strong>{who}</strong>, who was notified. They will verify it and post it to {where}. You can take it back from My tasks until they verify.</>;

export const assignSummary = (mrl: string, who: string, sub: string): React.ReactNode =>
  <>MRL {mrl} is now with <strong>{who}</strong> ({sub}), who was notified. They verify what arrived, choose where it goes, or hand it to an FMS. You can follow it under Deliveries, then My tasks.</>;
