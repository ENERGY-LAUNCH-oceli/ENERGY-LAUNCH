import * as React from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, UploadCloud, ClipboardList, Copy, Download, ExternalLink, FileText, GraduationCap, Link2, Maximize, Minimize, Moon, PanelLeft, Printer, RotateCw, Rocket, Settings, Sun } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { findObject } from '@/data/objects';
import { useDrop } from '@/features/drop/drop-store';
import { useHelpDialog } from '@/features/help/help-api';
import { startTour } from '@/features/tour/TourHost';
import { tourForPath } from '@/features/tour/tours';
import { notify, useUi } from '@/store';
import { cn } from '@/utils/cn';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}
type Group = MenuItem[];

interface Target {
  x: number;
  y: number;
  objectId?: string;
  href?: string;
  selection?: string;
}

/** Поля ввода и редактируемый текст – родное меню браузера (вставка, орфография). */
const nativeTarget = (el: Element | null) => !!el?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-native-context]');

const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Снимок страницы: разметка с текущим состоянием и стили приложения (без скриптов). */
const savePage = () => {
  const doc = document.documentElement.cloneNode(true) as HTMLElement;
  doc.querySelectorAll('script, [data-testid="app-context-menu"]').forEach((n) => n.remove());
  const css = [...document.styleSheets].map((sh) => {
    try {
      return [...sh.cssRules].map((r) => r.cssText).join('\n');
    } catch {
      return '';
    }
  });
  doc.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => n.remove());
  doc.querySelector('head')?.insertAdjacentHTML('beforeend', `<style>${css.join('\n')}</style>`);
  const name = (document.title || 'energy-launch').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  download(`${name}.html`, `<!doctype html>\n${doc.outerHTML}`, 'text/html');
};

const toggleFullscreen = () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

const copy = (text: string, what: string) => {
  void navigator.clipboard?.writeText(text).then(
    () => notify({ tone: 'success', title: `${what} скопировано` }),
    () => notify({ tone: 'warning', title: 'Не удалось скопировать', description: 'Браузер запретил доступ к буферу обмена' }),
  );
};

/**
 * Контекстное меню приложения вместо меню браузера: действия зависят от места клика
 * (объект, ссылка, выделенный текст). Shift + правая кнопка – меню браузера.
 */
export function AppContextMenu() {
  const [target, setTarget] = React.useState<Target | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);

  const close = React.useCallback(() => {
    setTarget(null);
    setPos(null);
  }, []);

  React.useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (e.shiftKey || nativeTarget(el)) return close();
      e.preventDefault();
      const link = el?.closest<HTMLAnchorElement>('a[href]');
      const href = link && link.origin === location.origin ? link.pathname + link.search : undefined;
      const objectId = el?.closest<HTMLElement>('[data-object-id]')?.dataset.objectId ?? (href ? /^\/objects\/([^/?]+)/.exec(href)?.[1] : undefined);
      const selection = window.getSelection()?.toString().trim() || undefined;
      setPos(null);
      setTarget({ x: e.clientX, y: e.clientY, ...(objectId && findObject(objectId) ? { objectId } : {}), ...(href ? { href } : {}), ...(selection ? { selection } : {}) });
    };
    document.addEventListener('contextmenu', onContext);
    return () => document.removeEventListener('contextmenu', onContext);
  }, [close]);

  // Закрыть по клику вне меню, Esc, прокрутке, изменению размера и смене страницы
  React.useEffect(() => {
    if (!target) return;
    const onDown = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    // Прокрутка самого меню (на невысоком экране оно прокручивается) не закрывает его
    const onScroll = (e: Event) => !menuRef.current?.contains(e.target as Node) && close();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [target, close]);
  React.useEffect(close, [pathname, close]);

  // Позиция: у курсора, не выходя за край окна; фокус на первый пункт
  React.useLayoutEffect(() => {
    if (!target || !menuRef.current) return;
    // offsetWidth/Height – без масштаба анимации появления
    const { offsetWidth: width, offsetHeight: height } = menuRef.current;
    const pad = 8;
    setPos({
      left: Math.max(pad, target.x + width + pad > innerWidth ? target.x - width : target.x),
      top: Math.max(pad, target.y + height + pad > innerHeight ? Math.max(pad, innerHeight - height - pad) : target.y),
    });
  }, [target]);
  // Фокус – когда меню уже видно (на скрытом элементе фокус не ставится)
  React.useEffect(() => {
    if (pos) menuRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not([disabled])')?.focus({ preventScroll: true });
  }, [pos]);

  if (!target) return null;
  const entry = target.objectId ? findObject(target.objectId) : undefined;
  const go = (to: string) => navigate(to);

  const groups: Group[] = [];
  if (entry) {
    groups.push([
      { id: 'launch', label: 'Карточка запуска', icon: Rocket, run: () => go(ROUTES.objectSection(entry.id, 'launch')) },
      { id: 'passport', label: 'Паспорт объекта', icon: FileText, run: () => go(ROUTES.object(entry.id)) },
      { id: 'audit', label: 'Журнал объекта', icon: ClipboardList, run: () => go(ROUTES.objectSection(entry.id, 'audit')) },
      { id: 'copy-code', label: `Копировать код ${entry.code}`, icon: Copy, run: () => copy(entry.code, 'Код объекта') },
      ...(entry.inputs?.passport || entry.ean.offtake
        ? [{ id: 'export-passport', label: 'Сохранить паспорт (JSON)', icon: Download, run: () => download(`${entry.code}.passport.json`, JSON.stringify({ id: entry.id, code: entry.code, name: entry.name, address: entry.address, kind: entry.kind, responsible: entry.responsible, ean: entry.ean, equipment: entry.equipment, passport: entry.inputs?.passport ?? null }, null, 2), 'application/json') }]
        : []),
    ]);
  }
  if (target.href) {
    groups.push([
      { id: 'open-tab', label: 'Открыть в новой вкладке', icon: ExternalLink, run: () => window.open(target.href, '_blank', 'noopener') },
      { id: 'copy-link', label: 'Копировать ссылку', icon: Link2, run: () => copy(location.origin + target.href, 'Ссылка') },
    ]);
  }
  if (target.selection) groups.push([{ id: 'copy', label: 'Копировать', icon: Copy, shortcut: 'Ctrl+C', run: () => copy(target.selection!, 'Текст') }]);
  groups.push([
    { id: 'back', label: 'Назад', icon: ArrowLeft, shortcut: 'Alt+←', disabled: (history.state?.idx ?? 1) === 0, run: () => navigate(-1) },
    { id: 'forward', label: 'Вперёд', icon: ArrowRight, shortcut: 'Alt+→', run: () => navigate(1) },
    { id: 'reload', label: 'Перезагрузить', icon: RotateCw, shortcut: 'Ctrl+R', run: () => location.reload() },
  ]);
  groups.push([
    { id: 'save', label: 'Сохранить страницу как…', icon: Download, run: savePage },
    { id: 'print', label: 'Печать…', icon: Printer, shortcut: 'Ctrl+P', run: () => window.print() },
    { id: 'fullscreen', label: document.fullscreenElement ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим', icon: document.fullscreenElement ? Minimize : Maximize, shortcut: 'F11', run: toggleFullscreen },
  ]);
  groups.push([
    { id: 'page-tab', label: 'Открыть страницу в новой вкладке', icon: ExternalLink, run: () => window.open(location.href, '_blank', 'noopener') },
    { id: 'page-link', label: 'Копировать адрес страницы', icon: Link2, run: () => copy(location.href, 'Адрес страницы') },
  ]);
  // Помощь: тур по текущей странице и вопрос помощнику по сайту (выделенный текст подставляется в вопрос)
  const lesson = tourForPath(pathname);
  groups.push([
    lesson
      ? { id: 'tour-here', label: 'Обучение: как работает эта страница', icon: GraduationCap, run: () => startTour(lesson) }
      : { id: 'tour-here', label: 'Обучение', icon: GraduationCap, run: () => go(ROUTES.help) },
    { id: 'upload', label: 'Загрузить файлы…', icon: UploadCloud, run: () => useDrop.getState().pick() },
    { id: 'help', label: 'Помощь: задать вопрос…', icon: CircleHelp, run: () => useHelpDialog.getState().show(target.selection && target.selection.length <= 200 ? target.selection : '') },
  ]);
  groups.push([
    { id: 'sidebar', label: collapsed ? 'Развернуть навигацию' : 'Свернуть навигацию', icon: PanelLeft, shortcut: 'Ctrl+B', run: toggleSidebar },
    { id: 'theme', label: theme === 'dark' ? 'Светлая тема' : 'Тёмная тема', icon: theme === 'dark' ? Sun : Moon, run: toggleTheme },
    { id: 'settings', label: 'Настройки', icon: Settings, run: () => go(ROUTES.settings) },
  ]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={entry ? `Действия: ${entry.name}` : 'Действия'}
      data-testid="app-context-menu"
      onKeyDown={onMenuKey}
      onContextMenu={(e) => e.preventDefault()}
      style={pos ?? { left: target.x, top: target.y, visibility: 'hidden' }}
      className="fixed z-[80] max-h-[calc(100dvh-1rem)] w-[19rem] overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface py-1.5 shadow-lg [scrollbar-width:thin] animate-in fade-in-0 zoom-in-95"
    >
      {entry && <div className="truncate px-4 pb-1.5 pt-1.5 text-label text-text-muted">{entry.name}</div>}
      {groups.map((g, gi) => (
        <div key={g[0]!.id} className={cn('px-1.5', gi > 0 && 'mt-1.5 border-t border-border pt-1.5')} role="group">
          {g.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close();
                item.run();
              }}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-body-sm outline-none transition-colors hover:bg-surface-hover focus:bg-surface-hover focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-45"
            >
              {item.icon && <item.icon className="size-4 shrink-0 text-text-muted" />}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.shortcut && <span className="shrink-0 pl-4 text-caption text-text-muted">{item.shortcut}</span>}
            </button>
          ))}
        </div>
      ))}
      <div className="mt-1.5 border-t border-border px-4 pb-0.5 pt-2 text-caption text-text-muted">Shift + правая кнопка – меню браузера</div>
    </div>
  );
}
