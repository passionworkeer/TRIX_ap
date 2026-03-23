import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Clock, KeyRound } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface PairingCode {
  code: string;
  createdAt: string;
  expiresAt: string;
  claimed: boolean;
  qrDataUrl?: string;
}

export function SettingsPairing(_props: SettingsSharedState) {
  const [pairingCodes, setPairingCodes] = useState<PairingCode[]>([]);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState<string | null>(null);
  const [revokingCode, setRevokingCode] = useState<string | null>(null);
  const [generatedQr, setGeneratedQr] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const loadPairingCodes = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setPairingLoading(true);
    setPairingError(null);
    try {
      const result = await api.pairingList();
      if (result.success && result.data) {
        setPairingCodes(result.data);
      } else {
        setPairingError(result.error ?? '加载失败');
        setPairingCodes([]);
      }
    } catch (err) {
      setPairingError(String(err));
    } finally {
      setPairingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPairingCodes();
  }, [loadPairingCodes]);

  const handleGeneratePairing = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setGeneratingCode(true);
    setPairingError(null);
    setPairingSuccess(null);
    setGeneratedQr(null);
    try {
      const result = await api.pairingGenerate();
      if (result.success && result.data) {
        setPairingSuccess(`配对码已生成: ${result.data.code.slice(0, 3)}***`);
        setGeneratedQr(result.data.qrDataUrl ?? null);
        await loadPairingCodes();
      } else {
        setPairingError(result.error ?? '生成失败');
      }
    } catch (err) {
      setPairingError(String(err));
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleRevokePairing = async (code: string) => {
    const api = window.electronAPI;
    if (!api) return;
    setRevokingCode(code);
    setPairingError(null);
    setPairingSuccess(null);
    try {
      const result = await api.pairingRevoke(code);
      if (result.success) {
        setPairingSuccess(`配对码 ${code.slice(0, 3)}*** 已撤销`);
        await loadPairingCodes();
      } else {
        setPairingError(result.error ?? '撤销失败');
      }
    } catch (err) {
      setPairingError(String(err));
    } finally {
      setRevokingCode(null);
    }
  };

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Generate new code */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
          生成新配对码
        </div>
        <p style={{ fontSize: 12, color: '#919191', marginBottom: 14, lineHeight: 1.6 }}>
          连接 TRIX Native 设备（手机/平板）到桌面端。配对码有效期 30 分钟。
        </p>
        {pairingError && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', color: '#ff6b6b', fontSize: 12, marginBottom: 12 }}>
            {pairingError}
          </div>
        )}
        {pairingSuccess && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontSize: 12, marginBottom: 12 }}>
            {pairingSuccess}
          </div>
        )}
        {generatedQr && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <img src={generatedQr} alt="Pairing QR Code" style={{ width: 160, height: 160, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }} />
            <p style={{ fontSize: 11, color: '#919191', marginTop: 8 }}>有效期 30 分钟，请尽快扫码</p>
          </div>
        )}
        <DarkButton icon={<KeyRound size={13} />} label={generatingCode ? '生成中...' : '生成配对码'} onClick={handleGeneratePairing} variant="primary" size="md" disabled={generatingCode} loading={generatingCode} />
      </DarkCard>

      {/* Active codes list */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>配对码列表</div>
          <DarkButton icon={<RefreshCw size={12} />} label="刷新" onClick={loadPairingCodes} variant="outline" size="sm" disabled={pairingLoading} />
        </div>

        {pairingLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ color: '#919191', fontSize: 12 }}>加载中...</div>
          </div>
        ) : pairingCodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#919191', fontSize: 12 }}>暂无配对码</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pairingCodes.map((pc) => {
              const expiryMs = pc.expiresAt ? new Date(pc.expiresAt).getTime() - Date.now() : 0;
              const isExpired = expiryMs <= 0;
              const mins = Math.floor(Math.max(0, expiryMs) / 60000);
              const secs = Math.floor((Math.max(0, expiryMs) % 60000) / 1000);
              const timeLeft = isExpired ? '已过期' : `${mins}m ${secs}s`;
              return (
                <div key={pc.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <code style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: '#e5e2e1', letterSpacing: '0.05em' }}>{pc.code.slice(0, 3)}***</code>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: pc.claimed ? 'rgba(74,222,128,0.1)' : isExpired ? 'rgba(255,107,107,0.1)' : 'rgba(99,14,212,0.15)', color: pc.claimed ? '#4ade80' : isExpired ? '#ff6b6b' : '#a78bfa', border: `1px solid ${pc.claimed ? 'rgba(74,222,128,0.2)' : isExpired ? 'rgba(255,107,107,0.2)' : 'rgba(99,14,212,0.3)'}` }}>
                        {pc.claimed ? '已使用' : isExpired ? '已过期' : '活跃'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#919191' }}>
                      <Clock size={11} />
                      {isExpired ? '已过期' : `剩余 ${timeLeft}`}
                    </div>
                  </div>
                  {!pc.claimed && !isExpired && (
                    <DarkButton icon={<Trash2 size={12} />} label="撤销" onClick={() => handleRevokePairing(pc.code)} variant="outline" size="sm" disabled={revokingCode === pc.code} loading={revokingCode === pc.code} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DarkCard>
    </div>
  );
}
