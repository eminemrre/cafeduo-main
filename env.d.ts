/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_APP_VERSION: string
  readonly VITE_BUILD_TIME: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
