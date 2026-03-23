import { useState, useEffect, useCallback } from 'react';
import { LogIn, LogOut, User, Shield, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface Session {
  user?: { email?: string };
  access_token?: string;
}

export function SettingsAccount(_props: SettingsSharedState) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const loadAuthSession = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    api.authGetSession().then((result) => {
      if (result.success && result.data) setSession(result.data as Session);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadAuthSession(); }, [loadAuthSession]);

  const handleAuthSubmit = async () => {
    if (!authEmail.trim() || !authPassword) return;
    const api = window.electronAPI;
    if (!api) return;
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      if (authMode === 'signin') {
        const result = await api.authSignIn(authEmail.trim(), authPassword);
        if (result.success && result.data) {
          setSession(result.data as Session);
          setAuthSuccess('登录成功');
          setAuthEmail('');
          setAuthPassword('');
        } else {
          setAuthError(result.error || '登录失败');
        }
      } else {
        const result = await api.authSignUp(authEmail.trim(), authPassword);
        if (result.success) {
          setAuthSuccess('注册成功，请查收确认邮件');
          setAuthMode('signin');
        } else {
          setAuthError(result.error || '注册失败');
        }
      }
    } catch (err) {
      setAuthError(String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    const api = window.electronAPI;
    if (!api) return;
    await api.authSignOut();
    setSession(null);
    setAuthSuccess(null);
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Shield size={16} color="#630ed4" />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>账户</div>
        </div>

        {session ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(99,14,212,0.08)', border: '1px solid rgba(99,14,212,0.2)', marginBottom: 18 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #630ed4, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={18} color="#ffffff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1', marginBottom: 2 }}>{session.user?.email || '已登录用户'}</div>
                <div style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} />已认证</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontSize: 11, fontWeight: 600, border: '1px solid rgba(74,222,128,0.2)', flexShrink: 0 }}>已登录</span>
            </div>
            <p style={{ fontSize: 12, color: '#919191', marginBottom: 16, lineHeight: 1.6 }}>
              登录后可同步学习数据（待办事项、学习记录、成就徽章）到云端。
            </p>
            <DarkButton icon={<LogOut size={13} />} label="退出登录" onClick={handleSignOut} variant="outline" size="md" />
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 12, color: '#919191', marginBottom: 18, lineHeight: 1.6 }}>
              登录后数据自动同步云端，支持 StudyPage 待办和 ProfilePage 成就。
            </p>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3, marginBottom: 16 }}>
              {(['signin', 'signup'] as const).map((mode) => (
                <button key={mode} onClick={() => { setAuthMode(mode); setAuthError(null); setAuthSuccess(null); }}
                  style={{ flex: 1, padding: '7px 8px', borderRadius: 6, border: 'none', background: authMode === mode ? 'rgba(255,255,255,0.1)' : 'transparent', color: authMode === mode ? '#e5e2e1' : '#919191', fontSize: 12, fontWeight: authMode === mode ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'system-ui, sans-serif' }}>
                  {mode === 'signin' ? '登录' : '注册'}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#919191', marginBottom: 6, fontWeight: 500 }}>邮箱</label>
              <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="your@email.com"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e5e2e1', fontSize: 13, fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(99,14,212,0.5)'; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#919191', marginBottom: 6, fontWeight: 500 }}>密码</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="至少 6 位"
                  style={{ width: '100%', padding: '9px 40px 9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e5e2e1', fontSize: 13, fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(99,14,212,0.5)'; }}
                  onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAuthSubmit(); }} />
                <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#919191', padding: 4, display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {authError && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', color: '#ff6b6b', fontSize: 12, marginBottom: 12 }}>{authError}</div>}
            {authSuccess && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontSize: 12, marginBottom: 12 }}>{authSuccess}</div>}

            <DarkButton icon={authLoading ? undefined : <LogIn size={13} />} label={authLoading ? (authMode === 'signin' ? '登录中...' : '注册中...') : (authMode === 'signin' ? '登录' : '注册账户')} onClick={handleAuthSubmit} variant="primary" size="md" disabled={authLoading || !authEmail.trim() || authPassword.length < 6} loading={authLoading} style={{ width: '100%' }} />
            {authMode === 'signup' && <p style={{ fontSize: 11, color: '#919191', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>注册即表示同意我们的服务条款。密码将加密存储。</p>}
          </div>
        )}
      </DarkCard>
    </div>
  );
}
