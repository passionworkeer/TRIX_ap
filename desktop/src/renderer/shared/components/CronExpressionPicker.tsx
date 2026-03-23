import { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface CronPreset {
  label: string;
  expr: string;
  desc: string;
}

const PRESETS: CronPreset[] = [
  { label: '每小时整点',    expr: '0 * * * *',     desc: '每小时的第 0 分钟执行' },
  { label: '每 30 分钟',    expr: '*/30 * * * *',  desc: '每 30 分钟执行一次' },
  { label: '每 15 分钟',    expr: '*/15 * * * *',  desc: '每 15 分钟执行一次' },
  { label: '每天 9:00',     expr: '0 9 * * *',     desc: '每天上午 9:00 执行' },
  { label: '每天 9:00 & 18:00', expr: '0 9,18 * * *', desc: '每天 9:00 和 18:00 执行' },
  { label: '每周一 9:00',   expr: '0 9 * * 1',     desc: '每周一上午 9:00 执行' },
  { label: '每月 1 号 9:00', expr: '0 9 1 * *',   desc: '每月 1 号上午 9:00 执行' },
  { label: '每工作日 9:00',  expr: '0 9 * * 1-5',  desc: '周一至周五 9:00 执行' },
];

function parseCron(expr: string): { next: string } | null {
  // Simple cron parser — extract hour/minute/day info for preview
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const [minRaw, hourRaw, dom, mon, dow] = parts;
  const min = minRaw ?? '*';
  const hour = hourRaw ?? '*';
  const mins = min === '*' ? [] : min.includes('/') ? [parseInt(min.split('/')[1] ?? '0')] : min.split(',').map(Number);
  const hrs = hour === '*' ? [] : hour.includes('/') ? [] : hour.split(',').map(Number);

  if (dom === '*' && mon === '*' && dow === '*') {
    // Daily
    if (hrs.length > 0 && mins.length > 0) {
      const h = hrs[0], m = mins[0];
      return { next: `每天 ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} 执行` };
    }
    if (hrs.length > 0) return { next: `每天 ${hrs[0]}:00 执行` };
    if (mins.length > 0) return { next: `每 ${mins[0]} 分钟执行` };
    return null;
  }
  if (dow !== '*') return { next: `每周执行 (dow=${dow})` };
  if (dom !== '*') return { next: `每月 ${dom} 号执行` };
  return { next: expr };
}

interface CronExpressionPickerProps {
  value: string;
  onChange: (expr: string) => void;
}

export function CronExpressionPicker({ value, onChange }: CronExpressionPickerProps) {
  const [custom, setCustom] = useState(value);
  const [selectedPreset, setSelectedPreset] = useState<CronPreset | null>(
    PRESETS.find(p => p.expr === value) || null
  );

  const handlePreset = useCallback((preset: CronPreset) => {
    setSelectedPreset(preset);
    setCustom(preset.expr);
    onChange(preset.expr);
  }, [onChange]);

  const handleCustom = useCallback((v: string) => {
    setCustom(v);
    setSelectedPreset(null);
    onChange(v);
  }, [onChange]);

  const preview = parseCron(custom || value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Presets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {PRESETS.map(preset => (
          <div
            key={preset.expr}
            onClick={() => handlePreset(preset)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              border: selectedPreset?.expr === preset.expr
                ? '1px solid rgba(255,255,255,0.3)'
                : '1px solid rgba(255,255,255,0.07)',
              background: selectedPreset?.expr === preset.expr
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(255,255,255,0.03)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: '#e5e2e1' }}>{preset.label}</div>
            <div style={{ fontSize: 10, color: '#919191', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{preset.expr}</div>
          </div>
        ))}
      </div>

      {/* Custom Input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#919191', width: 50, flexShrink: 0 }}>自定义</div>
        <input
          value={custom}
          onChange={e => handleCustom(e.target.value)}
          placeholder="* * * * *"
          style={{
            flex: 1,
            background: '#0e0e0e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 10px',
            color: '#e5e2e1',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            outline: 'none',
          }}
        />
        {selectedPreset && (
          <div style={{ fontSize: 11, color: '#4ade80', flexShrink: 0 }}>
            ✓ 已选预设
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(74,222,128,0.06)',
          border: '1px solid rgba(74,222,128,0.12)',
          borderRadius: 8,
          fontSize: 12,
          color: '#4ade80',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <RefreshCw size={11} />
          {preview.next}
        </div>
      )}

      {/* Help */}
      <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>
        格式: 分 时 日 月 周 — 例如 <span style={{ fontFamily: 'monospace', color: '#919191' }}>0 9 * * 1-5</span> = 工作日 9:00
      </div>
    </div>
  );
}
