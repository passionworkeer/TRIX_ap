import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { ArrowLeft, Navigation, Ghost } from 'lucide-react';
import L from 'leaflet';

// 修复 Leaflet 默认图标丢失问题
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 模拟好友数据（上海陆家嘴附近）
interface MockFriend {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  emoji: string;
}

const mockFriends: MockFriend[] = [
  {
    id: '1',
    name: 'Alex',
    lat: 31.2304,
    lng: 121.4737,
    status: '喝咖啡中',
    emoji: '☕',
  },
  {
    id: '2',
    name: 'Sam',
    lat: 31.235,
    lng: 121.48,
    status: '摸鱼',
    emoji: '👻',
  },
  {
    id: '3',
    name: 'Jordan',
    lat: 31.228,
    lng: 121.468,
    status: '开车',
    emoji: '🚗',
  },
];

// 创建自定义 Bitmoji 图标
const createBitmojiIcon = (name: string, emoji: string, status: string) => {
  return L.divIcon({
    className: 'custom-bitmoji-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <!-- 状态气泡 -->
        <div style="
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          padding: 4px 10px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          margin-bottom: 6px;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        ">
          <span style="font-size: 12px; color: white; font-weight: 500;">
            ${emoji} ${status}
          </span>
        </div>
        <!-- 头像容器 -->
        <div style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow:
            0 4px 15px rgba(0, 0, 0, 0.4),
            0 0 0 2px rgba(255, 255, 255, 0.3) inset;
          overflow: hidden;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
        ">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=${name}"
            alt="${name}"
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
            "
          />
        </div>
        <!-- 定位指示器 -->
        <div style="
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 10px solid white;
          margin-top: -4px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        "></div>
      </div>
    `,
    iconSize: [44, 80],
    iconAnchor: [22, 80],
    popupAnchor: [0, -80],
  });
};

// 地图中心定位到当前位置的组件
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

  // 上海陆家嘴中心坐标
  const center: [number, number] = [31.2304, 121.4737];

  // 使用 useMemo 缓存图标创建
  const friendMarkers = useMemo(() => {
    return mockFriends.map((friend) => (
      <Marker
        key={friend.id}
        position={[friend.lat, friend.lng]}
        icon={createBitmojiIcon(friend.name, friend.emoji, friend.status)}
      />
    ));
  }, []);

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
        {/* 深色风格地图 */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* CSS 滤镜：Snapchat 风格深色地图 */}
        <style>{`
          .leaflet-tile-pane {
            filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) saturate(150%);
          }
          .leaflet-container {
            background: #0a0a0a !important;
          }
        `}</style>

        {/* 热点区域 - Snap Story */}
        <Circle
          center={[31.232, 121.475]}
          radius={300}
          pathOptions={{
            fillColor: 'rgba(255, 0, 0, 0.3)',
            fillOpacity: 0.5,
            color: 'rgba(255, 0, 0, 0.5)',
            weight: 2,
          }}
        />

        {/* 热点脉冲动画效果 */}
        <Circle
          center={[31.232, 121.475]}
          radius={400}
          pathOptions={{
            fillColor: 'rgba(255, 0, 0, 0.1)',
            fillOpacity: 0.3,
            color: 'rgba(255, 0, 0, 0.3)',
            weight: 1,
            dashArray: '5, 10',
          }}
        />

        {/* 好友标记 */}
        {friendMarkers}

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
          {mockFriends.length} 位好友 nearby
        </span>
      </div>
    </div>
  );
};

export default SnapMapScreen;
