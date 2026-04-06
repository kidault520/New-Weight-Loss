-- 地图选点：经纬度（可选，历史行可为空）
ALTER TABLE IF EXISTS public.delivery_addresses
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.delivery_addresses.latitude IS '地图选点纬度（WGS84/高德坐标系以高德为准）';
COMMENT ON COLUMN public.delivery_addresses.longitude IS '地图选点经度';
