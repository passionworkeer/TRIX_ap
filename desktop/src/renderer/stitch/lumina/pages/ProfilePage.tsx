import React, { useState, useEffect } from 'react';
import {
  User, Edit, Share2, Shield, Key, Smartphone,
  Monitor, ChevronRight, Plus, Twitter, Github,
  MessageCircle, CheckCircle, Lock, Award, Calendar,
  MapPin, CreditCard, Wifi,
} from 'lucide-react';
import { LuminaButton } from '../components/buttons';
import { SurfaceCard } from '../components/cards';

// ── Types ────────────────────────────────────────────────────────────────────

interface Achievement {
  id: string;
  icon: React.ReactNode;
  label: string;
  earned: boolean;
  lockedLabel?: string;
}

interface SecurityItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}

interface SocialAccount {
  id: string;
  icon: React.ReactNode;
  name: string;
  username: string;
  connected: boolean;
}

// ── Design Tokens ─────────────────────────────────────────────────────────────

const C = {
  primary: '#630ed4',
  primaryContainer: '#7c3aed',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#ede0ff',
  surfaceLowest: '#ffffff',
  surfaceLow: '#f2f4f6',
  surfaceHigh: '#e6e8ea',
  surfaceContainer: '#eceef0',
  surfaceBright: '#f7f9fb',
  onSurface: '#191c1e',
  onSurfaceVariant: '#4a4455',
  outline: '#7b7487',
  outlineVariant: '#ccc3d8',
  success: '#1a7a4a',
  successBg: '#d1fae5',
  successText: '#065f46',
  successBorder: '#6ee7b7',
  textTertiary: '#7b7280',
  disabledBg: '#f3f4f6',
  disabledText: '#9ca3af',
} as const;

// ── Demo fallback data ────────────────────────────────────────────────────────

const DEMO_ACHIEVEMENTS: Achievement[] = [
  { id: '1', icon: <User size={20} />, label: '首次配对', earned: true },
  { id: '2', icon: <Award size={20} />, label: '7天连续活跃', earned: true },
  { id: '3', icon: <MessageCircle size={20} />, label: 'AI 对话大师', earned: true },
  { id: '4', icon: <Share2 size={20} />, label: '首次分享', earned: true },
  { id: '5', icon: <Shield size={20} />, label: '安全先锋', earned: true },
  { id: '6', icon: <Key size={20} />, label: 'API 探索者', earned: true },
  { id: '7', icon: <Wifi size={20} />, label: '跨端互联', earned: false },
  { id: '8', icon: <CreditCard size={20} />, label: '付费用户', earned: false },
  { id: '9', icon: <Calendar size={20} />, label: '一周年纪念', earned: false },
];

const MOCK_SECURITY_ITEMS: SecurityItem[] = [
  {
    id: '1',
    icon: <Shield size={18} />,
    title: '双重验证',
    subtitle: '已启用',
    trailing: (
      <span style={{
        padding: '3px 10px',
        borderRadius: 999,
        background: C.successBg,
        color: C.successText,
        fontSize: 11,
        fontWeight: 600,
      }}>
        已保护
      </span>
    ),
  },
  {
    id: '2',
    icon: <Key size={18} />,
    title: '修改密码',
    subtitle: '上次更新于 30 天前',
  },
  {
    id: '3',
    icon: <Smartphone size={18} />,
    title: '登录设备管理',
    subtitle: '2 台设备',
  },
];

const MOCK_SOCIAL_ACCOUNTS: SocialAccount[] = [
  {
    id: '1',
    icon: <Twitter size={18} color="#1DA1F2" />,
    name: 'Twitter',
    username: '@langwang_dev',
    connected: true,
  },
  {
    id: '2',
    icon: <Github size={18} color="#333333" />,
    name: 'GitHub',
    username: 'langwang',
    connected: true,
  },
  {
    id: '3',
    icon: <MessageCircle size={18} color="#5865F2" />,
    name: 'Discord',
    username: '',
    connected: false,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

interface ListItemRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}

const ListItemRow = (props: ListItemRowProps) => {
  const { icon, title, subtitle, trailing, onClick } = props;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 0',
        borderBottom: `1px solid ${C.outlineVariant}20`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.opacity = '0.75';
      }}
      onMouseLeave={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.opacity = '1';
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${C.primary}10`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: C.primary,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.onSurface, marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: C.onSurfaceVariant }}>
          {subtitle}
        </div>
      </div>
      {trailing ? (
        trailing
      ) : (
        <ChevronRight size={16} color={C.outline} style={{ flexShrink: 0 }} />
      )}
    </div>
  );
};

interface SocialAccountRowProps {
  account: SocialAccount;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

const SocialAccountRow = (props: SocialAccountRowProps) => {
  const { account, onConnect, onDisconnect } = props;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 0',
        borderBottom: `1px solid ${C.outlineVariant}20`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: C.surfaceLow,
          border: `1px solid ${C.outlineVariant}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {account.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.onSurface, marginBottom: 2 }}>
          {account.name}
        </div>
        {account.connected ? (
          <div style={{ fontSize: 12, color: C.onSurfaceVariant }}>
            {account.username}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.disabledText }}>
            未连接
          </div>
        )}
      </div>
      {account.connected ? (
        <button
          onClick={() => onDisconnect(account.id)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            padding: '5px 14px',
            borderRadius: 8,
            border: `1px solid ${hovered ? C.primary : C.outlineVariant}`,
            background: hovered ? `${C.primary}08` : 'transparent',
            color: hovered ? C.primary : C.onSurfaceVariant,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          断开
        </button>
      ) : (
        <button
          onClick={() => onConnect(account.id)}
          style={{
            padding: '5px 14px',
            borderRadius: 8,
            border: `1px solid ${C.primary}50`,
            background: `${C.primary}08`,
            color: C.primary,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}18`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}08`;
          }}
        >
          连接
        </button>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const api = window.electronAPI;
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>(MOCK_SOCIAL_ACCOUNTS);
  const [achievements, setAchievements] = useState<Achievement[]>(DEMO_ACHIEVEMENTS);
  const [, setProfileStats] = useState<{
    displayName: string;
    points: number;
    streak: number;
    level: number;
  }>({ displayName: 'TRIX 用户', points: 0, streak: 0, level: 1 });

  // Load achievements + profile stats from IPC (Supabase via main process)
  useEffect(() => {
    if (!api) return;

    api.getAchievements().then((result: { success: boolean; data?: Achievement[] }) => {
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        setAchievements(result.data.map((a: Achievement) => ({
          id: a.id,
          icon: typeof a.icon === 'string' ? <span style={{ fontSize: 22 }}>{a.icon}</span> : a.icon,
          label: a.label,
          earned: a.earned,
        })));
      }
      // else: keep DEMO_ACHIEVEMENTS
    }).catch(() => {});

    api.getProfileStats().then((result: { success: boolean; data?: { displayName: string; points: number; streak: number; level: number } }) => {
      if (result.success && result.data) {
        setProfileStats(result.data);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = (id: string) => {
    setSocialAccounts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, connected: true, username: '已连接账号' } : a,
      ),
    );
  };

  const handleDisconnect = (id: string) => {
    setSocialAccounts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, connected: false, username: '' } : a,
      ),
    );
  };

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: C.surfaceBright,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ padding: '36px 40px 60px', maxWidth: 720, margin: '0 auto' }}>

        {/* ── Profile Header ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  fontWeight: 700,
                  color: C.onPrimary,
                  letterSpacing: '0.02em',
                  boxShadow: `0 4px 20px ${C.primary}30`,
                }}
              >
                LW
              </div>
              {/* Edit overlay */}
              <button
                onClick={() => {}}
                title="更换头像"
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `2px solid ${C.surfaceLowest}`,
                  background: C.primary,
                  color: C.onPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: `0 2px 8px ${C.primary}40`,
                  transition: 'transform 0.15s',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
              >
                <Edit size={12} />
              </button>
            </div>

            {/* Name + badge + info */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: C.onSurface, margin: 0 }}>
                  Lang Wang
                </h1>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: `${C.primary}12`,
                    color: C.primary,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  高级账户
                </span>
              </div>

              {/* Info grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, auto)',
                  gap: '4px 24px',
                  marginBottom: 16,
                }}
              >
                {[
                  { icon: <Calendar size={12} />, text: '注册于 2024-01-15' },
                  { icon: <MapPin size={12} />, text: '北京市' },
                  { icon: <CreditCard size={12} />, text: '年付订阅' },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      color: C.onSurfaceVariant,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: C.outline }}>{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <LuminaButton
                  variant="primary"
                  size="md"
                  icon={<Edit size={13} />}
                  label="编辑资料"
                  onClick={() => {}}
                />
                <LuminaButton
                  variant="outline"
                  size="md"
                  icon={<Share2 size={13} />}
                  label="分享名片"
                  onClick={() => {}}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Achievements Grid ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.onSurface, margin: 0 }}>
              成就徽章
            </h2>
            <span style={{ fontSize: 12, color: C.onSurfaceVariant }}>
              {earnedCount} / {achievements.length} 已获得
            </span>
          </div>
          <SurfaceCard elevation="low" style={{ padding: 20 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
              }}
            >
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 10px',
                    borderRadius: 12,
                    background: achievement.earned ? `${C.primary}06` : C.disabledBg,
                    border: achievement.earned
                      ? `1px solid ${C.primary}18`
                      : `1px solid ${C.outlineVariant}20`,
                    transition: 'all 0.15s',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    if (achievement.earned) {
                      (e.currentTarget as HTMLDivElement).style.background = `${C.primary}12`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (achievement.earned) {
                      (e.currentTarget as HTMLDivElement).style.background = `${C.primary}06`;
                    }
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: achievement.earned
                        ? `${C.primary}18`
                        : `${C.disabledText}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: achievement.earned ? C.primary : C.disabledText,
                    }}
                  >
                    {achievement.earned ? achievement.icon : <Lock size={16} />}
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: achievement.earned ? 600 : 500,
                      color: achievement.earned ? C.onSurface : C.disabledText,
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}
                  >
                    {achievement.earned ? achievement.label : achievement.label}
                  </span>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        {/* ── Account Security ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <SurfaceCard elevation="low" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px 14px',
                borderBottom: `1px solid ${C.outlineVariant}20`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color={C.primary} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: C.onSurface, margin: 0 }}>
                  账户安全
                </h2>
              </div>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: C.successBg,
                  color: C.successText,
                  fontSize: 11,
                  fontWeight: 700,
                  border: `1px solid ${C.successBorder}`,
                }}
              >
                <CheckCircle size={11} />
                已保护
              </span>
            </div>

            {/* List items */}
            <div style={{ padding: '0 20px 4px' }}>
              {MOCK_SECURITY_ITEMS.map((item) => (
                <ListItemRow
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  trailing={item.trailing}
                  onClick={() => {}}
                />
              ))}
              {/* Last item — no border */}
              <ListItemRow
                icon={<Monitor size={18} />}
                title="账户数据"
                subtitle="查看所有登录活动"
                onClick={() => {}}
              />
            </div>
          </SurfaceCard>
        </div>

        {/* ── Social Connections ─────────────────────────────────────────── */}
        <div>
          <SurfaceCard elevation="low" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px 14px',
                borderBottom: `1px solid ${C.outlineVariant}20`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={16} color={C.primary} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: C.onSurface, margin: 0 }}>
                  社交连接
                </h2>
              </div>
              <button
                onClick={() => {}}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: `1px solid ${C.primary}50`,
                  background: `${C.primary}08`,
                  color: C.primary,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}18`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}08`;
                }}
              >
                <Plus size={12} />
                添加更多
              </button>
            </div>

            {/* Social account rows */}
            <div style={{ padding: '0 20px 4px' }}>
              {socialAccounts.map((account) => (
                <SocialAccountRow
                  key={account.id}
                  account={account}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          </SurfaceCard>
        </div>

      </div>

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.outlineVariant}; border-radius: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}
