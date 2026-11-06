import { useMemo } from 'react';
import { OBJECT_CATALOG, type ObjectCatalogEntry } from '@/data/objects';
import { useLaunchStore } from '@/store';
import type { AuditEvent, LaunchInputs, LaunchSession } from '@/types';

export interface PortfolioWorkspace {
  entry: ObjectCatalogEntry;
  session: LaunchSession;
  inputs: LaunchInputs;
  auditLog: AuditEvent[];
}

/** Состояние каждого объекта портфеля (текущий – из хранилища, остальные – из сохранённых рабочих пространств). */
export function usePortfolioWorkspaces(): PortfolioWorkspace[] {
  const currentId = useLaunchStore((s) => s.currentObjectId);
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const auditLog = useLaunchStore((s) => s.auditLog);
  const workspaces = useLaunchStore((s) => s.workspaces);
  return useMemo(
    () =>
      OBJECT_CATALOG.flatMap((entry) => {
        if (entry.id === currentId) return session && inputs ? [{ entry, session, inputs, auditLog }] : [];
        const w = workspaces[entry.id];
        return w ? [{ entry, session: w.session, inputs: w.inputs, auditLog: w.auditLog }] : [];
      }),
    [currentId, session, inputs, auditLog, workspaces],
  );
}
