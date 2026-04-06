 
import { supabase } from '../config/supabase';
import { toLocalDateString } from '../utils/dateUtils';
import { DELIVERY_MEAL_TIME_RANGES } from '../constants/deliveryMealTimes';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

export interface DeliverySchedule {
  id: string;
  user_id: string;
  delivery_date: string; // YYYY-MM-DD
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  delivery_time_start?: string; // HH:MM
  delivery_time_end?: string; // HH:MM
  status: 'pending' | 'scheduled' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  delivery_address_id?: string;
  is_locked?: boolean;
  locked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryScheduleUpsertInput {
  date: Date | string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | string;
  addressId: string;
  isLocked?: boolean;
}

const normalizeDateString = (date: Date | string): string => {
  if (typeof date === 'string') return date.split('T')[0];
  return toLocalDateString(date);
};

/**
 * 配送计划服务
 * 用于获取用户的配送计划数据
 */
export const deliveryScheduleService = {
  async logAuditEvent(payload: {
    user_id?: string | null;
    action: string;
    entity_type: 'delivery_schedule' | string;
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
      console.warn('⚠️ Failed to write delivery_audit_logs for schedules:', error);
    }
  },

  /**
   * 获取用户的配送计划
   * @param userId 用户ID
   * @param startDate 开始日期（可选）
   * @param endDate 结束日期（可选）
   * @returns 配送计划数组
   */
  async getUserDeliverySchedules(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DeliverySchedule[]> {
    try {
      let query = supabase
        .from('delivery_schedules')
        .select('*')
        .eq('user_id', userId)
        .eq('delivery_type', 'meal')
        .not('meal_type', 'is', null)
        .order('delivery_date', { ascending: true })
        .order('meal_type', { ascending: true });

      // 如果有开始日期，添加过滤条件（使用本地日期，避免 UTC 时区错位）
      if (startDate) {
        const startDateStr = toLocalDateString(startDate);
        query = query.gte('delivery_date', startDateStr);
      }

      // 如果有结束日期，添加过滤条件
      if (endDate) {
        const endDateStr = toLocalDateString(endDate);
        query = query.lte('delivery_date', endDateStr);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching delivery schedules:', error);
        throw error;
      }

      return (data || []) as DeliverySchedule[];
    } catch (error) {
      console.error('Error in getUserDeliverySchedules:', error);
      return [];
    }
  },

  /**
   * 获取指定日期的配送计划
   * @param userId 用户ID
   * @param date 日期
   * @returns 该日期的配送计划数组
   */
  async getDeliverySchedulesByDate(
    userId: string,
    date: Date | string
  ): Promise<DeliverySchedule[]> {
    try {
      const dateStr = typeof date === 'string' ? date : toLocalDateString(date);

      const { data, error } = await supabase
        .from('delivery_schedules')
        .select('*')
        .eq('user_id', userId)
        .eq('delivery_type', 'meal')
        .eq('delivery_date', dateStr)
        .order('meal_type', { ascending: true });

      if (error) {
        console.error('Error fetching delivery schedules by date:', error);
        throw error;
      }

      return (data || []) as DeliverySchedule[];
    } catch (error) {
      console.error('Error in getDeliverySchedulesByDate:', error);
      return [];
    }
  },

  /**
   * 获取配送计划的最早和最晚日期
   * @param userId 用户ID
   * @returns 包含最早和最晚日期的对象
   */
  async getDeliveryDateRange(userId: string): Promise<{
    startDate: Date | null;
    endDate: Date | null;
  }> {
    try {
      devLog('🔍 [deliveryScheduleService] Getting delivery date range for user:', userId);

      // 获取最早的配送日期
      const { data: earliest, error: earliestError } = await supabase
        .from('delivery_schedules')
        .select('delivery_date')
        .eq('user_id', userId)
        .eq('delivery_type', 'meal')
        .not('meal_type', 'is', null)
        .order('delivery_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      // 获取最晚的配送日期
      const { data: latest, error: latestError } = await supabase
        .from('delivery_schedules')
        .select('delivery_date')
        .eq('user_id', userId)
        .eq('delivery_type', 'meal')
        .not('meal_type', 'is', null)
        .order('delivery_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (earliestError && earliestError.code !== 'PGRST116') {
        console.error('❌ [deliveryScheduleService] Error fetching earliest delivery date:', earliestError);
      }

      if (latestError && latestError.code !== 'PGRST116') {
        console.error('❌ [deliveryScheduleService] Error fetching latest delivery date:', latestError);
      }

      // 🔥 修复：正确解析日期字符串，避免时区问题
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (earliest?.delivery_date) {
        // delivery_date 格式是 YYYY-MM-DD，需要解析为本地日期（不包含时间）
        const [year, month, day] = earliest.delivery_date.split('-').map(Number);
        startDate = new Date(year, month - 1, day);
        startDate.setHours(0, 0, 0, 0);
        devLog('✅ [deliveryScheduleService] Earliest date:', {
          raw: earliest.delivery_date,
          parsed: toLocalDateString(startDate),
          local: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
        });
      }

      if (latest?.delivery_date) {
        // delivery_date 格式是 YYYY-MM-DD，需要解析为本地日期（不包含时间）
        const [year, month, day] = latest.delivery_date.split('-').map(Number);
        endDate = new Date(year, month - 1, day);
        endDate.setHours(0, 0, 0, 0);
        devLog('✅ [deliveryScheduleService] Latest date:', {
          raw: latest.delivery_date,
          parsed: toLocalDateString(endDate),
          local: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
        });
      }

      return {
        startDate,
        endDate,
      };
    } catch (error) {
      console.error('❌ [deliveryScheduleService] Error in getDeliveryDateRange:', error);
      return {
        startDate: null,
        endDate: null,
      };
    }
  },

  async syncUserDeliverySchedules(
    userId: string,
    items: DeliveryScheduleUpsertInput[],
    orderId?: string | null
  ): Promise<{
    targetCount: number;
    insertedCount: number;
    updatedCount: number;
    invalidAddressCount: number;
    errorCount: number;
    hasErrors: boolean;
  }> {
    try {
      if (!userId || !items.length) {
        return {
          targetCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          invalidAddressCount: 0,
          errorCount: 0,
          hasErrors: false,
        };
      }

      // 去重：同一天同餐次仅保留最后一次修改
      const deduped = new Map<string, DeliveryScheduleUpsertInput>();
      items.forEach((item) => {
        if (!item?.addressId) return;
        const dateStr = normalizeDateString(item.date);
        const key = `${dateStr}-${item.mealType}`;
        deduped.set(key, { ...item, date: dateStr });
      });
      const normalizedItems = Array.from(deduped.values());
      if (!normalizedItems.length) {
        return {
          targetCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          invalidAddressCount: 0,
          errorCount: 0,
          hasErrors: false,
        };
      }

      const targetCount = normalizedItems.length;
      let errorCount = 0;
      let hasErrors = false;

      const dateStrings = Array.from(new Set(normalizedItems.map(i => String(i.date))));
      const mealTypes = Array.from(new Set(normalizedItems.map(i => i.mealType)));

      // 地址必须属于当前用户且未删除（与统一配送计划直连写入规则一致）
      const addressIds = [...new Set(normalizedItems.map((i) => i.addressId).filter(Boolean))];
      let validAddressIdSet = new Set<string>();
      if (addressIds.length > 0) {
        const { data: validAddrs, error: addressErr } = await supabase
          .from('delivery_addresses')
          .select('id')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .in('id', addressIds);
        if (addressErr) {
          console.error('❌ [deliveryScheduleService] Failed to validate address ownership:', addressErr);
          return {
            targetCount,
            insertedCount: 0,
            updatedCount: 0,
            invalidAddressCount: addressIds.length,
            errorCount: 1,
            hasErrors: true,
          };
        }
        validAddressIdSet = new Set((validAddrs || []).map((a: any) => a.id));
      }

      const validItems = normalizedItems.filter((item) => validAddressIdSet.has(item.addressId));
      const invalidAddressCount = targetCount - validItems.length;
      if (invalidAddressCount > 0) {
        hasErrors = true;
        errorCount += 1;
        console.warn('⚠️ [deliveryScheduleService] Filtered invalid/unauthorized address items:', {
          targetCount,
          validCount: validItems.length,
          invalidAddressCount,
        });
      }
      if (validItems.length === 0) {
        return {
          targetCount,
          insertedCount: 0,
          updatedCount: 0,
          invalidAddressCount,
          errorCount,
          hasErrors,
        };
      }

      // 批量拉取本次涉及的地址快照，确保地址修改后快照也同步更新
      const addrIdsToFetch = [...new Set(validItems.map((i) => i.addressId).filter(Boolean))];
      const addrSnapshotMap: Record<string, { address: string; label: string; contact_name: string; phone: string }> = {};
      if (addrIdsToFetch.length > 0) {
        const { data: addrs } = await supabase
          .from('delivery_addresses')
          .select('id, address, door_number, label, contact_name, phone')
          .in('id', addrIdsToFetch)
          .eq('is_deleted', false);
        (addrs || []).forEach((a: any) => {
          addrSnapshotMap[a.id] = {
            address: [a.address, a.door_number].filter(Boolean).join(' ').trim(),
            label: a.label || a.tag || '',
            contact_name: a.contact_name || '',
            phone: a.phone || '',
          };
        });
      }

      const { data: existingRows, error: fetchError } = await supabase
        .from('delivery_schedules')
        .select('id, user_id, delivery_date, meal_type, delivery_address_id, is_locked, locked_at, status, order_id, updated_at')
        .eq('user_id', userId)
        .eq('delivery_type', 'meal')
        .in('delivery_date', dateStrings)
        .in('meal_type', mealTypes);

      if (fetchError) {
        console.error('❌ [deliveryScheduleService] Failed to fetch existing schedules:', fetchError);
        return {
          targetCount,
          insertedCount: 0,
          updatedCount: 0,
          invalidAddressCount,
          errorCount: errorCount + 1,
          hasErrors: true,
        };
      }

      const existingByKey = new Map<string, any>();
      (existingRows || []).forEach((row: any) => {
        existingByKey.set(`${row.delivery_date}-${row.meal_type}`, row);
      });

      const inserts: Record<string, any>[] = [];
      const updates: {
        id: string;
        payload: Record<string, any>;
        before: any;
        expectedUpdatedAt?: string | null;
        needOrderSnapshot?: string | null;
      }[] = [];

      validItems.forEach((item) => {
        const dateStr = String(item.date);
        const key = `${dateStr}-${item.mealType}`;
        const existing = existingByKey.get(key);
        const timeRange = DELIVERY_MEAL_TIME_RANGES[item.mealType as keyof typeof DELIVERY_MEAL_TIME_RANGES] || DELIVERY_MEAL_TIME_RANGES.lunch;
        const desiredLocked = typeof item.isLocked === 'boolean' ? item.isLocked : true;
        const snap = addrSnapshotMap[item.addressId] || null;

        if (existing?.id) {
          const payload: Record<string, any> = {};
          if (existing.delivery_address_id !== item.addressId) {
            payload.delivery_address_id = item.addressId;
            if (snap) {
              payload.delivery_address = snap.address;
              payload.delivery_address_label = snap.label;
              payload.delivery_contact_name = snap.contact_name;
              payload.delivery_contact_phone = snap.phone;
            }
          }
          if (existing.is_locked !== desiredLocked) {
            payload.is_locked = desiredLocked;
            payload.locked_at = desiredLocked ? new Date().toISOString() : null;
          }
          if (orderId && !existing.order_id) payload.order_id = orderId;
          if (Object.keys(payload).length > 0) {
            payload.updated_at = new Date().toISOString();
            updates.push({
              id: existing.id,
              payload,
              before: existing,
              expectedUpdatedAt: existing.updated_at || null,
              needOrderSnapshot: orderId && !existing.order_id ? orderId : null
            });
          }
          return;
        }

        const itemName = item.mealType === 'breakfast' ? '早餐健康餐' : item.mealType === 'lunch' ? '午餐健康餐' : '晚餐健康餐';
        inserts.push({
          user_id: userId,
          order_id: orderId || null,
          delivery_type: 'meal',
          delivery_date: dateStr,
          meal_type: item.mealType,
          delivery_time: `${timeRange.start}-${timeRange.end}`,
          delivery_time_start: timeRange.start,
          delivery_time_end: timeRange.end,
          item_name: itemName,
          quantity: 1,
          delivery_address_id: item.addressId,
          is_locked: desiredLocked,
          locked_at: desiredLocked ? new Date().toISOString() : null,
          status: 'pending',
          updated_at: new Date().toISOString(),
          addressIdForSnapshot: item.addressId,
        });
      });

      // 拉取用户快照（nickname, phone）和订单号快照
      let userSnapshot: { nickname: string; phone: string } = { nickname: '用户', phone: '' };
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('nickname, name, phone')
        .eq('user_id', userId)
        .maybeSingle();
      if (profile) {
        userSnapshot = {
          nickname: (profile.nickname || profile.name || '用户').trim() || '用户',
          phone: profile.phone || '',
        };
      }
      let orderNumberSnapshot: string | null = null;
      if (orderId) {
        const { data: ord } = await supabase
          .from('orders')
          .select('order_number')
          .eq('id', orderId)
          .maybeSingle();
        if (ord?.order_number) orderNumberSnapshot = ord.order_number;
      }

      inserts.forEach((row: any) => {
        const snap = row.addressIdForSnapshot ? addrSnapshotMap[row.addressIdForSnapshot] : null;
        delete row.addressIdForSnapshot;
        if (snap) {
          row.delivery_address = snap.address;
          row.delivery_address_label = snap.label;
          row.delivery_contact_name = snap.contact_name;
          row.delivery_contact_phone = snap.phone;
        }
        row.delivery_user_nickname = userSnapshot.nickname;
        row.delivery_user_phone = userSnapshot.phone;
        row.delivery_order_number = orderNumberSnapshot;
      });

      let insertedCount = 0;
      let updatedCount = 0;

      if (inserts.length > 0) {
        const { data: insertedRows, error: insertError } = await supabase
          .from('delivery_schedules')
          .insert(inserts)
          .select('id, user_id, delivery_date, meal_type, delivery_address_id, is_locked, locked_at, status, order_id, updated_at');
        if (insertError) {
          console.error('❌ [deliveryScheduleService] Failed to insert schedules:', insertError);
          hasErrors = true;
          errorCount += 1;
        } else {
          insertedCount = inserts.length;
          for (const row of insertedRows || []) {
            await this.logAuditEvent({
              user_id: row.user_id,
              action: 'create',
              entity_type: 'delivery_schedule',
              entity_id: row.id,
              after_data: row,
              reason: 'sync_user_delivery_schedules',
              source: 'app',
            });
          }
        }
      }

      if (updates.length > 0) {
        const orderIdsToFetch = [...new Set(updates.map((u: any) => u.needOrderSnapshot).filter(Boolean))];
        const orderNumberMap: Record<string, string> = {};
        if (orderIdsToFetch.length > 0) {
          const { data: ords } = await supabase
            .from('orders')
            .select('id, order_number')
            .in('id', orderIdsToFetch);
          (ords || []).forEach((o: any) => { orderNumberMap[o.id] = o.order_number || ''; });
        }
        for (const row of updates) {
          const payload = { ...row.payload };
          if (row.needOrderSnapshot && orderNumberMap[row.needOrderSnapshot]) {
            payload.delivery_order_number = orderNumberMap[row.needOrderSnapshot];
          }
          let updateQuery = supabase
            .from('delivery_schedules')
            .update(payload)
            .eq('id', row.id);
          if (row.expectedUpdatedAt) {
            updateQuery = updateQuery.eq('updated_at', row.expectedUpdatedAt);
          }
          const { data: updatedRow, error: updateError } = await updateQuery
            .select('id, user_id, delivery_date, meal_type, delivery_address_id, is_locked, locked_at, status, order_id, updated_at')
            .maybeSingle();
          if (updateError) {
            console.error('❌ [deliveryScheduleService] Failed to update schedule:', updateError);
            hasErrors = true;
            errorCount += 1;
          } else if (!updatedRow) {
            console.warn('⚠️ [deliveryScheduleService] Skip stale schedule update due to optimistic lock:', row.id);
            hasErrors = true;
            errorCount += 1;
          } else {
            updatedCount += 1;
            await this.logAuditEvent({
              user_id: updatedRow.user_id,
              action: 'update',
              entity_type: 'delivery_schedule',
              entity_id: updatedRow.id,
              before_data: row.before || null,
              after_data: updatedRow,
              reason: 'sync_user_delivery_schedules',
              source: 'app',
            });
          }
        }
      }

      devLog('✅ [deliveryScheduleService] Synced delivery_schedules:', {
        targetCount,
        insertedCount,
        updatedCount,
        invalidAddressCount,
        errorCount,
      });

      return {
        targetCount,
        insertedCount,
        updatedCount,
        invalidAddressCount,
        errorCount,
        hasErrors,
      };
    } catch (error) {
      console.error('❌ [deliveryScheduleService] Error in syncUserDeliverySchedules:', error);
      return {
        targetCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        invalidAddressCount: 0,
        errorCount: 1,
        hasErrors: true,
      };
    }
  },
};

