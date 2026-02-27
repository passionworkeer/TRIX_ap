import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { ArrowLeft, Navigation, Map as MapIcon } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { getFriends } from '../services/databaseService';
import { getFriendsLocations } from '../services/locationService';
import { getNearbyPlaces, searchPlaces } from '../services/placeService';
import type { FriendLatestMessage } from '../config/supabase';
import type { FriendLocation } from '../types/location';
import type { Place, PlaceCategory } from '../types/place';
import { PLACE_CATEGORY_LABELS } from '../types/place';
import { IMAGES } from '../constants';
import PlacePopupContent from '../components/map/PlacePopupContent';
import FriendPopupContent from '../components/map/FriendPopupContent';

// 修复 Leaflet 默认图标丢失问题
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// 本地 3D PNG 图片路径
const HERO_3D_IMAGE = IMAGES.HERO_RENDER;

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

const mockFriends: FriendLatestMessage[] = [
  {
    user_id: 'mock-user',
    friend_id: 'mock-friend-1',
    name: 'Ava',
    avatar_url: IMAGES.WIZARD_BOY_LOGIN,
    status: 'online',
    bio: 'Map mock user 1',
    study_time: 45,
    is_studying: true,
    unread_count: 0,
    last_message: '在地图上见！',
    last_message_time: new Date().toISOString(),
  },
  {
    user_id: 'mock-user',
    friend_id: 'mock-friend-2',
    name: 'Leo',
    avatar_url: IMAGES.AVATAR_GIRL,
    status: 'online',
    bio: 'Map mock user 2',
    study_time: 30,
    is_studying: false,
    unread_count: 0,
    last_message: '今天去哪儿？',
    last_message_time: new Date().toISOString(),
  },
  {
    user_id: 'mock-user',
    friend_id: 'mock-friend-3',
    name: 'Mia',
    avatar_url: IMAGES.FRIEND_2,
    status: 'away',
    bio: 'Map mock user 3',
    study_time: 72,
    is_studying: true,
    unread_count: 1,
    last_message: '我在附近自习',
    last_message_time: new Date().toISOString(),
  },
];

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
  return { lat: baseLat + (offset?.lat ?? 0), lng: baseLng + (offset?.lng ?? 0) };
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
const createAvatarIcon = (friend: FriendLatestMessage): L.Icon => {
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
  const { t } = useTranslation();
  const [friends, setFriends] = useState<FriendLatestMessage[]>([]);
  const [friendLocations, setFriendLocations] = useState<FriendLocation[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [favoritePlaces, setFavoritePlaces] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // 使用 t 避免未使用变量警告
  console.debug('[SnapMapScreen] Translation loaded:', t('map.virtualSpace'));

  // 加载好友数据
  useEffect(() => {
    const loadFriends = async () => {
      try {
        setLoading(true);
        const data = await getFriends();
        setFriends(data.length > 0 ? data.slice(0, 3) : mockFriends);
      } catch (error) {
        console.error('加载好友失败:', error);
        setFriends(mockFriends);
      } finally {
        setLoading(false);
      }
    };
    loadFriends();
  }, []);

  // 加载好友真实位置
  useEffect(() => {
    const loadFriendLocations = async () => {
      try {
        const locations = await getFriendsLocations();
        if (locations.length > 0) {
          setFriendLocations(locations);
        }
      } catch (error) {
        console.error('加载好友位置失败:', error);
        // 使用 mock 数据作为备选
      }
    };
    loadFriendLocations();

    // T3.4.1: 定时刷新好友位置 (每30秒)
    const interval = setInterval(() => {
      loadFriendLocations();
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 1000);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // 加载真实地点数据
  useEffect(() => {
    const loadPlaces = async () => {
      try {
        // 上海陆家嘴中心坐标
        const nearbyPlaces = await getNearbyPlaces({
          latitude: 31.2304,
          longitude: 121.4737,
          radius: 10000, // 10km
        });
        if (nearbyPlaces.length > 0) {
          setPlaces(nearbyPlaces);
          setFilteredPlaces(nearbyPlaces);
        }
      } catch (error) {
        console.error('加载地点失败:', error);
        // 使用 mock 数据作为备选
      }
    };
    loadPlaces();
  }, []);

  // T4.4: 分类筛选
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredPlaces(places);
    } else {
      setFilteredPlaces(places.filter(p => p.category === selectedCategory));
    }
  }, [places, selectedCategory]);

  // T4.5: 搜索地点
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredPlaces(selectedCategory === 'all' ? places : places.filter(p => p.category === selectedCategory));
      return;
    }

    try {
      const searchResults = await searchPlaces({ query, category: selectedCategory === 'all' ? undefined : selectedCategory });
      if (searchResults.length > 0) {
        setFilteredPlaces(searchResults);
      } else {
        // 本地搜索
        const filtered = places.filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredPlaces(filtered);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      // 本地搜索作为备选
      const filtered = places.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredPlaces(filtered);
    }
  };

  // 上海陆家嘴中心坐标
  const center: [number, number] = [31.2304, 121.4737];

  // 生成好友标记
  const friendMarkers = useMemo(() => {
    // 优先使用真实位置数据
    if (friendLocations.length > 0) {
      return friendLocations.map((location) => {
        const status = friendStatuses[location.friendId] || {
          emoji: '👤',
          text: location.status === 'online' ? 'Online' : 'Offline',
        };

        return (
          <Marker
            key={location.friendId}
            position={[location.latitude, location.longitude]}
            icon={createAvatarIcon({
              friend_id: location.friendId,
              avatar_url: location.avatar,
              name: location.name,
            } as FriendLatestMessage)}
          >
            <Popup>
              <FriendPopupContent
                friend={{
                  friend_id: location.friendId,
                  avatar_url: location.avatar,
                  name: location.name,
                  status: location.status,
                  statusText: status.text,
                  emoji: status.emoji,
                  bio: null,
                  study_time: 0,
                  is_studying: location.isStudying,
                  unread_count: 0,
                  last_message: null,
                  last_message_time: null,
                  user_id: '',
                }}
                onMessage={() => {
                  navigate(`/chat/${location.friendId}`);
                }}
                onViewProfile={() => {
                  navigate(`/profile/${location.friendId}`);
                }}
                onInvite={() => {
                  console.log('邀请', location.name, '一起自习');
                }}
              />
            </Popup>
          </Marker>
        );
      });
    }

    // 使用模拟位置
    return friends.map((friend, index) => {
      const pos = getOffsetPosition(center[0], center[1], index);
      const status = friendStatuses[friend.friend_id] || {
        emoji: ['🧑‍💻', '🎮', '🎵'][index % 3] || '👤',
        text: ['Coding...', 'Gaming...', 'Listening...'][index % 3] || 'Online',
      };

      return (
        <Marker
          key={friend.friend_id}
          position={[pos.lat, pos.lng]}
          icon={createAvatarIcon(friend)}
        >
          <Popup>
            <FriendPopupContent
              friend={{
                ...friend,
                status,
                avatar_url: friend.avatar_url || undefined
              }}
              onMessage={() => {
                // Navigate to chat with this friend
                navigate(`/chat/${friend.friend_id}`);
              }}
              onViewProfile={() => {
                // Navigate to friend's profile
                navigate(`/profile/${friend.friend_id}`);
              }}
              onInvite={() => {
                // 邀请功能需要实现：发送自习邀请通知给好友
                // 需要集成通知系统（如 Supabase Realtime 或推送服务）
                console.log('邀请', friend.name, '一起自习');
              }}
            />
          </Popup>
        </Marker>
      );
    });
  }, [friends, friendLocations, navigate]);

  // 生成地点标记
  const placeMarkers = useMemo(() => {
    // 优先使用真实地点数据
    if (filteredPlaces.length > 0) {
      return filteredPlaces.map((place) => {
        const isFavorite = favoritePlaces.has(place.id);

        return (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
          >
            <Popup>
              <PlacePopupContent
                place={{
                  name: place.name,
                  type: place.category,
                  emoji: place.emoji,
                  description: place.description,
                  openHours: place.openHours,
                }}
                isFavorite={isFavorite}
                onFavorite={() => {
                  setFavoritePlaces(prev => {
                    const newFavorites = new Set(prev);
                    if (newFavorites.has(place.id)) {
                      newFavorites.delete(place.id);
                    } else {
                      newFavorites.add(place.id);
                    }
                    return newFavorites;
                  });
                }}
              />
            </Popup>
          </Marker>
        );
      });
    }

    // 使用 mock 数据
    return mockPlaces.map((place, index) => {
      const pos = getOffsetPosition(center[0], center[1], index + 10); // 偏移10位避免重叠
      const isFavorite = favoritePlaces.has(place.name);

      return (
        <Marker
          key={place.name}
          position={[pos.lat, pos.lng]}
        >
          <Popup>
            <PlacePopupContent
              place={place}
              isFavorite={isFavorite}
              onFavorite={() => {
                setFavoritePlaces(prev => {
                  const newFavorites = new Set(prev);
                  if (newFavorites.has(place.name)) {
                    newFavorites.delete(place.name);
                  } else {
                    newFavorites.add(place.name);
                  }
                  return newFavorites;
                });
              }}
            />
          </Popup>
        </Marker>
      );
    });
  }, [filteredPlaces, favoritePlaces]);

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

      {/* T4.4 & T4.5: 搜索和筛选栏 */}
      <div
        style={{
          position: 'absolute',
          top: '110px',
          left: '16px',
          right: '16px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* 搜索框 */}
        <input
          type="text"
          placeholder="搜索地点..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            fontSize: '14px',
            outline: 'none',
          }}
        />

        {/* 分类筛选 */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '16px',
              border: 'none',
              background: selectedCategory === 'all' ? '#6366f1' : 'rgba(255, 255, 255, 0.9)',
              color: selectedCategory === 'all' ? 'white' : '#333',
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            全部
          </button>
          {(['dining', 'entertainment', 'study', 'shopping', 'park'] as PlaceCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                border: 'none',
                background: selectedCategory === cat ? '#6366f1' : 'rgba(255, 255, 255, 0.9)',
                color: selectedCategory === cat ? 'white' : '#333',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              {PLACE_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* T3.4.3: 刷新指示器 */}
        {refreshing && (
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.9)',
              color: 'white',
              fontSize: '12px',
              textAlign: 'center',
            }}
          >
            正在刷新好友位置...
          </div>
        )}
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
            {filteredPlaces.length > 0 ? filteredPlaces.length : mockPlaces.length} 热门地点
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
