/**
 * Baidu Maps JavaScript API Service
 *
 * Wraps the Baidu Maps JS SDK with TypeScript interfaces and error handling.
 * Falls back gracefully when API key is not configured or SDK fails to load.
 */

import { WGS84ToGCJ02, GCJ02ToBD09 } from '../utils/coordinateUtils';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface MapOptions {
  center?: { lat: number; lon: number };
  zoom?: number;
  enableScrollZoom?: boolean;
  enableDoubleClickZoom?: boolean;
  enableDragging?: boolean;
  minZoom?: number;
  maxZoom?: number;
  mapType?: 'BMAP_NORMAL_MAP' | 'BMAP_EARTH_MAP' | 'BMAP_SATELLITE_MAP';
}

export interface Point {
  lat: number;
  lon: number;
}

export type RouteStrategy = 'BMAP_TRANSIT_POLICY_LEAST_TIME' | 'BMAP_TRANSIT_POLICY_LEAST_TRANSFER' | 'BMAP_TRANSIT_POLICY_LEAST_WALKING';

export interface POI {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  city?: string;
  district?: string;
  telephone?: string;
  uid?: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  address: string;
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  streetNumber?: string;
}

export interface RouteNode {
  lat: number;
  lon: number;
  name?: string;
}

export interface RouteResult {
  distance: number; // in meters
  duration: number; // in seconds
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

// ============================================================================
// Global SDK State
// ============================================================================

declare global {
  interface Window {
    BMap?: typeof BMap;
    baiduMapLoaded?: boolean;
    baiduMapError?: string;
  }
}

let sdkLoadAttempted = false;
let sdkLoaded = false;

// ============================================================================
// SDK Loading
// ============================================================================

const BAIDU_MAP_AK = import.meta.env.VITE_BAIDU_MAP_AK as string | undefined;

/**
 * Load Baidu Maps JavaScript SDK dynamically
 * Returns true if SDK is available, false otherwise
 */
export async function loadBaiduMapSDK(): Promise<boolean> {
  // Already loaded
  if (window.baiduMapLoaded || window.BMap) {
    return true;
  }

  // Already attempted and failed
  if (sdkLoadAttempted && !sdkLoaded) {
    return false;
  }

  sdkLoadAttempted = true;

  return new Promise((resolve) => {
    // Check if script already exists
    if (document.getElementById('baidu-map-sdk')) {
      waitForBaiduMap().then(resolve);
      return;
    }

    const script = document.createElement('script');
    script.id = 'baidu-map-sdk';
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${BAIDU_MAP_AK}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      window.baiduMapLoaded = true;
      sdkLoaded = true;
      logger.info('BaiduMapService', 'SDK loaded successfully');
      resolve(true);
    };

    script.onerror = () => {
      const error = 'Failed to load Baidu Maps SDK';
      window.baiduMapError = error;
      sdkLoaded = false;
      logger.error('BaiduMapService', error);
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

/**
 * Wait for Baidu Map SDK to be ready
 */
async function waitForBaiduMap(timeoutMs = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (window.BMap || window.baiduMapLoaded) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return false;
}

/**
 * Check if Baidu Maps SDK is available
 */
export function isBaiduMapAvailable(): boolean {
  return Boolean(window.BMap && window.baiduMapLoaded);
}

// ============================================================================
// Map Initialization
// ============================================================================

let mapInstance: BMapGL | null = null;

/**
 * Initialize Baidu Map in a container
 * @param containerId - HTML element ID
 * @param options - Map initialization options
 * @returns Map instance or null if initialization fails
 */
export async function initMap(containerId: string, options?: MapOptions): Promise<BMapGL | null> {
  const available = await loadBaiduMapSDK();
  if (!available) {
    logger.warn('BaiduMapService', 'Cannot init map - SDK not available');
    return null;
  }

  try {
    const container = document.getElementById(containerId);
    if (!container) {
      logger.error('BaiduMapService', `Container not found: ${containerId}`);
      return null;
    }

    // Convert WGS-84 to BD-09 for Baidu
    const centerCoord = options?.center
      ? WGS84ToGCJ02(options.center.lat, options.center.lon)
      : { lat: 31.2304, lon: 121.4737 }; // Shanghai default
    const bdCoord = GCJ02ToBD09(centerCoord.lat, centerCoord.lon);

    const map = new BMapGL(containerId, {
      enableDoubleClickZoom: options?.enableDoubleClickZoom ?? true,
      enableScrollWheelZoom: options?.enableScrollZoom ?? true,
      enableDragging: options?.enableDragging ?? true,
      minZoom: options?.minZoom ?? 3,
      maxZoom: options?.maxZoom ?? 18,
    });

    const point = new BMapGL.Point(bdCoord.lon, bdCoord.lat);
    map.centerAndZoom(point, options?.zoom ?? 15);

    if (options?.mapType) {
      map.setMapType(options.mapType as unknown as number);
    }

    mapInstance = map;
    logger.info('BaiduMapService', `Map initialized in ${containerId}`);
    return map;
  } catch (error) {
    logger.error('BaiduMapService', 'Failed to initialize map', error);
    return null;
  }
}

/**
 * Get the current map instance
 */
export function getMapInstance(): BMapGL | null {
  return mapInstance;
}

/**
 * Destroy the current map instance
 */
export function destroyMap(): void {
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }
}

// ============================================================================
// POI Search
// ============================================================================

export interface SearchOptions {
  city?: string;
  pageSize?: number;
  pageNum?: number;
}

/**
 * Search POIs by keyword
 * @param keyword - Search keyword
 * @param city - City name (optional, defaults to nationwide)
 * @returns Array of POI results
 */
export async function searchPOI(keyword: string, city?: string): Promise<POI[]> {
  const available = await loadBaiduMapSDK();
  if (!available) {
    logger.warn('BaiduMapService', 'Cannot search POI - SDK not available');
    return [];
  }

  if (!keyword.trim()) {
    return [];
  }

  return new Promise((resolve) => {
    try {
      const options: SearchOptions = {
        city: city || '全国',
        pageSize: 20,
        pageNum: 0,
      };

      const callback = (results: BMapGL.LocalResult) => {
        if (!results || results.getNumPois() === 0) {
          resolve([]);
          return;
        }

        const pois: POI[] = [];
        for (let i = 0; i < results.getNumPois(); i++) {
          const poi = results.getPoi(i);
          if (poi) {
            // Baidu uses BD-09, convert to GCJ-02 for consistency
            pois.push({
              title: poi.title,
              address: poi.address,
              latitude: poi.lat,
              longitude: poi.lng,
              city: poi.city,
              district: poi.district,
              telephone: poi.phoneNumber,
              uid: poi.uid,
            });
          }
        }
        resolve(pois);
      };

      const local = new BMapGL.LocalSearch(city || '全国', {
        pageCapacity: options.pageSize,
      });
      local.setSearchCompleteCallback(callback);

      local.search(keyword);
    } catch (error) {
      logger.error('BaiduMapService', 'POI search failed', error);
      resolve([]);
    }
  });
}

// ============================================================================
// Geocoding
// ============================================================================

/**
 * Convert address to coordinates (geocoding)
 * @param address - Address string
 * @param city - City name for hint (optional)
 * @returns Geocode result or null if not found
 */
export async function geocode(address: string, city?: string): Promise<GeocodeResult | null> {
  const available = await loadBaiduMapSDK();
  if (!available) {
    logger.warn('BaiduMapService', 'Cannot geocode - SDK not available');
    return null;
  }

  if (!address.trim()) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const callback = (result: BMapGL.GeocodeResultType) => {
        if (!result || result.point === null) {
          resolve(null);
          return;
        }

        resolve({
          latitude: result.point.lat,
          longitude: result.point.lng,
          address: result.address,
          province: result.province,
          city: result.city,
          district: result.district,
          street: result.street,
          streetNumber: result.streetNumber,
        });
      };

      const geocoder = new BMapGL.Geocoder();
      const searchAddress = city ? `${city}${address}` : address;
      geocoder.getPoint(searchAddress, callback, city);
    } catch (error) {
      logger.error('BaiduMapService', 'Geocoding failed', error);
      resolve(null);
    }
  });
}

/**
 * Convert coordinates to address (reverse geocoding)
 * @param lat - Latitude (GCJ-02)
 * @param lon - Longitude (GCJ-02)
 * @returns Geocode result or null if not found
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult | null> {
  const available = await loadBaiduMapSDK();
  if (!available) {
    logger.warn('BaiduMapService', 'Cannot reverse geocode - SDK not available');
    return null;
  }

  return new Promise((resolve) => {
    try {
      const point = new BMapGL.Point(lon, lat);

      const callback = (result: BMapGL.ReverseGeocodeResultType) => {
        if (!result) {
          resolve(null);
          return;
        }

        resolve({
          latitude: lat,
          longitude: lon,
          address: result.address,
          province: result.addressComponents.province,
          city: result.addressComponents.city,
          district: result.addressComponents.district,
          street: result.addressComponents.street,
          streetNumber: result.addressComponents.streetNumber,
        });
      };

      const geocoder = new BMapGL.Geocoder();
      geocoder.getLocation(point, callback);
    } catch (error) {
      logger.error('BaiduMapService', 'Reverse geocoding failed', error);
      resolve(null);
    }
  });
}

// ============================================================================
// Route Planning
// ============================================================================

/**
 * Plan route between two points
 * @param start - Start point
 * @param end - End point
 * @param strategy - Route strategy
 * @returns Route result or null if planning fails
 */
export async function routePlan(
  start: Point,
  end: Point,
  strategy: RouteStrategy = 'BMAP_TRANSIT_POLICY_LEAST_TIME'
): Promise<RouteResult | null> {
  const available = await loadBaiduMapSDK();
  if (!available) {
    logger.warn('BaiduMapService', 'Cannot plan route - SDK not available');
    return null;
  }

  return new Promise((resolve) => {
    try {
      // Convert to BD-09
      const startGCJ = WGS84ToGCJ02(start.lat, start.lon);
      const endGCJ = WGS84ToGCJ02(end.lat, end.lon);

      const startBD = GCJ02ToBD09(startGCJ.lat, startGCJ.lon);
      const endBD = GCJ02ToBD09(endGCJ.lat, endGCJ.lon);

      const callback = (result: BMapGL.TransitResult) => {
        if (!result || result.getNumPlans() === 0) {
          resolve(null);
          return;
        }

        const plan = result.getPlan(0);
        if (!plan) {
          resolve(null);
          return;
        }

        const steps: RouteStep[] = [];
        for (let i = 0; i < plan.getNumSteps(); i++) {
          const step = plan.getStep(i);
          if (step) {
            steps.push({
              instruction: step.getInstruction(),
              distance: step.getDistance(),
              duration: step.getDuration(),
            });
          }
        }

        resolve({
          distance: plan.getDistance(),
          duration: plan.getDuration(),
          steps,
        });
      };

      const transit = new BMapGL.TransitRoute();
      transit.setSearchCompleteCallback(callback);
      transit.setPolicy(strategy as unknown as number);
      transit.search(new BMapGL.Point(startBD.lon, startBD.lat), new BMapGL.Point(endBD.lon, endBD.lat));
    } catch (error) {
      logger.error('BaiduMapService', 'Route planning failed', error);
      resolve(null);
    }
  });
}

// ============================================================================
// Marker Management
// ============================================================================

/**
 * Create a marker at the specified coordinates
 * @param lat - Latitude (will be converted to BD-09)
 * @param lon - Longitude (will be converted to BD-09)
 * @param options - Marker options
 * @returns Marker instance or null
 */
export function createMarker(
  lat: number,
  lon: number,
  options?: {
    enableDragging?: boolean;
    icon?: BMapGL.Icon;
    title?: string;
  }
): BMapGL.Marker | null {
  if (!isBaiduMapAvailable()) {
    return null;
  }

  try {
    // Convert WGS-84 to BD-09
    const gcj = WGS84ToGCJ02(lat, lon);
    const bd = GCJ02ToBD09(gcj.lat, gcj.lon);
    const point = new BMapGL.Point(bd.lon, bd.lat);

    const markerOptions: BMapGL.MarkerOptions = {
      enableDragging: options?.enableDragging ?? false,
      title: options?.title,
    };

    if (options?.icon) {
      markerOptions.icon = options.icon;
    }

    return new BMapGL.Marker(point, markerOptions);
  } catch (error) {
    logger.error('BaiduMapService', 'Failed to create marker', error);
    return null;
  }
}

/**
 * Add marker to map
 */
export function addMarkerToMap(map: BMapGL, marker: BMapGL.Marker): void {
  map.addOverlay(marker);
}

/**
 * Remove marker from map
 */
export function removeMarkerFromMap(map: BMapGL, marker: BMapGL.Marker): void {
  map.removeOverlay(marker);
}

/**
 * Create an InfoWindow
 */
export function createInfoWindow(content: string, options?: { width?: number; height?: number }): BMapGL.InfoWindow | null {
  if (!isBaiduMapAvailable()) {
    return null;
  }

  return new BMapGL.InfoWindow(content, {
    width: options?.width ?? 200,
    height: options?.height ?? 100,
  });
}

// ============================================================================
// Map Control
// ============================================================================

/**
 * Add zoom control to map
 */
export function addZoomControl(map: BMapGL): void {
  const zoomCtrl = new BMapGL.ZoomControl();
  map.addControl(zoomCtrl);
}

/**
 * Add navigation control to map
 */
export function addNavigationControl(map: BMapGL): void {
  const navCtrl = new BMapGL.NavigationControl();
  map.addControl(navCtrl);
}

/**
 * Pan map to location
 */
export function panTo(map: BMapGL, lat: number, lon: number): void {
  const gcj = WGS84ToGCJ02(lat, lon);
  const bd = GCJ02ToBD09(gcj.lat, gcj.lon);
  map.panTo(new BMapGL.Point(bd.lon, bd.lat));
}

/**
 * Set map center
 */
export function setCenter(map: BMapGL, lat: number, lon: number, zoom?: number): void {
  const gcj = WGS84ToGCJ02(lat, lon);
  const bd = GCJ02ToBD09(gcj.lat, gcj.lon);
  map.setCenter(new BMapGL.Point(bd.lon, bd.lat));
  if (zoom !== undefined) {
    map.setZoom(zoom);
  }
}

// ============================================================================
// Baidu Map TypeScript Definitions (subset)
// ============================================================================

// These are minimal type definitions for the Baidu Maps GL SDK
// The actual SDK is loaded via script tag

declare class BMapGL {
  constructor(container: string | HTMLElement, opts?: Record<string, unknown>);
  centerAndZoom(point: BMapGL.Point, zoom: number): void;
  setCenter(point: BMapGL.Point | string): void;
  setZoom(zoom: number): void;
  panTo(point: BMapGL.Point): void;
  addControl(control: BMapGL.Control): void;
  addOverlay(overlay: BMapGL.Overlay): void;
  removeOverlay(overlay: BMapGL.Overlay): void;
  getOverlays(): BMapGL.Overlay[];
  destroy(): void;
  setMapType(type: number): void;
  enableDoubleClickZoom(enable?: boolean): void;
  enableScrollWheelZoom(enable?: boolean): void;
  enableDragging(enable?: boolean): void;
}

declare namespace BMapGL {
  class Point {
    constructor(lng: number, lat: number);
    lng: number;
    lat: number;
  }

  class Marker {
    constructor(point: BMapGL.Point, opts?: MarkerOptions);
    setPosition(point: BMapGL.Point): void;
    setIcon(icon: BMapGL.Icon): void;
    setTitle(title: string): void;
    enableDragging(): void;
    disableDragging(): void;
    addEventListener(event: string, handler: (e: MarkerEvent) => void): void;
    openInfoWindow(infoWindow: BMapGL.InfoWindow): void;
  }

  interface MarkerOptions {
    enableDragging?: boolean;
    icon?: BMapGL.Icon;
    title?: string;
  }

  interface MarkerEvent {
    type: string;
    target: BMapGL.Marker;
    point: BMapGL.Point;
  }

  class Icon {
    constructor(url: string, size: BMapGL.Size, opts?: { anchor?: BMapGL.Size; imageSize?: BMapGL.Size });
  }

  class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  class InfoWindow {
    constructor(content: string, opts?: { width?: number; height?: number });
  }

  class LocalSearch {
    constructor(city: string, opts?: { pageCapacity?: number });
    search(keyword: string): void;
    setSearchCompleteCallback(callback: (results: LocalResult) => void): void;
  }

  class Geocoder {
    getPoint(address: string, callback: (result: GeocodeResultType) => void, city?: string): void;
    getLocation(point: BMapGL.Point, callback: (result: ReverseGeocodeResultType) => void): void;
  }

  class TransitRoute {
    constructor();
    search(start: BMapGL.Point, end: BMapGL.Point): void;
    setSearchCompleteCallback(callback: (results: TransitResult) => void): void;
    setPolicy(policy: number): void;
  }

  interface LocalResult {
    getNumPois(): number;
    getPoi(index: number): POIItem | null;
  }

  interface POIItem {
    title: string;
    address: string;
    lat: number;
    lng: number;
    city?: string;
    district?: string;
    phoneNumber?: string;
    uid?: string;
  }

  interface GeocodeResultType {
    point: { lat: number; lng: number } | null;
    address: string;
    province: string;
    city: string;
    district: string;
    street: string;
    streetNumber: string;
  }

  interface ReverseGeocodeResultType {
    address: string;
    addressComponents: {
      province: string;
      city: string;
      district: string;
      street: string;
      streetNumber: string;
    };
  }

  interface TransitResult {
    getNumPlans(): number;
    getPlan(index: number): TransitPlan | null;
  }

  interface TransitPlan {
    getDistance(): number;
    getDuration(): number;
    getNumSteps(): number;
    getStep(index: number): TransitStep | null;
  }

  interface TransitStep {
    getInstruction(): string;
    getDistance(): number;
    getDuration(): number;
  }

  class ZoomControl extends Control {}
  class NavigationControl extends Control {}

  class Control {
    constructor();
  }

  type Overlay = Marker | BMapGL.InfoWindow;
}

// Export BMapGL type for external use
export type { BMapGL };

declare class BMap {
  constructor(container: string | HTMLElement);
  // Compatibility with older Baidu Map API
}

declare class BMapGLMap extends BMapGL {}
