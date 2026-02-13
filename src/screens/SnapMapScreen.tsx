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

interface PlaceInfo {
  name: string;
  type: 'dining' | 'entertainment' | 'study' | 'shopping' | 'park';
  emoji: string;
  description: string;
  openHours?: string;
}

const friendStatuses: Record<string, FriendStatus> = {
  'clawbot': { emoji: '🤖', text: 'Coding...' },
};

// 虚拟地点数据 - 上海热门地标
const mockPlaces: PlaceInfo[] = [
  {
    name: '星巴克咖啡',
    type: 'dining',
    emoji: '☕',
    description: '和朋友聚会喝咖啡',
    openHours: '07:30 - 22:00',
  },
  {
    name: '海底捞火锅',
    type: 'dining',
    emoji: '🍲',
    description: '热闹的火锅聚餐',
    openHours: '11:00 - 22:00',
  },
  {
    name: '万达影城',
    type: 'entertainment',
    emoji: '🎬',
    description: '最新电影上映中',
    openHours: '10:00 - 23:00',
  },
  {
    name: '静安雕塑公园',
    type: 'park',
    emoji: '🌳',
    description: '适合散步和聊天',
    openHours: '全天开放',
  },
  {
    name: '24小时自习室',
    type: 'study',
    emoji: '📚',
    description: '安静的学习环境',
    openHours: '24小时',
  },
  {
    name: 'KTV 唱歌',
    type: 'entertainment',
    emoji: '🎤',
    description: '聚会唱K放松',
    openHours: '12:00 - 02:00',
  },
];

// 上海陆家嘴附近的坐标偏移
const getOffsetPosition = (baseLat: number, baseLng: number, index: number) => {
  const offsets = [
    { lat: 0.001, lng: 0.002 },
    { lat: -0.001, lng: 0.003 },
    { lat: 0.002, lng: -0.002 },
    { lat: -0.002, lng: -0.003 },
    { lat: 0.003, lng: 0.001 },
    { lat: -0.003, lng: 0.001 },
  ];
  const offset = offsets[index % offsets.length];
  return { lat: baseLat + offset.lat, lng: baseLng + offset.lng };
};

// 热力图数据
interface HeatZone {
  position: [number, number];
  color: string;
  size: number;
}

const heatZones: HeatZone[] = [
  { position: [31.231, 121.474], color: 'rgba(239, 68, 68, 0.15)', size: 300 },
  { position: [31.229, 121.472], color: 'rgba(59, 130, 246, 0.12)', size: 250 },
  { position: [31.232, 121.476], color: 'rgba(168, 85, 247, 0.1)', size: 280 },
];

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
            <div style={{
              textAlign: 'center',
              padding: '8px',
              minWidth: '120px',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{status.emoji}</div>
              <div style={{
                fontWeight: 700,
                fontSize: '15px',
                color: '#1f2937',
                marginBottom: '4px'
              }}>
                {friend.name}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#22c55e',
                fontWeight: 500,
                padding: '4px 8px',
                background: '#dcfce7',
                borderRadius: '12px',
                display: 'inline-block'
              }}>
                {status.text}
              </div>
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [friends]);

  // 生成虚拟地点标记
  const placeMarkers = useMemo(() => {
    return mockPlaces.map((place, index) => {
      const pos = getOffsetPosition(center[0], center[1], index + 10); // 偏移10位避免重叠

      return (
        <Marker
          key={place.name}
          position={[pos.lat, pos.lng]}
        >
          <Popup>
            <div style={{
              textAlign: 'left',
              padding: '12px',
              minWidth: '160px',
            }}>
              {/* 标题行 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '28px' }}>{place.emoji}</span>
                <div style={{
                  fontWeight: 700,
                  fontSize: '16px',
                  color: '#1f2937',
                  flex: 1
                }}>
                  {place.name}
                </div>
              </div>

              {/* 描述 */}
              <div style={{
                fontSize: '13px',
                color: '#6b7280',
                marginBottom: '8px',
                lineHeight: '1.5'
              }}>
                {place.description}
              </div>

              {/* 营业时间 */}
              {place.openHours && (
                <div style={{
                  fontSize: '12px',
                  color: '#64748b',
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>🕐</span>
                  <span>{place.openHours}</span>
                </div>
              )}

              {/* 类型标签 */}
              <div style={{
                marginTop: '8px',
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap'
              }}>
                {place.type === 'dining' && (
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    background: '#fef3c7',
                    color: '#d97706',
                    borderRadius: '12px',
                    fontWeight: 600
                  }}>🍽️ 美食</span>
                )}
                {place.type === 'entertainment' && (
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    borderRadius: '12px',
                    fontWeight: 600
                  }}>🎪 娱乐</span>
                )}
                {place.type === 'study' && (
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    background: '#dbeafe',
                    color: '#15803d',
                    borderRadius: '12px',
                    fontWeight: 600
                  }}>📖 学习</span>
                )}
                {place.type === 'park' && (
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    background: '#d1fae5',
                    color: '#166534',
                    borderRadius: '12px',
                    fontWeight: 600
                  }}>🌿️ 公园</span>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      );
    });
  }, []);

  // 生成热力圈标记
  const heatMarkers = useMemo(() => {
    return heatZones.map((zone, index) => (
      <Marker
        key={`heat-${index}`}
        position={zone.position}
        interactive={false}
        icon={L.divIcon({
          className: 'heat-zone-marker',
          html: `<div style="
            width: ${zone.size}px;
            height: ${zone.size}px;
            background: radial-gradient(circle, ${zone.color} 0%, transparent 70%);
            border-radius: 50%;
            transform: translate(-50%, -50%);
          "></div>`,
          iconSize: [zone.size, zone.size],
          iconAnchor: [zone.size / 2, zone.size / 2],
        })}
      />
    ));
  }, []);

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
        /* 移除 Leaflet 可能的白色背景 */
        .leaflet-pane,
        .leaflet-tile-pane,
        .leaflet-overlay-pane {
          background: transparent !important;
        }
        .leaflet-marker-icon.avatar-icon-transparent {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-marker-icon.avatar-icon-transparent img {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        }
        /* 移除 Popup 白色背景 */
        .leaflet-popup-content-wrapper,
        .leaflet-popup-tip {
          background: transparent !important;
        }
        .leaflet-popup-content {
          background: rgba(255, 255, 255, 0.95) !important;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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

        {/* 热力圈 - 平面渐变效果 */}
        {heatMarkers}

        {/* 虚拟地点标记 */}
        {placeMarkers}

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
          background: 'white',
          padding: '12px 24px',
          borderRadius: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        {/* 地点数量 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#3b82f6',
              boxShadow: '0 0 8px #3b82f6',
            }}
          />
          <span style={{ color: '#333', fontSize: '13px', fontWeight: 500 }}>
            {mockPlaces.length} 热门地点
          </span>
        </div>

        {/* 分隔线 */}
        <div style={{ width: '1px', height: '16px', background: '#e5e7eb' }} />

        {/* 好友数量 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
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
            {friends.length} 位好友
          </span>
        </div>
      </div>
    </div>
  );
};

export default SnapMapScreen;
