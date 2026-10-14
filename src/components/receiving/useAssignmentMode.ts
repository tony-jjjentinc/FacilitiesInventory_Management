/**
 * @file useAssignmentMode.ts
 * @description Whether MRLs are received through a Head's assignment (the MRL_ASSIGNMENT switch on the server), and whether
 * assignment tasks are still open. The answer is cached, so tabs and links can follow it at once.
 */
import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { fetchWithSwr, getCachedData } from '../../services/cache';

export function useAssignmentMode(): { assignment: boolean; tasks: boolean; known: boolean } {
  const [on, setOn] = useState(() => !!getCachedData<{ assignment: boolean }>('receiving:mode')?.assignment);
  const [known, setKnown] = useState(() => getCachedData('receiving:mode') != null); // false until the server has answered once
  const [tasks, setTasks] = useState(() => !!getCachedData<{ tasks: boolean }>('receiving:mode')?.tasks);
  useEffect(() => {
    let alive = true;
    fetchWithSwr<{ assignment: boolean; tasks: boolean }>('receiving:mode', () => apiRequest('receiving:getMode'), d => { if (alive && d) { setOn(!!d.assignment); setTasks(!!d.tasks); setKnown(true); } }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return { assignment: on, tasks, known };
}
