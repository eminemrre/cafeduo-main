/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  // daha fazla env variable...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
