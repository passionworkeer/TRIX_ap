import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { Navigation, Map as MapIcon, X, Send, Heart, Clock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { getFriends } from '../services/databaseService';
import { getFriendsLocations } from '../services/locationService';
import type { FriendLatestMessage } from '../config/supabase';
import type { FriendLocation } from '../types/location';
import type { Place, PlaceCategory } from '../types/place';
import { PLACE_CATEGORY_LABELS } from '../types/place';
import { IMAGES } from '../constants';

import { useTheme } from '../contexts/ThemeContext';
import { iosIconButtonMotion, iosPressableMotion, iosQuickSpring, iosSheetMotion } from '../utils/iosMotion';
import { WGS84ToGCJ02 } from '../utils/coordinateUtils';
import {
  loadBaiduMapSDK,
  initMap,
  searchPOI,
  addMarkerToMap,
  createMarker,
  addNavigationControl,
  type POI,
  type BMapGL,
} from '../services/baiduMapService';
import { logger } from '../utils/logger';

// Fix Default Leaflet Icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const HERO_3D_IMAGE = IMAGES.HERO_RENDER;

const mockFriends: FriendLatestMessage[] = [
  { user_id: 'mock-user', friend_id: 'mock-friend-1', name: 'Ava', avatar_url: IMAGES.WIZARD_BOY_LOGIN, status: 'online', bio: '正在肝《计算机网络》...', study_time: 45, is_studying: true, unread_count: 0, last_message: '晚上一起去自习呀', last_message_time: new Date().toISOString() },
  { user_id: 'mock-user', friend_id: 'mock-friend-2', name: 'Leo', avatar_url: IMAGES.AVATAR_GIRL, status: 'online', bio: '刚下课，准备去吃点东西', study_time: 120, is_studying: false, unread_count: 2, last_message: '推荐你尝尝中心那家的烤肉', last_message_time: new Date().toISOString() },
  { user_id: 'mock-user', friend_id: 'mock-friend-3', name: 'Mia', avatar_url: IMAGES.FRIEND_2, status: 'away', bio: '专注模式中，请忽打扰🎧', study_time: 210, is_studying: true, unread_count: 0, last_message: '刚背完两百个单词！', last_message_time: new Date().toISOString() },
  { user_id: 'mock-user', friend_id: 'mock-friend-4', name: 'David', avatar_url: IMAGES.WIZARD_BOY_LOGIN, status: 'offline', bio: '考研二战，加油。', study_time: 410, is_studying: false, unread_count: 0, last_message: '兄弟，借我看一下笔记', last_message_time: new Date().toISOString() },
  { user_id: 'mock-user', friend_id: 'mock-friend-5', name: 'Bob', avatar_url: IMAGES.AVATAR_GIRL, status: 'online', bio: '看电影ing', study_time: 12, is_studying: false, unread_count: 5, last_message: '哈哈哈这个好好笑', last_message_time: new Date().toISOString() },
  { user_id: 'mock-user', friend_id: 'mock-friend-6', name: 'Alice', avatar_url: IMAGES.FRIEND_2, status: 'online', bio: '在星巴克做PPT', study_time: 65, is_studying: true, unread_count: 0, last_message: '马上就弄完啦', last_message_time: new Date().toISOString() }
];

const getOffsetPosition = (baseLat: number, baseLng: number, index: number) => {
  const offsets = [
    { lat: -0.0014, lng: -0.0042 },
    { lat: -0.0034, lng: -0.0014 },
    { lat: -0.0032, lng: 0.0020 },
    { lat: -0.0016, lng: 0.0046 },
    { lat: 0.0006, lng: 0.0034 },
    { lat: 0.0008, lng: -0.0028 }
  ];
  const offset = offsets[index % offsets.length];
  return { lat: baseLat + (offset?.lat ?? 0), lng: baseLng + (offset?.lng ?? 0) };
};

const mockPlaces: Place[] = [
  // 学习场所
  { id: 'place-study-1', name: '24H 沉浸自习室', category: 'study', emoji: '📚', description: '提供绝对安静的学习环境，配备人体工学椅与护眼灯，适合考研党凌晨冲刺。', openHours: '全天开放', latitude: 31.2304 - 0.0012, longitude: 121.4737 - 0.0054 },
  { id: 'place-study-2', name: '中心区市立图书馆', category: 'study', emoji: '📖', description: '全市最大的综合性图书馆，藏书丰富，顶层有绝佳的观景阅读区。', openHours: '09:00 - 21:00', latitude: 31.2304 - 0.0034, longitude: 121.4737 - 0.0034 },
  { id: 'place-study-3', name: 'TRIX 青年创客空间', category: 'study', emoji: '💻', description: '独立开发者的聚集地，网速极快，咖啡免费续杯。', openHours: '08:00 - 23:00', latitude: 31.2304 - 0.0040, longitude: 121.4737 + 0.0006 },
  
  // 餐饮场所
  { id: 'place-dining-1', name: 'Blue Bottle 蓝瓶咖啡', category: 'dining', emoji: '☕', description: '在简约静谧的工业风空间里，享受一杯顶级的单品手冲咖啡。', openHours: '08:00 - 19:00', latitude: 31.2304 - 0.0030, longitude: 121.4737 + 0.0034 },
  { id: 'place-dining-2', name: 'Fumin Bagel', category: 'dining', emoji: '🥯', description: '现烤健康贝果与特调拿铁，排队人数经常爆满的网红店！', openHours: '08:00 - 20:00', latitude: 31.2304 - 0.0012, longitude: 121.4737 + 0.0056 },
  { id: 'place-dining-3', name: 'Giglio La Pizza', category: 'dining', emoji: '🍕', description: '柴火窑烤的正宗那不勒斯披萨，满口都是芝士与麦香。', openHours: '11:00 - 22:00', latitude: 31.2304 + 0.0006, longitude: 121.4737 + 0.0044 },
  { id: 'place-dining-4', name: '深夜食堂·和风居居酒屋', category: 'dining', emoji: '🍣', description: '温暖疲惫灵魂的寿司与烧鸟，学习完来这里抚慰一下肠胃吧。', openHours: '18:00 - 02:00', latitude: 31.2304 + 0.0012, longitude: 121.4737 + 0.0018 },
  
  // 娱乐和公园场所
  { id: 'place-ent-1', name: '光年 Livehouse 星光 KTV', category: 'entertainment', emoji: '🎤', description: '百万级音响设备，周末放松解压、跟好友尽情嗨唱的绝佳去处！', openHours: '12:00 - 02:00', latitude: 31.2304 + 0.0010, longitude: 121.4737 - 0.0016 },
  { id: 'place-ent-2', name: 'VR 零界探索·超空间', category: 'entertainment', emoji: '🥽', description: '全沉浸式的虚拟现实体验馆，带你穿越到赛博朋克异世界。', openHours: '10:00 - 22:00', latitude: 31.2304 - 0.0004, longitude: 121.4737 - 0.0046 },
  { id: 'place-park-1', name: '城市绿洲极客公园', category: 'park', emoji: '🌳', description: '繁华都市中的自然氧吧，林荫大道与慢跑径，适合傍晚散步放松。', openHours: '全天开放', latitude: 31.2304 - 0.0022, longitude: 121.4737 + 0.0018 },
  { id: 'place-park-2', name: '滨江现代艺术展览中心', category: 'park', emoji: '🎨', description: '依水而建的现代艺术展览馆，近期正在举办《未来科技与艺术》特展。', openHours: '10:00 - 18:00', latitude: 31.2304 + 0.0002, longitude: 121.4737 - 0.0030 },
];

const heatZones: Array<{ position: [number, number]; color: string; size: number }> = [
  { position: [31.2295, 121.4745], color: 'rgba(234, 179, 8, 0.4)', size: 400 },
  { position: [31.2295, 121.4745], color: 'rgba(34, 197, 94, 0.3)', size: 600 },
  { position: [31.2315, 121.4715], color: 'rgba(59, 130, 246, 0.25)', size: 450 },
];

const createSnapAvatarIcon = (friend: FriendLatestMessage, isDark: boolean): L.DivIcon => {
  const root = document.createElement('div');
  root.style.position = 'relative';
  root.style.width = '64px';
  root.style.height = '80px';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.alignItems = 'center';
  root.style.justifyContent = 'flex-end';
  root.style.pointerEvents = 'none';

  const shadow = document.createElement('div');
  shadow.style.position = 'absolute';
  shadow.style.bottom = '16px';
  shadow.style.width = '36px';
  shadow.style.height = '12px';
  shadow.style.background = 'rgba(59, 130, 246, 0.5)';
  shadow.style.borderRadius = '50%';
  shadow.style.filter = 'blur(4px)';
  shadow.style.pointerEvents = 'none';

  const img = document.createElement('img');
  img.src = HERO_3D_IMAGE;
  img.alt = friend.name || 'Friend';
  img.style.width = '64px';
  img.style.height = '64px';
  img.style.objectFit = 'contain';
  img.style.position = 'relative';
  img.style.zIndex = '2';
  img.style.pointerEvents = 'none';

  const label = document.createElement('div');
  label.style.position = 'absolute';
  label.style.bottom = '0';
  label.style.background = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)';
  label.style.backdropFilter = 'blur(4px)';
  label.style.color = isDark ? 'white' : 'black';
  label.style.fontSize = '11px';
  label.style.padding = '2px 10px';
  label.style.borderRadius = '12px';
  label.style.whiteSpace = 'nowrap';
  label.style.fontWeight = '600';
  label.style.border = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)';
  label.style.zIndex = '3';
  label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  label.textContent = friend.name || 'Friend';
  label.style.pointerEvents = 'none';

  root.append(shadow, img, label);

  return L.divIcon({
    className: 'custom-snap-marker',
    html: root,
    iconSize: [64, 80],
    iconAnchor: [32, 70],
  });
};

const createSnapPlaceIcon = (place: Place, isDark: boolean): L.DivIcon => {
  const root = document.createElement('div');
  root.style.position = 'relative';
  root.style.width = '50px';
  root.style.height = '70px';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.alignItems = 'center';
  root.style.justifyContent = 'flex-end';
  root.style.pointerEvents = 'none';

  const emojiDiv = document.createElement('div');
  emojiDiv.style.position = 'relative';
  emojiDiv.style.width = '44px';
  emojiDiv.style.height = '44px';
  emojiDiv.style.borderRadius = '50%';
  emojiDiv.style.border = `2px solid ${isDark ? '#ef4444' : '#f87171'}`;
  emojiDiv.style.background = isDark ? 'rgba(20,20,20,0.9)' : 'rgba(255,255,255,0.95)';
  emojiDiv.style.backdropFilter = 'blur(4px)';
  emojiDiv.style.boxShadow = '0 0 15px rgba(239,68,68,0.4), inset 0 0 10px rgba(239,68,68,0.2)';
  emojiDiv.style.display = 'flex';
  emojiDiv.style.alignItems = 'center';
  emojiDiv.style.justifyContent = 'center';
  emojiDiv.style.fontSize = '20px';
  emojiDiv.style.marginBottom = '2px';
  emojiDiv.style.zIndex = '2';
  emojiDiv.style.pointerEvents = 'none';
  emojiDiv.textContent = place.emoji || '📍';

  const label = document.createElement('div');
  label.style.position = 'absolute';
  label.style.bottom = '0';
  label.style.background = isDark ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.9)';
  label.style.backdropFilter = 'blur(4px)';
  label.style.color = isDark ? '#f87171' : '#dc2626';
  label.style.fontSize = '10px';
  label.style.padding = '2px 8px';
  label.style.borderRadius = '10px';
  label.style.whiteSpace = 'nowrap';
  label.style.fontWeight = '600';
  label.style.border = isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(239,68,68,0.2)';
  label.style.zIndex = '3';
  label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  label.style.pointerEvents = 'none';
  label.textContent = place.name;

  root.append(emojiDiv, label);

  return L.divIcon({
    className: 'custom-snap-marker',
    html: root,
    iconSize: [50, 70],
    iconAnchor: [25, 60],
  });
};

const LocationButton: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const map = useMap();
  const handleClick = () => map.setView([31.2304, 121.4737], 15, { animate: true, duration: 1 });
  return (
    <motion.button
      onClick={handleClick}
      transition={iosQuickSpring}
      {...iosIconButtonMotion}
      className="ios-pressable ios-icon-button"
      style={{
        position: 'absolute', bottom: '110px', right: '16px', zIndex: 1000,
        width: '48px', height: '48px', borderRadius: '50%', background: isDark ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Navigation size={22} color={isDark ? "#fff" : "#000"} />
    </motion.button>
  );
};

export type MapSelectedItem = (Place & { type: 'place' }) | (FriendWithLocation & { type: 'friend' });

// Friend with location data for map display - more flexible type
type FriendWithLocation = {
  friend_id: string;
  name: string;
  avatar_url: string | null;
  status: 'online' | 'offline' | 'busy' | 'away';
  lat: number;
  lng: number;
  user_id?: string;
  bio?: string | null;
  study_time?: number;
  is_studying?: boolean;
  unread_count?: number;
  last_message?: string | null;
  last_message_time?: string | null;
};

type SpreadPlaceMarker = {
  key: string;
  type: 'place';
  lat: number;
  lng: number;
  place: Place;
};

type SpreadFriendMarker = {
  key: string;
  type: 'friend';
  lat: number;
  lng: number;
  friend: FriendWithLocation;
};

type SpreadMarker = SpreadPlaceMarker | SpreadFriendMarker;

const MIN_MARKER_SEPARATION = 0.0036;

const spreadMarkerPositions = <T extends { lat: number; lng: number }>(items: T[]): T[] => {
  const placed: Array<{ lat: number; lng: number }> = [];

  return items.map((item, index) => {
    const baseLat = item.lat;
    const baseLng = item.lng;
    let lat = baseLat;
    let lng = baseLng;
    let attempt = 0;

    while (
      placed.some((candidate) => {
        const lngFactor = Math.cos(((candidate.lat + lat) / 2) * Math.PI / 180);
        const latDelta = candidate.lat - lat;
        const lngDelta = (candidate.lng - lng) * lngFactor;
        return Math.hypot(latDelta, lngDelta) < MIN_MARKER_SEPARATION;
      }) &&
      attempt < 12
    ) {
      const angle = (index * 0.85 + attempt) * Math.PI * 0.9;
      const radius = 0.001 + attempt * 0.00045;
      lat = baseLat - Math.abs(Math.sin(angle)) * radius;
      lng = baseLng + Math.cos(angle) * radius * 1.15;
      attempt += 1;
    }

    placed.push({ lat, lng });
    return { ...item, lat, lng };
  });
};

const arrangeDemoMarkers = <T extends { lat: number; lng: number }>(items: T[], center: [number, number]): T[] => {
  if (items.length === 0) {
    return items;
  }

  const innerCount = items.length > 10 ? Math.ceil(items.length / 2) : items.length;
  const ringSizes = [innerCount, Math.max(items.length - innerCount, 0)].filter((size) => size > 0);
  let cursor = 0;

  return ringSizes.flatMap((ringSize, ringIndex) => {
    const ringItems = items.slice(cursor, cursor + ringSize);
    cursor += ringSize;

    const radiusLat = 0.0032 + ringIndex * 0.0019;
    const radiusLng = 0.0048 + ringIndex * 0.0021;
    const angleOffset = ringIndex * 0.18;

    return ringItems.map((item, index) => {
      const angle = (-Math.PI / 2) + angleOffset + (Math.PI * 2 * index) / ringSize;
      return {
        ...item,
        lat: center[0] + Math.sin(angle) * radiusLat,
        lng: center[1] + Math.cos(angle) * radiusLng,
      };
    });
  });
};

const SnapMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [friends, setFriends] = useState<FriendLatestMessage[]>([]);
  const [friendLocations, setFriendLocations] = useState<FriendLocation[]>([]);
  const [places] = useState<Place[]>(mockPlaces);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MapSelectedItem | null>(null);

  // Baidu Maps state
  const [isBaiduAvailable, setIsBaiduAvailable] = useState(false);
  const [isUsingBaidu, setIsUsingBaidu] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<POI[]>([]);
  const baiduMapRef = useRef<BMapGL | null>(null);

  // Initialize Baidu Maps availability check
  useEffect(() => {
    async function checkBaiduAvailability() {
      try {
        const available = await loadBaiduMapSDK();
        setIsBaiduAvailable(available);
        logger.info('SnapMapScreen', `Baidu Maps SDK available: ${available}`);
      } catch (error) {
        logger.error('SnapMapScreen', 'Failed to check Baidu Maps availability', error);
        setIsBaiduAvailable(false);
      }
    }
    checkBaiduAvailability();
  }, []);

  // Initialize Baidu Map when toggled
  useEffect(() => {
    async function initBaiduMap() {
      if (!isUsingBaidu || !isBaiduAvailable) return;

      try {
        const map = await initMap('baidu-map-container', {
          center: { lat: 31.2304, lon: 121.4737 },
          zoom: 15,
          enableScrollZoom: true,
          enableDragging: true,
        });

        if (map) {
          baiduMapRef.current = map;
          addNavigationControl(map);

          // Add heat zone overlays (simplified - just center points)
          for (const zone of heatZones) {
            const gcj = WGS84ToGCJ02(zone.position[0], zone.position[1]);
            const marker = createMarker(gcj.lat, gcj.lon, { title: 'Heat Zone' });
            if (marker) {
              addMarkerToMap(map, marker);
            }
          }
        }
      } catch (error) {
        logger.error('SnapMapScreen', 'Failed to initialize Baidu Map', error);
        setIsUsingBaidu(false);
      }
    }

    initBaiduMap();

    return () => {
      if (baiduMapRef.current) {
        baiduMapRef.current.destroy();
        baiduMapRef.current = null;
      }
    };
  }, [isUsingBaidu, isBaiduAvailable]);

  // Handle search with Baidu when using Baidu mode
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (isUsingBaidu && isBaiduAvailable) {
      setSearchLoading(true);
      try {
        const results = await searchPOI(query, '上海');
        setSearchResults(results);
      } catch (error) {
        logger.error('SnapMapScreen', 'Baidu POI search failed', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    } else {
      setSearchResults([]);
    }
  }, [isUsingBaidu, isBaiduAvailable]);

  // Toggle between Baidu and Leaflet maps
  const toggleMapProvider = useCallback(async () => {
    if (!isBaiduAvailable) {
      logger.warn('SnapMapScreen', 'Baidu Maps not available');
      return;
    }

    if (isUsingBaidu) {
      // Switch back to Leaflet
      if (baiduMapRef.current) {
        baiduMapRef.current.destroy();
        baiduMapRef.current = null;
      }
      setIsUsingBaidu(false);
    } else {
      // Switch to Baidu
      setIsUsingBaidu(true);
    }
  }, [isBaiduAvailable, isUsingBaidu]);

  // Handle Baidu marker click
  const handleBaiduMarkerClick = useCallback((poi: POI) => {
    const gcj = WGS84ToGCJ02(poi.latitude, poi.longitude);
    const item: MapSelectedItem = {
      id: poi.uid || `baidu-${Date.now()}`,
      name: poi.title,
      category: 'dining' as PlaceCategory,
      latitude: gcj.lat,
      longitude: gcj.lon,
      description: poi.address,
      emoji: '📍',
      type: 'place' as const,
    };
    setSelectedItem(item);
  }, []);

  useEffect(() => {
    Promise.all([
      getFriends().catch(() => []),
      getFriendsLocations().catch(() => [])
    ]).then(([data, locations]) => {
      if (data && data.length > 0) {
        const merged = [...data, ...mockFriends.filter(m => !data.some(d => d.friend_id === m.friend_id))];
        setFriends(merged.slice(0, 8));
      } else {
        setFriends(mockFriends.slice(0, 8));
      }
      
      if (locations && locations.length > 0) {
        setFriendLocations(locations);
      }
      
      setLoading(false);
    });
  }, []);

  const center: [number, number] = [31.2304, 121.4737];

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      const matchesCategory = selectedCategory === 'all' || place.category === selectedCategory;
      const matchesQuery = !normalizedQuery
        || place.name.toLowerCase().includes(normalizedQuery)
        || place.description.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [normalizedQuery, places, selectedCategory]);

  const visibleFriends = useMemo((): FriendWithLocation[] => {
      // 获取基于 friends 的模拟位置列表
      const friendsWithMockLocs = friends.map((friend, index) => {
        const pos = getOffsetPosition(center[0], center[1], index);
        return { ...friend, lat: pos.lat, lng: pos.lng };
      });
      
      let list = [];
      if (friendLocations.length > 0) {
        // 如果有真实的地理位置，保留真实数据
        const realLocs = friendLocations.map((loc) => ({
          friend_id: loc.friendId,
          avatar_url: loc.avatar,
          name: loc.name,
          status: loc.status,
          lat: loc.latitude,
          lng: loc.longitude
        }));
        
        // 并把那些没有真实地理位置的 mock 朋友加上（用于展示丰富度）
        const mockOnly = friendsWithMockLocs.filter(f => 
          !realLocs.some(r => r.friend_id === f.friend_id)
        );
        
        list = [...realLocs, ...mockOnly];
      } else {
        list = friendsWithMockLocs;
      }
    if (!normalizedQuery) {
      return list;
    }

    return list.filter((friend) => friend.name?.toLowerCase().includes(normalizedQuery));
  }, [center, friendLocations, friends, normalizedQuery]);

  const spreadMarkers = useMemo(() => {
    const baseMarkers: SpreadMarker[] = [
      ...filteredPlaces.map((place) => ({
        key: `place-${place.id}`,
        type: 'place' as const,
        lat: place.latitude,
        lng: place.longitude,
        place,
      })),
      ...visibleFriends.map((friend) => ({
        key: `friend-${friend.friend_id}`,
        type: 'friend' as const,
        lat: friend.lat,
        lng: friend.lng,
        friend,
      })),
    ];

    if (friendLocations.length === 0) {
      return arrangeDemoMarkers<SpreadMarker>(baseMarkers, center);
    }

    // Spread dense pins so real-world clusters remain individually clickable.
    return spreadMarkerPositions<SpreadMarker>(baseMarkers);
  }, [center, filteredPlaces, friendLocations.length, visibleFriends]);

  const friendMarkers = useMemo(() => {
    return spreadMarkers
      .filter((item): item is SpreadFriendMarker => item.type === 'friend')
      .map((item) => (
      <Marker
        key={item.key}
        position={[item.lat, item.lng]}
        icon={createSnapAvatarIcon(item.friend as FriendLatestMessage, isDark)}
        eventHandlers={{ click: () => setSelectedItem({ ...item.friend, type: 'friend' }) }}
      />
    ));
  }, [isDark, spreadMarkers]);

  const placeMarkers = useMemo(() => {
    return spreadMarkers
      .filter((item): item is SpreadPlaceMarker => item.type === 'place')
      .map((item) => (
      <Marker
        key={item.key}
        position={[item.lat, item.lng]}
        icon={createSnapPlaceIcon(item.place, isDark)}
        eventHandlers={{ click: () => setSelectedItem({ ...item.place, type: 'place' }) }}
      />
    ));
  }, [isDark, spreadMarkers]);

  const heatMarkers = useMemo(() => {
    return heatZones.map((zone, index) => (
      <Marker
        key={`heat-${index}`}
        position={zone.position as [number, number]}
        interactive={false}
        icon={L.divIcon({
          className: 'heat-zone-marker',
          html: `<div style="width: ${zone.size}px; height: ${zone.size}px; background: radial-gradient(circle, ${zone.color} 0%, transparent 60%); border-radius: 50%; transform: translate(-50%, -50%); mix-blend-mode: screen; filter: blur(20px);"></div>`,
          iconSize: [0, 0],
        })}
      />
    ));
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: isDark ? '#0a0a0a' : '#f0f4f8', overflow: 'hidden' }}>
      <style>{`
        .leaflet-pane, .leaflet-tile-pane, .leaflet-overlay-pane { background: transparent !important; }
        .leaflet-marker-icon { background: transparent !important; border: none !important; pointer-events: auto !important; outline: none !important; }
        .leaflet-interactive { cursor: pointer !important; pointer-events: auto !important; }
        .custom-snap-marker { pointer-events: auto !important; }
        .custom-snap-marker > *, .custom-snap-marker > * * { pointer-events: none !important; }
        .leaflet-marker-icon.heat-zone-marker, .leaflet-marker-icon.heat-zone-marker * { pointer-events: none !important; }
        .leaflet-control-attribution { background: rgba(0,0,0,0.5) !important; color: #888 !important; }
        .leaflet-control-attribution a { color: #aaa !important; }
      `}</style>

      {/* Top Navigation */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, padding: '16px', paddingTop: '48px', background: isDark ? 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)' : 'linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, transparent 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div
          className="ios-glass-surface"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.6)', padding: '8px 24px', borderRadius: '24px', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)', pointerEvents: 'auto' }}
        >
          <MapIcon size={18} color={isDark ? "#fff" : "#000"} />
          <span style={{ color: isDark ? '#fff' : '#000', fontSize: '15px', fontWeight: 600, letterSpacing: '0.5px' }}>{t('features.virtualWorld', 'Virtual World')}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ position: 'absolute', top: '110px', left: '16px', right: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '12px', pointerEvents: 'none' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={isUsingBaidu ? "搜索地点..." : "搜索地点或好友..."}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="ios-glass-surface"
            style={{ width: '100%', padding: '14px 20px', paddingRight: searchLoading ? '44px' : '20px', borderRadius: '20px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', background: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)', color: isDark ? 'white' : 'black', boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)', fontSize: '14px', outline: 'none', pointerEvents: 'auto' }}
          />
          {searchLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Baidu Search Results */}
        {isUsingBaidu && searchResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {searchResults.map((poi, index) => (
              <button
                key={poi.uid || index}
                onClick={() => handleBaiduMarkerClick(poi)}
                className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div className="font-medium text-gray-900 dark:text-white text-sm">{poi.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{poi.address}</div>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', pointerEvents: 'auto' }}>
          {['all', 'dining', 'entertainment', 'study'].map((cat) => (
            <motion.button
              key={cat}
              onClick={() => setSelectedCategory(cat as any)}
              transition={iosQuickSpring}
              {...iosPressableMotion}
              className="ios-pressable"
              style={{ padding: '8px 16px', borderRadius: '20px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', background: selectedCategory === cat ? (isDark ? '#fff' : '#000') : (isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)'), backdropFilter: 'blur(8px)', color: selectedCategory === cat ? (isDark ? '#000' : '#fff') : (isDark ? '#fff' : '#000'), fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {cat === 'all' ? '全部' : PLACE_CATEGORY_LABELS[cat as PlaceCategory]}
            </motion.button>
          ))}

          {/* Toggle Map Provider Button */}
          {isBaiduAvailable && (
            <motion.button
              key="toggle-map"
              onClick={toggleMapProvider}
              transition={iosQuickSpring}
              {...iosPressableMotion}
              className="ios-pressable"
              style={{ padding: '8px 16px', borderRadius: '20px', border: isUsingBaidu ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)', background: isUsingBaidu ? '#3b82f6' : (isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)'), backdropFilter: 'blur(8px)', color: isUsingBaidu ? 'white' : (isDark ? '#fff' : '#000'), fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}
            >
              {isUsingBaidu ? '百度地图' : '切换百度'}
            </motion.button>
          )}
        </div>
      </div>

      {/* Baidu Map Container */}
      {isUsingBaidu && (
        <div
          id="baidu-map-container"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
        />
      )}

      {/* Leaflet Map Container (fallback) */}
      {!isUsingBaidu && (
        <MapContainer center={center} zoom={15} minZoom={3} maxZoom={18} zoomControl={false} style={{ width: '100%', height: '100%', background: isDark ? '#0f1011' : '#f8f9fa' }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={isDark
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"}
          />
          {heatMarkers}
          {placeMarkers}
          {!loading && friendMarkers}
          <LocationButton isDark={isDark} />
        </MapContainer>
      )}

      {/* Bottom Sheet Overlay */}
      <AnimatePresence>
        {selectedItem ? (
          <motion.div
            className="ios-glass-surface"
            initial={iosSheetMotion.initial}
            animate={iosSheetMotion.animate}
            exit={{ opacity: 0, y: 140, scale: 0.96, transition: { duration: 0.16 } }}
            style={{
              position: 'absolute', bottom: '90px', left: '16px', right: '16px', zIndex: 1001,
              background: isDark ? 'rgba(24, 24, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)', color: isDark ? 'white' : 'black',
              borderRadius: '28px',
              padding: '24px 20px',
              boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column', gap: '20px',
              pointerEvents: 'auto'
            }}
          >
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', alignSelf: 'center', marginBottom: '-10px' }} />

            <motion.button
              onClick={() => setSelectedItem(null)}
              transition={iosQuickSpring}
              {...iosIconButtonMotion}
              className="ios-pressable"
              style={{ position: 'absolute', top: '24px', right: '20px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={16} />
            </motion.button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {selectedItem.type === 'place' ? (
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: isDark ? '#252528' : '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)' }}>
                  {selectedItem.emoji}
                </div>
              ) : (
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: isDark ? 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(30, 30, 30, 0.8) 70%)' : 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(240, 240, 240, 0.8) 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src={selectedItem.avatar_url || HERO_3D_IMAGE} alt="avatar" style={{ width: '120%', height: '120%', objectFit: 'contain', transform: 'translateY(10px)' }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{selectedItem.name}</h2>
                <p style={{ margin: '4px 0 0', color: '#10b981', fontSize: '13px', fontWeight: 600 }}>
                  {selectedItem.type === 'place' ? `营业中 · ${selectedItem.name.includes('百度') ? '1.5' : '0.8'} 公里 · 深圳` : `当前在线 · 0.5 公里`}
                </p>
              </div>
            </div>

            {/* 详细描述模块 */}
            <div style={{ background: isDark ? '#252528' : '#f4f4f5', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedItem.type === 'place' ? (
                <>
                  <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                    <img src={IMAGES.STUDY_ROOM_DARK} alt="place_image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ color: isDark ? '#e4e4e7' : '#3f3f46', fontSize: '14px', lineHeight: '1.5' }}>
                    {selectedItem.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <Clock size={14} color="#a1a1aa" />
                    <span style={{ color: '#a1a1aa', fontSize: '12px' }}>营业时间：{selectedItem.openHours}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', background: isDark ? '#18181b' : '#e4e4e7', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <img src={IMAGES.HERO_RENDER} alt="friend_avatar" style={{ height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#e4e4e7' : '#3f3f46', fontSize: '14px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: selectedItem.is_studying ? '#10b981' : '#f59e0b' }}></span>
                    <span style={{ fontWeight: 500 }}>{selectedItem.is_studying ? `已专注 ${selectedItem.study_time} 分钟` : '目前处于休息状态'}</span>
                  </div>
                  <div style={{ color: '#a1a1aa', fontSize: '13px', marginTop: '2px', fontStyle: 'italic' }}>
                    "{selectedItem.bio || selectedItem.last_message || '正在探索 Virtual World'}"
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <motion.button
                transition={iosQuickSpring}
                {...iosPressableMotion}
                className="ios-pressable"
                style={{ flex: 1, padding: '16px', borderRadius: '20px', background: isDark ? '#252528' : '#f4f4f5', color: isDark ? 'white' : 'black', border: 'none', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                {selectedItem.type === 'place' ? <><Heart size={18} /> 收藏</> : <><Send size={18} /> 私信</>}
              </motion.button>
              <motion.button
                onClick={() => {
                  const lat = selectedItem.type === 'place' ? selectedItem.latitude : (selectedItem as any).lat;
                  const lng = selectedItem.type === 'place' ? selectedItem.longitude : (selectedItem as any).lng;
                  window.open(`https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(selectedItem.name)}`);
                }}
                transition={iosQuickSpring}
                {...iosPressableMotion}
                className="ios-pressable"
                style={{ flex: 2, padding: '16px', borderRadius: '20px', background: '#fef08a', color: '#000', border: 'none', fontWeight: 'bold', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(254, 240, 138, 0.3)' }}
              >
                <Navigation size={18} />
                {selectedItem.type === 'place' ? '导航过去' : '找他去'}
              </motion.button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default SnapMapScreen;
