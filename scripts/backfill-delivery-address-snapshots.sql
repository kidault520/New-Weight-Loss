-- 为已有 delivery_schedules 回填地址快照（delivery_address, delivery_contact_name 等）
-- 当 delivery_address_id 有值但 delivery_address 为空时，从 delivery_addresses 同步
-- 在 Supabase SQL Editor 中执行

UPDATE delivery_schedules ds
SET
  delivery_address = COALESCE(ds.delivery_address, trim(da.address || ' ' || coalesce(da.door_number, ''))),
  delivery_address_label = COALESCE(ds.delivery_address_label, da.label),
  delivery_contact_name = COALESCE(ds.delivery_contact_name, da.contact_name),
  delivery_contact_phone = COALESCE(ds.delivery_contact_phone, da.phone),
  updated_at = now()
FROM delivery_addresses da
WHERE ds.delivery_address_id = da.id
  AND ds.delivery_type = 'meal'
  AND (ds.delivery_address IS NULL OR ds.delivery_address = '' OR ds.delivery_contact_name IS NULL OR ds.delivery_contact_name = '');
