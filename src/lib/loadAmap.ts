import { load as loadAmapScript } from '@amap/amap-jsapi-loader';

/** 默认中心：北京（无初始坐标时使用） */
export const DEFAULT_MAP_LNG = 116.397428;
export const DEFAULT_MAP_LAT = 39.90923;

export function ensureAmapSecurityConfig(): void {
  const code = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;
  if (typeof window === 'undefined' || !code) return;
  (window as unknown as { _AMapSecurityConfig?: { securityJsCode: string } })._AMapSecurityConfig = {
    securityJsCode: code,
  };
}

export function getAmapKey(): string | undefined {
  const k = import.meta.env.VITE_AMAP_KEY;
  return typeof k === 'string' && k.trim() ? k.trim() : undefined;
}

/**
 * 加载高德 JSAPI 2.0（含逆地理、定位）
 */
export function loadAmap(): Promise<Record<string, unknown>> {
  const key = getAmapKey();
  if (!key) {
    return Promise.reject(new Error('MISSING_AMAP_KEY'));
  }
  ensureAmapSecurityConfig();
  return loadAmapScript({
    key,
    version: '2.0',
    plugins: ['AMap.Geocoder', 'AMap.Geolocation', 'AMap.Scale', 'AMap.PlaceSearch'],
  }) as Promise<Record<string, unknown>>;
}
