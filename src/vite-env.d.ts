/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string

  // Native TRIX channel endpoints
  readonly VITE_TRIX_NATIVE_SERVER_URL?: string
  readonly VITE_TRIX_NATIVE_PUBLIC_URL?: string

  // Server-side OSS upload flag (default true)
  readonly VITE_USE_SERVER_OSS_UPLOAD?: string

  // Aliyun OSS browser upload variables (legacy direct-upload path)
  readonly VITE_ALIYUN_OSS_REGION?: string
  readonly VITE_ALIYUN_OSS_BUCKET?: string
  readonly VITE_ALIYUN_OSS_ACCESS_KEY_ID?: string
  readonly VITE_ALIYUN_OSS_ACCESS_KEY_SECRET?: string
  readonly VITE_ALIYUN_OSS_ENDPOINT?: string

  // Deprecated legacy endpoint variable; kept for compatibility
  readonly VITE_OSS_ENDPOINT?: string
  readonly VITE_TTS_PROXY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
