/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GATEWAY_WS_URL?: string
  readonly VITE_GATEWAY_AUTH_TOKEN?: string
  readonly VITE_PC_WEBSOCKET_URL?: string   // 旧变量，已被 VITE_GATEWAY_WS_URL 取代
  readonly VITE_PC_AUTH_TOKEN?: string      // 旧变量，已被 VITE_GATEWAY_AUTH_TOKEN 取代
  readonly VITE_CLAWBOT_CHANNEL_URL?: string
  readonly VITE_OSS_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
