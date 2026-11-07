import * as React from 'react';
import { ArrowRight, CircleAlert, CircleCheck, FileJson, FileQuestion, FileSpreadsheet, FolderOpen, Info, Loader2, Plus, UploadCloud } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { STAGE_META } from '@/config/stages';
import { findObject } from '@/data/objects';
import { collectDropped, KIND_LABEL, type DropPlan } from '@/services/file-route';
import { useLaunchStore } from '@/store';
import { cn } from '@/utils/cn';
import { NEW_OBJECT, objectKeys, STAGE_OF, useDrop } from './drop-store';

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1)} МБ`);
const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

/**
 * «Брось файл куда угодно»: перетаскивание файлов или папок в любое место окна, выбор файлов из меню.
 * Поля загрузки этапов ([data-dropzone]) обрабатывают свои файлы сами – общая подсказка над ними не мешает.
 */
export function DropHost() {
  const [over, setOver] = React.useState<false | 'window' | 'zone'>(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const analyze = useDrop((s) => s.analyze);
  const registerPicker = useDrop((s) => s.registerPicker);

  React.useEffect(() => {
    registerPicker(() => inputRef.current?.click());
    let depth = 0;
    const inZone = (e: DragEvent) => !!(e.target as Element | null)?.closest?.('[data-dropzone]');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setOver(inZone(e) ? 'zone' : 'window');
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setOver(inZone(e) ? 'zone' : 'window');
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setOver(false);
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setOver(false);
      if (!hasFiles(e) || inZone(e) || !e.dataTransfer) return;
      e.preventDefault();
      void collectDropped(e.dataTransfer).then((files) => analyze(files));
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      registerPicker(null);
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [analyze, registerPicker]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.json,.txt"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="drop-picker"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].map((file) => ({ file, path: file.name }));
          e.target.value = '';
          void analyze(files);
        }}
      />
      {/* Подсказка при перетаскивании: только визуальная, события идут к странице */}
      <div aria-hidden className={cn('pointer-events-none fixed inset-0 z-[150] flex items-center justify-center bg-background/70 p-6 backdrop-blur-[2px] transition-opacity duration-200', over === 'window' ? 'opacity-100' : 'opacity-0')}>
        <div className={cn('flex max-w-md flex-col items-center gap-3 rounded-xl border-2 border-dashed border-accent bg-surface px-10 py-9 text-center shadow-lg transition-transform duration-300 ease-out', over === 'window' ? 'scale-100' : 'scale-95')}>
          <span className="flex size-14 items-center justify-center rounded-full bg-accent-subtle text-accent-strong">
            <UploadCloud className="size-7" aria-hidden />
          </span>
          <span className="text-h3">Отпустите файлы</span>
          <span className="text-body-sm text-text-secondary">invoice.csv, telemetry.csv, object.json или целые папки – система сама определит объект и этап и покажет, куда загрузит.</span>
        </div>
      </div>
      <DropDialog />
    </>
  );
}

function FileIcon({ plan }: { plan: DropPlan }) {
  const Icon = plan.kind === 'passport' ? FileJson : plan.kind === 'unknown' ? FileQuestion : FileSpreadsheet;
  return <Icon className={cn('size-5 shrink-0', plan.kind === 'unknown' ? 'text-text-muted' : 'text-accent-strong')} aria-hidden />;
}

function DropDialog() {
  const open = useDrop((s) => s.open);
  const analyzing = useDrop((s) => s.analyzing);
  const applying = useDrop((s) => s.applying);
  const done = useDrop((s) => s.done);
  const note = useDrop((s) => s.note);
  const plans = useDrop((s) => s.plans);
  const targets = useDrop((s) => s.targets);
  const results = useDrop((s) => s.results);
  const setTarget = useDrop((s) => s.setTarget);
  const apply = useDrop((s) => s.apply);
  const close = useDrop((s) => s.close);
  const navigate = useNavigate();
  // Состояние объектов – для предупреждений (этап завершён, нет паспорта для телеметрии)
  useLaunchStore((s) => s.session);
  const options = React.useMemo(() => (open ? objectKeys().map((k) => ({ value: k.entry.id, label: k.entry.name, description: k.entry.code })) : []), [open]);
  const ready = plans.filter((p) => p.kind !== 'unknown' && targets[p.id]).length;
  const objects = new Set(plans.filter((p) => p.kind !== 'unknown' && targets[p.id]).map((p) => targets[p.id]));

  const warnings = (p: DropPlan): string[] => {
    const t = targets[p.id];
    if (!t || t === NEW_OBJECT || p.kind === 'unknown') return [];
    const st = useLaunchStore.getState();
    const ws = t === st.currentObjectId ? { session: st.session, inputs: st.inputs } : st.workspaces[t];
    const out: string[] = [];
    const stage = ws?.session?.stages[STAGE_OF[p.kind]];
    if (stage?.status === 'COMPLETED') out.push(`Этап «${STAGE_META[STAGE_OF[p.kind]].titleRu}» уже завершён: новая версия сделает его подтверждения устаревшими`);
    if (p.kind === 'telemetry' && !ws?.inputs?.passport && !plans.some((x) => x.kind === 'passport' && targets[x.id] === t)) out.push('У объекта нет паспорта object.json – добавьте его в загрузку');
    return out;
  };

  return (
    <Modal open={open} onOpenChange={(v) => !v && close()} title={done ? 'Файлы разложены' : `Разложить файлы${plans.length ? ` · ${plans.length}` : ''}`} description={note ?? 'Система определила тип каждого файла и объект. Проверьте и при необходимости поменяйте объект.'} className="max-w-2xl"
      footer={
        done ? (
          <Button onClick={close}>Готово</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={applying}>
              Отмена
            </Button>
            <Button onClick={() => void apply(navigate)} disabled={!ready || applying || analyzing} data-testid="drop-apply">
              {applying ? <Loader2 className="animate-spin" aria-hidden /> : <UploadCloud aria-hidden />}
              {ready ? `Загрузить ${ready} ${ready === 1 ? 'файл' : ready < 5 ? 'файла' : 'файлов'}${objects.size > 1 ? ` в ${objects.size} объекта` : ''}` : 'Нечего загружать'}
            </Button>
          </>
        )
      }
    >
      {analyzing ? (
        <div className="flex items-center gap-3 py-6 text-body-sm text-text-secondary">
          <Loader2 className="size-5 animate-spin text-accent" aria-hidden /> Читаю файлы и ищу объекты…
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5" data-testid="drop-plans">
          {plans.map((p) => {
            const r = results[p.id];
            const t = targets[p.id];
            const sure = p.match === 'object_id' || p.match === 'ean' || p.match === 'hash' || p.match === 'name';
            return (
              <li key={p.id} data-kind={p.kind} data-target={t ?? ''} data-match={p.match} className={cn('flex flex-col gap-2.5 rounded-lg border px-4 py-3', r?.status === 'error' ? 'border-error-border bg-error-subtle/40' : r?.status === 'ok' ? 'border-success/40 bg-success-subtle/40' : 'border-border bg-surface')}>
                <div className="flex items-start gap-3">
                  <FileIcon plan={p} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-caption font-medium text-text-primary" title={p.path}>
                      {p.path.includes('/') && <FolderOpen className="mr-1 inline size-3.5 text-text-muted" aria-hidden />}
                      {p.path}
                    </span>
                    <span className="text-caption text-text-muted">
                      {KIND_LABEL[p.kind]} · {size(p.file.size)}
                    </span>
                  </div>
                  {r?.status === 'running' && <Loader2 className="size-4 animate-spin text-accent" aria-label="Загружается" />}
                  {r?.status === 'ok' && <CircleCheck className="size-4 text-success" aria-label="Загружен" />}
                  {r?.status === 'error' && <CircleAlert className="size-4 text-error" aria-label="Ошибка" />}
                </div>

                {p.kind === 'unknown' ? (
                  <p className="text-caption text-text-muted">{p.error} – файл пропущен.</p>
                ) : done ? (
                  r && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
                      <span className={r.status === 'error' ? 'text-error' : 'text-text-secondary'}>{r.message}</span>
                      {r.href && (
                        <Link to={r.href} onClick={close} className="inline-flex items-center gap-1 font-medium text-accent-strong hover:underline">
                          Открыть <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      )}
                    </div>
                  )
                ) : (
                  <>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <Select
                        aria-label={`Объект для ${p.file.name}`}
                        value={t ?? undefined}
                        onValueChange={(v) => setTarget(p.id, v)}
                        placeholder="Выберите объект"
                        options={[...(p.draft ? [{ value: NEW_OBJECT, label: `+ Новый объект «${p.draft.name}»`, description: `${p.draft.pvCount} PV, ${p.draft.batteryCount} батарей` }] : p.withPassport ? [{ value: NEW_OBJECT, label: `Новый объект «${plans.find((x) => x.id === p.withPassport)?.draft?.name ?? ''}»`, description: 'создаётся из паспорта в этой загрузке' }] : []), ...options]}
                        disabled={applying}
                      />
                      {t && t !== NEW_OBJECT && <span className="text-caption text-text-muted sm:text-right">→ {STAGE_META[STAGE_OF[p.kind]].titleRu}</span>}
                    </div>
                    <p className={cn('flex items-start gap-1.5 text-caption', sure ? 'text-text-secondary' : 'text-warning')}>
                      {sure ? <CircleCheck className="mt-px size-3.5 shrink-0 text-success" aria-hidden /> : p.draft ? <Plus className="mt-px size-3.5 shrink-0" aria-hidden /> : <Info className="mt-px size-3.5 shrink-0" aria-hidden />}
                      {t && t !== p.objectId && t !== NEW_OBJECT ? `Объект выбран вручную: ${findObject(t)?.name ?? t}` : p.reason}
                    </p>
                    {warnings(p).map((w) => (
                      <p key={w} className="flex items-start gap-1.5 text-caption text-warning">
                        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> {w}
                      </p>
                    ))}
                    {r?.status === 'error' && <p className="text-caption text-error">{r.message}</p>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Кнопка «Загрузить файлы» – тот же разбор, что и при перетаскивании (для телефона и тех, кто не перетаскивает). */
export function UploadFilesButton({ variant = 'secondary', size = 'md' }: { variant?: 'secondary' | 'ghost'; size?: 'sm' | 'md' }) {
  const pick = useDrop((s) => s.pick);
  return (
    <Button variant={variant} size={size} onClick={pick} title="Или перетащите файлы и папки в любое место окна" data-testid="upload-files">
      <UploadCloud aria-hidden /> Загрузить файлы
    </Button>
  );
}
