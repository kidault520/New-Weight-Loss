 
import { supabase } from '../config/supabase';
import { getUserStorageItem } from '../utils/userStorage';
import { isWithinOneHourOfDelivery } from './deliveryPlanService';
import { getDeliveryMealStartTime } from '../constants/deliveryMealTimes';
import { toLocalDateString } from '../utils/dateUtils';

/** 默认应用于的餐次：null=沿用原逻辑，['all']=全部，['lunch','dinner']=指定餐次 */
export type DefaultMealTypes = string[] | null;

export interface DeliveryAddress {
  id: string;
  user_id: string;
  label: string;
  address: string;
  door_number: string;
  contact_name: string;
  phone: string;
  gender: 'male' | 'female';
  tag?: string;
  is_default: boolean;
  default_meal_types?: DefaultMealTypes;
  is_deleted?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  /** 地图选点经度（高德坐标系） */
  longitude?: number | null;
  /** 地图选点纬度 */
  latitude?: number | null;
}

export interface CreateAddressData {
  label: string;
  address: string;
  door_number: string;
  contact_name: string;
  phone: string;
  gender: 'male' | 'female';
  tag?: string;
  is_default?: boolean;
  default_meal_types?: DefaultMealTypes;
  longitude?: number | null;
  latitude?: number | null;
}

export interface UpdateAddressData extends Partial<CreateAddressData> {
  id: string;
  default_meal_types?: DefaultMealTypes;
  expected_updated_at?: string;
}

export interface AddressSyncMeta {
  matchedCount: number;
  updatedCount: number;
  skippedLockedCount: number;
}

export interface AddressEditGuardResult {
  inPlan: boolean;
  inPlanCount: number;
  blockedByTodayWindow: boolean;
  blockedMealInfo?: {
    date: string;
    mealType: string;
    deliveryTimeStart: string;
    lockStartTime?: string;
    currentTime?: string;
  };
}


export const addressService = {
  formatHHMM(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  getLockStartTime(deliveryTimeStart: string): string {
    const [h, m] = String(deliveryTimeStart || '12:00')
      .split(':')
      .map((x) => parseInt(x, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '—';
    const dt = new Date();
    dt.setHours(h, m, 0, 0);
    dt.setMinutes(dt.getMinutes() - 60);
    return this.formatHHMM(dt);
  },

  async logAuditEvent(payload: {
    user_id?: string | null;
    action: string;
    entity_type: 'delivery_address' | 'delivery_schedule' | string;
    entity_id?: string | null;
    before_data?: any;
    after_data?: any;
    reason?: string;
    source?: string;
  }) {
    try {
      if (!payload.user_id) return;
      await supabase.from('delivery_audit_logs').insert({
        user_id: payload.user_id,
        action: payload.action,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id || null,
        before_data: payload.before_data || null,
        after_data: payload.after_data || null,
        reason: payload.reason || null,
        source: payload.source || 'app',
      });
    } catch (error) {
      console.warn('⚠️ Failed to write delivery_audit_logs:', error);
    }
  },

  getLocalDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  async fetchUserAddresses(userId: string | null): Promise<DeliveryAddress[]> {
    if (!userId) {
      console.log('No userId provided, cannot fetch addresses');
      return [];
    }

    try {
      let { data, error } = await supabase
        .from('delivery_addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      // 兼容旧库未加 is_deleted 字段时兜底
      if (error && String(error.message || '').includes('is_deleted')) {
        const fallback = await supabase
          .from('delivery_addresses')
          .select('*')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('Error fetching addresses:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in fetchUserAddresses:', error);
      return [];
    }
  },

  async createAddress(userId: string | null, addressData: CreateAddressData): Promise<DeliveryAddress | null> {
    if (!userId) {
      console.error('No userId provided, cannot create address');
      return null;
    }

    try {
      console.log('Attempting to create address:', { userId, addressData });
      const { data, error } = await supabase
        .from('delivery_addresses')
        .insert({
          user_id: userId,
          is_deleted: false,
          deleted_at: null,
          ...addressData
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating address:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('Successfully created address:', data);
      await this.logAuditEvent({
        user_id: userId,
        action: 'create',
        entity_type: 'delivery_address',
        entity_id: data?.id,
        after_data: data,
        source: 'app',
      });
      return data;
    } catch (error) {
      console.error('Error in createAddress:', error);
      return null;
    }
  },

  async updateAddress(addressData: UpdateAddressData): Promise<DeliveryAddress | null> {
    const { id, expected_updated_at, ...updates } = addressData;

    try {
      const { data: before, error: beforeError } = await supabase
        .from('delivery_addresses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (beforeError) {
        console.error('Error loading address before update:', beforeError);
        throw beforeError;
      }
      if (!before) return null;
      if (before.is_deleted) {
        throw new Error('ADDRESS_ALREADY_DELETED');
      }

      const expectedTs = expected_updated_at || before.updated_at;

      const { data, error } = await supabase
        .from('delivery_addresses')
        .update(updates)
        .eq('id', id)
        .eq('updated_at', expectedTs)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating address:', error);
        throw error;
      }
      if (!data) {
        throw new Error('ADDRESS_UPDATE_CONFLICT');
      }

      // 地址主数据更新后，同步回写未来配送计划里的地址快照字段（若表中存在这些字段）
      const syncMeta = await this.syncAddressSnapshotsToDeliverySchedules(data as DeliveryAddress);
      (data as any).__syncMeta = syncMeta;

      await this.logAuditEvent({
        user_id: (data as any)?.user_id || before.user_id,
        action: 'update',
        entity_type: 'delivery_address',
        entity_id: id,
        before_data: before,
        after_data: data,
        reason: 'user_edit',
        source: 'app',
      });

      console.log('✅ Updated address in database:', id);
      return data;
    } catch (error: any) {
      if (error?.message === 'ADDRESS_UPDATE_CONFLICT') {
        throw error;
      }
      if (error?.message === 'ADDRESS_ALREADY_DELETED') {
        throw error;
      }
      console.error('Error in updateAddress:', error);
      return null;
    }
  },

  async syncAddressSnapshotsToDeliverySchedules(address: DeliveryAddress): Promise<AddressSyncMeta> {
    try {
      if (!address?.id || !address?.user_id) return { matchedCount: 0, updatedCount: 0, skippedLockedCount: 0 };

      const todayStr = this.getLocalDateString();
      const { data: sampleRows, error: sampleError } = await supabase
        .from('delivery_schedules')
        .select('*')
        .eq('user_id', address.user_id)
        .eq('delivery_type', 'meal')
        .eq('delivery_address_id', address.id)
        .gte('delivery_date', todayStr)
        .limit(1);

      if (sampleError) {
        console.warn('⚠️ Failed to inspect delivery_schedules columns:', sampleError);
        return { matchedCount: 0, updatedCount: 0, skippedLockedCount: 0 };
      }
      if (!sampleRows || sampleRows.length === 0) return { matchedCount: 0, updatedCount: 0, skippedLockedCount: 0 };

      const sample = sampleRows[0] as Record<string, any>;
      const fullAddress = [address.address, address.door_number].filter(Boolean).join(' ').trim();
      const payload: Record<string, string> = {};

      if ('delivery_address_label' in sample) payload.delivery_address_label = address.label || address.tag || '';
      if ('delivery_address' in sample) payload.delivery_address = fullAddress;
      if ('delivery_contact_name' in sample) payload.delivery_contact_name = address.contact_name || '';
      if ('delivery_contact_phone' in sample) payload.delivery_contact_phone = address.phone || '';
      if ('contact_name' in sample) payload.contact_name = address.contact_name || '';
      if ('contact_phone' in sample) payload.contact_phone = address.phone || '';
      if ('phone' in sample) payload.phone = address.phone || '';

      if (Object.keys(payload).length === 0) return { matchedCount: 0, updatedCount: 0, skippedLockedCount: 0 };

      let targetQuery = supabase
        .from('delivery_schedules')
        .select('id, delivery_date, meal_type, delivery_time_start')
        .eq('user_id', address.user_id)
        .eq('delivery_type', 'meal')
        .eq('delivery_address_id', address.id)
        .gte('delivery_date', todayStr);

      let query = supabase
        .from('delivery_schedules')
        .update(payload)
        .eq('user_id', address.user_id)
        .eq('delivery_type', 'meal')
        .eq('delivery_address_id', address.id)
        .gte('delivery_date', todayStr);

      // 如果有状态字段，仅更新未完成配送，避免改历史数据快照
      if ('status' in sample) {
        targetQuery = targetQuery.in('status', ['pending', 'scheduled', 'preparing', 'shipped']);
        query = query.in('status', ['pending', 'scheduled', 'preparing', 'shipped']);
      }

      const { data: targetRows, error: targetError } = await targetQuery;
      if (targetError) {
        console.warn('⚠️ Failed to count target schedules before sync:', targetError);
      }
      const matchedRows = (targetRows || []) as Array<{
        id: string;
        delivery_date?: string;
        meal_type?: string;
        delivery_time_start?: string;
      }>;

      // 严格规则：今天已进入配送前1小时窗口的餐次，不随地址主数据编辑回写
      const updatableRows = matchedRows
        .filter((row) => {
          const dateStr = row.delivery_date;
          if (!dateStr) return false;
          if (dateStr !== todayStr) return true; // 未来日期照常可回写
          const mealType = String(row.meal_type || '').toLowerCase();
          const deliveryTimeStart = row.delivery_time_start || getDeliveryMealStartTime(mealType) || '12:00';
          return !isWithinOneHourOfDelivery(dateStr, deliveryTimeStart);
        });

      const updatableIds = updatableRows.map((row) => row.id).filter(Boolean);
      const skippedLockedCount = Math.max(0, matchedRows.length - updatableRows.length);

      if (updatableIds.length === 0) {
        console.log('ℹ️ Skip syncing address snapshots: no updatable schedules after lock-window filtering', {
          addressId: address.id,
          matchedCount: matchedRows.length,
        });
        return { matchedCount: matchedRows.length, updatedCount: 0, skippedLockedCount };
      }

      const { error: updateError } = await supabase
        .from('delivery_schedules')
        .update(payload)
        .in('id', updatableIds);

      if (updateError) {
        console.warn('⚠️ Failed to sync address snapshots to delivery_schedules:', updateError);
        return { matchedCount: matchedRows.length, updatedCount: 0, skippedLockedCount };
      } else {
        console.log('✅ Synced address snapshots to delivery_schedules:', {
          addressId: address.id,
          matchedCount: matchedRows.length,
          updatedCount: updatableIds.length,
          payloadKeys: Object.keys(payload),
        });
        return { matchedCount: matchedRows.length, updatedCount: updatableIds.length, skippedLockedCount };
      }
    } catch (error) {
      console.warn('⚠️ Error in syncAddressSnapshotsToDeliverySchedules:', error);
      return { matchedCount: 0, updatedCount: 0, skippedLockedCount: 0 };
    }
  },

  async checkAddressInUse(addressId: string): Promise<{ inUse: boolean; upcomingDeliveries: any[] }> {
    try {
      console.log('🔍 Checking if address is in use:', addressId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      console.log('📅 Today:', toLocalDateString(today));

      // Check in mealAddresses from localStorage (用户隔离)
      const mealAddresses = await getUserStorageItem<Record<string, string>>('mealAddresses') || {};
      const upcomingDeliveries: any[] = [];

      if (mealAddresses && Object.keys(mealAddresses).length > 0) {
        console.log('📦 All mealAddresses:', mealAddresses);

        // Check each meal address
        for (const [mealKey, storedAddressId] of Object.entries(mealAddresses)) {
          console.log(`🔑 Checking key: ${mealKey}, stored address: ${storedAddressId}`);

          if (storedAddressId === addressId) {
            // mealKey 格式: yyyy-mm-dd-mealType，日期中本身包含“-”，必须从最后一个“-”切分
            const separatorIndex = mealKey.lastIndexOf('-');
            if (separatorIndex <= 0 || separatorIndex >= mealKey.length - 1) {
              console.warn('⚠️ Invalid mealKey format, skipping:', mealKey);
              continue;
            }
            const dateStr = mealKey.slice(0, separatorIndex);
            const mealType = mealKey.slice(separatorIndex + 1);
            console.log(`📅 Found matching address for ${dateStr}, meal: ${mealType}`);

            const mealDate = new Date(`${dateStr}T00:00:00+08:00`);
            if (Number.isNaN(mealDate.getTime())) {
              console.warn('⚠️ Invalid meal date, skipping:', dateStr);
              continue;
            }
            mealDate.setHours(0, 0, 0, 0);

            console.log(`⏰ Meal date: ${mealDate.toISOString()}, Today: ${today.toISOString()}`);
            console.log(`⚖️ Comparison: ${mealDate.getTime()} >= ${today.getTime()} = ${mealDate >= today}`);

            // Check if this delivery is today or in the future
            if (mealDate >= today) {
              const delivery = {
                date: dateStr,
                mealType: mealType,
                displayDate: mealDate.toLocaleDateString('zh-CN'),
              };
              console.log('✅ Adding upcoming delivery:', delivery);
              upcomingDeliveries.push(delivery);
            } else {
              console.log('❌ Past delivery, skipping');
            }
          }
        }
      } else {
        console.log('ℹ️ No mealAddresses in localStorage');
      }

      // 兜底：同时检查 delivery_schedules（避免仅靠本地缓存漏判）
      const { data: scheduleRows, error: scheduleError } = await supabase
        .from('delivery_schedules')
        .select('delivery_date, meal_type')
        .eq('delivery_type', 'meal')
        .eq('delivery_address_id', addressId)
        .gte('delivery_date', toLocalDateString(today))
        .order('delivery_date', { ascending: true });

      if (scheduleError) {
        console.warn('⚠️ Failed to query delivery_schedules:', scheduleError);
      } else if (scheduleRows?.length) {
        const existingKeys = new Set(upcomingDeliveries.map(
          d => `${d.date}-${d.mealType}`
        ));
        scheduleRows.forEach((row: any) => {
          const dateStr = row.delivery_date;
          const mealType = row.meal_type;
          const key = `${dateStr}-${mealType}`;
          if (existingKeys.has(key)) return;
          const mealDate = new Date(`${dateStr}T00:00:00+08:00`);
          upcomingDeliveries.push({
            date: dateStr,
            mealType,
            displayDate: Number.isNaN(mealDate.getTime())
              ? dateStr
              : mealDate.toLocaleDateString('zh-CN'),
          });
        });
      }

      console.log('📊 Total upcoming deliveries found:', upcomingDeliveries.length);

      // Note: meal_orders 表已废弃，现在使用 orders 表
      // 地址使用情况通过 delivery_schedules 表查询（关联 orders 表）

      const result = {
        inUse: upcomingDeliveries.length > 0,
        upcomingDeliveries
      };
      console.log('🎯 Final result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error checking address usage:', error);
      return { inUse: false, upcomingDeliveries: [] };
    }
  },

  async getAddressEditGuard(addressId: string): Promise<AddressEditGuardResult> {
    try {
      const todayStr = this.getLocalDateString();
      const activeStatuses = ['pending', 'scheduled', 'preparing', 'shipped'];

      const { data: scheduleRows, error } = await supabase
        .from('delivery_schedules')
        .select('delivery_date, meal_type, delivery_time_start, status')
        .eq('delivery_type', 'meal')
        .eq('delivery_address_id', addressId)
        .gte('delivery_date', todayStr)
        .in('status', activeStatuses)
        .order('delivery_date', { ascending: true });

      if (error) {
        console.warn('⚠️ Failed to query delivery_schedules in getAddressEditGuard:', error);
        return {
          inPlan: false,
          inPlanCount: 0,
          blockedByTodayWindow: false,
        };
      }

      const rows = scheduleRows || [];
      const now = new Date();
      const parseTimePoint = (timeHHMM: string) => {
        const [h, m] = String(timeHHMM || '12:00').split(':').map((x) => parseInt(x, 10));
        const dt = new Date(now);
        dt.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0);
        return dt;
      };

      // today 的已过配送开始时间餐次视为“已过期”，不再计入可编辑映射
      const effectiveRows = rows.filter((row: any) => {
        if (row.delivery_date !== todayStr) return true;
        const mealType = String(row.meal_type || '').toLowerCase();
        const deliveryTimeStart = row.delivery_time_start || getDeliveryMealStartTime(mealType) || '12:00';
        const deliveryStartAt = parseTimePoint(deliveryTimeStart);
        return now <= deliveryStartAt;
      });
      const inPlanCount = effectiveRows.length;

      const todayBlocked = effectiveRows.find((row: any) => {
        if (row.delivery_date !== todayStr) return false;
        const mealType = String(row.meal_type || '').toLowerCase();
        const deliveryTimeStart = row.delivery_time_start || getDeliveryMealStartTime(mealType) || '12:00';
        const deliveryStartAt = parseTimePoint(deliveryTimeStart);
        const lockStartAt = new Date(deliveryStartAt);
        lockStartAt.setMinutes(lockStartAt.getMinutes() - 60);
        // 仅锁定“配送前1小时窗口内”；配送已开始后不再命中该窗口
        return now >= lockStartAt && now <= deliveryStartAt;
      });

      return {
        inPlan: inPlanCount > 0,
        inPlanCount,
        blockedByTodayWindow: !!todayBlocked,
        blockedMealInfo: todayBlocked
          ? {
              date: todayBlocked.delivery_date,
              mealType: todayBlocked.meal_type,
              deliveryTimeStart: todayBlocked.delivery_time_start || getDeliveryMealStartTime(String(todayBlocked.meal_type || '').toLowerCase()) || '12:00',
              lockStartTime: this.getLockStartTime(
                todayBlocked.delivery_time_start || getDeliveryMealStartTime(String(todayBlocked.meal_type || '').toLowerCase()) || '12:00'
              ),
              currentTime: this.formatHHMM(new Date()),
            }
          : undefined,
      };
    } catch (error) {
      console.warn('⚠️ Error in getAddressEditGuard:', error);
      return {
        inPlan: false,
        inPlanCount: 0,
        blockedByTodayWindow: false,
      };
    }
  },

  async deleteAddress(addressId: string): Promise<boolean> {
    // First check if address is in use
    const { inUse, upcomingDeliveries } = await this.checkAddressInUse(addressId);

    if (inUse) {
      throw new Error(JSON.stringify({
        message: 'ADDRESS_IN_USE',
        deliveries: upcomingDeliveries
      }));
    }

    try {
      const { data: before } = await supabase
        .from('delivery_addresses')
        .select('*')
        .eq('id', addressId)
        .maybeSingle();

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('delivery_addresses')
        .update({
          is_deleted: true,
          deleted_at: now,
          is_default: false,
          updated_at: now,
        })
        .eq('id', addressId)
        .eq('is_deleted', false)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error deleting address:', error);
        throw error;
      }

      if (!data) return false;

      await this.logAuditEvent({
        user_id: (data as any)?.user_id || (before as any)?.user_id,
        action: 'soft_delete',
        entity_type: 'delivery_address',
        entity_id: addressId,
        before_data: before || null,
        after_data: data,
        reason: 'user_delete',
        source: 'app',
      });

      return true;
    } catch (error) {
      console.error('Error in deleteAddress:', error);
      return false;
    }
  },

  /**
   * 按餐次排他：从其他地址的 default_meal_types 中移除被当前地址占用的餐次
   * 保证同一餐次只有一个默认地址，但不同餐次可对应不同地址
   */
  async clearMealTypesFromOtherAddresses(
    userId: string | null,
    currentAddressId: string,
    mealTypesToClaim: string[]
  ): Promise<boolean> {
    if (!userId || !mealTypesToClaim.length) return true;

    const ALL_MEALS = ['breakfast', 'lunch', 'dinner'];
    const toRemove = mealTypesToClaim.includes('all') ? ALL_MEALS : mealTypesToClaim;

    try {
      const { data: addresses, error: fetchError } = await supabase
        .from('delivery_addresses')
        .select('id, default_meal_types, is_default')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .neq('id', currentAddressId);

      if (fetchError || !addresses?.length) return true;

      for (const addr of addresses) {
        const current = addr.default_meal_types;
        if (!current || !Array.isArray(current) || current.length === 0) continue;

        const expanded = current.includes('all') ? [...ALL_MEALS] : [...current];
        const remaining = expanded.filter((t: string) => !toRemove.includes(t));

        let newDefaultMealTypes: string[] | null = null;
        if (remaining.length > 0) {
          newDefaultMealTypes = remaining.length === 3 ? ['all'] : remaining;
        }

        await supabase
          .from('delivery_addresses')
          .update({
            default_meal_types: newDefaultMealTypes,
            is_default: newDefaultMealTypes !== null && newDefaultMealTypes.length > 0
          })
          .eq('id', addr.id)
          .eq('is_deleted', false)
          .eq('user_id', userId);
      }
      return true;
    } catch (e) {
      console.error('Error in clearMealTypesFromOtherAddresses:', e);
      return false;
    }
  },

  async setDefaultAddress(userId: string | null, addressId: string): Promise<boolean> {
    if (!userId) {
      console.error('No userId provided, cannot set default address');
      return false;
    }

    try {
      // First, set all addresses for this user to not default
      await supabase
        .from('delivery_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_deleted', false);

      // Then set the selected address as default
      const { error } = await supabase
        .from('delivery_addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('is_deleted', false)
        .eq('user_id', userId);

      if (error) {
        console.error('Error setting default address:', error);
        throw error;
      }

      console.log('✅ Successfully set default address:', addressId);

      // React Query 会自动处理数据更新，无需派发事件
      // 调用者应该使用 useAddressesQuery hook 的 setDefaultAddress 方法

      return true;
    } catch (error) {
      console.error('Error in setDefaultAddress:', error);
      return false;
    }
  },

};
