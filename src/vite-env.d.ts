/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string

  // Canonical Clawbot endpoint variables (recommended)
  readonly VITE_CLAWBOT_CHANNEL_URL?: string
  readonly VITE_GATEWAY_WS_URL?: string
  readonly VITE_GATEWAY_AUTH_TOKEN?: string

  // Legacy compatibility variables
  readonly VITE_CLAWBOT_GATEWAY_URL?: string
  readonly VITE_CLAWBOT_GATEWAY_TOKEN?: string
  readonly VITE_PC_WEBSOCKET_URL?: string
  readonly VITE_PC_AUTH_TOKEN?: string

  readonly VITE_OSS_ENDPOINT?: string
  readonly VITE_TTS_PROXY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
