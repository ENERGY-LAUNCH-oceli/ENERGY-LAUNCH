import { Ban, CheckCheck, CirclePlay, FilePlus2, FlaskConical, LayoutDashboard, Lock, OctagonAlert, Send, ShieldCheck, Stamp, Upload, Unlock, Flag, CircleDot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Timeline, type TimelineTone } from '@/components/ui/timeline';
import { AUDIT_ACTION_LABEL } from '@/config/labels';
import { STAGE_META } from '@/config/stages';
import type { AuditAction, AuditEvent } from '@/types';
import { formatDateTime } from '@/utils/format';
import { EmptyState } from '@/components/common/EmptyState';

const STYLE: Record<AuditAction, { tone: TimelineTone; icon: typeof Ban }> = {
  SESSION_CREATED: { tone: 'accent', icon: CircleDot },
  SESSION_COMPLETED: { tone: 'success', icon: Flag },
  STAGE_STARTED: { tone: 'info', icon: CirclePlay },
  STAGE_BLOCKED: { tone: 'error', icon: OctagonAlert },
  STAGE_UNBLOCKED: { tone: 'info', icon: Unlock },
  STAGE_COMPLETED: { tone: 'success', icon: CheckCheck },
  TRANSITION_REJECTED: { tone: 'warning', icon: Ban },
  VALIDATION_RUN: { tone: 'neutral', icon: FlaskConical },
  BLOCKER_OPENED: { tone: 'error', icon: OctagonAlert },
  BLOCKER_RESOLVED: { tone: 'success', icon: ShieldCheck },
  EVIDENCE_ADDED: { tone: 'neutral', icon: FilePlus2 },
  CONFIRMATION_ADDED: { tone: 'accent', icon: Stamp },
  DATASET_IMPORTED: { tone: 'neutral', icon: Upload },
  CONTROL_COMMAND: { tone: 'info', icon: Send },
  DASHBOARD_UPDATED: { tone: 'neutral', icon: LayoutDashboard },
  DASHBOARD_PUBLISHED: { tone: 'info', icon: LayoutDashboard },
  DASHBOARD_ACCEPTANCE: { tone: 'success', icon: Stamp },
  ACCESS_DENIED: { tone: 'warning', icon: Lock },
  CONFIRMATIONS_STALE: { tone: 'warning', icon: Ban },
};

function describe(e: AuditEvent): string | undefined {
  const p = e.payload ?? {};
  if (e.action === 'TRANSITION_REJECTED' && typeof p.message === 'string') return p.message;
  if (e.action === 'VALIDATION_RUN' && Array.isArray(p.failed)) return p.failed.length ? `Не пройдены: ${p.failed.join(', ')}` : 'Все блокирующие правила пройдены';
  if (e.action === 'BLOCKER_OPENED' && typeof p.ruleId === 'string') return `Правило ${p.ruleId}`;
  if (e.action === 'CONFIRMATION_ADDED' && typeof p.requirementId === 'string') return `Требование ${p.requirementId}`;
  return undefined;
}

export interface AuditTimelineProps {
  events: AuditEvent[];
  /** Новые сверху (по умолчанию). */
  newestFirst?: boolean;
  limit?: number;
  className?: string;
}

/** Журнал переходов и подтверждений: время, автор, этап, версия правил, результат (ТЗ 2.2.6). */
export function AuditTimeline({ events, newestFirst = true, limit, className }: AuditTimelineProps) {
  if (events.length === 0) return <EmptyState compact title="Событий пока нет" description="Каждый переход и ручное подтверждение будет записано здесь." />;
  const ordered = newestFirst ? [...events].reverse() : events;
  const shown = limit ? ordered.slice(0, limit) : ordered;
  return (
    <Timeline
      className={className}
      items={shown.map((e) => {
        const s = STYLE[e.action];
        const Icon = s.icon;
        return {
          id: e.id,
          tone: s.tone,
          icon: <Icon aria-hidden />,
          title: AUDIT_ACTION_LABEL[e.action],
          time: formatDateTime(e.timestamp),
          description: describe(e),
          meta: (
            <>
              {e.stageId && (
                <Badge size="sm" tone="neutral">
                  {STAGE_META[e.stageId].titleRu}
                </Badge>
              )}
              <Badge size="sm" tone="neutral">
                {e.actor}
              </Badge>
              {e.rulesetVersion && (
                <Badge size="sm" tone="neutral">
                  Правила v{e.rulesetVersion}
                </Badge>
              )}
            </>
          ),
        };
      })}
    />
  );
}
