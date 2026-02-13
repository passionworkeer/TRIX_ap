import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { LatLng, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import heroRenderImg from '../assets/roles/role1/hero_render.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// 自定义角色图标
const UserIcon = L.icon({
  iconUrl: heroRenderImg,
  iconSize: [80, 120],      // 宽80px 高120px (缩小尺寸)
  iconAnchor: [40, 120],    // 锚点在底部中心,脚踩在坐标点上
  popupAnchor: [0, -120],   // 弹窗在角色头顶
  className: 'user-marker-shadow'
});

// 定位监听组件
function LocationMarker({ setUserPos }: { setUserPos: (pos: LatLng) => void }) {
  const map = useMap();
  
  useMapEvents({
    locationfound(e) {
      setUserPos(e.latlng);
      map.flyTo(e.latlng, 15, { duration: 1.5 });
    },
  });

  useEffect(() => {
    map.locate({ setView: false, enableHighAccuracy: true });
  }, [map]);

  return null;
}

const MapScreen: React.FC = () => {
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [locationName, setLocationName] = useState<string>('Locating...');
  const [isLocating, setIsLocating] = useState(true);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const pos = new L.LatLng(latitude, longitude);
          setUserPos(pos);
          setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setIsLocating(false);
        },
        (error) => {
          // 默认上海
          const pos = new L.LatLng(31.2304, 121.4737);
          setUserPos(pos);
          setLocationName('Shanghai, China (Default)');
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      const pos = new L.LatLng(31.2304, 121.4737);
      setUserPos(pos);
      setLocationName('Geolocation not supported');
      setIsLocating(false);
    }
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <MapContainer 
        center={[31.2304, 121.4737]} 
        zoom={15} 
        zoomControl={false} 
        className="absolute inset-0 w-full h-full z-0" 
        style={{ background: '#f2f4f6' }}
      >
        <LocationMarker setUserPos={setUserPos} />
        <TileLayer 
          attribution='&copy; OpenStreetMap &copy; CARTO' 
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
        />
        
        {/* 用户角色 Marker - 跟随真实坐标 */}
        {userPos && (
          <Marker position={userPos} icon={UserIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-bold text-sm">🎮 You are here!</p>
                <p className="text-xs text-gray-600">{locationName}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* 顶部状态栏 */}
      <div className="absolute top-4 left-4 right-4 z-[1001] flex justify-between items-start pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg pointer-events-auto">
          <p className="text-xs font-bold text-gray-800">
            {isLocating ? '📍 Locating...' : `📍 ${locationName}`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapScreen;
