import { create } from 'zustand';
import { env } from '@/config/env';
import { apiRequest, ApiError } from '@/services/server-storage';
import type { DemoRole } from '@/types';

/** Роли учётных записей (сервер, server/auth.ts). */
export const ACCOUNT_ROLES = ['ADMIN', 'LAUNCH_ENGINEER', 'OPERATOR', 'ACCEPTANCE_OFFICER'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_ROLE_TITLE: Record<AccountRole, string> = {
  ADMIN: 'Администратор',
  LAUNCH_ENGINEER: 'Инженер запуска',
  OPERATOR: 'Оператор',
  ACCEPTANCE_OFFICER: 'Ответственный за приёмку',
};

/** Права в приложении: администратор работает с запуском как инженер запуска. */
export const appRole = (r: AccountRole): DemoRole => (r === 'ADMIN' ? 'LAUNCH_ENGINEER' : r);

export interface Account {
  id: number;
  login: string;
  name: string;
  role: AccountRole;
}

/**
 * Состояние входа. off – вход не используется (нет сервера или режим «браузер»): приложение работает с демо-ролями, как раньше.
 * setup – сотрудников ещё нет, создаётся администратор; login – нужен вход; ready – сотрудник вошёл.
 */
interface AuthState {
  status: 'loading' | 'off' | 'setup' | 'login' | 'ready';
  user: Account | null;
  /** Сервер требует вход для всего сайта (AUTH_REQUIRED=1); иначе – демо-режим, вход в личный кабинет по желанию. */
  required: boolean;
  check(): Promise<void>;
  login(login: string, password: string): Promise<void>;
  setup(input: { login: string; name: string; password: string }): Promise<void>;
  logout(): Promise<void>;
}

const post = <T,>(path: string, body: unknown) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const useAuth = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,
  required: false,
  check: async () => {
    if (env.storage === 'browser') return set({ status: 'off', user: null });
    try {
      const r = await apiRequest<{ user: Account | null; setup: boolean; required?: boolean }>('/auth/me');
      set({ ...(r.user ? { status: 'ready', user: r.user } : { status: r.setup ? 'setup' : 'login', user: null }), required: !!r.required });
    } catch (e) {
      // Сервера нет (или старая версия без входа) – работаем, как раньше
      set({ status: e instanceof ApiError && e.status === 401 ? 'login' : 'off', user: null, required: e instanceof ApiError && e.status === 401 });
    }
  },
  login: async (login, password) => {
    const r = await post<{ user: Account }>('/auth/login', { login, password });
    set({ status: 'ready', user: r.user });
  },
  setup: async (input) => {
    const r = await post<{ user: Account }>('/auth/setup', input);
    set({ status: 'ready', user: r.user });
  },
  logout: async () => {
    await post('/auth/logout', {}).catch(() => {});
    // Состояние приложения в памяти принадлежит вышедшему сотруднику – начисто
    window.location.assign('/');
  },
}));

export const authApi = {
  changePassword: (current: string, next: string) => post<void>('/auth/password', { current, next }),
  myStats: () => apiRequest<MyStats>('/me/stats'),
  users: () => apiRequest<{ users: AdminUser[]; summary: AdminSummary }>('/admin/users'),
  createUser: (u: { login: string; name: string; role: AccountRole; password: string }) => post<{ user: Account }>('/admin/users', u),
  updateUser: (id: number, patch: { disabled?: boolean; role?: AccountRole; password?: string }) => apiRequest<{ user: Account }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
};

export interface MyStats {
  actions: number;
  actions_7d: number;
  objects: number;
  last_action_at: string | null;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  recent: { id: string; action: string; timestamp: string; objectId?: string; stageId?: string }[];
  byAction: { action: string; n: number }[];
}

export interface AdminUser extends Account {
  disabled: boolean;
  created_at: string;
  created_by: string | null;
  last_login_at: string | null;
  login_count: number;
  actions: number;
  actions_7d: number;
  objects: number;
  last_action_at: string | null;
}

export interface AdminSummary {
  users: number;
  disabled: number;
  active_7d: number;
  sessions: number;
  actions_24h: number;
}
