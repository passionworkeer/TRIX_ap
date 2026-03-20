import React, { useState, useCallback } from 'react';
import {
  Home,
  MessageSquare,
  BookOpen,
  Map,
  Camera,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  Zap,
  Users,
  FolderOpen,
  LayoutDashboard,
  MessageCircle,
} from 'lucide-react';

export type DesktopNavItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
};

export const DESKTOP_NAV_ITEMS: DesktopNavItem[] = [
  { id: 'home', icon: Home, label: '首页' },
  { id: 'chat', icon: MessageSquare, label: '聊天' },
  { id: 'study', icon: BookOpen, label: '学习' },
  { id: 'snapshot', icon: Camera, label: '拍照' },
  { id: 'map', icon: Map, label: '地图' },
  { id: 'profile', icon: User, label: '我的' },
];

export const DESKTOP_SETTINGS_ITEMS: DesktopNavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: '控制台' },
  { id: 'agents', icon: Bot, label: 'Agent 管理' },
  { id: 'channels', icon: MessageCircle, label: '渠道配置' },
  { id: 'skills', icon: Zap, label: 'Skill 管理' },
  { id: 'backups', icon: FolderOpen, label: '配置备份' },
  { id: 'settings', icon: Settings, label: '桌面设置' },
];

interface DesktopSidebarProps {
  activeItem: string;
  onNavigate: (id: string) => void;
}

export function DesktopSidebar({ activeItem, onNavigate }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const sidebarWidth = collapsed ? 56 : 200;
  const activeColor = '#818cf8';
  const hoverBg = 'rgba(255,255,255,0.06)';
  const itemColor = '#94a3b8';
  const sectionBg = 'rgba(255,255,255,0.03)';

  const NavButton = ({ item }: { item: DesktopNavItem }) => {
    const isActive = activeItem === item.id;
    return (
      <button
        onClick={() => onNavigate(item.id)}
        title={collapsed ? item.label : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : 10,
          padding: collapsed ? '10px 0' : '10px 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          border: 'none',
          borderRadius: 10,
          background: isActive ? 'rgba(129,140,248,0.12)' : 'transparent',
          color: isActive ? activeColor : itemColor,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = hoverBg;
            e.currentTarget.style.color = '#e2e8f0';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = itemColor;
          }
        }}
      >
        {isActive && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 3,
              height: 20,
              background: activeColor,
              borderRadius: '0 2px 2px 0',
            }}
          />
        )}
        <item.icon
          size={18}
          strokeWidth={isActive ? 2.2 : 1.9}
          style={{ flexShrink: 0 }}
        />
        {!collapsed && (
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </span>
        )}
        {item.badge && !collapsed && (
          <span
            style={{
              marginLeft: 'auto',
              background: '#ef4444',
              color: '#fff',
              borderRadius: 999,
              padding: '1px 6px',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        width: sidebarWidth,
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Logo / Brand */}
      <div
        style={{
          padding: collapsed ? '14px 0' : '14px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          justifyContent: collapsed ? 'center' : 'flex-start',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14 }}>🤖</span>
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#f1f5f9',
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap',
              }}
            >
              TRIX
            </div>
            <div
              style={{
                fontSize: 10,
                color: '#475569',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              Companion
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {/* Main nav */}
        {DESKTOP_NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'rgba(255,255,255,0.04)',
            margin: '8px 4px',
          }}
        />

        {/* Settings section */}
        {!collapsed && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#475569',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              padding: '4px 8px 6px',
            }}
          >
            管理
          </div>
        )}
        {DESKTOP_SETTINGS_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </div>

      {/* Collapse toggle */}
      <div
        style={{
          padding: '8px 6px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={toggleCollapse}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? '8px 0' : '8px 10px',
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            color: '#475569',
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontSize: 12,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = hoverBg;
            e.currentTarget.style.color = '#94a3b8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#475569';
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>收起</span>}
        </button>
      </div>
    </div>
  );
}
