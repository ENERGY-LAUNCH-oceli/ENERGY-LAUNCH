/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_DB_NAME?: string;
  readonly VITE_RULESET_VERSION?: string;
  readonly VITE_DEBUG_STATE_MACHINE?: string;
  readonly VITE_STORAGE?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
