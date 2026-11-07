import * as React from 'react';
import { ArrowLeft, ArrowRight, Check, CirclePlay, GraduationCap, MessageCircleQuestion, Plus, Search, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_OBJECT_ID } from '@/data/objects';
import { AskPanel } from '@/features/help/AskPanel';
import { useHelpDialog, useUserQuestions } from '@/features/help/help-api';
import { LESSONS } from '@/features/help/lessons';
import { startTour } from '@/features/tour/TourHost';
import { useHelpProgress } from '@/features/tour/tour-store';
import { FAQ, FAQ_CATEGORIES, type FaqCategory } from '@/help/knowledge';
import { useLaunchStore } from '@/store';
import { cn } from '@/utils/cn';

const plural = (n: number, forms: [string, string, string]) => forms[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];
const catLabel = (c: string) => FAQ_CATEGORIES.find(([id]) => id === c)?.[1] ?? c;

/** «Обучение»: уроки по каждому блоку сайта с туром «Показать на сайте» и вопросы-ответы с помощником. */
export function HelpPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'faq' ? 'faq' : 'lessons';
  const done = useHelpProgress((s) => s.done).filter((id) => LESSONS.some((l) => l.id === id));
  const showAsk = useHelpDialog((s) => s.show);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Обучение"
        title="Обучение"
        description="Короткие уроки по каждому блоку сайта – с показом прямо на страницах – и ответы на вопросы."
        actions={
          <Button variant="secondary" onClick={() => showAsk()}>
            <MessageCircleQuestion aria-hidden /> Задать вопрос
          </Button>
        }
      />
      <Hero done={done.length} />
      <Tabs value={tab} onValueChange={(v) => set({ tab: v === 'faq' ? 'faq' : null, q: null })}>
        <TabsList aria-label="Разделы обучения">
          <TabsTrigger value="lessons">
            Уроки · {done.length}/{LESSONS.length}
          </TabsTrigger>
          <TabsTrigger value="faq">Вопросы и ответы · {FAQ.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="lessons" className="pt-6">
          <Lessons current={params.get('lesson')} onSelect={(id) => set({ lesson: id })} done={done} />
        </TabsContent>
        <TabsContent value="faq" className="pt-6">
          <Faq focusId={params.get('q')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Hero({ done }: { done: number }) {
  const all = done === LESSONS.length;
  return (
    <section className="relative flex items-center justify-between gap-6 overflow-hidden rounded-lg border border-border bg-surface px-6 py-6 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-accent-subtle to-transparent" />
      <div className="relative flex max-w-2xl flex-col gap-2.5">
        <span className="text-label text-text-muted">Для всех, кто запускает объекты</span>
        <h2 className="text-h2 text-balance">{all ? 'Все уроки пройдены – вы знаете ENERGY LAUNCH' : 'Каждый блок сайта – отдельный урок'}</h2>
        <p className="text-body-sm text-text-secondary">Прочитайте урок и нажмите «Показать на сайте»: тур сам откроет нужную страницу, подсветит элементы и покажет действия – например, заполнит форму нового объекта.</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1" role="progressbar" aria-label="Пройдено уроков" aria-valuemin={0} aria-valuemax={LESSONS.length} aria-valuenow={done}>
          <span className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(done / LESSONS.length) * 100}%` }} />
          </span>
          <span className="text-body-sm font-medium">
            Пройдено {done} из {LESSONS.length} {plural(LESSONS.length, ['урока', 'уроков', 'уроков'])}
          </span>
        </div>
      </div>
      <span aria-hidden className="relative hidden size-24 shrink-0 -rotate-6 items-center justify-center rounded-xl bg-primary text-accent sm:flex">
        <GraduationCap className="size-12" strokeWidth={1.4} />
      </span>
    </section>
  );
}

function Lessons({ current, onSelect, done }: { current: string | null; onSelect: (id: string) => void; done: string[] }) {
  const objectId = useLaunchStore((s) => s.currentObjectId) ?? DEFAULT_OBJECT_ID;
  const markDone = useHelpProgress((s) => s.markDone);
  const index = Math.max(0, LESSONS.findIndex((l) => l.id === current));
  const lesson = LESSONS[index]!;
  const isDone = done.includes(lesson.id);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const go = (i: number) => {
    onSelect(LESSONS[i]!.id);
    requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true });
      titleRef.current?.closest('article')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
      <nav aria-label="Уроки" className="lg:sticky lg:top-24">
        <ol className="flex flex-col gap-1.5">
          {LESSONS.map((l, i) => {
            const d = done.includes(l.id);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? 'step' : undefined}
                  data-lesson={l.id}
                  className={cn('flex w-full items-center gap-3 rounded-md border bg-surface px-3 py-2.5 text-left transition-colors', i === index ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-strong')}
                >
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-caption font-medium tabular', d ? 'bg-success-subtle text-success' : i === index ? 'bg-accent text-accent-foreground' : 'bg-surface-sunken text-text-secondary')}>
                    {d ? <Check className="size-3.5" aria-label="пройден" /> : i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-sm font-medium">{l.title}</span>
                    <span className="text-caption text-text-muted">
                      {l.block} · {l.minutes} мин{d ? ' · пройден' : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <article aria-labelledby="lesson-title" className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-surface" data-testid="lesson">
        <header className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-label text-text-muted">
              Урок {index + 1} из {LESSONS.length} · {lesson.block} · {lesson.minutes} мин
            </span>
            <h2 id="lesson-title" ref={titleRef} tabIndex={-1} className="text-h2 text-balance outline-none">
              {lesson.title}
            </h2>
            <p className="text-body-sm text-text-secondary">{lesson.lead}</p>
          </div>
          <Button variant="accent" onClick={() => startTour(lesson.id)} className="shrink-0" data-testid="lesson-tour">
            <CirclePlay aria-hidden /> Показать на сайте
          </Button>
        </header>
        <div className="flex flex-col gap-3 px-6 py-5 text-body-sm text-text-secondary">{lesson.body(objectId)}</div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-secondary px-6 py-3.5">
          {index > 0 ? (
            <Button variant="ghost" onClick={() => go(index - 1)}>
              <ArrowLeft aria-hidden /> <span className="max-w-[14rem] truncate">{LESSONS[index - 1]!.title}</span>
            </Button>
          ) : (
            <span />
          )}
          {isDone && index === LESSONS.length - 1 ? (
            <span className="flex items-center gap-1.5 text-body-sm font-medium text-success">
              <Check className="size-4" aria-hidden /> Все уроки пройдены
            </span>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                markDone(lesson.id);
                if (index < LESSONS.length - 1) go(index + 1);
              }}
            >
              {isDone ? 'Дальше' : index === LESSONS.length - 1 ? 'Понятно, завершить' : 'Понятно, дальше'}
              {index < LESSONS.length - 1 && <ArrowRight aria-hidden />}
            </Button>
          )}
        </footer>
      </article>
    </div>
  );
}

/** Вопрос FAQ: аккордеон, открыт только один; высота меняется плавно. */
function QA({ id, q, a, tag, lesson, open, onToggle, meta }: { id: string; q: string; a: string; tag?: string; lesson?: string | null; open: boolean; onToggle: () => void; meta?: string }) {
  return (
    <div id={`faq-${id}`} className={cn('scroll-mt-24 border-b border-border transition-colors duration-300 last:border-b-0', open && 'bg-surface-secondary')} data-faq={id}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={`faq-${id}-a`} onClick={onToggle} className={cn('group flex w-full items-center gap-4 px-5 py-4 text-left text-body font-medium transition-colors hover:text-accent-strong', open && 'text-accent-strong')}>
          <span className="flex flex-1 flex-col gap-0.5">
            {q}
            {meta && <span className="text-caption font-normal text-text-muted">{meta}</span>}
          </span>
          {tag && <span className="hidden shrink-0 rounded-pill bg-surface-sunken px-2.5 py-0.5 text-caption font-normal text-text-muted sm:inline">{tag}</span>}
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-300 ease-brand', open ? 'rotate-45 bg-accent text-accent-foreground' : 'bg-accent-subtle text-accent-strong')}>
            <Plus className="size-4" aria-hidden />
          </span>
        </button>
      </h3>
      <div id={`faq-${id}-a`} role="region" aria-label={q} className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-brand', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden" inert={!open}>
          <div className="flex flex-col items-start gap-3 px-5 pb-4 text-body-sm text-text-secondary">
            <p>{a}</p>
            {lesson && (
              <Button size="sm" variant="outline" onClick={() => startTour(lesson)}>
                <CirclePlay aria-hidden /> Показать на сайте
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Faq({ focusId }: { focusId: string | null }) {
  const [cat, setCat] = React.useState<FaqCategory | 'all'>('all');
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState<string | null>(focusId);
  const users = useUserQuestions((s) => s.items);
  const refresh = useUserQuestions((s) => s.refresh);
  React.useEffect(() => void refresh(), [refresh]);
  React.useEffect(() => {
    if (!focusId) return;
    setOpen(focusId);
    requestAnimationFrame(() => document.getElementById(`faq-${focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [focusId]);

  const needle = query.trim().toLocaleLowerCase('ru-RU');
  const items = FAQ.filter((f) => (cat === 'all' || f.cat === cat) && (!needle || `${f.q} ${f.a} ${f.keywords}`.toLocaleLowerCase('ru-RU').includes(needle)));
  const count = (c: string) => FAQ.filter((f) => c === 'all' || f.cat === c).length;
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h3">Спросите своими словами</h2>
          <p className="text-body-sm text-text-secondary">Помощник по сайту подберёт ответ из базы знаний и покажет нужное место на сайте. Ваш вопрос попадёт в раздел «Вопросы пользователей».</p>
        </div>
        <AskPanel />
      </section>

      <div className="flex flex-col gap-3">
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по вопросам: EAN, телеметрия, роль…" aria-label="Поиск по вопросам" leading={<Search className="size-4" aria-hidden />} className="max-w-xl" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Темы">
          {FAQ_CATEGORIES.map(([c, label]) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={cn('inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-caption transition-colors', cat === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary')}
            >
              {label}
              <span className={cn('tabular', cat === c ? 'opacity-70' : 'text-text-muted')}>{count(c)}</span>
            </button>
          ))}
        </div>
        <p role="status" className="min-h-4 text-caption text-text-muted">
          {needle || cat !== 'all' ? `Найдено: ${items.length}` : ''}
        </p>
        {items.length ? (
          <div className="overflow-hidden rounded-lg border border-border bg-surface" data-testid="faq-list">
            {items.map((f) => (
              <QA key={f.id} id={f.id} q={f.q} a={f.a} tag={catLabel(f.cat)} lesson={f.lesson ?? null} open={open === f.id} onToggle={() => toggle(f.id)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface px-5 py-6">
            <p className="text-body font-medium">Ничего не нашлось</p>
            <p className="text-body-sm text-text-secondary">Попробуйте другое слово или спросите помощника – вопрос попадёт сюда.</p>
          </div>
        )}
      </div>

      {users.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="user-questions">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-text-muted" aria-hidden />
            <h2 className="text-h3">Вопросы пользователей</h2>
          </div>
          <p className="-mt-1.5 text-body-sm text-text-secondary">Что спрашивали у помощника по сайту и какой ответ он нашёл.</p>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {users.map((u, i) => {
              const f = FAQ.find((x) => x.id === u.faqId)!;
              const id = `user-${i}`;
              return <QA key={`${u.text}-${i}`} id={id} q={u.text} a={f.a} tag={catLabel(f.cat)} lesson={f.lesson ?? null} meta={`${u.count > 1 ? `Спрашивали ${u.count} ${plural(u.count, ['раз', 'раза', 'раз'])} · ` : ''}ответ: «${f.q}»`} open={open === id} onToggle={() => toggle(id)} />;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
