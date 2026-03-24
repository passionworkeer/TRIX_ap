import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// 每个测试后清理
afterEach(() => {
  cleanup()
})

// Mock HTMLCanvasElement.getContext and requestAnimationFrame for happy-dom
if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      globalAlpha: 1,
    })),
    writable: true,
  })
}

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  return setTimeout(() => cb(Date.now()), 16) as unknown as number
})
globalThis.cancelAnimationFrame = vi.fn((id: number) => {
  clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
})

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      session: () => ({ data: { session: null } })
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn()
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
      subscribe: vi.fn(),
      unsubscribe: vi.fn()
    }))
  }))
}))

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({})
  }
})

// Mock environment variables
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'
