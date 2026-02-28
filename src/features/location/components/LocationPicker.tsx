/**
 * LocationPicker Component
 *
 * Full-screen modal with map for selecting and sharing locations.
 * Uses Leaflet map (react-leaflet) with location selection and sharing capabilities.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { X, Navigation, Share2, MapPin, Search, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useNotification } from '../../../hooks/useNotification';
import { getCurrentPosition } from '../../../services/locationService';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom selected location icon (blue marker)
const selectedLocationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="32" height="32">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Default center (Shanghai Lujiazui)
const DEFAULT_CENTER: [number, number] = [31.2304, 121.4737];
const DEFAULT_ZOOM = 15;

export interface SelectedLocation {
  latitude: number;
  longitude: number;
  name: string;
}

export interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelected?: (location: SelectedLocation) => void;
}

/**
 * Map click handler component
 */
const MapClickHandler: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

/**
 * Fly to location component
 */
const FlyToLocation: React.FC<{
  center: [number, number];
  zoom?: number;
}> = ({ center, zoom = DEFAULT_ZOOM }) => {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, {
      animate: true,
      duration: 1,
    });
  }, [center, zoom, map]);

  return null;
};

/**
 * LocationPicker Component
 *
 * Full-screen modal with map for selecting and sharing locations.
 */
const LocationPicker: React.FC<LocationPickerProps> = ({
  isOpen,
  onClose,
  onLocationSelected,
}) => {
  const notification = useNotification();

  // State
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [locationName, setLocationName] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedLocation(null);
      setLocationName('');
      setSearchQuery('');
      setMapCenter(DEFAULT_CENTER);
    }
  }, [isOpen]);

  // Handle map click to select location
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setSelectedLocation({
      latitude: lat,
      longitude: lng,
      name: '',
    });
    setLocationName('');
  }, []);

  // Get current location
  const handleGetCurrentLocation = useCallback(async () => {
    setIsLocating(true);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      setMapCenter([latitude, longitude]);
      setSelectedLocation({
        latitude,
        longitude,
        name: 'My Location',
      });
      setLocationName('My Location');
      notification.showSuccess('Location acquired');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get location';
      notification.showError(message);
    } finally {
      setIsLocating(false);
    }
  }, [notification]);

  // Share location
  const handleShareLocation = useCallback(async () => {
    if (!selectedLocation) {
      notification.showError('Please select a location first');
      return;
    }

    const name = locationName.trim() || 'Selected Location';
    const { latitude, longitude } = selectedLocation;

    setIsSharing(true);

    try {
      // Generate Amap URL
      const shareUrl = `https://map.amap.com/?lat=${latitude}&lng=${longitude}&name=${encodeURIComponent(name)}`;

      // Try Web Share API first
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Location: ${name}`,
            text: `I'm at ${name}`,
            url: shareUrl,
          });
          notification.showSuccess('Location shared successfully');

          // Notify parent component
          onLocationSelected?.({
            latitude,
            longitude,
            name,
          });

          return;
        } catch (e) {
          // User cancelled or error, fallback to clipboard
          if ((e as Error).name === 'AbortError') {
            // User cancelled, don't show error
            return;
          }
          // Fall through to clipboard
        }
      }

      // Fallback: Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      notification.showSuccess('Location link copied to clipboard');

      // Notify parent component
      onLocationSelected?.({
        latitude,
        longitude,
        name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share location';
      notification.showError(message);
    } finally {
      setIsSharing(false);
    }
  }, [selectedLocation, locationName, notification, onLocationSelected]);

  // Handle search (simple implementation - just shows placeholder)
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // Note: For a full implementation, integrate with a geocoding service
    // such as Nominatim (OSM) or a Chinese geocoding service
  }, []);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Map fly effect key - triggers re-render when center changes
  const flyKey = useMemo(() => Date.now(), [mapCenter]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1002] flex flex-col bg-white"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-picker-title"
    >
      {/* CSS fixes for Leaflet */}
      <style>{`
        .leaflet-pane,
        .leaflet-tile-pane,
        .leaflet-overlay-pane {
          background: transparent !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1) !important;
        }
        .leaflet-control-zoom a {
          background: white !important;
          color: #333 !important;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white shadow-sm z-10">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X size={24} className="text-gray-600" />
        </button>

        <h2 id="location-picker-title" className="text-lg font-semibold text-gray-800">
          Select Location
        </h2>

        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 bg-white z-10">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={DEFAULT_ZOOM}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full"
          style={{ background: '#f5f5f5' }}
        >
          {/* OSM Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Map click handler */}
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Fly to location when center changes */}
          {selectedLocation && (
            <FlyToLocation
              key={flyKey}
              center={[selectedLocation.latitude, selectedLocation.longitude]}
            />
          )}

          {/* Selected location marker */}
          {selectedLocation && (
            <Marker
              position={[selectedLocation.latitude, selectedLocation.longitude]}
              icon={selectedLocationIcon}
            />
          )}
        </MapContainer>

        {/* Get current location button */}
        <button
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50"
          aria-label="Get current location"
        >
          {isLocating ? (
            <Loader2 size={22} className="text-blue-500 animate-spin" />
          ) : (
            <Navigation size={22} className="text-gray-700" />
          )}
        </button>

        {/* Instructions */}
        {!selectedLocation && (
          <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={16} className="text-blue-500" />
              <span>Tap on map to select a location</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {selectedLocation && (
        <div className="bg-white border-t border-gray-200 p-4 space-y-3">
          {/* Location name input */}
          <div>
            <label htmlFor="location-name" className="block text-xs text-gray-500 mb-1">
              Location Name
            </label>
            <input
              id="location-name"
              type="text"
              placeholder="Enter location name..."
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Coordinates display */}
          <div className="text-xs text-gray-400">
            {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
          </div>

          {/* Share button */}
          <button
            onClick={handleShareLocation}
            disabled={isSharing}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSharing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Sharing...</span>
              </>
            ) : (
              <>
                <Share2 size={18} />
                <span>Share Location</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
