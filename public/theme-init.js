// Тема до загрузки приложения, чтобы не было вспышки: по умолчанию светлая.
// Отдельный файл, а не встроенный скрипт: строгая Content-Security-Policy (script-src 'self').
try {
  if (localStorage.getItem('el.theme') === 'dark') document.documentElement.dataset.theme = 'dark';
  if (localStorage.getItem('el.accent') === 'blue') document.documentElement.dataset.accent = 'blue';
  // Английский: страница скрыта, пока не загрузится словарь (иначе мелькнул бы русский текст)
  if (localStorage.getItem('el.lang') === 'en') {
    document.documentElement.lang = 'en';
    document.documentElement.classList.add('i18n-loading');
  }
} catch (e) {}
