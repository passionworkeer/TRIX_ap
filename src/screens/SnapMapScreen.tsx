import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// 创建标准 L.Icon 小人图标
const createAvatarIcon = (friend: FriendLatestMessage, status: FriendStatus): L.Icon => {
  // 使用好友头像，如果没有则使用默认 3D 图片
  const iconUrl = friend.avatar_url || HERO_3D_IMAGE;

  return new L.Icon({
    iconUrl,
    iconSize: [64, 96],
    iconAnchor: [32, 96],
    popupAnchor: [0, -96],
    className: 'avatar-icon-transparent',
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
          icon={createAvatarIcon(friend, status)}
        >
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{status.emoji}</div>
              <div style={{ fontWeight: 600 }}>{friend.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{status.text}</div>
            </div>
          </Popup>
        </Marker>
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
      {/* 强制透明背景的 CSS 补丁 */}
      <style>{`
        .avatar-icon-transparent {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-marker-icon.avatar-icon-transparent img {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        }
      `}</style>

      {/* 顶部导航栏 */}
      <div
        style={{
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
        }}
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

      {/* 标准 2D 地图容器 */}
      <MapContainer
        center={center}
        zoom={15}
        minZoom={3}
        maxZoom={18}
        zoomControl={false}
        attributionControl={false}
        style={{
          width: '100%',
          height: '100vh',
          background: '#f5f5f5',
        }}
      >
        {/* 官方 OSM 地图源 */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 好友标记 - 暂时注释掉测试白色背景问题 */}
        {/* {!loading && friendMarkers} */}

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
