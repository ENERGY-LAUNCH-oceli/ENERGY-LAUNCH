import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DEFAULT_OBJECT_ID } from '@/data/objects';
import { notify, useLaunchStore } from '@/store';
import { cn } from '@/utils/cn';
import { reducedMotion, smoothScrollTo, waitFor } from './demo';
import { useHelpProgress, useTour } from './tour-store';
import { TOURS } from './tours';

const PAD = 6;
const GAP = 14;
const EDGE = 16;
const DIM = '0 0 0 9999px rgb(6 14 28 / 0.58)';

/** Запустить урок-тур (текущий, если был, закрывается с возвратом страницы как было). */
export function startTour(id: string) {
  const cur = useTour.getState().tourId;
  if (cur) TOURS[cur]?.cleanup?.();
  if (TOURS[id]) useTour.getState().start(id);
}

/**
 * Тур поверх приложения: затемнение с «окном» вокруг элемента и карточка шага рядом с ним.
 * Модальный: подложка перехватывает клики (действия выполняет сам тур), фокус остаётся в карточке,
 * Esc закрывает, ← → листают шаги. Нет нужного элемента – карточка по центру.
 */
export function TourHost() {
  const tourId = useTour((s) => s.tourId);
  const index = useTour((s) => s.index);
  const go = useTour((s) => s.go);
  const stop = useTour((s) => s.stop);
  const markDone = useHelpProgress((s) => s.markDone);
  const tour = tourId ? TOURS[tourId] : undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const objectId = useLaunchStore((s) => s.currentObjectId) ?? DEFAULT_OBJECT_ID;

  const locRef = React.useRef(location);
  locRef.current = location;
  // Объект тура фиксируется при запуске: переключение объекта в шапке не уводит тур на другой объект
  const objRef = React.useRef(objectId);
  React.useEffect(() => {
    if (tourId) objRef.current = useLaunchStore.getState().currentObjectId ?? DEFAULT_OBJECT_ID;
  }, [tourId]);

  const targetRef = React.useRef<HTMLElement | null>(null);
  const holeRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const nextRef = React.useRef<HTMLButtonElement>(null);
  const morphUntil = React.useRef(0);
  // Готов ли текущий шаг (ключ шага, а не флаг: при смене шага «готовность» сбрасывается в том же кадре)
  const [readyKey, setReadyKey] = React.useState('');
  const ready = readyKey === `${tourId}:${index}`;
  const readyRef = React.useRef(ready);
  readyRef.current = ready;

  const finish = React.useCallback(
    (completed: boolean) => {
      const t = tourId ? TOURS[tourId] : undefined;
      stop();
      t?.cleanup?.();
      if (completed && t) {
        markDone(t.id);
        notify({ tone: 'success', title: 'Урок пройден', description: t.title });
      }
    },
    [tourId, stop, markDone],
  );

  const last = tour ? index === tour.steps.length - 1 : false;
  const next = React.useCallback(() => (last ? finish(true) : go(index + 1)), [last, finish, go, index]);
  const back = React.useCallback(() => index > 0 && go(index - 1), [go, index]);

  // Шаг: переход на страницу, действие «за пользователя», поиск элемента
  React.useEffect(() => {
    const step = tour?.steps[index];
    if (!step) return;
    const ctrl = new AbortController();
    const ctx = { objectId: objRef.current, signal: ctrl.signal };
    targetRef.current = null;
    morphUntil.current = performance.now() + 400;
    const key = `${tour?.id}:${index}`;
    void (async () => {
      if (step.route) {
        const to = step.route(ctx);
        if (locRef.current.pathname + locRef.current.search !== to) navigate(to);
      }
      try {
        await step.before?.(ctx);
      } catch (e) {
        console.error('[tour] шаг не выполнен', e);
      }
      const el = step.target ? await waitFor(step.target, ctrl.signal, step.route ? 6000 : 2500) : null;
      if (ctrl.signal.aborted) return;
      targetRef.current = el;
      // Пока страница едет к блоку, «окно» плавно догоняет его, а карточка скрыта – не прыгает по краям
      morphUntil.current = Number.POSITIVE_INFINITY;
      if (el) await smoothScrollTo(el, ctrl.signal);
      if (ctrl.signal.aborted) return;
      morphUntil.current = performance.now() + 360;
      setReadyKey(key);
      nextRef.current?.focus({ preventScroll: true });
    })();
    return () => ctrl.abort();
  }, [tour, index, navigate]);

  // Положение «окна» и карточки – каждый кадр: элемент может сдвинуться (прокрутка, анимация окна)
  React.useEffect(() => {
    if (!tour) return;
    let raf = 0;
    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
    const frame = () => {
      const hole = holeRef.current;
      const card = cardRef.current;
      if (hole && card) {
        const vw = document.documentElement.clientWidth;
        const vh = window.innerHeight;
        const cw = card.offsetWidth;
        const ch = card.offsetHeight;
        const el = targetRef.current;
        let left: number;
        let top: number;
        if (el?.isConnected && el.getClientRects().length) {
          const r = el.getBoundingClientRect();
          Object.assign(hole.style, { left: `${r.left - PAD}px`, top: `${r.top - PAD}px`, width: `${r.width + PAD * 2}px`, height: `${r.height + PAD * 2}px`, opacity: '1' });
          // Карточка справа от элемента, иначе снизу, сверху, слева; не помещается – внизу экрана
          if (r.right + GAP + cw <= vw - EDGE) [left, top] = [r.right + GAP, r.top];
          else if (r.bottom + GAP + ch <= vh - EDGE) [left, top] = [r.left, r.bottom + GAP];
          else if (r.top - GAP - ch >= EDGE) [left, top] = [r.left, r.top - GAP - ch];
          else if (r.left - GAP - cw >= EDGE) [left, top] = [r.left - GAP - cw, r.top];
          else [left, top] = [(vw - cw) / 2, vh - ch - EDGE];
        } else {
          // Без элемента «окно» схлопывается в центр – затемнение на весь экран
          Object.assign(hole.style, { left: `${vw / 2}px`, top: `${vh / 2}px`, width: '0px', height: '0px', opacity: '1' });
          [left, top] = [(vw - cw) / 2, (vh - ch) / 2];
        }
        hole.style.transition = performance.now() < morphUntil.current && !reducedMotion() ? 'left 320ms cubic-bezier(.2,.7,.2,1), top 320ms cubic-bezier(.2,.7,.2,1), width 320ms cubic-bezier(.2,.7,.2,1), height 320ms cubic-bezier(.2,.7,.2,1)' : 'none';
        // Карточка встаёт на место, когда блок доехал; во время прокрутки – скрыта (иначе мечется между сторонами)
        const shown = readyRef.current;
        if (shown) {
          card.style.left = `${clamp(left, EDGE, vw - cw - EDGE)}px`;
          card.style.top = `${clamp(top, EDGE, vh - ch - EDGE)}px`;
        }
        card.style.opacity = shown ? '1' : '0';
        card.style.transform = shown || reducedMotion() ? 'none' : 'translateY(6px)';
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tour]);

  // Клавиатура: перехват до окон приложения (Esc закрывает тур, а не форму под ним)
  React.useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      const swallow = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'Escape') {
        swallow();
        finish(false);
      } else if (e.key === 'ArrowRight') {
        swallow();
        next();
      } else if (e.key === 'ArrowLeft') {
        swallow();
        back();
      } else if (e.key === 'Tab') {
        const items = [...(cardRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
        if (!items.length) return;
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        swallow();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tour, finish, next, back]);

  if (!tour) return null;
  const step = tour.steps[index];
  if (!step) return null;

  return createPortal(
    <div data-tour-ui="" data-testid="tour">
      {/* Подложка перехватывает клики: страницу в туре «нажимает» сам тур */}
      <div aria-hidden className="fixed inset-0 z-[200]" style={{ pointerEvents: 'auto' }} onClick={() => nextRef.current?.focus()} />
      <div ref={holeRef} aria-hidden className="pointer-events-none fixed z-[201] rounded-lg outline outline-2 outline-offset-2 outline-accent" style={{ boxShadow: DIM, left: '50%', top: '50%', width: 0, height: 0 }} />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        data-tour-ui=""
        data-testid="tour-card"
        data-step={index}
        className="fixed z-[202] max-h-[calc(100dvh-2rem)] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-lg transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
        style={{ pointerEvents: 'auto', left: -9999, top: -9999, opacity: 0 }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="pt-1 text-label text-accent-strong">
              Шаг {index + 1} из {tour.steps.length}
              <span className="sr-only"> · {tour.title}</span>
            </span>
            <button type="button" onClick={() => finish(false)} aria-label="Закрыть обучение" title="Закрыть (Esc)" className="-mr-1.5 -mt-1 inline-flex size-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {/* Анимируется только текст шага: кнопки не пересоздаются (иначе окно под туром приняло бы щелчок за внешний) */}
          <div key={`${tour.id}-${index}`} className="flex flex-col gap-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-1">
            <h2 id="tour-title" className="text-h3 text-balance">
              {step.title}
            </h2>
            <p id="tour-text" className="text-body-sm text-text-secondary">
              {step.text}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="flex flex-wrap gap-1" aria-hidden>
              {tour.steps.map((_, i) => (
                <i key={i} className={cn('size-1.5 rounded-full transition-colors', i <= index ? 'bg-accent' : 'bg-border-strong', i === index && !ready && 'animate-pulse')} />
              ))}
            </span>
            <span className="flex gap-2">
              {index > 0 && (
                <Button size="sm" variant="secondary" onClick={back}>
                  Назад
                </Button>
              )}
              <Button ref={nextRef} size="sm" variant="accent" onClick={next} data-testid="tour-next">
                {last ? 'Готово' : 'Далее'}
              </Button>
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
