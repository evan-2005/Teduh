/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_AI?: string;
  readonly VITE_DATASET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
