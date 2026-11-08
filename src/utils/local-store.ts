/**
 * Браузерное хранилище для удобств интерфейса (тема, роль, свёрнутая панель, пройденные уроки, замеры).
 * В приватном режиме или при запрете хранилища `localStorage` бросает исключение: чтение тогда возвращает
 * значение по умолчанию, запись пропускается – значение живёт до перезагрузки страницы. Данные запуска здесь не хранятся.
 */
export const localStore = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* хранилище недоступно */
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* хранилище недоступно */
    }
  },

  /** JSON по ключу; повреждённое или не прошедшее проверку значение – `fallback`. */
  getJson<T>(key: string, fallback: T, guard: (v: unknown) => v is T = (v): v is T => v !== null && v !== undefined): T {
    const raw = this.get(key);
    if (raw === null) return fallback;
    try {
      const v: unknown = JSON.parse(raw);
      return guard(v) ? v : fallback;
    } catch {
      return fallback;
    }
  },

  setJson(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  },
};
