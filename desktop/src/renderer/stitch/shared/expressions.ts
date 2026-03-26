/**
 * expressions.ts — KKClaw-style expression system for GlassPet
 * 42 expressions + time-aware mood engine
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ExpressionSpeed = 'snap' | 'fast' | 'smooth' | 'slow' | 'drift';

export interface EyeParams {
  w: number;       // width px
  h: number;       // height px
  br: string;      // border-radius e.g. "6px" or "3px 6px 6px 3px"
  tx?: number;     // translateX (pupil offset)
  ty?: number;     // translateY (pupil offset)
  sx?: number;     // scaleX
  sy?: number;     // scaleY
  rot?: number;    // rotation deg
}

export type ExpressionName =
  | 'normal' | 'lookLeft' | 'lookRight' | 'lookUp' | 'lookDown'
  | 'squint' | 'talking' | 'talkBig'
  | 'blink' | 'halfBlink'
  | 'surprised' | 'wow' | 'sparkle'
  | 'wink' | 'winkR'
  | 'dizzy' | 'cross' | 'flattered' | 'nervous'
  | 'happy' | 'superHappy' | 'giggle'
  | 'curious' | 'thinking' | 'hmm'
  | 'sad' | 'angry' | 'love' | 'smug' | 'confused'
  | 'softSmile' | 'focus' | 'pout'
  | 'peekL' | 'peekR' | 'mischief' | 'worried' | 'sly'
  | 'sleepy' | 'drowsy' | 'dead' | 'content' | 'bliss'
  | 'daydream' | 'blank';

// ── Expression Definitions ──────────────────────────────────────────────────
// Each function returns EyeParams for left + right eye (or same for both)
export const EXPRESSIONS: Record<ExpressionName, { left: EyeParams; right: EyeParams; speed: ExpressionSpeed }> = {
  // ── normal / drift ─────────────────────────────────────────────────────────
  normal:     { left: { w:11, h:19, br:'6px' },           right: { w:11, h:19, br:'6px' },           speed: 'snap' },
  lookLeft:   { left: { w:11, h:19, br:'6px', tx:-4 },    right: { w:11, h:19, br:'6px', tx:-4 },    speed: 'snap' },
  lookRight:  { left: { w:11, h:19, br:'6px', tx:4 },     right: { w:11, h:19, br:'6px', tx:4 },     speed: 'snap' },
  lookUp:     { left: { w:11, h:19, br:'6px', ty:-5 },    right: { w:11, h:19, br:'6px', ty:-5 },    speed: 'snap' },
  lookDown:   { left: { w:11, h:15, br:'6px', ty:4 },     right: { w:11, h:15, br:'6px', ty:4 },     speed: 'snap' },
  squint:     { left: { w:12, h:6,  br:'4px',  ty:1 },    right: { w:12, h:6,  br:'4px',  ty:1 },    speed: 'snap' },
  talking:    { left: { w:10, h:17, br:'5px' },            right: { w:10, h:17, br:'5px' },            speed: 'snap' },
  talkBig:    { left: { w:12, h:20, br:'6px' },           right: { w:12, h:20, br:'6px' },           speed: 'snap' },
  blink:      { left: { w:12, h:3,  br:'3px' },            right: { w:12, h:3,  br:'3px' },            speed: 'snap' },
  halfBlink:  { left: { w:11, h:10, br:'5px' },            right: { w:11, h:10, br:'5px' },            speed: 'fast' },

  // ── fast ─────────────────────────────────────────────────────────────────
  surprised:  { left: { w:13, h:21, br:'7px' },           right: { w:13, h:21, br:'7px' },           speed: 'fast' },
  wow:        { left: { w:16, h:16, br:'8px' },            right: { w:16, h:16, br:'8px' },            speed: 'fast' },
  sparkle:    { left: { w:12, h:12, br:'3px', rot:45 },    right: { w:12, h:12, br:'3px', rot:45 },    speed: 'fast' },
  wink:       {
    left:  { w:13, h:7,  br:'7px 7px 3px 3px', ty:1 },
    right: { w:11, h:19, br:'6px' },
    speed: 'fast',
  },
  winkR:      {
    left:  { w:11, h:19, br:'6px' },
    right: { w:13, h:7,  br:'7px 7px 3px 3px', ty:1 },
    speed: 'fast',
  },
  dizzy:      {
    left:  { w:10, h:10, br:'5px', rot:25, tx:-2 },
    right: { w:10, h:10, br:'5px', rot:-25, tx:2 },
    speed: 'fast',
  },
  cross:      {
    left:  { w:10, h:3,  br:'2px', rot:30 },
    right: { w:10, h:3,  br:'2px', rot:-30 },
    speed: 'fast',
  },
  flattered:  { left: { w:14, h:20, br:'7px', sy:1.05 },  right: { w:14, h:20, br:'7px', sy:1.05 },  speed: 'fast' },
  nervous:    { left: { w:9,  h:14, br:'5px',  ty:1, sx:0.9 }, right: { w:9, h:14, br:'5px', ty:1, sx:0.9 }, speed: 'fast' },

  // ── smooth ────────────────────────────────────────────────────────────────
  happy:      { left: { w:13, h:7,  br:'7px 7px 3px 3px', ty:1 },  right: { w:13, h:7, br:'7px 7px 3px 3px', ty:1 }, speed: 'smooth' },
  superHappy: { left: { w:15, h:5,  br:'8px 8px 3px 3px', ty:1, sx:1.1 }, right: { w:15, h:5, br:'8px 8px 3px 3px', ty:1, sx:1.1 }, speed: 'smooth' },
  giggle:     {
    left:  { w:13, h:7,  br:'7px 7px 3px 3px', ty:1, rot:-8 },
    right: { w:13, h:7,  br:'7px 7px 3px 3px', ty:1, rot:8 },
    speed: 'smooth',
  },
  curious:    {
    left:  { w:9,  h:16, br:'5px',  ty:-1 },
    right: { w:13, h:21, br:'7px',  ty:-1 },
    speed: 'smooth',
  },
  thinking:   { left: { w:10, h:17, br:'5px',  ty:-3 },  right: { w:10, h:17, br:'5px', ty:-3 },  speed: 'smooth' },
  hmm:        {
    left:  { w:11, h:16, br:'5px',  ty:-1, rot:8 },
    right: { w:9,  h:13, br:'5px',  ty:0,  rot:-8 },
    speed: 'smooth',
  },
  sad:        { left: { w:10, h:16, br:'5px',  ty:3,  sy:0.9 },  right: { w:10, h:16, br:'5px', ty:3, sy:0.9 },  speed: 'smooth' },
  angry:      {
    left:  { w:12, h:14, br:'3px 6px 6px 3px', ty:-2, rot:-12 },
    right: { w:12, h:14, br:'6px 3px 3px 6px', ty:-2, rot:12 },
    speed: 'smooth',
  },
  love:       { left: { w:14, h:13, br:'7px 1px 7px 1px', rot:45, sx:1.1 }, right: { w:14, h:13, br:'7px 1px 7px 1px', rot:45, sx:1.1 }, speed: 'smooth' },
  smug:       {
    left:  { w:11, h:7,  br:'6px 6px 3px 3px', ty:1 },
    right: { w:9,  h:15, br:'5px',  tx:3 },
    speed: 'smooth',
  },
  confused:   {
    left:  { w:11, h:19, br:'6px',  ty:-2 },
    right: { w:9,  h:12, br:'5px',  ty:2,  rot:15 },
    speed: 'smooth',
  },
  softSmile:  { left: { w:12, h:9,  br:'6px 6px 3px 3px', ty:1 },  right: { w:12, h:9, br:'6px 6px 3px 3px', ty:1 }, speed: 'smooth' },
  focus:      { left: { w:9,  h:18, br:'4px',  ty:-1 },  right: { w:9,  h:18, br:'4px', ty:-1 },  speed: 'smooth' },
  pout:       { left: { w:10, h:11, br:'5px',  ty:2,  sy:0.85 },  right: { w:10, h:11, br:'5px', ty:2, sy:0.85 },  speed: 'smooth' },
  peekL:      {
    left:  { w:11, h:6,  br:'4px',  ty:1 },
    right: { w:10, h:17, br:'5px',  tx:-3 },
    speed: 'smooth',
  },
  peekR:      {
    left:  { w:10, h:17, br:'5px',  tx:3 },
    right: { w:11, h:6,  br:'4px',  ty:1 },
    speed: 'smooth',
  },
  mischief:   {
    left:  { w:13, h:14, br:'7px',  rot:-5, ty:-1 },
    right: { w:9,  h:10, br:'5px',  rot:10, ty:1 },
    speed: 'smooth',
  },
  worried:    {
    left:  { w:11, h:16, br:'5px',  ty:1,  rot:5 },
    right: { w:11, h:16, br:'5px',  ty:1,  rot:-5 },
    speed: 'smooth',
  },
  sly:        {
    left:  { w:10, h:14, br:'5px',  tx:3,  rot:-6 },
    right: { w:12, h:8,  br:'6px 6px 3px 3px', tx:3, ty:1 },
    speed: 'smooth',
  },

  // ── slow ─────────────────────────────────────────────────────────────────
  sleepy:     { left: { w:12, h:4,  br:'4px',  ty:2 },   right: { w:12, h:4,  br:'4px', ty:2 },   speed: 'slow' },
  drowsy:     { left: { w:11, h:10, br:'5px',  ty:1 },  right: { w:11, h:10, br:'5px', ty:1 },  speed: 'slow' },
  dead:       { left: { w:10, h:3,  br:'2px',  ty:3 },  right: { w:10, h:3,  br:'2px', ty:3 },  speed: 'slow' },
  content:    { left: { w:13, h:8,  br:'7px 7px 4px 4px', ty:0, sx:1.05 }, right: { w:13, h:8, br:'7px 7px 4px 4px', ty:0, sx:1.05 }, speed: 'slow' },
  bliss:      { left: { w:14, h:5,  br:'7px 7px 2px 2px', ty:1, sx:1.1 },  right: { w:14, h:5, br:'7px 7px 2px 2px', ty:1, sx:1.1 },  speed: 'slow' },

  // ── drift ─────────────────────────────────────────────────────────────────
  daydream:  { left: { w:13, h:20, br:'7px',  ty:-3, sx:0.95 },  right: { w:13, h:20, br:'7px', ty:-3, sx:0.95 },  speed: 'drift' },
  blank:      { left: { w:8,  h:15, br:'4px' },    right: { w:8,  h:15, br:'4px' },    speed: 'drift' },
};

// ── Mood Definitions ───────────────────────────────────────────────────────

export type MoodName =
  | 'offline' | 'idle' | 'happy' | 'talking' | 'thinking'
  | 'sleepy' | 'surprised' | 'sad' | 'angry' | 'fearful'
  | 'calm' | 'excited' | 'love' | 'focused';

export interface MoodConfig {
  /** Background gradient for the inner fluid layer */
  fluid: string;
  /** Blob 1 gradient */
  b1: string;
  /** Blob 2 gradient */
  b2: string;
  /** Glass shell box-shadow glow */
  glow: string;
  /** Default expression for this mood */
  eyes: ExpressionName;
  /** Target scale of the pet body */
  scale: number;
  /** Breathing bounce amplitude */
  bounce: number;
  /** Blob animation speed */
  speed: string;
  /** Blink rate modifier (higher = blink more often) */
  blinkRate?: number;
  /** Blob opacity (sad/sleepy moods dim it) */
  opacity?: number;
}

export const MOODS: Record<MoodName, MoodConfig> = {
  offline: {
    fluid: 'linear-gradient(135deg,#ccc,#ddd)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(160,160,160,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(180,180,180,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(200,200,200,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(140,140,140,0.3),transparent 35%)',
    glow: '0 0 20px rgba(160,160,160,0.15), 0 0 40px rgba(160,160,160,0.05)',
    eyes: 'sleepy', scale: 0.93, bounce: 0, speed: '20s', blinkRate: 0.3, opacity: 0.7,
  },
  idle: {
    fluid: 'linear-gradient(135deg,#ffb3b3,#fed6e3)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(235,87,87,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(255,154,108,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(255,200,150,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(220,60,60,0.3),transparent 35%)',
    glow: '0 0 40px rgba(255,107,74,0.25), 0 0 80px rgba(255,107,74,0.1)',
    eyes: 'normal', scale: 1, bounce: 0, speed: '8s',
  },
  happy: {
    fluid: 'linear-gradient(135deg,#ffe0b2,#fff3e0)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(255,193,7,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(255,152,0,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(255,235,59,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(255,183,77,0.3),transparent 35%)',
    glow: '0 0 40px rgba(255,193,7,0.3), 0 0 80px rgba(255,152,0,0.15)',
    eyes: 'happy', scale: 1.05, bounce: 0.02, speed: '5s', blinkRate: 1.5,
  },
  talking: {
    fluid: 'linear-gradient(135deg,#f8bbd0,#fce4ec)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(233,30,99,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(255,105,180,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(255,182,193,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(219,68,85,0.3),transparent 35%)',
    glow: '0 0 40px rgba(255,105,180,0.3), 0 0 80px rgba(233,30,99,0.15)',
    eyes: 'talking', scale: 1, bounce: 0.015, speed: '4s',
  },
  thinking: {
    fluid: 'linear-gradient(135deg,#d1c4e9,#ede7f6)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(103,58,183,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(123,104,238,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(179,157,219,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(94,53,177,0.3),transparent 35%)',
    glow: '0 0 40px rgba(123,104,238,0.3), 0 0 80px rgba(103,58,183,0.15)',
    eyes: 'thinking', scale: 1, bounce: 0, speed: '12s',
  },
  sleepy: {
    fluid: 'linear-gradient(135deg,#e8d5e0,#f0e6ef)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(186,147,170,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(200,170,190,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(220,200,215,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(170,130,160,0.3),transparent 35%)',
    glow: '0 0 30px rgba(186,147,170,0.2), 0 0 60px rgba(186,147,170,0.08)',
    eyes: 'sleepy', scale: 0.97, bounce: 0, speed: '16s', blinkRate: 2, opacity: 0.7,
  },
  surprised: {
    fluid: 'linear-gradient(135deg,#fff9c4,#fff3e0)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(255,215,0,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(255,165,0,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(255,235,59,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(255,87,34,0.3),transparent 35%)',
    glow: '0 0 50px rgba(255,215,0,0.35), 0 0 100px rgba(255,165,0,0.15)',
    eyes: 'surprised', scale: 1.06, bounce: 0, speed: '6s',
  },
  sad: {
    fluid: 'linear-gradient(135deg,#90caf9,#bbdefb)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(30,136,229,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(66,165,245,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(144,202,249,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(21,101,192,0.3),transparent 35%)',
    glow: '0 0 40px rgba(66,165,245,0.3), 0 0 80px rgba(30,136,229,0.15)',
    eyes: 'sad', scale: 0.96, bounce: 0, speed: '14s', opacity: 0.8,
  },
  angry: {
    fluid: 'linear-gradient(135deg,#ef5350,#e53935)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(211,47,47,0.9),transparent 40%),radial-gradient(circle at 70% 65%,rgba(244,67,54,0.85),transparent 40%)',
    b2: 'radial-gradient(circle at 50% 50%,rgba(255,82,82,0.45),transparent 35%),radial-gradient(circle at 35% 70%,rgba(183,28,28,0.35),transparent 35%)',
    glow: '0 0 50px rgba(244,67,54,0.4), 0 0 100px rgba(211,47,47,0.2)',
    eyes: 'angry', scale: 1.04, bounce: 0.01, speed: '3s',
  },
  fearful: {
    fluid: 'linear-gradient(135deg,#ce93d8,#e1bee7)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(156,39,176,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(186,104,200,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(206,147,216,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(123,31,162,0.3),transparent 35%)',
    glow: '0 0 40px rgba(156,39,176,0.3), 0 0 80px rgba(123,31,162,0.15)',
    eyes: 'nervous', scale: 0.97, bounce: 0, speed: '5s',
  },
  calm: {
    fluid: 'linear-gradient(135deg,#b2dfdb,#e0f2f1)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(77,182,172,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(128,203,196,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(178,223,219,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(0,137,123,0.3),transparent 35%)',
    glow: '0 0 40px rgba(77,182,172,0.25), 0 0 80px rgba(0,137,123,0.1)',
    eyes: 'softSmile', scale: 1, bounce: 0, speed: '10s',
  },
  excited: {
    fluid: 'linear-gradient(135deg,#f48fb1,#f8bbd0)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(233,30,99,0.9),transparent 40%),radial-gradient(circle at 70% 65%,rgba(255,64,129,0.85),transparent 40%)',
    b2: 'radial-gradient(circle at 50% 50%,rgba(248,187,208,0.45),transparent 35%),radial-gradient(circle at 35% 70%,rgba(194,24,91,0.35),transparent 35%)',
    glow: '0 0 55px rgba(233,30,99,0.4), 0 0 110px rgba(255,64,129,0.2)',
    eyes: 'superHappy', scale: 1.08, bounce: 0.025, speed: '3s', blinkRate: 1.2,
  },
  love: {
    fluid: 'linear-gradient(135deg,#ff8a80,#ffcdd2)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(229,57,53,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(255,82,82,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 50% 50%,rgba(255,138,128,0.45),transparent 35%),radial-gradient(circle at 35% 70%,rgba(198,40,40,0.3),transparent 35%)',
    glow: '0 0 45px rgba(229,57,53,0.35), 0 0 90px rgba(255,82,82,0.15)',
    eyes: 'love', scale: 1.05, bounce: 0.015, speed: '6s', blinkRate: 1.2,
  },
  focused: {
    fluid: 'linear-gradient(135deg,#80deea,#b2ebf2)',
    b1: 'radial-gradient(circle at 30% 30%,rgba(0,151,167,0.85),transparent 40%),radial-gradient(circle at 70% 65%,rgba(38,166,154,0.8),transparent 40%)',
    b2: 'radial-gradient(circle at 60% 30%,rgba(128,222,234,0.4),transparent 35%),radial-gradient(circle at 35% 70%,rgba(0,131,143,0.3),transparent 35%)',
    glow: '0 0 40px rgba(0,151,167,0.3), 0 0 80px rgba(38,166,154,0.15)',
    eyes: 'focus', scale: 1.02, bounce: 0, speed: '10s',
  },
};

// ── Mood → Expression Map (for idle micro-expressions) ─────────────────────

export const MOOD_DEFAULT_EXPRESSION: Record<MoodName, ExpressionName> = {
  offline:  'sleepy',
  idle:     'normal',
  happy:    'happy',
  talking:  'talking',
  thinking: 'thinking',
  sleepy:   'sleepy',
  surprised: 'surprised',
  sad:      'sad',
  angry:    'angry',
  fearful:  'nervous',
  calm:     'softSmile',
  excited:  'superHappy',
  love:     'love',
  focused:  'focus',
};

// ── Time Scene Detection ──────────────────────────────────────────────────────

export type TimeScene = 'morning' | 'noon' | 'afternoon' | 'evening' | 'latenight';

export function getTimeScene(): TimeScene {
  const h = new Date().getHours();
  if (h >= 6  && h < 11)  return 'morning';
  if (h >= 11 && h < 14)  return 'noon';
  if (h >= 14 && h < 18)  return 'afternoon';
  if (h >= 18 && h < 22)  return 'evening';
  return 'latenight';
}

// ── Tone Detection from AI text ───────────────────────────────────────────────

export type Tone =
  | 'cheerful' | 'shy' | 'annoyed' | 'sad' | 'curious'
  | 'encourage' | 'tired' | 'surprised' | 'calm' | 'neutral';

export function detectTone(text: string): Tone {
  if (!text) return 'neutral';
  if (/哈哈|嘻嘻|😄|😆|笑|开心|太好了|棒|厉害|不错|好耶/.test(text)) return 'cheerful';
  if (/害羞|脸红|嘿嘿|😳|😊|人家/.test(text)) return 'shy';
  if (/生气|可恶|气死|哼|😠|😤|讨厌/.test(text)) return 'annoyed';
  if (/难过|伤心|唉|😢|😭|呜呜|抱歉|对不起/.test(text)) return 'sad';
  if (/好奇|为什么|怎么|吗？|呢？|🤔|想想/.test(text)) return 'curious';
  if (/加油|冲|💪|努力|一定可以|相信/.test(text)) return 'encourage';
  if (/困|累|😴|哈欠|想睡|好困/.test(text)) return 'tired';
  if (/惊|天哪|什么|😱|😮|不会吧|哇/.test(text)) return 'surprised';
  if (/嗯|好的|了解|明白|知道了|收到/.test(text)) return 'calm';
  return 'neutral';
}

// ── Idle Action Pool Types ────────────────────────────────────────────────────

export type ActionPool = 'daily' | 'happy' | 'shy' | 'thinking' | 'surprised'
  | 'sleepy' | 'sad' | 'annoyed' | 'encourage' | 'smug' | 'dizzy' | 'playful' | 'dreamy';

export interface IdleAction {
  /** Human-readable label (for debugging) */
  label: string;
  /** Execute this action — returns duration in ms */
  exec: (ctx: IdleActionContext) => number;
}

export interface IdleActionContext {
  applyExpr: (name: ExpressionName) => void;
  resetExpr: () => void;
  setScale: (s: number) => void;
  getScale: () => number;
  setBlush: (intensity: number) => void;
  clearBlush: () => void;
  setBlobOpacity: (v: number) => void;
}

// ── Action Pool Definitions ─────────────────────────────────────────────────
// Each action returns its duration so the scheduler knows when to pick the next one

export function buildActionPools(ctx: IdleActionContext): Record<ActionPool, IdleAction[]> {
  const { applyExpr, resetExpr, setScale, getScale, setBlush, clearBlush } = ctx;
  const s = () => getScale();

  const daily: IdleAction[] = [
    { label: 'lookLeft→lookRight', exec: () => { applyExpr('lookLeft'); setTimeout(() => { applyExpr('lookRight'); setTimeout(resetExpr, 500); }, 500); return 1000; } },
    { label: 'curious', exec: () => { applyExpr('curious'); setTimeout(resetExpr, 800); return 800; } },
    { label: 'wink', exec: () => { applyExpr('wink'); setTimeout(resetExpr, 700); return 700; } },
    { label: 'winkR', exec: () => { applyExpr('winkR'); setTimeout(resetExpr, 700); return 700; } },
    { label: 'hmm', exec: () => { applyExpr('hmm'); setTimeout(resetExpr, 800); return 800; } },
    { label: 'sparkle', exec: () => { applyExpr('sparkle'); setTimeout(resetExpr, 500); return 500; } },
    { label: 'doubleBlink', exec: () => { applyExpr('blink'); setTimeout(resetExpr, 80); setTimeout(() => { applyExpr('blink'); setTimeout(resetExpr, 330); }, 250); return 580; } },
    { label: 'lookAround', exec: () => { applyExpr('lookLeft'); setTimeout(() => { applyExpr('lookRight'); setTimeout(() => { applyExpr('lookLeft'); setTimeout(() => { applyExpr('lookRight'); setTimeout(resetExpr, 800); }, 600); }, 200); }, 400); return 2000; } },
    { label: 'squint', exec: () => { applyExpr('squint'); setTimeout(resetExpr, 500); return 500; } },
    { label: 'shiver', exec: () => { setScale(0.92); setTimeout(() => { setScale(1.06); setTimeout(() => { setScale(s()); }, 150); }, 150); return 300; } },
    { label: 'peekL', exec: () => { applyExpr('peekL'); setTimeout(() => { applyExpr('blink'); setTimeout(resetExpr, 100); }, 700); return 800; } },
    { label: 'peekR', exec: () => { applyExpr('nervous'); setTimeout(() => { applyExpr('peekR'); setTimeout(resetExpr, 400); }, 600); return 1000; } },
    { label: 'blank', exec: () => { applyExpr('blank'); setTimeout(() => { applyExpr('surprised'); setTimeout(resetExpr, 300); }, 1200); return 1500; } },
    { label: 'softSmile', exec: () => { applyExpr('softSmile'); setTimeout(resetExpr, 1000); return 1000; } },
    { label: 'focus', exec: () => { applyExpr('focus'); setTimeout(() => { applyExpr('curious'); setTimeout(resetExpr, 500); }, 800); return 1300; } },
  ];

  const happy: IdleAction[] = [
    { label: 'happy', exec: () => { applyExpr('happy'); setTimeout(resetExpr, 1000); return 1000; } },
    { label: 'superHappyBounce', exec: () => { const cur = s(); applyExpr('superHappy'); setScale(1.1); setTimeout(() => { setScale(0.93); }, 200); setTimeout(() => { setScale(1.08); applyExpr('giggle'); setTimeout(() => { setScale(cur); resetExpr(); }, 800); }, 400); return 1200; } },
    { label: 'giggle', exec: () => { applyExpr('giggle'); setTimeout(resetExpr, 800); return 800; } },
    { label: 'bounce', exec: () => { const cur = s(); applyExpr('happy'); setScale(0.9); setTimeout(() => { setScale(1.12); }, 150); setTimeout(() => { setScale(0.93); }, 350); setTimeout(() => { setScale(1.05); applyExpr('giggle'); setTimeout(() => { setScale(cur); resetExpr(); }, 500); }, 500); return 1000; } },
    { label: 'smug', exec: () => { applyExpr('smug'); setTimeout(() => { applyExpr('giggle'); setTimeout(resetExpr, 600); }, 700); return 1300; } },
    { label: 'loveEyes', exec: () => { applyExpr('love'); setBlush(0.4); setTimeout(() => { applyExpr('superHappy'); setTimeout(() => { resetExpr(); clearBlush(); }, 1000); }, 1000); return 2000; } },
    { label: 'content', exec: () => { applyExpr('content'); setTimeout(() => { applyExpr('softSmile'); setTimeout(resetExpr, 800); }, 600); return 1400; } },
    { label: 'bliss', exec: () => { applyExpr('bliss'); setBlush(0.3); setTimeout(() => { applyExpr('content'); setTimeout(() => { resetExpr(); clearBlush(); }, 1200); }, 1500); return 2700; } },
  ];

  const shy: IdleAction[] = [
    { label: 'shyBlush', exec: () => { applyExpr('happy'); setBlush(0.5); setTimeout(() => { resetExpr(); clearBlush(); }, 1200); return 1200; } },
    { label: 'squintShy', exec: () => { applyExpr('squint'); setBlush(0.4); setTimeout(() => { applyExpr('lookDown'); setTimeout(() => { resetExpr(); clearBlush(); }, 1000); }, 400); return 1400; } },
    { label: 'halfBlinkDown', exec: () => { applyExpr('halfBlink'); setTimeout(() => { applyExpr('lookDown'); setBlush(0.35); setTimeout(() => { resetExpr(); clearBlush(); }, 1000); }, 300); return 1300; } },
  ];

  const thinking: IdleAction[] = [
    { label: 'thinking', exec: () => { applyExpr('thinking'); setTimeout(resetExpr, 800); return 800; } },
    { label: 'hmmChain', exec: () => { applyExpr('hmm'); setTimeout(() => { applyExpr('thinking'); setTimeout(resetExpr, 600); }, 500); return 1100; } },
    { label: 'curious', exec: () => { applyExpr('curious'); setTimeout(() => { applyExpr('hmm'); setTimeout(resetExpr, 600); }, 500); return 1100; } },
    { label: 'lookUpThink', exec: () => { applyExpr('lookUp'); setTimeout(() => { applyExpr('thinking'); setTimeout(resetExpr, 700); }, 500); return 1200; } },
    { label: 'confusedSparkle', exec: () => { applyExpr('confused'); setTimeout(() => { applyExpr('thinking'); setTimeout(() => { applyExpr('sparkle'); setTimeout(resetExpr, 400); }, 500); }, 600); return 1500; } },
    { label: 'thinkSparkle', exec: () => { applyExpr('thinking'); setTimeout(() => { applyExpr('sparkle'); setTimeout(() => { applyExpr('giggle'); setTimeout(resetExpr, 500); }, 400); }, 800); return 1700; } },
    { label: 'focusConfused', exec: () => { applyExpr('focus'); setTimeout(() => { applyExpr('confused'); setTimeout(() => { applyExpr('sparkle'); setTimeout(() => { applyExpr('happy'); setTimeout(resetExpr, 400); }, 400); }, 500); }, 800); return 2100; } },
    { label: 'daydream', exec: () => { applyExpr('daydream'); setTimeout(() => { applyExpr('blink'); setTimeout(() => { applyExpr('surprised'); setTimeout(resetExpr, 300); }, 100); }, 1500); return 1900; } },
    { label: 'worriedRelax', exec: () => { applyExpr('worried'); setTimeout(() => { applyExpr('thinking'); setTimeout(() => { applyExpr('softSmile'); setTimeout(resetExpr, 600); }, 600); }, 600); return 1800; } },
  ];

  const sleepy: IdleAction[] = [
    { label: 'drowsyWake', exec: () => { applyExpr('drowsy'); setTimeout(() => { applyExpr('sleepy'); setTimeout(() => { applyExpr('surprised'); setTimeout(resetExpr, 300); }, 600); }, 400); return 1300; } },
    { label: 'slowBlink', exec: () => { applyExpr('halfBlink'); setTimeout(() => { applyExpr('sleepy'); setTimeout(() => { applyExpr('halfBlink'); setTimeout(() => { applyExpr('drowsy'); setTimeout(resetExpr, 2200); }, 1000); }, 500); }, 500); return 3700; } },
    { label: 'stretch', exec: () => { const cur = s(); applyExpr('sleepy'); setScale(1.08); setTimeout(() => { setScale(cur); applyExpr('drowsy'); setTimeout(() => { applyExpr('surprised'); setTimeout(resetExpr, 300); }, 400); }, 1000); return 1700; } },
    { label: 'sleepyBlink', exec: () => { applyExpr('sleepy'); setTimeout(() => { applyExpr('blink'); setTimeout(() => { applyExpr('sleepy'); setTimeout(resetExpr, 1200); }, 400); }, 800); return 2400; } },
    { label: 'napNod', exec: () => { const cur = s(); applyExpr('sleepy'); setScale(0.95); setTimeout(() => { setScale(1.02); applyExpr('blink'); setTimeout(() => { setScale(0.93); applyExpr('sleepy'); setTimeout(() => { setScale(cur); applyExpr('drowsy'); setTimeout(resetExpr, 2000); }, 500); }, 400); }, 600); return 3500; } },
  ];

  const sad: IdleAction[] = [
    { label: 'sadRecover', exec: () => { applyExpr('sad'); setTimeout(() => { applyExpr('drowsy'); setTimeout(() => { applyExpr('happy'); setTimeout(resetExpr, 700); }, 400); }, 600); return 1700; } },
    { label: 'sadLookDown', exec: () => { applyExpr('sad'); setTimeout(() => { applyExpr('lookDown'); setTimeout(resetExpr, 600); }, 500); return 1100; } },
    { label: 'confusedSad', exec: () => { applyExpr('confused'); setTimeout(() => { applyExpr('sad'); setTimeout(resetExpr, 700); }, 400); return 1100; } },
  ];

  const annoyed: IdleAction[] = [
    { label: 'angryStomp', exec: () => { const cur = s(); applyExpr('angry'); setScale(1.05); setTimeout(() => { setScale(0.95); setTimeout(() => { setScale(1.05); setTimeout(() => { setScale(cur); applyExpr('hmm'); setTimeout(resetExpr, 1000); }, 200); }, 200); }, 400); return 1800; } },
    { label: 'eyeRoll', exec: () => { applyExpr('lookUp'); setTimeout(() => { applyExpr('lookDown'); setTimeout(() => { applyExpr('blink'); setTimeout(resetExpr, 200); }, 300); }, 300); return 800; } },
    { label: 'headShake', exec: () => { applyExpr('squint'); applyExpr('lookLeft'); setTimeout(() => { applyExpr('lookRight'); setTimeout(() => { resetExpr(); }, 250); }, 500); return 1000; } },
  ];

  const encourage: IdleAction[] = [
    { label: 'sparkleGrow', exec: () => { const cur = s(); applyExpr('sparkle'); setScale(1.08); setTimeout(() => { setScale(cur); applyExpr('superHappy'); setTimeout(resetExpr, 900); }, 400); return 1300; } },
    { label: 'happyEscalate', exec: () => { applyExpr('happy'); setTimeout(() => { applyExpr('superHappy'); setTimeout(() => { applyExpr('giggle'); setTimeout(resetExpr, 500); }, 400); }, 300); return 1200; } },
    { label: 'focusSparkle', exec: () => { applyExpr('focus'); setTimeout(() => { applyExpr('sparkle'); setScale(1.06); setTimeout(() => { setScale(s()); applyExpr('content'); setTimeout(resetExpr, 900); }, 400); }, 500); return 1800; } },
  ];

  const playful: IdleAction[] = [
    { label: 'mischiefWink', exec: () => { applyExpr('mischief'); setTimeout(() => { applyExpr('wink'); setTimeout(() => { applyExpr('giggle'); setTimeout(resetExpr, 500); }, 400); }, 600); return 1500; } },
    { label: 'peekCaught', exec: () => { applyExpr('peekL'); setTimeout(() => { applyExpr('surprised'); setTimeout(() => { applyExpr('nervous'); setTimeout(() => { applyExpr('blink'); setTimeout(resetExpr, 100); }, 300); }, 300); }, 800); return 1500; } },
    { label: 'slyBounce', exec: () => { const cur = s(); applyExpr('sly'); setTimeout(() => { applyExpr('mischief'); setScale(1.08); setTimeout(() => { setScale(cur); applyExpr('giggle'); setTimeout(resetExpr, 800); }, 400); }, 500); return 1700; } },
  ];

  const dreamy: IdleAction[] = [
    { label: 'daydreamSmile', exec: () => { applyExpr('daydream'); setTimeout(() => { applyExpr('softSmile'); setTimeout(resetExpr, 800); }, 1200); return 2000; } },
    { label: 'blankBreath', exec: () => { applyExpr('blank'); setTimeout(() => { applyExpr('daydream'); setTimeout(() => { applyExpr('content'); setTimeout(resetExpr, 600); }, 1000); }, 800); return 2400; } },
    { label: 'lookUpDream', exec: () => { applyExpr('lookUp'); setTimeout(() => { applyExpr('daydream'); setTimeout(() => { applyExpr('softSmile'); setTimeout(resetExpr, 700); }, 1200); }, 500); return 2400; } },
  ];

  const surprised: IdleAction[] = [
    { label: 'surprised', exec: () => { applyExpr('surprised'); setTimeout(resetExpr, 600); return 600; } },
    { label: 'wowCurious', exec: () => { applyExpr('wow'); setTimeout(() => { applyExpr('curious'); setTimeout(resetExpr, 600); }, 500); return 1100; } },
    { label: 'surprisedWorried', exec: () => { applyExpr('surprised'); setTimeout(() => { applyExpr('worried'); setTimeout(() => { applyExpr('softSmile'); setTimeout(resetExpr, 500); }, 600); }, 400); return 1500; } },
  ];

  return { daily, happy, shy, thinking, sleepy, sad, annoyed, encourage, playful, dreamy, surprised, dizzy: daily, smug: happy };
}

// ── Time Scene → Action Pool Weights ───────────────────────────────────────

export const SCENE_WEIGHTS: Record<TimeScene, Partial<Record<ActionPool, number>>> = {
  morning:   { sleepy: 4, daily: 3, dreamy: 2, shy: 1, thinking: 1 },
  noon:      { daily: 3, happy: 2, playful: 2, thinking: 1, sleepy: 1 },
  afternoon: { daily: 3, thinking: 2, happy: 1, dreamy: 1, playful: 1, encourage: 1 },
  evening:   { daily: 2, happy: 2, dreamy: 2, shy: 1, sleepy: 2 },
  latenight: { sleepy: 5, dreamy: 2, daily: 1, dizzy: 2, sad: 1 },
};

export const TONE_TO_POOL: Record<Tone, ActionPool | null> = {
  cheerful: 'happy', shy: 'shy', annoyed: 'annoyed', sad: 'sad',
  curious: 'thinking', encourage: 'encourage', tired: 'sleepy',
  surprised: 'surprised', calm: 'dreamy', neutral: null,
};

// ── Mood Color Map (for glassTint, eyeGlow, blush) ───────────────────────────
// Maps mood to accent color triplet [r,g,b] for UI elements outside the orb

export const MOOD_ACCENTS: Record<MoodName, { glassTint: string; eyeGlow: string; blush: string }> = {
  offline:  { glassTint: 'rgba(160,160,160,0.12)', eyeGlow: 'rgba(200,200,200,0.8)', blush: 'rgba(180,180,180,0.2)' },
  idle:     { glassTint: 'rgba(235,87,87,0.12)',  eyeGlow: 'rgba(255,255,255,0.9)', blush: 'rgba(255,130,130,0.25)' },
  happy:    { glassTint: 'rgba(255,193,7,0.15)',   eyeGlow: 'rgba(255,255,200,0.95)', blush: 'rgba(255,200,80,0.3)' },
  talking:  { glassTint: 'rgba(233,30,99,0.12)',  eyeGlow: 'rgba(255,200,220,0.95)', blush: 'rgba(255,130,160,0.35)' },
  thinking: { glassTint: 'rgba(103,58,183,0.12)', eyeGlow: 'rgba(200,230,255,0.9)', blush: 'rgba(130,160,255,0.2)' },
  sleepy:   { glassTint: 'rgba(186,147,170,0.10)', eyeGlow: 'rgba(220,200,210,0.8)', blush: 'rgba(200,160,180,0.2)' },
  surprised: { glassTint: 'rgba(255,215,0,0.18)',  eyeGlow: 'rgba(255,255,200,1)',   blush: 'rgba(255,220,80,0.3)' },
  sad:      { glassTint: 'rgba(66,165,245,0.12)',  eyeGlow: 'rgba(180,220,255,0.9)', blush: 'rgba(100,160,220,0.2)' },
  angry:    { glassTint: 'rgba(244,67,54,0.18)',    eyeGlow: 'rgba(255,180,180,0.9)', blush: 'rgba(255,100,80,0.3)' },
  fearful:  { glassTint: 'rgba(156,39,176,0.12)',  eyeGlow: 'rgba(220,180,255,0.9)', blush: 'rgba(180,100,220,0.2)' },
  calm:     { glassTint: 'rgba(77,182,172,0.12)',  eyeGlow: 'rgba(200,255,240,0.9)', blush: 'rgba(100,200,180,0.15)' },
  excited:  { glassTint: 'rgba(233,30,99,0.15)',  eyeGlow: 'rgba(255,200,220,0.95)', blush: 'rgba(255,80,140,0.35)' },
  love:     { glassTint: 'rgba(229,57,53,0.15)',  eyeGlow: 'rgba(255,200,200,0.95)', blush: 'rgba(255,80,120,0.4)' },
  focused:  { glassTint: 'rgba(0,151,167,0.12)',  eyeGlow: 'rgba(180,240,255,0.9)', blush: 'rgba(80,180,200,0.15)' },
};
