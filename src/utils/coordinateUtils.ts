/**
 * Coordinate conversion utilities for Chinese map coordinate systems
 *
 * WGS-84: Standard GPS coordinate system (what devices report)
 * GCJ-02: Chinese encrypted coordinate system (高德/腾讯使用)
 * BD-09: Baidu Maps proprietary coordinate system (百度使用)
 *
 * Reference: Same algorithm as iOS implementation
 */

const PI = Math.PI;
const A = 6378245.0; // Semi-major axis of Earth
const EE = 0.00669342162296594323; // First eccentricity squared

/**
 * Check if coordinates are within China region
 */
function isOutOfChina(lat: number, lon: number): boolean {
  return lat < 0.7290000000000001 || lat > 55.827100000000005 || lon < 72.002 || lon > 137.8347;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLon(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/**
 * Convert WGS-84 (GPS) coordinates to GCJ-02 (高德/腾讯) coordinates
 * @param lat - WGS-84 latitude
 * @param lon - WGS-84 longitude
 * @returns GCJ-02 coordinates
 */
export function WGS84ToGCJ02(lat: number, lon: number): { lat: number; lon: number } {
  if (isOutOfChina(lat, lon)) {
    return { lat, lon };
  }

  let dLat = transformLat(lon - 105.0, lat - 35.0);
  let dLon = transformLon(lon - 105.0, lat - 35.0);

  const radLat = lat / 180.0 * PI;
  const magic = Math.sin(radLat);
  const magicSquared = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magicSquared);

  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magicSquared * sqrtMagic) * PI);
  dLon = (dLon * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  return {
    lat: lat + dLat,
    lon: lon + dLon,
  };
}

/**
 * Convert GCJ-02 (高德/腾讯) coordinates to WGS-84 (GPS) coordinates
 * @param lat - GCJ-02 latitude
 * @param lon - GCJ-02 longitude
 * @returns WGS-84 coordinates
 */
export function GCJ02ToWGS84(lat: number, lon: number): { lat: number; lon: number } {
  if (isOutOfChina(lat, lon)) {
    return { lat, lon };
  }

  let dLat = transformLat(lon - 105.0, lat - 35.0);
  let dLon = transformLon(lon - 105.0, lat - 35.0);

  const radLat = lat / 180.0 * PI;
  const magic = Math.sin(radLat);
  const magicSquared = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magicSquared);

  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magicSquared * sqrtMagic) * PI);
  dLon = (dLon * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  return {
    lat: lat - dLat,
    lon: lon - dLon,
  };
}

/**
 * Convert BD-09 (Baidu) coordinates to GCJ-02 coordinates
 * @param lat - BD-09 latitude
 * @param lon - BD-09 longitude
 * @returns GCJ-02 coordinates
 */
export function BD09ToGCJ02(lat: number, lon: number): { lat: number; lon: number } {
  const x = lon - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * PI);

  return {
    lat: z * Math.sin(theta),
    lon: z * Math.cos(theta),
  };
}

/**
 * Convert GCJ-02 coordinates to BD-09 (Baidu) coordinates
 * @param lat - GCJ-02 latitude
 * @param lon - GCJ-02 longitude
 * @returns BD-09 coordinates
 */
export function GCJ02ToBD09(lat: number, lon: number): { lat: number; lon: number } {
  const z = Math.sqrt(lon * lon + lat * lat) + 0.00002 * Math.sin(lat * PI);
  const theta = Math.atan2(lat, lon) + 0.000003 * Math.cos(lon * PI);

  return {
    lat: z * Math.sin(theta) + 0.006,
    lon: z * Math.cos(theta) + 0.0065,
  };
}

/**
 * Convert WGS-84 to BD-09 (Baidu) coordinates
 * @param lat - WGS-84 latitude
 * @param lon - WGS-84 longitude
 * @returns BD-09 coordinates
 */
export function WGS84ToBD09(lat: number, lon: number): { lat: number; lon: number } {
  const gcj = WGS84ToGCJ02(lat, lon);
  return GCJ02ToBD09(gcj.lat, gcj.lon);
}

/**
 * Convert BD-09 (Baidu) to WGS-84 coordinates
 * @param lat - BD-09 latitude
 * @param lon - BD-09 longitude
 * @returns WGS-84 coordinates
 */
export function BD09ToWGS84(lat: number, lon: number): { lat: number; lon: number } {
  const gcj = BD09ToGCJ02(lat, lon);
  return GCJ02ToWGS84(gcj.lat, gcj.lon);
}
