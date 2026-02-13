import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { ArrowLeft, Navigation, Map as MapIcon } from 'lucide-react';
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

// 本地 3D PNG 图片路径
const HERO_3D_IMAGE = '/assets/hero_render.png';

// 好友状态模拟数据
interface FriendStatus {
  emoji: string;
  text: string;
}

const friendStatuses: Record<string, FriendStatus> = {
  'clawbot': { emoji: '🤖', text: 'Coding...' },
};

// 上海陆家嘴附近的坐标偏移
const getOffsetPosition = (baseLat: number, baseLng: number, index: number) => {
  const offsets = [
    { lat: 0.001, lng: 0.002 },
    { lat: -0.001, lng: 0.003 },
    { lat: 0.002, lng: -0.002 },
  ];
  const offset = offsets[index % offsets.length];
  return { lat: baseLat + offset.lat, lng: baseLng + offset.lng };
};

// 创建 3D PNG Avatar 标记
const create3DAvatarIcon = (friend: FriendLatestMessage, status: FriendStatus) => {
  return L.divIcon({
    className: 'avatar-3d-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translateY(-100%);
      ">
        <!-- 状态标签 -->
        <div style="
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          padding: 6px 14px;
          border-radius: 20px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
          margin-bottom: 4px;
          white-space: nowrap;
          border: 1px solid rgba(0, 0, 0, 0.05);
          font-size: 13px;
          font-weight: 600;
          color: #333;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span>${status.emoji}</span>
          <span>${status.text}</span>
          <!-- 小三角 -->
          <div style="
            position: absolute;
            bottom: -5px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid rgba(255, 255, 255, 0.95);
          "></div>
        </div>

        <!-- 3D 角色图片 -->
        <div style="
          width: 80px;
          height: 80px;
          position: relative;
          filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.3));
        ">
          <img
            src="${HERO_3D_IMAGE}"
            alt="${friend.name}"
            style="
              width: 100%;
              height: 100%;
              object-fit: contain;
              object-position: bottom;
            "
          />
        </div>

        <!-- 底座投影 -->
        <div style="
          width: 40px;
          height: 8px;
          background: radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, transparent 70%);
          border-radius: 50%;
          margin-top: -5px;
        "></div>
      </div>
    `,
    iconSize: [80, 120],
    iconAnchor: [40, 80],
    popupAnchor: [0, -60],
  });
};

// 创建发光热力圈（柔和风格）
const createHeatIcon = () => {
  return L.divIcon({
    className: 'heat-marker',
    html: `
      <div style="
        position: relative;
        width: 200px;
        height: 200px;
        transform: translate(-50%, -50%);
        pointer-events: none;
      ">
        <!-- 外层柔和光晕 -->
        <div style="
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(255, 107, 107, 0.25) 0%, rgba(255, 107, 107, 0.08) 50%, transparent 70%);
          border-radius: 50%;
          filter: blur(15px);
          animation: pulse-heat 4s ease-in-out infinite;
        "></div>
        <!-- 中层光晕 -->
        <div style="
          position: absolute;
          inset: 15%;
          background: radial-gradient(circle, rgba(255, 142, 83, 0.3) 0%, rgba(255, 142, 83, 0.1) 50%, transparent 70%);
          border-radius: 50%;
          filter: blur(10px);
          animation: pulse-heat 4s ease-in-out infinite 0.5s;
        "></div>
        <!-- 中心亮点 -->
        <div style="
          position: absolute;
          inset: 35%;
          background: radial-gradient(circle, rgba(255, 200, 100, 0.5) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(5px);
          animation: pulse-core 3s ease-in-out infinite;
        "></div>
        <!-- 脉冲环 -->
        <div style="
          position: absolute;
          inset: 20%;
          border: 2px solid rgba(255, 107, 107, 0.2);
          border-radius: 50%;
          animation: ripple 3s ease-out infinite;
        "></div>
      </div>
      <style>
        @keyframes pulse-heat {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes pulse-core {
          0%, 100% { opacity: 0.5; transform: scale(0.9); }
          50% { opacity: 0.9; transform: scale(1.1); }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      </style>
    `,
    iconSize: [200, 200],
    iconAnchor: [100, 100],
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
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'white',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      }}
    >
      <Navigation size={22} color="#333" />
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
        emoji: ['🧑‍💻', '🎮', '🎵'][index % 3],
        text: ['Coding...', 'Gaming...', 'Listening...'][index % 3],
      };

      return (
        <Marker
          key={friend.friend_id}
          position={[pos.lat, pos.lng]}
          icon={create3DAvatarIcon(friend, status)}
        />
      );
    });
  }, [friends]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f5f5f5',
        overflow: 'hidden',
      }}
    >
      {/* 顶部导航栏 - 浅色风格 */}
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
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, transparent 100%)',
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
            background: 'white',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          }}
        >
          <ArrowLeft size={20} color="#333" />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          }}
        >
          <MapIcon size={18} color="#6366f1" />
          <span style={{ color: '#333', fontSize: '14px', fontWeight: 600 }}>
            Virtual World
          </span>
        </div>

        <div style={{ width: '40px' }} />
      </div>

      {/* 地图容器 */}
      <MapContainer
        center={center}
        zoom={15}
        minZoom={3}
        maxZoom={18}
        zoomControl={false}
        attributionControl={false}
        style={{
          width: '100%',
          height: 'calc(100vh - 80px)',
          background: '#f5f5f5',
        }}
      >
        {/* CartoDB Voyager - 彩色导航版，细节丰富 */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* 热力圈 - 柔和发光效果 */}
        <Marker
          position={[31.232, 121.475]}
          icon={createHeatIcon()}
          interactive={false}
        />

        {/* 好友 3D Avatar 标记 */}
        {!loading && friendMarkers}

        {/* 定位按钮 */}
        <LocationButton />
      </MapContainer>

      {/* 底部提示 - 浅色风格 */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'white',
          padding: '12px 24px',
          borderRadius: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
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
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e',
          }}
        />
        <span style={{ color: '#333', fontSize: '13px', fontWeight: 500 }}>
          {friends.length} friends nearby
        </span>
      </div>
    </div>
  );
};

export default SnapMapScreen;
