import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, Search } from 'lucide-react';
import { DEFAULT_MAP_LAT, DEFAULT_MAP_LNG, getAmapKey, loadAmap } from '../../lib/loadAmap';

export interface MapPickResult {
  address: string;
  lng: number;
  lat: number;
}

interface AmapAddressMapEmbedProps {
  /** 当前经度（有则作为中心） */
  longitude?: number | null;
  /** 当前纬度 */
  latitude?: number | null;
  /** 图钉移动并解析出地址后回调（用于直接回填表单） */
  onPick: (result: MapPickResult) => void;
  className?: string;
  /** 地图区域高度 Tailwind 类，默认 h-56 */
  mapHeightClass?: string;
}

/**
 * 收货地址页顶部：内嵌地图缩略图。点击地图 / 拖拽图钉即逆地理并 onPick 回填，不跳转全屏页。
 */
export function AmapAddressMapEmbed({
  longitude,
  latitude,
  onPick,
  className = '',
  mapHeightClass = 'h-56',
}: AmapAddressMapEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const geocoderRef = useRef<unknown>(null);
  const amapNsRef = useRef<Record<string, unknown> | null>(null);
  const pickingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);

  const reverseGeocodeAndPick = useCallback(
    (AMapNS: Record<string, unknown>, lng: number, lat: number) => {
      const Geocoder = AMapNS.Geocoder as new (opts: { city: string }) => {
        getAddress: (
          lnglat: [number, number],
          cb: (status: string, result: { info?: string; regeocode?: { formattedAddress?: string } }) => void
        ) => void;
      };
      if (!geocoderRef.current) {
        geocoderRef.current = new Geocoder({ city: '全国' });
      }
      const gc = geocoderRef.current as {
        getAddress: (
          lnglat: [number, number],
          cb: (status: string, result: { info?: string; regeocode?: { formattedAddress?: string } }) => void
        ) => void;
      };
      gc.getAddress([lng, lat], (status, result) => {
        if (status === 'complete' && result?.info === 'OK' && result.regeocode) {
          const formatted = (result.regeocode.formattedAddress || '').trim();
          if (formatted) {
            onPick({ address: formatted, lng, lat });
          }
        }
      });
    },
    [onPick]
  );

  const destroyMap = useCallback(() => {
    const m = mapRef.current as { destroy?: () => void } | null;
    if (m?.destroy) {
      try {
        m.destroy();
      } catch {
        /* ignore */
      }
    }
    mapRef.current = null;
    markerRef.current = null;
    geocoderRef.current = null;
    amapNsRef.current = null;
  }, []);

  useEffect(() => {
    if (!getAmapKey()) {
      setError('未配置地图 Key');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadAmap()
      .then((AMapNS: Record<string, unknown>) => {
        if (cancelled || !containerRef.current) return;
        amapNsRef.current = AMapNS;

        const lng =
          longitude != null && Number.isFinite(longitude) ? longitude : DEFAULT_MAP_LNG;
        const lat =
          latitude != null && Number.isFinite(latitude) ? latitude : DEFAULT_MAP_LAT;

        const MapCtor = AMapNS.Map as new (el: HTMLElement, opts: { zoom: number; center: [number, number] }) => {
          add: (x: unknown) => void;
          addControl: (x: unknown) => void;
          setCenter: (p: unknown) => void;
          setZoom: (z: number) => void;
          on: (ev: string, fn: (e: { lnglat: { getLng: () => number; getLat: () => number } }) => void) => void;
          destroy: () => void;
        };
        const MarkerCtor = AMapNS.Marker as new (opts: {
          position: [number, number];
          draggable: boolean;
        }) => {
          setPosition: (p: unknown) => void;
          getPosition: () => { getLng: () => number; getLat: () => number };
          on: (ev: string, fn: () => void) => void;
        };
        const ScaleCtor = AMapNS.Scale as new () => unknown;

        const map = new MapCtor(containerRef.current, {
          zoom: 16,
          center: [lng, lat],
        });
        map.addControl(new ScaleCtor());
        mapRef.current = map;

        const marker = new MarkerCtor({
          position: [lng, lat],
          draggable: true,
        });
        map.add(marker);
        markerRef.current = marker;

        const applyPick = () => {
          if (pickingRef.current) return;
          pickingRef.current = true;
          const pos = marker.getPosition();
          if (pos) {
            reverseGeocodeAndPick(AMapNS, pos.getLng(), pos.getLat());
          }
          window.setTimeout(() => {
            pickingRef.current = false;
          }, 400);
        };

        marker.on('dragend', applyPick);
        map.on('click', (e: { lnglat: { getLng: () => number; getLat: () => number } }) => {
          const ll = e.lnglat;
          marker.setPosition(ll);
          reverseGeocodeAndPick(AMapNS, ll.getLng(), ll.getLat());
        });

        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setLoading(false);
        setError(e?.message || '地图加载失败');
      });

    return () => {
      cancelled = true;
      destroyMap();
    };
    // 仅挂载时建图；父组件传入坐标变化时由下一 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 外部表单同步了经纬度时，移动地图中心与标记（不重复 onPick，避免循环） */
  useEffect(() => {
    const map = mapRef.current as {
      setCenter: (p: unknown) => void;
      setZoom?: (z: number) => void;
    } | null;
    const marker = markerRef.current as { setPosition: (p: unknown) => void } | null;
    if (!map || !marker) return;
    if (longitude == null || latitude == null || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return;
    }
    const ll: [number, number] = [longitude, latitude];
    map.setCenter(ll);
    marker.setPosition(ll);
  }, [longitude, latitude]);

  const runPlugin = (names: string | string[], fn: () => void) => {
    const AMapNS = amapNsRef.current;
    if (!AMapNS || typeof AMapNS.plugin !== 'function') return;
    (AMapNS.plugin as (n: string | string[], cb: () => void) => void)(names, fn);
  };

  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const map = mapRef.current as { setCenter: (p: unknown) => void } | null;
    const marker = markerRef.current as { setPosition: (p: unknown) => void } | null;
    const AMapNS = amapNsRef.current;
    if (!map || !marker || !AMapNS) return;

    runPlugin('AMap.Geolocation', () => {
      const GeoCtor = AMapNS.Geolocation as new (opts: {
        enableHighAccuracy?: boolean;
        timeout?: number;
        needAddress?: boolean;
        GeoLocationFirst?: boolean;
      }) => {
        getCurrentPosition: (
          cb: (status: string, result: { position?: { getLng: () => number; getLat: () => number }; message?: string }) => void
        ) => void;
      };
      const geolocation = new GeoCtor({
        enableHighAccuracy: true,
        timeout: 15000,
        GeoLocationFirst: true,
      });
      geolocation.getCurrentPosition((status, result) => {
        if (status === 'complete' && result?.position) {
          const ll = result.position;
          map.setCenter(ll);
          marker.setPosition(ll);
          reverseGeocodeAndPick(AMapNS, ll.getLng(), ll.getLat());
        }
      });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const q = searchText.trim();
    if (!q) return;
    const map = mapRef.current as { setCenter: (p: unknown) => void; setZoom?: (z: number) => void } | null;
    const marker = markerRef.current as { setPosition: (p: unknown) => void } | null;
    const AMapNS = amapNsRef.current;
    if (!map || !marker || !AMapNS) return;

    setSearchBusy(true);
    runPlugin('AMap.PlaceSearch', () => {
      const PS = AMapNS.PlaceSearch as new (opts: { pageSize: number; city?: string }) => {
        search: (
          keyword: string,
          cb: (status: string, result: { poiList?: { pois?: Array<{ location?: { getLng: () => number; getLat: () => number } }> } }) => void
        ) => void;
      };
      const ps = new PS({ pageSize: 1, city: '全国' });
      ps.search(q, (status, result) => {
        setSearchBusy(false);
        const poi = result?.poiList?.pois?.[0];
        if (status !== 'complete' || !poi) return;
        const loc = poi.location as { getLng?: () => number; getLat?: () => number } | undefined;
        if (loc && typeof loc.getLng === 'function' && typeof loc.getLat === 'function') {
          const lng = loc.getLng();
          const lat = loc.getLat();
          map.setCenter([lng, lat]);
          if (typeof map.setZoom === 'function') map.setZoom(17);
          marker.setPosition([lng, lat]);
          reverseGeocodeAndPick(AMapNS, lng, lat);
        }
      });
    });
  };

  return (
    <div className={`relative rounded-t-2xl overflow-hidden bg-slate-100 ${className}`}>
      {error && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center p-3 text-center text-xs text-gray-600 bg-gray-50">
          {error}
        </div>
      )}
      {loading && !error && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-gray-50">
          <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
          <span className="text-xs text-gray-500">加载地图…</span>
        </div>
      )}

      <form
        onSubmit={handleSearchSubmit}
        className="absolute top-3 right-3 left-3 z-[3] flex gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 flex items-center bg-white/95 rounded-full shadow-sm border border-gray-200/80 px-3 py-1.5 min-w-0">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="search"
            enterKeyHint="search"
            placeholder="搜索地点"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1 min-w-0 ml-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={searchBusy}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/95 shadow-sm border border-gray-200 text-sm font-medium text-gray-800 disabled:opacity-50"
        >
          {searchBusy ? '…' : '搜索'}
        </button>
      </form>

      <div ref={containerRef} className={`w-full ${mapHeightClass}`} />

      <div className="absolute bottom-3 right-3 z-[3]">
        <button
          type="button"
          onClick={handleLocate}
          className="bg-white rounded-full p-2.5 shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50"
          aria-label="定位到当前位置"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
