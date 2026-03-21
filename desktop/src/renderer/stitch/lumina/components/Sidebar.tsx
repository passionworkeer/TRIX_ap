import React, { useState } from 'react';
import {
  Home,
  MessageSquare,
  BookOpen,
  Camera,
  Map,
  User,
  LayoutDashboard,
  Bot,
  MessageCircle,
  Zap,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type SidebarRoute =
  | 'home' | 'chat' | 'study' | 'snapshot' | 'map' | 'profile'
  | 'dashboard' | 'agents' | 'channels' | 'skills' | 'backups' | 'settings';

interface NavItem {
  id: SidebarRoute;
  icon: React.ElementType;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: Home, label: '首页' },
  { id: 'chat', icon: MessageSquare, label: '聊天' },
  { id: 'study', icon: BookOpen, label: '学习' },
  { id: 'snapshot', icon: Camera, label: '拍照' },
  { id: 'map', icon: Map, label: '地图' },
  { id: 'profile', icon: User, label: '我的' },
];

const MANAGEMENT_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: '控制台' },
  { id: 'agents', icon: Bot, label: 'Agent 管理' },
  { id: 'channels', icon: MessageCircle, label: '渠道配置' },
  { id: 'skills', icon: Zap, label: 'Skill 管理' },
  { id: 'backups', icon: FolderOpen, label: '配置备份' },
  { id: 'settings', icon: Settings, label: '桌面设置' },
];

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 240;

interface SidebarProps {
  activeRoute: SidebarRoute;
  onNavigate: (id: SidebarRoute) => void;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

interface NavButtonProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const NavButton = (props: NavButtonProps) => {
  const { item, active, collapsed, onClick } = props;
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        width: '100%',
        padding: collapsed ? '8px 0' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: active ? '#eceef0' : 'transparent',
        color: active ? '#630ed4' : '#4a4455',
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        outline: 'none',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = '#eceef0';
          el.style.color = '#191c1e';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = 'transparent';
          el.style.color = '#4a4455';
        }
      }}
    >
      {active && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 20,
            background: '#630ed4',
            borderRadius: '0 2px 2px 0',
          }}
        />
      )}

      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      {!collapsed && <span>{item.label}</span>}
    </button>
  );
};

export const LuminaSidebar = (props: SidebarProps) => {
  const { activeRoute, onNavigate } = props;
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = props.collapsed ?? internalCollapsed;
  const setCollapsed = props.onCollapse ?? setInternalCollapsed;

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <div
      style={{
        width,
        height: '100%',
        background: '#f2f4f6',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        borderRight: '1px solid #e6e8ea',
        userSelect: 'none',
      }}
    >
      {/* Collapse toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-end',
          padding: collapsed ? '12px 0' : '12px 12px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: '1px solid #ccc3d8',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4a4455',
            transition: 'all 0.15s',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = '#e6e8ea';
            el.style.borderColor = '#630ed4';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = 'transparent';
            el.style.borderColor = '#ccc3d8';
          }}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Navigation items */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingLeft: collapsed ? 8 : 12,
          paddingRight: collapsed ? 8 : 12,
          paddingBottom: 16,
        }}
      >
        {!collapsed && (
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#4a4455',
              opacity: 0.5,
              margin: '0 0 6px 0',
              paddingLeft: 4,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            导航
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeRoute === item.id}
              collapsed={collapsed}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>

        <div
          style={{
            margin: '12px 4px',
            borderTop: '1px solid #ccc3d8',
            opacity: 0.4,
          }}
        />

        {!collapsed && (
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#4a4455',
              opacity: 0.5,
              margin: '0 0 6px 0',
              paddingLeft: 4,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            管理
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {MANAGEMENT_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeRoute === item.id}
              collapsed={collapsed}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ccc3d8; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #7b7487; }
      `}</style>
    </div>
  );
};
