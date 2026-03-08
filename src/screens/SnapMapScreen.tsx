import React, { useEffect, useState, useMemo } from 'react';
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

// Fix Default Leaflet Icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const HERO_3D_IMAGE = IMAGES.HERO_RENDER;

const mockFriends: FriendLatestMessage[] = [
  { user_id: 'mock-user', friend_id: 'mock-friend-1', name: 'Ava', avatar_url: IMAGES.WIZARD_BOY_LOGIN, status: 'online', bio: 'Map mock user 1', study_time: 45, is_studying: true, unread_count: 0, last_message: 'Hi!', last_message_time: new Date().toISOString() },
  { user_id: 'mock-user', friend_id: 'mock-friend-2', name: 'Leo', avatar_url: IMAGES.AVATAR_GIRL, status: 'online', bio: 'Map mock user 2', study_time: 30, is_studying: false, unread_count: 0, last_message: 'Hi', last_message_time: new Date().toISOString() },
  { user_id: 'mock-user', friend_id: 'mock-friend-3', name: 'Mia', avatar_url: IMAGES.FRIEND_2, status: 'away', bio: 'Map mock user 3', study_time: 72, is_studying: true, unread_count: 1, last_message: 'Hi', last_message_time: new Date().toISOString() },
];

const getOffsetPosition = (baseLat: number, baseLng: number, index: number) => {
  const offsets = [{ lat: 0.001, lng: 0.002 }, { lat: -0.001, lng: 0.003 }, { lat: 0.002, lng: -0.002 }, { lat: -0.002, lng: -0.003 }, { lat: 0.003, lng: 0.001 }, { lat: -0.003, lng: 0.001 }];
  const offset = offsets[index % offsets.length];
  return { lat: baseLat + (offset?.lat ?? 0), lng: baseLng + (offset?.lng ?? 0) };
};

const mockPlaces: Place[] = [
  { id: 'place-1', name: '百度烤肉(上沙店)', category: 'dining', emoji: '🥩', description: '本周热门烤架', openHours: '10:00 - 01:30', latitude: 31.2304 + 0.001, longitude: 121.4737 + 0.002 },
  { id: 'place-2', name: 'Giglio La Pizza', category: 'dining', emoji: '🍕', description: '经常回访的意式披萨', openHours: '11:00 - 22:00', latitude: 31.2304 - 0.001, longitude: 121.4737 + 0.003 },
  { id: 'place-3', name: '深圳高尔夫俱乐部', category: 'entertainment', emoji: '⛳', description: '城市中心绿地', openHours: '10:00 - 23:00', latitude: 31.2304 + 0.002, longitude: 121.4737 - 0.002 },
  { id: 'place-4', name: '中心公园', category: 'park', emoji: '🌲', description: '适合散步和聊天', openHours: '全天开放', latitude: 31.2304 - 0.002, longitude: 121.4737 - 0.003 },
  { id: 'place-5', name: 'Fumin Bagel', category: 'dining', emoji: '🥯', description: '餐馆 & 咖啡', openHours: '08:00 - 20:00', latitude: 31.2304 + 0.003, longitude: 121.4737 + 0.001 },
  { id: 'place-6', name: 'KTV 唱歌', category: 'entertainment', emoji: '🎤', description: '聚会唱K放松', openHours: '12:00 - 02:00', latitude: 31.2304 - 0.003, longitude: 121.4737 + 0.001 },
];

const heatZones = [
  { position: [31.2295, 121.4745], color: 'rgba(234, 179, 8, 0.4)', size: 400 },
  { position: [31.2295, 121.4745], color: 'rgba(34, 197, 94, 0.3)', size: 600 },
  { position: [31.2315, 121.4715], color: 'rgba(59, 130, 246, 0.25)', size: 450 },
];

const createSnapAvatarIcon = (friend: FriendLatestMessage, isDark: boolean): L.DivIcon => {
  const iconUrl = friend.avatar_url || HERO_3D_IMAGE;
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
    <button
      onClick={handleClick}
      style={{
        position: 'absolute', bottom: '110px', right: '16px', zIndex: 1000,
        width: '48px', height: '48px', borderRadius: '50%', background: isDark ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Navigation size={22} color={isDark ? "#fff" : "#000"} />
    </button>
  );
};

export type MapSelectedItem = (Place & { type: 'place' }) | (FriendLatestMessage & { type: 'friend'; lat?: number; lng?: number });

const SnapMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [friends, setFriends] = useState<FriendLatestMessage[]>([]);
  const [friendLocations, setFriendLocations] = useState<FriendLocation[]>([]);
  const [places] = useState<Place[]>(mockPlaces);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>(mockPlaces);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MapSelectedItem | null>(null);

  useEffect(() => {
    getFriends().then(data => setFriends(data.length > 0 ? data.slice(0, 3) : mockFriends)).catch(() => setFriends(mockFriends)).finally(() => setLoading(false));
    getFriendsLocations().then(locations => { if(locations.length) setFriendLocations(locations); }).catch(() => {});
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const filtered = places.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase()));
    setFilteredPlaces(filtered);
  };

  const center: [number, number] = [31.2304, 121.4737];

  const friendMarkers = useMemo(() => {
    const list = friendLocations.length > 0 ? friendLocations.map(loc => ({
      friend_id: loc.friendId, avatar_url: loc.avatar, name: loc.name, status: loc.status,
      lat: loc.latitude, lng: loc.longitude
    })) : friends.map((f, i) => {
      const pos = getOffsetPosition(center[0], center[1], i);
      return { ...f, lat: pos.lat, lng: pos.lng };
    });

    return list.map((friend: any) => (
      <Marker
        key={friend.friend_id}
        position={[friend.lat, friend.lng]}
          icon={createSnapAvatarIcon(friend as FriendLatestMessage, isDark)}
        eventHandlers={{ click: () => setSelectedItem({ ...friend, type: 'friend' }) }}
      />
    ));
  }, [friends, friendLocations]);

  const placeMarkers = useMemo(() => {
    return filteredPlaces.map((place) => (
      <Marker
        key={place.id}
        position={[place.latitude, place.longitude]}
          icon={createSnapPlaceIcon(place, isDark)}
        eventHandlers={{ click: () => setSelectedItem({ ...place, type: 'place' }) }}
      />
    ));
  }, [filteredPlaces]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(12px)', padding: '8px 24px', borderRadius: '24px', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)', pointerEvents: 'auto' }}>
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
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: '100%', padding: '14px 20px', borderRadius: '20px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', background: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', color: isDark ? 'white' : 'black', boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)', fontSize: '14px', outline: 'none', pointerEvents: 'auto' }}
        />
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', pointerEvents: 'auto' }}>
          {['all', 'dining', 'entertainment', 'study'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as any)}
              style={{ padding: '8px 16px', borderRadius: '20px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', background: selectedCategory === cat ? (isDark ? '#fff' : '#000') : (isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)'), backdropFilter: 'blur(8px)', color: selectedCategory === cat ? (isDark ? '#000' : '#fff') : (isDark ? '#fff' : '#000'), fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {cat === 'all' ? '全部' : PLACE_CATEGORY_LABELS[cat as PlaceCategory]}
            </button>
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
      <div
        style={{
          position: 'absolute', bottom: '90px', left: '16px', right: '16px', zIndex: 1001,
          background: isDark ? 'rgba(24, 24, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', color: isDark ? 'white' : 'black',
          borderRadius: '28px',
          padding: '24px 20px',
          boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
          transform: selectedItem ? 'translateY(0)' : 'translateY(150%)',
          transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease',
          opacity: selectedItem ? 1 : 0,
          display: 'flex', flexDirection: 'column', gap: '20px',
          pointerEvents: selectedItem ? 'auto' : 'none'
        }}
      >
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', alignSelf: 'center', marginBottom: '-10px' }} />

        {selectedItem && (
          <>
            <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: '24px', right: '20px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} />
            </button>

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
                  {selectedItem.type === 'place' ? `营业中 · ${selectedItem.name.includes('百度') ? '43.1' : '1.2'} 公里 · 深圳` : `当前在线 · 0.5 公里`}
                </p>
              </div>
            </div>

            {selectedItem.type === 'place' ? (
              <div style={{ background: isDark ? '#252528' : '#f4f4f5', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={18} color="#a1a1aa" />
                <div>
                  <div style={{ color: '#10b981', fontSize: '14px', fontWeight: 600 }}>营业中</div>
                  <div style={{ color: '#a1a1aa', fontSize: '12px', marginTop: '2px' }}>{selectedItem.openHours}</div>
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button style={{ flex: 1, padding: '16px', borderRadius: '20px', background: isDark ? '#252528' : '#f4f4f5', color: isDark ? 'white' : 'black', border: 'none', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                {selectedItem.type === 'place' ? <><Heart size={18} /> 收藏</> : <><Send size={18} /> 私信</>}
              </button>
              <button
                onClick={() => {
                  const lat = selectedItem.type === 'place' ? selectedItem.latitude : (selectedItem as any).lat;
                  const lng = selectedItem.type === 'place' ? selectedItem.longitude : (selectedItem as any).lng;
                  window.open(`https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(selectedItem.name)}`);
                }}
                style={{ flex: 2, padding: '16px', borderRadius: '20px', background: '#fef08a', color: '#000', border: 'none', fontWeight: 'bold', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(254, 240, 138, 0.3)' }}
              >
                <Navigation size={18} />
                {selectedItem.type === 'place' ? '导航过去' : '找他去'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SnapMapScreen;
