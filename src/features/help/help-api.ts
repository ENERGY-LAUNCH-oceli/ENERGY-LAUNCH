import { create } from 'zustand';
import { answer } from '@/help/agent';
import { FAQ } from '@/help/knowledge';
import { apiRequest, useStorageStatus } from '@/services/server-storage';

/** Ответ помощника по сайту – с сервера (вопрос сохраняется и попадает в FAQ) или, без сервера, из той же базы в браузере. */
export interface HelpReply {
  answer: { id: string; q: string; a: string; lesson: string | null; confidence: number } | null;
  alternatives: { id: string; q: string; a: string; lesson: string | null; confidence: number }[];
  /** Вопрос сохранён на сервере. */
  saved: boolean;
  /** Вопрос появится в разделе «Вопросы пользователей». */
  published: boolean;
}

export interface UserQuestion {
  text: string;
  faqId: string;
  count: number;
  lastAskedAt: string;
}

const server = () => useStorageStatus.getState().mode === 'server';

function local(question: string): HelpReply {
  const r = answer(question);
  const pick = (m: (typeof r.alternatives)[number]) => ({ id: m.item.id, q: m.item.q, a: m.item.a, lesson: m.item.lesson ?? null, confidence: m.confidence });
  return { answer: r.best ? pick(r.best) : null, alternatives: r.alternatives.map(pick), saved: false, published: false };
}

export async function askHelp(question: string): Promise<HelpReply> {
  if (!server()) return local(question);
  try {
    const reply = await apiRequest<HelpReply>('/help/ask', { method: 'POST', body: JSON.stringify({ question }) });
    if (reply.published) void useUserQuestions.getState().refresh();
    return reply;
  } catch (e) {
    console.error('[help] сервер не ответил, ответ подобран в браузере', e);
    return local(question);
  }
}

/** Вопросы пользователей (с найденным ответом) – раздел FAQ. Без сервера – пусто. */
export const useUserQuestions = create<{ items: UserQuestion[]; loaded: boolean; refresh(): Promise<void> }>()((set) => ({
  items: [],
  loaded: false,
  refresh: async () => {
    if (!server()) return set({ items: [], loaded: true });
    try {
      const { questions } = await apiRequest<{ questions: UserQuestion[] }>('/help/questions');
      set({ items: questions.filter((q) => FAQ.some((f) => f.id === q.faqId)), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));

/** Окно «Помощь по сайту» (открывается из контекстного меню). */
export const useHelpDialog = create<{ open: boolean; question: string; show(question?: string): void; hide(): void }>()((set) => ({
  open: false,
  question: '',
  show: (question = '') => set({ open: true, question }),
  hide: () => set({ open: false }),
}));
