import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { ArrowLeft, Navigation, Ghost } from 'lucide-react';
import L from 'leaflet';
import { getFriends } from '../services/databaseService';
import type { FriendLatestMessage } from '../config/supabase';

// 修复 Leaflet 默认图标丢失问题
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 模拟状态数据（实际应用中可能来自数据库）
interface FriendStatus {
  emoji: string;
  text: string;
}

const friendStatuses: Record<string, FriendStatus> = {
  'clawbot': { emoji: '🤖', text: '在线中' },
};

// 上海陆家嘴附近的坐标偏移（为好友生成 slightly 不同的位置）
const getOffsetPosition = (baseLat: number, baseLng: number, index: number) => {
  const offsets = [
    { lat: 0, lng: 0 },
    { lat: 0.002, lng: 0.003 },
    { lat: -0.001, lng: 0.002 },
    { lat: 0.001, lng: -0.002 },
    { lat: -0.002, lng: -0.001 },
  ];
  const offset = offsets[index % offsets.length];
  return { lat: baseLat + offset.lat, lng: baseLng + offset.lng };
};

// 创建 3D 贴纸风格的好友标记
const createFriendMarkerIcon = (friend: FriendLatestMessage, status: FriendStatus, index: number) => {
  const avatarUrl = friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`;

  return L.divIcon({
    className: 'friend-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translateY(-50%);
      ">
        <!-- 状态气泡 - 胶囊形状 -->
        <div style="
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 6px 14px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          margin-bottom: 8px;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          position: relative;
        ">
          <span style="font-size: 13px; color: white; font-weight: 500; display: flex; align-items: center; gap: 4px;">
            <span>${status.emoji}</span>
            <span>${status.text}</span>
          </span>
          <!-- 小三角形尖角 -->
          <div style="
            position: absolute;
            bottom: -5px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid rgba(0, 0, 0, 0.6);
          "></div>
        </div>

        <!-- 头像容器 - 3D 贴纸感 -->
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow:
            0 4px 8px rgba(0, 0, 0, 0.5),
            0 8px 24px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          overflow: hidden;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
          transform: translateZ(0);
        ">
          <img
            src="${avatarUrl}"
            alt="${friend.name}"
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
            "
            onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}'"
          />
        </div>
      </div>
    `,
    iconSize: [48, 100],
    iconAnchor: [24, 50],
    popupAnchor: [0, -50],
  });
};

// 创建发光热力圈（使用 blur 效果）
const createHeatIcon = () => {
  return L.divIcon({
    className: 'heat-marker',
    html: `
      <div style="
        position: relative;
        width: 256px;
        height: 256px;
        transform: translate(-50%, -50%);
        pointer-events: none;
      ">
        <!-- 外层光晕 -->
        <div style="
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.1) 40%, transparent 70%);
          border-radius: 50%;
          filter: blur(20px);
          animation: pulse-heat 3s ease-in-out infinite;
        "></div>
        <!-- 内层核心 -->
        <div style="
          position: absolute;
          inset: 20%;
          background: radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, rgba(239, 68, 68, 0.2) 50%, transparent 70%);
          border-radius: 50%;
          filter: blur(10px);
          animation: pulse-heat 3s ease-in-out infinite 0.5s;
        "></div>
        <!-- 脉冲环 -->
        <div style="
          position: absolute;
          inset: 10%;
          border: 2px solid rgba(239, 68, 68, 0.3);
          border-radius: 50%;
          animation: ripple 2s ease-out infinite;
        "></div>
      </div>
      <style>
        @keyframes pulse-heat {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      </style>
    `,
    iconSize: [256, 256],
    iconAnchor: [128, 128],
  });
};

// 定位按钮组件
const LocationButton: React.FC = () => {
  const map = useMap();

  const handleClick = () => {
    map.setView([31.2304, 121.4737], 15, {
      animate: true,
      duration: 1,
    });
  };

  return (
    <button
      onClick={handleClick}
      style={{
        position: 'absolute',
        bottom: '120px',
        right: '16px',
        zIndex: 1000,
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'rgba(0, 0, 0, 0.8)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
      }}
    >
      <Navigation size={24} color="white" />
    </button>
  );
};

const SnapMapScreen: React.FC = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendLatestMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载好友数据
  useEffect(() => {
    const loadFriends = async () => {
      try {
        setLoading(true);
        const data = await getFriends();
        // 只取前 3 个好友用于演示
        setFriends(data.slice(0, 3));
      } catch (error) {
        console.error('加载好友失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadFriends();
  }, []);

  // 上海陆家嘴中心坐标
  const center: [number, number] = [31.2304, 121.4737];

  // 生成好友标记
  const friendMarkers = useMemo(() => {
    return friends.map((friend, index) => {
      const pos = getOffsetPosition(center[0], center[1], index);
      const status = friendStatuses[friend.friend_id] || {
        emoji: ['☕', '👻', '🚗'][index % 3],
        text: ['喝咖啡中', '摸鱼', '开车'][index % 3],
      };

      return (
        <Marker
          key={friend.friend_id}
          position={[pos.lat, pos.lng]}
          icon={createFriendMarkerIcon(friend, status, index)}
        />
      );
    });
  }, [friends]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      {/* 顶部导航栏 */}
      <div
        style={
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            padding: '16px',
            paddingTop: '48px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          } as React.CSSProperties
        }
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
          }}
        >
          <ArrowLeft size={20} color="white" />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Ghost size={18} color="#FFFC00" />
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
            Snap Map
          </span>
        </div>

        <div style={{ width: '40px' }} />
      </div>

      {/* 地图容器 */}
      <MapContainer
        center={center}
        zoom={15}
        zoomControl={false}
        attributionControl={false}
        style={{
          width: '100%',
          height: '100%',
          background: '#0a0a0a',
        }}
      >
        {/* CartoDB Dark Matter 深色底图 */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* 热力圈 - 发光模糊光斑 */}
        <Marker
          position={[31.232, 121.475]}
          icon={createHeatIcon()}
          interactive={false}
        />

        {/* 好友标记 */}
        {!loading && friendMarkers}

        {/* 定位按钮 */}
        <LocationButton />
      </MapContainer>

      {/* 底部提示 */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          padding: '12px 24px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#00ff88',
            boxShadow: '0 0 10px #00ff88',
          }}
        />
        <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>
          {friends.length} 位好友 nearby
        </span>
      </div>
    </div>
  );
};

export default SnapMapScreen;
