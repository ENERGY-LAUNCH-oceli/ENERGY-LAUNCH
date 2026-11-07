import * as React from 'react';
import { CirclePlay, LoaderCircle, MessageCircleQuestion, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { startTour } from '@/features/tour/TourHost';
import { cn } from '@/utils/cn';
import { askHelp, type HelpReply } from './help-api';

const HINTS = ['Как создать новый объект?', 'Какой EAN вводить?', 'Почему этап заблокирован?', 'Где хранятся данные?'];

/**
 * Вопрос помощнику по сайту: поле ввода и ответ из базы знаний.
 * Текст вопроса – только данные для поиска ответа: помощник не выполняет действий и не меняет статусы.
 */
export function AskPanel({ initial = '', autoFocus = false, onAction, className }: { initial?: string; autoFocus?: boolean; onAction?: () => void; className?: string }) {
  const [question, setQuestion] = React.useState(initial);
  const [asked, setAsked] = React.useState('');
  const [reply, setReply] = React.useState<HelpReply | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [openAlt, setOpenAlt] = React.useState<string | null>(null);

  const ask = async (q = question) => {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setOpenAlt(null);
    try {
      setReply(await askHelp(text));
      setAsked(text);
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (initial.trim().length >= 3) void ask(initial);
    // Только при открытии с готовым вопросом
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tour = (lesson: string | null) =>
    lesson && (
      <Button
        size="sm"
        variant="accent"
        onClick={() => {
          onAction?.();
          startTour(lesson);
        }}
      >
        <CirclePlay aria-hidden /> Показать на сайте
      </Button>
    );

  return (
    <div className={cn('flex flex-col gap-4', className)} data-testid="help-ask">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Например: как добавить новый завод?"
          aria-label="Ваш вопрос"
          maxLength={300}
          autoFocus={autoFocus}
          leading={<MessageCircleQuestion className="size-4" aria-hidden />}
          data-testid="help-question"
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy || question.trim().length < 3} data-testid="help-submit">
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          Спросить
        </Button>
      </form>

      {!reply && (
        <div className="flex flex-wrap gap-1.5" aria-label="Примеры вопросов">
          {HINTS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                setQuestion(h);
                void ask(h);
              }}
              className="rounded-pill border border-border bg-surface px-3 py-1 text-caption text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {reply && (
        <div role="status" aria-live="polite" className="flex flex-col gap-3" data-testid="help-reply" data-answer={reply.answer?.id ?? ''}>
          {reply.answer ? (
            <section className="flex flex-col gap-2 rounded-lg border border-accent/35 bg-accent-subtle px-4 py-3.5">
              <span className="text-label text-accent-strong">Ответ</span>
              <h3 className="text-h3 text-balance">{reply.answer.q}</h3>
              <p className="text-body-sm text-text-primary">{reply.answer.a}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {tour(reply.answer.lesson)}
                <Button asChild size="sm" variant="secondary">
                  <Link to={`/help?tab=faq&q=${encodeURIComponent(reply.answer.id)}`} onClick={onAction}>
                    Открыть в FAQ
                  </Link>
                </Button>
              </div>
            </section>
          ) : (
            <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface-secondary px-4 py-3.5">
              <h3 className="text-h3">Пока не знаю точного ответа</h3>
              <p className="text-body-sm text-text-secondary">
                {reply.saved ? 'Вопрос сохранён – команда добавит ответ в FAQ. ' : ''}Попробуйте сформулировать иначе{reply.alternatives.length ? ' или посмотрите похожие вопросы:' : '.'}
              </p>
            </section>
          )}

          {reply.alternatives.length > 0 && (
            <div className="flex flex-col gap-1">
              {reply.answer && <span className="text-label text-text-muted">Похожие вопросы</span>}
              {reply.alternatives.map((alt) => (
                <div key={alt.id} className="rounded-md border border-border">
                  <button type="button" aria-expanded={openAlt === alt.id} onClick={() => setOpenAlt(openAlt === alt.id ? null : alt.id)} className="w-full px-3 py-2 text-left text-body-sm font-medium hover:text-accent-strong">
                    {alt.q}
                  </button>
                  {openAlt === alt.id && (
                    <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
                      <p className="text-body-sm text-text-secondary">{alt.a}</p>
                      {tour(alt.lesson)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-caption text-text-muted">
            {reply.published
              ? `Вопрос «${asked}» добавлен в FAQ, в раздел «Вопросы пользователей». `
              : reply.saved && reply.answer
                ? 'Вопрос сохранён. '
                : !reply.saved
                  ? 'Сервер помощника недоступен – ответ подобран в браузере, вопрос не сохранён. '
                  : ''}
            Помощник по сайту подбирает ответы из базы знаний на сервере – без внешних ИИ-сервисов.
          </p>
        </div>
      )}
    </div>
  );
}
