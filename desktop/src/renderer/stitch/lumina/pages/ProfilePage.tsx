import React, { useState, useEffect, useRef } from 'react';
import {
  Edit, Share2, Shield,
  Monitor, ChevronRight, Plus,
  MessageCircle, CheckCircle, Lock, Award,
  X, Zap, Activity,
} from 'lucide-react';
import { LuminaButton } from '../components/buttons';
import { SurfaceCard } from '../components/cards';
import { LuminaInput } from '../components/inputs';

// ── Types ────────────────────────────────────────────────────────────────────

interface Achievement {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  earned: boolean;
  lockedLabel?: string;
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
  const canEditProfile = false;
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [profileStats, setProfileStats] = useState<{
    displayName: string;
    points: number;
    streak: number;
    level: number;
  }>({ displayName: 'TRIX 用户', points: 0, streak: 0, level: 1 });

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Edit profile modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNickname, setEditNickname] = useState(profileStats.displayName);
  const [editLocation, setEditLocation] = useState('');

  // Achievement detail
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  // Load achievements + profile stats from IPC (Supabase via main process)
  useEffect(() => {
    if (!api) return;

    api.getAchievements().then((result) => {
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        setAchievements(result.data.map((a) => ({
          id: a.id,
          icon: typeof a.icon === 'string' ? <span style={{ fontSize: 22 }}>{a.icon}</span> : a.icon,
          label: a.label,
          description: '已解锁此成就徽章',
          earned: a.earned,
        })));
      } else {
        setAchievements([]);
      }
    }).catch(() => {
      setAchievements([]);
    });

    api.getProfileStats().then((result: { success: boolean; data?: { displayName: string; points: number; streak: number; level: number } }) => {
      if (result.success && result.data) {
        setProfileStats(result.data);
        setEditNickname(result.data.displayName);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function openEditModal() {
    if (!canEditProfile) return;
    setEditNickname(profileStats.displayName);
    setEditLocation('');
    setEditModalOpen(true);
  }

  function saveProfile() {
    if (!canEditProfile) {
      setEditModalOpen(false);
      return;
    }
    setProfileStats((prev) => ({ ...prev, displayName: editNickname }));
    setEditModalOpen(false);
  }

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
  const profileInitials = profileStats.displayName
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TR';

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
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="头像"
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    boxShadow: `0 4px 20px ${C.primary}30`,
                  }}
                />
              ) : (
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
                  {profileInitials}
                </div>
              )}
              {/* Hidden file input */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              {/* Edit overlay */}
              <button
                onClick={() => avatarInputRef.current?.click()}
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
                  {profileStats.displayName}
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
                  { icon: <Zap size={12} />, text: `${profileStats.points} 积分` },
                  { icon: <Activity size={12} />, text: `Lv.${profileStats.level}` },
                  { icon: <Award size={12} />, text: `连续 ${profileStats.streak} 天` },
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
                  onClick={openEditModal}
                  disabled={!canEditProfile}
                />
                <LuminaButton
                  variant="outline"
                  size="md"
                  icon={<Share2 size={13} />}
                  label="分享名片"
                  onClick={() => {}}
                  disabled
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
            {achievements.length === 0 ? (
              <div
                style={{
                  padding: '14px 4px',
                  fontSize: 12,
                  color: C.onSurfaceVariant,
                  lineHeight: 1.7,
                }}
              >
                当前账号还没有同步到真实成就数据，页面不再显示演示徽章。
              </div>
            ) : (
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
                    onClick={() => { if (achievement.earned) setSelectedAchievement(achievement); }}
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
                      {achievement.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
              <ListItemRow
                icon={<Shield size={18} />}
                title="账户安全"
                subtitle="查看安全设置"
                onClick={() => {}}
              />
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
                disabled
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
                  cursor: 'not-allowed',
                  transition: 'all 0.15s',
                  opacity: 0.5,
                }}
              >
                <Plus size={12} />
                暂未接入
              </button>
            </div>

            {/* Social account rows */}
            <div style={{ padding: '0 20px 4px' }}>
              {socialAccounts.length === 0 ? (
                <div style={{ padding: '12px 0 16px', fontSize: 12, color: C.onSurfaceVariant, lineHeight: 1.7 }}>
                  当前桌面端还没有接入真实的社交账号绑定能力，这里不再展示演示账号或本地假连接状态。
                </div>
              ) : (
                socialAccounts.map((account) => (
                  <SocialAccountRow
                    key={account.id}
                    account={account}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                  />
                ))
              )}
            </div>
          </SurfaceCard>
        </div>

      </div>

      {/* ── Edit Profile Modal ─────────────────────────────────────────── */}
      {editModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditModalOpen(false); }}
        >
          <div style={{
            background: C.surfaceLowest,
            borderRadius: 20,
            padding: '28px 28px 24px',
            width: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.onSurface, margin: 0 }}>
                编辑资料
              </h2>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: 'none', background: C.surfaceLow, color: C.onSurfaceVariant,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
            {/* Nickname */}
            <div style={{ marginBottom: 16 }}>
              <LuminaInput
                label="昵称"
                placeholder="输入你的昵称"
                value={editNickname}
                onChange={setEditNickname}
              />
            </div>
            {/* Location */}
            <div style={{ marginBottom: 28 }}>
              <LuminaInput
                label="所在地"
                placeholder="输入你的城市"
                value={editLocation}
                onChange={setEditLocation}
              />
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  border: `1px solid ${C.outlineVariant}`,
                  background: 'transparent', color: C.onSurfaceVariant,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={saveProfile}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  border: 'none',
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
                  color: C.onPrimary,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  boxShadow: `0 4px 16px ${C.primary}40`,
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Achievement Detail Modal ───────────────────────────────────── */}
      {selectedAchievement && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedAchievement(null); }}
        >
          <div style={{
            background: C.surfaceLowest,
            borderRadius: 20,
            padding: '32px 28px 24px',
            width: 340,
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {/* Badge icon */}
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: `${C.primary}14`,
              border: `2px solid ${C.primary}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              color: C.primary,
            }}>
              {selectedAchievement.icon}
            </div>
            {/* Title */}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.onSurface, margin: '0 0 8px' }}>
              {selectedAchievement.label}
            </h2>
            {/* Status badge */}
            <span style={{
              display: 'inline-block',
              padding: '3px 12px',
              borderRadius: 999,
              background: `${C.success}14`,
              color: C.success,
              fontSize: 11, fontWeight: 700,
              marginBottom: 14,
            }}>
              已解锁
            </span>
            {/* Description */}
            <p style={{
              fontSize: 13.5, color: C.onSurfaceVariant,
              lineHeight: 1.6, margin: '0 0 24px',
            }}>
              {selectedAchievement.description}
            </p>
            {/* Close button */}
            <button
              onClick={() => setSelectedAchievement(null)}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10,
                border: 'none',
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
                color: C.onPrimary,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                boxShadow: `0 4px 16px ${C.primary}40`,
              }}
            >
              知道了
            </button>
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.outlineVariant}; border-radius: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}
