/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string

  // Native TRIX channel endpoints
  readonly VITE_TRIX_NATIVE_SERVER_URL?: string
  readonly VITE_TRIX_NATIVE_PUBLIC_URL?: string

  // Server-side OSS upload flag (default true)
  readonly VITE_USE_SERVER_OSS_UPLOAD?: string

  // Deprecated legacy upload endpoint variable; kept for compatibility
  readonly VITE_OSS_ENDPOINT?: string
  readonly VITE_TTS_PROXY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
