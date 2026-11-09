import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/jetbrains-mono';
import { App } from '@/app/App';
import '@/app/styles.css';
import { initI18n } from '@/i18n';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

// Страница «Нет подключения» при обновлении без сети (/sw.js). Только рабочая сборка: в dev и e2e не мешает перезагрузкам и тестам
if (import.meta.env.PROD && import.meta.env.MODE !== 'e2e' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// Язык – до первой отрисовки: английский перевод подключается раньше, чем React выведет русский текст
void initI18n().finally(() =>
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
