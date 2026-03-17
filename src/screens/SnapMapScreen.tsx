import React, { useEffect, useState, useMemo } from 'react';
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
    { lat: 0.0018, lng: 0.0022 },
    { lat: -0.0015, lng: 0.0035 },
    { lat: 0.0025, lng: -0.0028 },
    { lat: -0.0022, lng: -0.0032 },
    { lat: 0.0035, lng: 0.0012 },
    { lat: -0.0038, lng: 0.0015 }
  ];
  const offset = offsets[index % offsets.length];
  return { lat: baseLat + (offset?.lat ?? 0), lng: baseLng + (offset?.lng ?? 0) };
};

const mockPlaces: Place[] = [
  // 学习场所
  { id: 'place-study-1', name: '24H 沉浸自习室', category: 'study', emoji: '📚', description: '提供绝对安静的学习环境，配备人体工学椅与护眼灯，适合考研党凌晨冲刺。', openHours: '全天开放', latitude: 31.2304 + 0.0015, longitude: 121.4737 - 0.0015 },
  { id: 'place-study-2', name: '中心区市立图书馆', category: 'study', emoji: '📖', description: '全市最大的综合性图书馆，藏书丰富，顶层有绝佳的观景阅读区。', openHours: '09:00 - 21:00', latitude: 31.2304 - 0.0018, longitude: 121.4737 - 0.0026 },
  { id: 'place-study-3', name: 'TRIX 青年创客空间', category: 'study', emoji: '💻', description: '独立开发者的聚集地，网速极快，咖啡免费续杯。', openHours: '08:00 - 23:00', latitude: 31.2304 + 0.0028, longitude: 121.4737 + 0.0022 },
  
  // 餐饮场所
  { id: 'place-dining-1', name: 'Blue Bottle 蓝瓶咖啡', category: 'dining', emoji: '☕', description: '在简约静谧的工业风空间里，享受一杯顶级的单品手冲咖啡。', openHours: '08:00 - 19:00', latitude: 31.2304 + 0.0006, longitude: 121.4737 + 0.0012 },
  { id: 'place-dining-2', name: 'Fumin Bagel', category: 'dining', emoji: '🥯', description: '现烤健康贝果与特调拿铁，排队人数经常爆满的网红店！', openHours: '08:00 - 20:00', latitude: 31.2304 - 0.0012, longitude: 121.4737 + 0.0018 },
  { id: 'place-dining-3', name: 'Giglio La Pizza', category: 'dining', emoji: '🍕', description: '柴火窑烤的正宗那不勒斯披萨，满口都是芝士与麦香。', openHours: '11:00 - 22:00', latitude: 31.2304 + 0.0022, longitude: 121.4737 + 0.0036 },
  { id: 'place-dining-4', name: '深夜食堂·和风居居酒屋', category: 'dining', emoji: '🍣', description: '温暖疲惫灵魂的寿司与烧鸟，学习完来这里抚慰一下肠胃吧。', openHours: '18:00 - 02:00', latitude: 31.2304 - 0.0016, longitude: 121.4737 + 0.0028 },
  
  // 娱乐和公园场所
  { id: 'place-ent-1', name: '光年 Livehouse 星光 KTV', category: 'entertainment', emoji: '🎤', description: '百万级音响设备，周末放松解压、跟好友尽情嗨唱的绝佳去处！', openHours: '12:00 - 02:00', latitude: 31.2304 - 0.0028, longitude: 121.4737 + 0.0008 },
  { id: 'place-ent-2', name: 'VR 零界探索·超空间', category: 'entertainment', emoji: '🥽', description: '全沉浸式的虚拟现实体验馆，带你穿越到赛博朋克异世界。', openHours: '10:00 - 22:00', latitude: 31.2304 + 0.0032, longitude: 121.4737 - 0.0012 },
  { id: 'place-park-1', name: '城市绿洲极客公园', category: 'park', emoji: '🌳', description: '繁华都市中的自然氧吧，林荫大道与慢跑径，适合傍晚散步放松。', openHours: '全天开放', latitude: 31.2304 - 0.0008, longitude: 121.4737 - 0.0032 },
  { id: 'place-park-2', name: '滨江现代艺术展览中心', category: 'park', emoji: '🎨', description: '依水而建的现代艺术展览馆，近期正在举办《未来科技与艺术》特展。', openHours: '10:00 - 18:00', latitude: 31.2304 + 0.0042, longitude: 121.4737 - 0.0028 },
];

const heatZones = [
  { position: [31.2295, 121.4745], color: 'rgba(234, 179, 8, 0.4)', size: 400 },
  { position: [31.2295, 121.4745], color: 'rgba(34, 197, 94, 0.3)', size: 600 },
  { position: [31.2315, 121.4715], color: 'rgba(59, 130, 246, 0.25)', size: 450 },
];

const createSnapAvatarIcon = (friend: FriendLatestMessage, isDark: boolean): L.DivIcon => {
  const iconUrl = HERO_3D_IMAGE;
  return L.divIcon({
    className: 'custom-snap-marker',
    html: `
      <div style="position: relative; width: 64px; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
        <div style="position: absolute; bottom: 16px; width: 36px; height: 12px; background: rgba(59, 130, 246, 0.5); border-radius: 50%; filter: blur(4px);"></div>
        <img src="${iconUrl}" style="width: 64px; height: 64px; object-fit: contain; position: relative; z-index: 2;" />
        <div style="position: absolute; bottom: 0; background: ${isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'}; backdrop-filter: blur(4px); color: ${isDark ? 'white' : 'black'}; font-size: 11px; padding: 2px 10px; border-radius: 12px; white-space: nowrap; font-weight: 600; border: ${isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'}; z-index: 3; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${friend.name || 'Friend'}
        </div>
      </div>
    `,
    iconSize: [64, 80],
    iconAnchor: [32, 70],
  });
};

const createSnapPlaceIcon = (place: Place, isDark: boolean): L.DivIcon => {
  return L.divIcon({
    className: 'custom-snap-marker',
    html: `
      <div style="position: relative; width: 50px; height: 70px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
        <div style="position: relative; width: 44px; height: 44px; border-radius: 50%; border: 2px solid ${isDark ? '#ef4444' : '#f87171'}; background: ${isDark ? 'rgba(20,20,20,0.9)' : 'rgba(255,255,255,0.95)'}; backdrop-filter: blur(4px); box-shadow: 0 0 15px rgba(239,68,68,0.4), inset 0 0 10px rgba(239,68,68,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 2px; z-index: 2;">
          ${place.emoji || '📍'}
        </div>
        <div style="position: absolute; bottom: 0; background: ${isDark ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.9)'}; backdrop-filter: blur(4px); color: ${isDark ? '#f87171' : '#dc2626'}; font-size: 10px; padding: 2px 8px; border-radius: 10px; white-space: nowrap; font-weight: 600; border: ${isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(239,68,68,0.2)'}; z-index: 3; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${place.name}
        </div>
      </div>
    `,
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

  const friendMarkers = useMemo(() => {
    return visibleFriends.map((friend) => (
      <Marker
        key={friend.friend_id}
        position={[friend.lat, friend.lng]}
        icon={createSnapAvatarIcon(friend as FriendLatestMessage, isDark)}
        eventHandlers={{ click: () => setSelectedItem({ ...friend, type: 'friend' }) }}
      />
    ));
  }, [isDark, visibleFriends]);

  const placeMarkers = useMemo(() => {
    return filteredPlaces.map((place) => (
      <Marker
        key={place.id}
        position={[place.latitude, place.longitude]}
        icon={createSnapPlaceIcon(place, isDark)}
        eventHandlers={{ click: () => setSelectedItem({ ...place, type: 'place' }) }}
      />
    ));
  }, [filteredPlaces, isDark]);

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
        <input
          type="text"
          placeholder="搜索地点或好友..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ios-glass-surface"
          style={{ width: '100%', padding: '14px 20px', borderRadius: '20px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', background: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)', color: isDark ? 'white' : 'black', boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)', fontSize: '14px', outline: 'none', pointerEvents: 'auto' }}
        />
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
        </div>
      </div>

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
