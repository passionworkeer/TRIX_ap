import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, RefreshCw, Terminal, Package } from 'lucide-react';
import { DarkButton } from '../../stitch/noir/components/DarkButton';

interface PackageStatus {
  name: string;
  installed: boolean;
  version?: string;
  error?: string;
}

interface StartupCheckDialogProps {
  onClose: () => void;
}

export function StartupCheckDialog({ onClose }: StartupCheckDialogProps) {
  const [results, setResults] = useState<PackageStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installOutput, setInstallOutput] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    setResults(null);
    try {
      const data = await api.checkPackages();
      if (data.success && Array.isArray(data.data)) {
        setResults(data.data as PackageStatus[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { runCheck(); }, [runCheck]);

  const missing = results?.filter(r => !r.installed) || [];
  const allGood = missing.length === 0 && results !== null;

  const handleInstall = useCallback(async (pkgName: string, method: 'pnpm' | 'npm') => {
    const api = window.electronAPI;
    if (!api) return;
    setInstalling(pkgName);
    setInstallOutput('');
    try {
      // For now, show instruction to run command manually
      setInstallOutput(`${method === 'pnpm' ? 'pnpm' : 'npm'} install -g ${pkgName}\n请在终端中运行此命令`);
    } finally {
      setInstalling(null);
    }
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: '#1c1b1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} color="#4ade80" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e2e1' }}>环境检测</div>
            <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>检查 TRIX Companion 所需的依赖项</div>
          </div>
        </div>

        {/* Package List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {loading && <div style={{ textAlign: 'center', padding: 20, color: '#919191', fontSize: 13 }}>检测中...</div>}
          {!loading && results?.map(pkg => (
            <div key={pkg.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px',
              background: pkg.installed ? 'rgba(74,222,128,0.05)' : 'rgba(255,107,107,0.05)',
              border: `1px solid ${pkg.installed ? 'rgba(74,222,128,0.15)' : 'rgba(255,107,107,0.15)'}`,
              borderRadius: 10,
            }}>
              {pkg.installed
                ? <CheckCircle size={16} color="#4ade80" />
                : <XCircle size={16} color="#ff6b6b" />
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: pkg.installed ? '#e5e2e1' : '#ff6b6b' }}>{pkg.name}</div>
                {pkg.installed && pkg.version && (
                  <div style={{ fontSize: 11, color: '#919191', marginTop: 1 }}>v{pkg.version}</div>
                )}
                {!pkg.installed && (
                  <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 1 }}>未安装 {pkg.error || ''}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* All good message */}
        {allGood && (
          <div style={{ padding: '14px 16px', background: 'rgba(74,222,128,0.08)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#4ade80', lineHeight: 1.6 }}>
            所有依赖项已就绪，可以正常使用 TRIX Companion！
          </div>
        )}

        {/* Missing packages help */}
        {missing.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1', marginBottom: 10 }}>安装缺失项</div>
            {missing.map(pkg => (
              <div key={pkg.name} style={{ marginBottom: 10, padding: '10px 12px', background: '#141414', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#919191', marginBottom: 6 }}>
                  {pkg.name === 'openclaw' ? '安装 openclaw（推荐 pnpm）' : `安装 ${pkg.name}`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {pkg.name === 'pnpm' ? (
                    <DarkButton
                      label="安装 pnpm"
                      icon={<Terminal size={11} />}
                      onClick={() => handleInstall('pnpm', 'npm')}
                      variant="primary"
                      size="sm"
                      disabled={installing === 'pnpm'}
                      loading={installing === 'pnpm'}
                    />
                  ) : pkg.name === 'openclaw' ? (
                    <>
                      <DarkButton
                        label="pnpm i -g openclaw"
                        icon={<Terminal size={11} />}
                        onClick={() => handleInstall('openclaw', 'pnpm')}
                        variant="primary"
                        size="sm"
                        disabled={installing === 'openclaw'}
                        loading={installing === 'openclaw'}
                      />
                      <DarkButton
                        label="npm i -g openclaw"
                        icon={<Terminal size={11} />}
                        onClick={() => handleInstall('openclaw', 'npm')}
                        variant="outline"
                        size="sm"
                        disabled={installing === 'openclaw'}
                      />
                    </>
                  ) : (
                    <DarkButton
                      label={`安装 ${pkg.name}`}
                      icon={<Terminal size={11} />}
                      onClick={() => handleInstall(pkg.name.toLowerCase().replace('node.js', 'node'), 'npm')}
                      variant="primary"
                      size="sm"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Install output */}
        {installOutput && (
          <div style={{ padding: '10px 12px', background: '#0e0e0e', borderRadius: 10, marginBottom: 16, fontSize: 12, fontFamily: 'monospace', color: '#e5e2e1', whiteSpace: 'pre-wrap' }}>
            {installOutput}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <DarkButton label="重新检测" icon={<RefreshCw size={12} />} onClick={runCheck} variant="outline" size="md" disabled={loading} />
          <DarkButton label={allGood ? '开始使用' : '跳过'} onClick={onClose} variant={allGood ? 'primary' : 'ghost'} size="md" />
        </div>
      </div>
    </div>
  );
}
