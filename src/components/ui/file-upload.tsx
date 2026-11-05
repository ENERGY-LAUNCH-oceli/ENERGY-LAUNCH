import { FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/utils/cn';
import { Button } from './button';

export interface FileUploadProps {
  /** Например ".csv,.json". */
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  disabled?: boolean;
  label?: string;
  hint?: string;
  error?: string;
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  className?: string;
}

const formatSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1)} МБ`);

/** Загрузка файлов: перетаскивание или выбор. Проверка типа и размера — до передачи в импорт. */
export function FileUpload({ accept, multiple, maxSizeMb = 50, disabled, label = 'Перетащите файл или выберите', hint, error, files = [], onFilesChange, className }: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const shownError = error ?? localError;

  const accepts = (f: File) => {
    if (!accept) return true;
    return accept.split(',').some((a) => f.name.toLowerCase().endsWith(a.trim().toLowerCase()));
  };

  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming = [...list];
    const bad = incoming.find((f) => !accepts(f) || f.size > maxSizeMb * 1024 * 1024);
    if (bad) {
      setLocalError(!accepts(bad) ? `Неподдерживаемый формат: ${bad.name}` : `Файл больше ${maxSizeMb} МБ: ${bad.name}`);
      return;
    }
    setLocalError(null);
    onFilesChange?.(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && (e.preventDefault(), inputRef.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-[1.5px] border-dashed border-border-strong bg-surface-secondary px-6 py-8 text-center transition-colors duration-fast hover:border-accent hover:bg-accent-subtle/50',
          dragging && 'border-accent bg-accent-subtle',
          shownError && 'border-error-border bg-error-subtle/50',
          disabled && 'pointer-events-none opacity-45',
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-surface text-accent-strong shadow-xs">
          <UploadCloud className="size-5" aria-hidden />
        </span>
        <span className="text-body-sm font-semibold">{dragging ? 'Отпустите, чтобы загрузить' : label}</span>
        <span className="text-caption text-text-muted">{hint ?? `${accept ? `Форматы: ${accept}. ` : ''}До ${maxSizeMb} МБ`}</span>
        <input ref={inputRef} type="file" className="sr-only" accept={accept} multiple={multiple} disabled={disabled} onChange={(e) => add(e.target.files)} tabIndex={-1} />
      </div>
      {shownError && (
        <p role="alert" className="text-caption text-error">
          {shownError}
        </p>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
              <FileSpreadsheet className="size-4 text-accent-strong" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-caption">{f.name}</span>
              <span className="tabular text-caption text-text-muted">{formatSize(f.size)}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Удалить ${f.name}`} onClick={() => onFilesChange?.(files.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
