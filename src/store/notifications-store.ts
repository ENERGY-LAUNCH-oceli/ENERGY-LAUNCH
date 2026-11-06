import { create } from 'zustand';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  description?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationsState {
  items: AppNotification[];
  /** Всплывающие уведомления (тосты), которые сейчас на экране. */
  toasts: string[];
  push(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void;
  dismissToast(id: string): void;
  markAllRead(): void;
  clear(): void;
}

let seq = 0;

export const useNotifications = create<NotificationsState>()((set) => ({
  items: [],
  toasts: [],
  push: (n) => {
    const id = `n-${Date.now()}-${++seq}`;
    set((s) => ({ items: [{ ...n, id, createdAt: new Date().toISOString(), read: false }, ...s.items].slice(0, 50), toasts: [...s.toasts, id].slice(-3) }));
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t !== id) })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
  clear: () => set({ items: [], toasts: [] }),
}));

export const notify = (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => useNotifications.getState().push(n);
