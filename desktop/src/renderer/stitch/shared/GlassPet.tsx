/**
 * GlassPet.tsx — Full KKClaw expression system
 * 14 moods, 42 expressions, time-aware idle micro-expressions, tone detection
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { BotState } from '../../../types/electron';
import {
  MOODS,
  MOOD_ACCENTS,
  MOOD_DEFAULT_EXPRESSION,
  EXPRESSIONS,
  buildActionPools,
  SCENE_WEIGHTS,
  TONE_TO_POOL,
  detectTone,
  getTimeScene,
  type MoodName,
  type ExpressionName,
  type IdleActionContext,
} from './expressions';

// ── BotState → MoodName mapping ───────────────────────────────────────────────

function botStateToMood(state: BotState): MoodName {
  switch (state) {
    case 'THINKING': return 'thinking';
    case 'SPEAKING': return 'talking';
    default:         return 'idle';
  }
}

// ── Weighted random pick ─────────────────────────────────────────────────────

function weightedRandom<T extends string | number | symbol>(weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (entries.length === 0) throw new Error('weightedRandom: empty weights');
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1]![0];
}

// ── useExpressionEngine ──────────────────────────────────────────────────────

interface ExpressionEngine {
  mood: MoodName;
  expr: ExpressionName;
  scale: number;
  blush: number;
  blobOpacity: number;
}

function useExpressionEngine(initialMood: MoodName = 'idle') {
  const [engine, setEngine] = useState<ExpressionEngine>({
    mood: initialMood,
    expr: MOOD_DEFAULT_EXPRESSION[initialMood],
    scale: MOODS[initialMood].scale,
    blush: 0,
    blobOpacity: MOODS[initialMood].opacity ?? 1,
  });

  // Stable ref so idle scheduler closures always see current values
  const engineRef = useRef(engine);
  useEffect(() => { engineRef.current = engine; }, [engine]);

  const applyExpr = useCallback((name: ExpressionName) => {
    setEngine(prev => ({ ...prev, expr: name }));
  }, []);

  const resetExpr = useCallback(() => {
    setEngine(prev => ({ ...prev, expr: MOOD_DEFAULT_EXPRESSION[prev.mood] }));
  }, []);

  const setScale = useCallback((s: number) => {
    setEngine(prev => ({ ...prev, scale: s }));
  }, []);

  const getScale = useCallback(() => engineRef.current.scale, []);

  const setBlush = useCallback((intensity: number) => {
    setEngine(prev => ({ ...prev, blush: Math.max(0, Math.min(1, intensity)) }));
  }, []);

  const clearBlush = useCallback(() => {
    setEngine(prev => ({ ...prev, blush: 0 }));
  }, []);

  const setBlobOpacity = useCallback((v: number) => {
    setEngine(prev => ({ ...prev, blobOpacity: Math.max(0, Math.min(1, v)) }));
  }, []);

  // Update mood whenever it changes externally
  useEffect(() => {
    const cfg = MOODS[initialMood];
    setEngine(prev => ({
      ...prev,
      mood: initialMood,
      expr: MOOD_DEFAULT_EXPRESSION[initialMood],
      scale: cfg.scale,
      blush: 0,
      blobOpacity: cfg.opacity ?? 1,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMood]);

  // ── Idle micro-expression scheduler ─────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNextIdle = useCallback((currentMood: MoodName, tone?: string) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    const scene = getTimeScene();
    const ctx: IdleActionContext = { applyExpr, resetExpr, setScale, getScale, setBlush, clearBlush, setBlobOpacity };
    const pools = buildActionPools(ctx);

    // Determine which pool to pick from
    let poolName: keyof typeof pools;
    if (tone) {
      const tonePool = TONE_TO_POOL[detectTone(tone)];
      if (tonePool) {
        poolName = tonePool;
      } else {
        poolName = weightedRandom<keyof typeof pools>(SCENE_WEIGHTS[scene]);
      }
    } else {
      poolName = weightedRandom<keyof typeof pools>(SCENE_WEIGHTS[scene]);
    }

    const pool = pools[poolName] ?? pools.daily;
    const action = pool[Math.floor(Math.random() * pool.length)];
    if (!action) return;

    // Base interval for this mood + scene
    const baseDelay = currentMood === 'excited' ? 1500
      : currentMood === 'sleepy' ? 5000
      : currentMood === 'thinking' ? 2500
      : 3000;

    const jitter = baseDelay * (0.6 + Math.random() * 0.8);
    idleTimerRef.current = setTimeout(() => {
      const duration = action.exec(ctx);
      // Schedule next after action finishes + pause
      idleTimerRef.current = setTimeout(() => scheduleNextIdle(currentMood, tone), duration + 800);
    }, jitter);
  }, [applyExpr, resetExpr, setScale, getScale, setBlush, clearBlush, setBlobOpacity]);

  // Start/stop idle scheduler based on mood
  useEffect(() => {
    // Don't run idle animations for reactive moods
    const skipIdle: MoodName[] = ['talking', 'excited', 'angry', 'fearful'];
    if (skipIdle.includes(initialMood)) return;

    scheduleNextIdle(initialMood);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMood]);

  return { engine, setBlush, clearBlush };
}

// ── useBlink ─────────────────────────────────────────────────────────────────

function useBlink(blinkRate = 1) {
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const schedule = () => {
      const base = 3000 / blinkRate;
      const delay = base * (0.5 + Math.random());
      blinkTimeoutRef.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          schedule();
        }, 120);
      }, delay);
    };
    schedule();
    return () => {
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, [blinkRate]);
  return { isBlinking };
}

// ── useMouseTracking ──────────────────────────────────────────────────────────

function useMouseTracking() {
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    setPupilOffset({ x: clamp(dx) * 5, y: clamp(dy) * 4 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPupilOffset({ x: 0, y: 0 });
  }, []);

  return { wrapperRef, pupilOffset, handleMouseMove, handleMouseLeave };
}

// ── useBubbles ────────────────────────────────────────────────────────────────

function useBubbles(size: number) {
  const [bubbles, setBubbles] = useState<Array<{ id: number; x: number; dur: number }>>([]);
  const bubbleIdRef = useRef(0);
  const bubbleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const spawn = () => {
      const id = ++bubbleIdRef.current;
      setBubbles(prev => {
        const next = [...prev, { id, x: 5 + Math.random() * (size * 0.5), dur: 5000 + Math.random() * 2000 }];
        return next.length > 4 ? next.slice(1) : next;
      });
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 7000);
    };
    bubbleTimerRef.current = setInterval(spawn, 3000);
    return () => {
      if (bubbleTimerRef.current) clearInterval(bubbleTimerRef.current);
    };
  }, [size]);

  return bubbles;
}

// ── useParticles ─────────────────────────────────────────────────────────────
// Sparkle particles emitted on mood change

function useParticles(mood: MoodName, blush: number) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; delay: number }>>([]);
  const particleIdRef = useRef(0);
  const prevMoodRef = useRef(mood);
  const prevBlushRef = useRef(blush);

  useEffect(() => {
    if (mood !== prevMoodRef.current || blush > prevBlushRef.current + 0.1) {
      prevMoodRef.current = mood;
      prevBlushRef.current = blush;
      // Emit 3-6 particles on mood change or blush spike
      const count = 3 + Math.floor(Math.random() * 4);
      const SPARKLE_COLORS = ['#ffd700', '#ff69b4', '#87ceeb', '#98fb98', '#dda0dd'];
      const newParticles = Array.from({ length: count }, () => {
        const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)] ?? '#ffd700';
        return {
          id: ++particleIdRef.current,
          x: 10 + Math.random() * 80,
          y: 10 + Math.random() * 80,
          color,
          delay: 0,
        };
      });
      setParticles(prev => [...prev, ...newParticles]);
      newParticles.forEach(p => {
        setTimeout(() => setParticles(prev => prev.filter(x => x.id !== p.id)), 2000);
      });
    }
  }, [mood, blush]);

  return particles;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface GlassPetProps {
  botState: BotState;
  /** Pet size in px (default 200) */
  size?: number;
  /** Called when the pet is clicked */
  onClick?: () => void;
}

// ── GlassPet ────────────────────────────────────────────────────────────────

export function GlassPet({ botState, size = 200, onClick }: GlassPetProps) {
  const mood = botStateToMood(botState);
  const moodCfg = MOODS[mood];
  const accents = MOOD_ACCENTS[mood];

  const { engine } = useExpressionEngine(mood);
  const { isBlinking } = useBlink(moodCfg.blinkRate ?? 1);
  const { wrapperRef, pupilOffset, handleMouseMove, handleMouseLeave } = useMouseTracking();
  const bubbles = useBubbles(size);
  const particles = useParticles(mood, engine.blush);

  // ── Computed sizes ──────────────────────────────────────────────────────
  const innerPad = Math.round(size * 0.04);
  const innerSize = size - innerPad * 2;
  const eyeY = Math.round(size * 0.14);
  const eyeX = Math.round(size * 0.20);
  const eyeGap = Math.round(size * 0.18);
  const blushY = Math.round(size * 0.54);
  const blushX = Math.round(size * 0.08);
  const eyeHeight = Math.round(size * 0.12);
  const pupilSize = Math.round(size * 0.035);

  // ── Expression → eye params ─────────────────────────────────────────────
  const exprDef = EXPRESSIONS[engine.expr] ?? EXPRESSIONS.normal;

  function eyeStyle(side: 'left' | 'right'): React.CSSProperties {
    const ep = side === 'left' ? exprDef.left : exprDef.right;
    const speed = exprDef.speed === 'snap' ? '0.08s' : exprDef.speed === 'fast' ? '0.15s' : '0.3s';
    return {
      width: ep.w,
      height: isBlinking ? 2 : Math.max(2, ep.h),
      borderRadius: isBlinking ? '2px' : ep.br,
      boxShadow: `0 0 6px ${accents.eyeGlow}, 0 0 14px rgba(255,255,255,0.3)`,
      transition: `height ${speed} ease, border-radius ${speed} ease, width ${speed} ease`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      transform: [
        ep.tx != null ? `translateX(${ep.tx}px)` : '',
        ep.ty != null ? `translateY(${ep.ty}px)` : '',
        ep.rot != null ? `rotate(${ep.rot}deg)` : '',
        ep.sx != null || ep.sy != null ? `scale(${ep.sx ?? 1},${ep.sy ?? 1})` : '',
      ].filter(Boolean).join(' ') || undefined,
    };
  }

  // ── Wrapper for movement animation (translate only) ────────────────────────
  const floatDuration = moodCfg.speed ?? '8s';

  // ── Inner div handles scale + tap squish ──────────────────────────────────
  const innerAnim = moodCfg.bounce > 0
    ? `pet-breathe ${4 + moodCfg.bounce * 50}s ease-in-out infinite`
    : 'none';

  return (
    // Wrapper: handles float translate, pointer events, and click
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        position: 'relative',
        zIndex: 10,
        cursor: 'pointer',
        willChange: 'transform',
        animation: `pet-float ${floatDuration} ease-in-out infinite`,
        flexShrink: 0,
      }}
      title="TRIX 宠物"
    >
      {/* Inner: handles scale + breathing (separate from wrapper's float) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${engine.scale})`,
          transformOrigin: 'center center',
          animation: innerAnim,
        }}
      >
      {/* ── Inner fluid layer ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: innerPad,
          left: innerPad,
          width: innerSize,
          height: innerSize,
          borderRadius: '50%',
          overflow: 'hidden',
          zIndex: 1,
          opacity: engine.blobOpacity,
          transition: 'opacity 2s ease',
        }}
      >
        {/* Blob 1 */}
        <div style={{
          position: 'absolute',
          width: '130%',
          height: '130%',
          top: '-15%',
          left: '-15%',
          background: moodCfg.b1,
          animation: `fluid-spin ${moodCfg.speed} linear infinite`,
        }} />
        {/* Blob 2 */}
        <div style={{
          position: 'absolute',
          width: '110%',
          height: '110%',
          top: '-5%',
          left: '-5%',
          background: moodCfg.b2,
          animation: `fluid-spin-r ${moodCfg.speed.replace(/(\d+)s/, (_, n) => String(Number(n) * 1.5) + 's')} linear infinite`,
        }} />
      </div>

      {/* ── Glass shell ───────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        zIndex: 2,
        background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), ${accents.glassTint}), radial-gradient(circle at 70% 70%, ${accents.glassTint}, transparent)`,
        boxShadow: `
          inset -2px -2px 8px rgba(255,255,255,0.10),
          inset 2px 2px 8px rgba(255,255,255,0.40),
          0px 2px 8px rgba(0,0,0,0.15),
          ${moodCfg.glow}
        `,
        border: '1px solid rgba(255,255,255,0.30)',
        transition: 'box-shadow 1.5s cubic-bezier(0.4,0,0.2,1), border-color 1.5s ease',
      }}>
        {/* Primary highlight */}
        <div style={{
          position: 'absolute',
          top: '12%',
          left: '18%',
          width: '28%',
          height: '14%',
          borderRadius: '50%',
          background: accents.eyeGlow,
          filter: 'blur(1px)',
          transform: 'rotate(-40deg)',
          opacity: 0.7,
        }} />
        {/* Secondary highlight */}
        <div style={{
          position: 'absolute',
          bottom: '22%',
          right: '20%',
          width: '16%',
          height: '10%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          filter: 'blur(1px)',
          transform: 'rotate(25deg)',
        }} />
      </div>

      {/* ── Eyes ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        zIndex: 3,
        top: eyeY,
        left: eyeX,
        width: innerSize - eyeX * 2,
        height: eyeHeight,
        display: 'flex',
        alignItems: 'center',
        gap: eyeGap,
        pointerEvents: 'none',
        overflow: 'visible',
      }}>
        {/* Left eye */}
        <div style={{ ...eyeStyle('left'), background: accents.eyeGlow }}>
          {!isBlinking && (
            <div style={{
              width: pupilSize,
              height: pupilSize,
              borderRadius: '50%',
              background: '#1a1a2e',
              transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
              transition: 'transform 0.08s ease-out',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: '15%', left: '20%',
                width: '30%', height: '30%', borderRadius: '50%',
                background: 'rgba(255,255,255,0.7)',
              }} />
            </div>
          )}
        </div>
        {/* Right eye */}
        <div style={{ ...eyeStyle('right'), background: accents.eyeGlow }}>
          {!isBlinking && (
            <div style={{
              width: pupilSize,
              height: pupilSize,
              borderRadius: '50%',
              background: '#1a1a2e',
              transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
              transition: 'transform 0.08s ease-out',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: '15%', left: '20%',
                width: '30%', height: '30%', borderRadius: '50%',
                background: 'rgba(255,255,255,0.7)',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Blush ─────────────────────────────────────────────────────── */}
      {engine.blush > 0 && (
        <>
          <div style={{
            position: 'absolute',
            zIndex: 3,
            top: blushY,
            left: blushX,
            width: Math.round(size * 0.18),
            height: Math.round(size * 0.10),
            borderRadius: '50%',
            background: `rgba(255,${Math.round(130 - engine.blush * 50)},${Math.round(130 - engine.blush * 50)},${engine.blush})`,
            filter: 'blur(3px)',
            pointerEvents: 'none',
            opacity: 0.8,
          }} />
          <div style={{
            position: 'absolute',
            zIndex: 3,
            top: blushY,
            right: blushX,
            width: Math.round(size * 0.18),
            height: Math.round(size * 0.10),
            borderRadius: '50%',
            background: `rgba(255,${Math.round(130 - engine.blush * 50)},${Math.round(130 - engine.blush * 50)},${engine.blush})`,
            filter: 'blur(3px)',
            pointerEvents: 'none',
            opacity: 0.8,
          }} />
        </>
      )}

      {/* ── Mood-based static blush (faint always-on blush) ────────────── */}
      <div style={{
        position: 'absolute',
        zIndex: 3,
        top: blushY,
        left: blushX,
        width: Math.round(size * 0.18),
        height: Math.round(size * 0.10),
        borderRadius: '50%',
        background: accents.blush,
        filter: 'blur(3px)',
        pointerEvents: 'none',
        opacity: 0.5,
      }} />
      <div style={{
        position: 'absolute',
        zIndex: 3,
        top: blushY,
        right: blushX,
        width: Math.round(size * 0.18),
        height: Math.round(size * 0.10),
        borderRadius: '50%',
        background: accents.blush,
        filter: 'blur(3px)',
        pointerEvents: 'none',
        opacity: 0.5,
      }} />

      {/* ── Bubbles ────────────────────────────────────────────────────── */}
      {bubbles.map(b => (
        <div
          key={b.id}
          style={{
            position: 'absolute',
            zIndex: 0,
            width: 5,
            height: 5,
            borderRadius: '50%',
            left: b.x,
            bottom: '20%',
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0.08))',
            border: '1px solid rgba(255,255,255,0.15)',
            opacity: 0,
            pointerEvents: 'none',
            animation: `pet-bub ${b.dur}ms ease-in forwards`,
          }}
        />
      ))}

      {/* ── Mood-change sparkle particles ─────────────────────────────── */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            zIndex: 5,
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: p.color,
            boxShadow: `0 0 6px ${p.color}`,
            pointerEvents: 'none',
            animation: `sparkle-pop 0.8s ease-out ${p.delay}ms forwards`,
          }}
        />
      ))}

      {/* ── Thinking sparks ────────────────────────────────────────────── */}
      {(mood === 'thinking') && (
        <>
          <div style={{
            position: 'absolute', zIndex: 5, top: '-8%', left: '30%',
            width: 4, height: 4, borderRadius: '50%',
            background: '#c4b5fd', boxShadow: '0 0 6px #c4b5fd',
            animation: 'spark 1.4s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', zIndex: 5, top: '-5%', right: '28%',
            width: 3, height: 3, borderRadius: '50%',
            background: '#a78bfa', boxShadow: '0 0 6px #a78bfa',
            animation: 'spark 1.4s ease-in-out 0.5s infinite',
          }} />
        </>
      )}

      {/* ── Speaking mouth emoji ───────────────────────────────────────── */}
      {(mood === 'talking') && (
        <div style={{
          position: 'absolute',
          zIndex: 5,
          bottom: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: Math.round(size * 0.14),
          lineHeight: 1,
          animation: 'speak-wiggle 0.35s ease-in-out infinite alternate',
          pointerEvents: 'none',
          opacity: 0.85,
        }}>
          💬
        </div>
      )}

      {/* ── Sleepy ZZZ ───────────────────────────────────────────────── */}
      {(mood === 'sleepy') && (
        <div style={{
          position: 'absolute',
          zIndex: 5,
          top: '-12%',
          right: '20%',
          fontSize: Math.round(size * 0.10),
          lineHeight: 1,
          animation: 'sleepy-zzz 2.5s ease-in-out infinite',
          pointerEvents: 'none',
          opacity: 0.7,
        }}>
          💤
        </div>
      )}

      {/* ── Love hearts ───────────────────────────────────────────────── */}
      {(mood === 'love' || mood === 'excited') && (
        <div style={{
          position: 'absolute',
          zIndex: 5,
          top: '-8%',
          left: '35%',
          fontSize: Math.round(size * 0.10),
          lineHeight: 1,
          animation: 'heart-float 1.5s ease-in-out infinite',
          pointerEvents: 'none',
          opacity: 0.8,
        }}>
          💕
        </div>
      )}

      {/* ── Inner scale wrapper closing ── */}
      </div>
    </div>
  );
}
