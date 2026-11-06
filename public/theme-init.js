// Тема до загрузки приложения, чтобы не было вспышки: по умолчанию светлая.
// Отдельный файл, а не встроенный скрипт: строгая Content-Security-Policy (script-src 'self').
try {
  if (localStorage.getItem('el.theme') === 'dark') document.documentElement.dataset.theme = 'dark';
  if (localStorage.getItem('el.accent') === 'blue') document.documentElement.dataset.accent = 'blue';
} catch (e) {}
