import { Download, FileCheck2, FileSpreadsheet, FileText, History, Image, NotebookPen, TerminalSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EVIDENCE_TYPE_LABEL } from '@/config/labels';
import type { EvidenceType } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

const ICON: Record<EvidenceType, typeof FileText> = {
  FILE: FileSpreadsheet,
  VALIDATION_REPORT: FileCheck2,
  SIGNED_ACT: FileText,
  COMMAND_LOG: TerminalSquare,
  SCREENSHOT: Image,
  NOTE: NotebookPen,
};

export interface EvidenceView {
  id: string;
  title: string;
  type: EvidenceType;
  fileName?: string;
  sizeBytes?: number;
  createdAt: string;
  createdBy: string;
  source?: string;
  rulesetVersion?: string;
  checksumSha256?: string;
  /** Материал стал неактуальным после изменения входных данных (ТЗ 2.2.4). */
  stale?: boolean;
}

export interface EvidenceCardProps {
  evidence: EvidenceView;
  onOpen?: () => void;
  onDownload?: () => void;
  className?: string;
}

const size = (b?: number) => (b === undefined ? null : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1)} МБ`);

/** Подтверждающий материал. Неактуальный материал приглушён и помечен, но не скрыт: история сохраняется. */
export function EvidenceCard({ evidence: e, onOpen, onDownload, className }: EvidenceCardProps) {
  const Icon = ICON[e.type];
  return (
    <article className={cn('flex gap-3 rounded-md border border-border bg-surface p-4', e.stale && 'border-dashed bg-surface-secondary', className)}>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-sm', e.stale ? 'bg-surface-sunken text-text-muted' : 'bg-accent-subtle text-accent-strong')}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {onOpen ? (
            <button type="button" onClick={onOpen} className="truncate text-left text-body-sm font-semibold hover:text-accent-strong">
              {e.title}
            </button>
          ) : (
            <span className="truncate text-body-sm font-semibold">{e.title}</span>
          )}
          {e.stale && (
            <Badge tone="warning" size="sm">
              <History aria-hidden />
              Неактуален
            </Badge>
          )}
        </div>
        <span className="text-caption text-text-secondary">
          {EVIDENCE_TYPE_LABEL[e.type]}
          {e.fileName && (
            <>
              {' · '}
              <span className="font-mono">{e.fileName}</span>
            </>
          )}
          {size(e.sizeBytes) && <span className="tabular"> · {size(e.sizeBytes)}</span>}
        </span>
        <span className="flex flex-wrap gap-x-3 text-caption text-text-muted">
          <span className="tabular">{formatDateTime(e.createdAt)}</span>
          <span>{e.createdBy}</span>
          {e.source && <span>Источник: {e.source}</span>}
          {e.rulesetVersion && <span>Правила v{e.rulesetVersion}</span>}
          {e.checksumSha256 && <span className="font-mono" title={e.checksumSha256}>SHA-256 {e.checksumSha256.slice(0, 8)}…</span>}
        </span>
      </div>
      {onDownload && (
        <Button variant="ghost" size="icon-sm" aria-label={`Скачать ${e.title}`} onClick={onDownload}>
          <Download />
        </Button>
      )}
    </article>
  );
}
