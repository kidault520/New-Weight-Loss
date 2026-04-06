const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { getDeliveryMealTimeRange } = require('../../config/deliveryMealTimes');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');
const aiService = require('../../services/aiService');
const { toBeijingDateString } = require('../../utils/timezone');
const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(auditLog);

/**
 * Get users list with pagination, search, and filters
 * GET /api/admin/users?page=1&limit=20&search=keyword&role=user
 */
router.get('/', checkPermission('manage_users'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'desc';
    const cEndOnly = req.query.c_end_only === '1' || req.query.c_end_only === 'true';
    const skipEmail = req.query.skip_email === '1' || req.query.skip_email === 'true';

    let query = supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact' });

    // 仅 C 端用户：排除组织内人员（auth_user_id、phone、nickname/name 匹配 sales_persons）
    let excludeUserIds = [];
    let excludePhones = [];
    let excludeNicknames = [];
    if (cEndOnly) {
      const { data: salesRows } = await supabaseAdmin
        .from('sales_persons')
        .select('auth_user_id, phone, name');
      excludeUserIds = (salesRows || []).map((r) => r.auth_user_id).filter(Boolean);
      excludePhones = (salesRows || []).map((r) => r.phone).filter((p) => p && String(p).trim());
      excludeNicknames = (salesRows || []).map((r) => r.name).filter((n) => n && String(n).trim());
    }

    // Search by name, nickname
    if (search) {
      query = query.or(`name.ilike.%${search}%,nickname.ilike.%${search}%`);
    }

    // 筛选条件（user_profiles 表字段）
    const nickname = req.query.nickname;
    const name = req.query.name;
    const phone = req.query.phone;
    if (nickname) query = query.ilike('nickname', `%${nickname}%`);
    if (name) query = query.ilike('name', `%${name}%`);
    if (phone) query = query.ilike('phone', `%${phone}%`);

    // Apply sorting
    if (sortBy === 'email') {
      // Note: Sorting by email requires a join, which is complex
      // For now, we'll sort by created_at
      query = query.order('created_at', { ascending: sortOrder === 'asc' });
    } else {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    let profiles = data || [];
    if (cEndOnly) {
      const userIdSet = new Set(excludeUserIds);
      const phoneSet = new Set(excludePhones.map((p) => String(p).trim()));
      const nicknameSet = new Set(excludeNicknames.map((n) => String(n).trim().toLowerCase()));
      profiles = profiles.filter((p) => {
        if (userIdSet.has(p.user_id)) return false;
        if (p.phone && phoneSet.has(String(p.phone).trim())) return false;
        const nick = (p.nickname || p.name || '').trim().toLowerCase();
        if (nick && nicknameSet.has(nick)) return false;
        return true;
      });
    }

    // Get email for each user（skip_email 时跳过，避免 N+1 导致极慢）
    const usersWithEmail = skipEmail
      ? profiles.map((p) => ({ ...p, email: null, last_sign_in_at: null }))
      : await Promise.all(
          profiles.map(async (profile) => {
            const { data: authData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
            return {
              ...profile,
              email: authData?.user?.email || null,
              last_sign_in_at: authData?.user?.last_sign_in_at || null
            };
          })
        );

    res.json({
      users: usersWithEmail,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    logger.error('Get users list error:', error);
    res.status(500).json({ error: 'Failed to get users list' });
  }
});

/**
 * Get user details by ID
 * GET /api/admin/users/:id
 */
router.get('/:id', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get auth user info
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);

    res.json({
      user: {
        ...profile,
        email: authData?.user?.email || null,
        last_sign_in_at: authData?.user?.last_sign_in_at || null,
        created_at: authData?.user?.created_at || null
      }
    });
  } catch (error) {
    logger.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

/**
 * Update user information
 * PUT /api/admin/users/:id
 */
router.put('/:id', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.user_id;
    delete updateData.id;
    delete updateData.created_at;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'User updated successfully',
      user: data
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * Delete user
 * DELETE /api/admin/users/:id
 */
router.delete('/:id', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Delete user from auth (this will cascade delete profile due to ON DELETE CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      throw error;
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * Reset user password
 * POST /api/admin/users/:id/reset-password
 */
router.post('/:id/reset-password', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Update user password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) {
      throw error;
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * Get all user data (health records, assessments, etc.)
 * GET /api/admin/users/:id/data?type=health_records&startDate=2024-01-01&endDate=2024-12-31&recordType=weight
 */
router.get('/:id/data', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;
    const dataType = req.query.type; // Optional filter: health_records, assessments, etc.
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const recordType = req.query.recordType; // For health_records: weight, steps, sleep, etc.

    const userData = {};

    // Health records with filtering
    if (!dataType || dataType === 'health_records') {
      let query = supabaseAdmin
        .from('health_records')
        .select('*')
        .eq('user_id', userId);
      
      if (recordType) {
        query = query.eq('record_type', recordType);
      }
      
      if (startDate) {
        query = query.gte('recorded_at', startDate);
      }
      
      if (endDate) {
        query = query.lte('recorded_at', endDate);
      }
      
      const { data: healthRecords } = await query.order('recorded_at', { ascending: false });
      userData.health_records = healthRecords || [];
    }

    // Delivery addresses
    if (!dataType || dataType === 'addresses') {
      const { data: addresses, error: addressError } = await supabaseAdmin
        .from('delivery_addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (addressError) {
        logger.error('Get delivery addresses error:', addressError);
        userData.addresses = [];
      } else {
        userData.addresses = addresses || [];
        logger.info(`Found ${userData.addresses.length} addresses for user ${userId}`);
      }
    }

    // User devices
    if (!dataType || dataType === 'devices') {
      const { data: devices } = await supabaseAdmin
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .order('connected_at', { ascending: false });
      userData.devices = devices || [];
    }

    // Orders (商品订单)
    if (!dataType || dataType === 'orders') {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('*, products(id, product_name, product_code, duration_days)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      userData.orders = orders || [];
    }

    // Note: meal_orders 表已废弃，现在使用 orders 表
    // 订单数据通过 orders 表查询（见上面的 orders 查询）

    // User packages
    if (!dataType || dataType === 'packages') {
      const { data: packages } = await supabaseAdmin
        .from('user_packages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      userData.packages = packages || [];
    }

    // Delivery schedules (配送计划)
    if (!dataType || dataType === 'delivery_schedules') {
      // 获取用户的配送计划配置（开始日期、结束日期等）
      const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('meal_plan_config_data')
        .eq('user_id', userId)
        .single();
      
      const mealPlanConfig = userProfile?.meal_plan_config_data || {};
      
      // 统一从 delivery_schedules 表获取（餐食 + 补剂）
      let deliverySchedules = [];
      let schedulesQuery = supabaseAdmin
        .from('delivery_schedules')
        .select(`
          *,
          delivery_addresses(
            id,
            label,
            address,
            door_number,
            contact_name,
            phone
          )
        `)
        .eq('user_id', userId);

      if (mealPlanConfig.start_date && mealPlanConfig.end_date) {
        schedulesQuery = schedulesQuery
          .gte('delivery_date', mealPlanConfig.start_date)
          .lte('delivery_date', mealPlanConfig.end_date);
      }

      const { data: schedulesData } = await schedulesQuery
        .order('delivery_date', { ascending: true })
        .order('meal_type', { ascending: true, nullsFirst: false });

      if (schedulesData && schedulesData.length > 0) {
        const mealTypeOrder = { 'breakfast': 1, 'lunch': 2, 'dinner': 3 };
        deliverySchedules = schedulesData.map((schedule) => {
          const range = getDeliveryMealTimeRange(schedule.meal_type || 'lunch');
          let deliveryTime = schedule.delivery_time
            || (schedule.delivery_time_start && schedule.delivery_time_end
              ? `${schedule.delivery_time_start}-${schedule.delivery_time_end}`
              : `${range.start}-${range.end}`);
          const mealTypeName = schedule.meal_type === 'lunch' ? '午餐' : schedule.meal_type === 'dinner' ? '晚餐' : '早餐';
          const addr = schedule.delivery_addresses;
          return {
            id: schedule.id,
            order_id: schedule.order_id,
            user_id: userId,
            delivery_type: schedule.delivery_type || 'meal',
            delivery_date: schedule.delivery_date,
            delivery_time: deliveryTime,
            item_id: schedule.item_id,
            item_name: schedule.item_name || `${mealTypeName}健康餐`,
            quantity: schedule.quantity ?? 1,
            delivery_address_id: schedule.delivery_address_id,
            status: schedule.status || 'pending',
            delivery_address: addr ? `${addr.address || ''} ${addr.door_number || ''}`.trim() : '',
            delivery_address_label: addr?.label || null,
            is_locked: schedule.is_locked || false,
            created_at: schedule.created_at,
            updated_at: schedule.updated_at
          };
        });
        deliverySchedules.sort((a, b) => {
          if (a.delivery_date !== b.delivery_date) return a.delivery_date.localeCompare(b.delivery_date);
          const ma = a.item_name?.includes('午餐') ? 'lunch' : a.item_name?.includes('晚餐') ? 'dinner' : 'breakfast';
          const mb = b.item_name?.includes('午餐') ? 'lunch' : b.item_name?.includes('晚餐') ? 'dinner' : 'breakfast';
          return (mealTypeOrder[ma] || 99) - (mealTypeOrder[mb] || 99);
        });
      }
      
      // 如果还是没有数据，基于配置信息动态生成配送计划
      if (deliverySchedules.length === 0 && mealPlanConfig.start_date && mealPlanConfig.end_date && mealPlanConfig.selected_meal_types) {
        const startDate = new Date(mealPlanConfig.start_date);
        const endDate = new Date(mealPlanConfig.end_date);
        const mealTypes = mealPlanConfig.selected_meal_types || [];
        const defaultAddressId = mealPlanConfig.delivery_address_id;
        
        // 获取默认地址信息
        let defaultAddress = null;
        if (defaultAddressId) {
          const { data: addressData } = await supabaseAdmin
            .from('delivery_addresses')
            .select('*')
            .eq('id', defaultAddressId)
            .eq('user_id', userId)
            .eq('is_deleted', false)
            .single();
          defaultAddress = addressData;
        }
        
        // 生成日期范围内的所有配送计划
        // 确保餐型按正确顺序：早餐 -> 午餐 -> 晚餐
        const mealTypeOrder = ['breakfast', 'lunch', 'dinner'];
        const sortedMealTypes = mealTypes.sort((a, b) => {
          const indexA = mealTypeOrder.indexOf(a);
          const indexB = mealTypeOrder.indexOf(b);
          return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
        
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateStr = toBeijingDateString(currentDate);
          
          sortedMealTypes.forEach((mealType) => {
            // 根据meal_type确定配送时间
            const range = getDeliveryMealTimeRange(mealType);
            const deliveryTime = `${range.start}-${range.end}`;
            
            const mealTypeName = mealType === 'lunch' ? '午餐' : mealType === 'dinner' ? '晚餐' : '早餐';
            
            deliverySchedules.push({
              id: `generated-${dateStr}-${mealType}`,
              order_id: null,
              user_id: userId,
              delivery_type: 'meal',
              delivery_date: dateStr,
              delivery_time: deliveryTime,
              item_id: null,
              item_name: `${mealTypeName}健康餐`,
              quantity: 1,
              delivery_address_id: defaultAddressId,
              status: 'pending',
              delivery_address: defaultAddress ? `${defaultAddress.address} ${defaultAddress.door_number}`.trim() : '',
              delivery_address_label: defaultAddress?.label || null,
              is_locked: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          });
          
          // 移动到下一天
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      
      // 如果有配送计划，获取关联的订单和商品信息
      if (deliverySchedules && deliverySchedules.length > 0) {
        const orderIds = [...new Set(deliverySchedules.map(s => s.order_id).filter(Boolean))];
        if (orderIds.length > 0) {
          const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, product_id, products(id, product_name, product_code)')
            .in('id', orderIds);
          
          // 将订单信息合并到配送计划中
          const ordersMap = {};
          (orders || []).forEach(order => {
            ordersMap[order.id] = order;
          });
          
          deliverySchedules.forEach(schedule => {
            if (schedule.order_id && ordersMap[schedule.order_id]) {
              schedule.orders = ordersMap[schedule.order_id];
            }
            
            // 处理地址信息
            if (schedule.delivery_addresses) {
              const addr = Array.isArray(schedule.delivery_addresses) 
                ? schedule.delivery_addresses[0] 
                : schedule.delivery_addresses;
              if (addr) {
                schedule.delivery_address = `${addr.address} ${addr.door_number}`.trim();
                schedule.delivery_address_label = addr.label;
              }
            }
          });
        }
      }
      
      // 统计锁定的餐食数量
      let lockedMealsCount = 0;
      if (deliverySchedules && deliverySchedules.length > 0) {
        deliverySchedules.forEach(schedule => {
          // 优先使用is_locked字段，如果没有则根据配送时间判断（配送时间前1小时自动锁定）
          if (schedule.is_locked === true) {
            lockedMealsCount++;
          } else if (schedule.delivery_date && schedule.delivery_time && !schedule.hasOwnProperty('is_locked')) {
            const deliveryTimeStr = schedule.delivery_time.split('-')[0]; // 获取开始时间，如 "11:30"
            const deliveryDateTime = new Date(`${schedule.delivery_date}T${deliveryTimeStr}+08:00`);
            const lockTime = new Date(deliveryDateTime.getTime() - 60 * 60 * 1000); // 1小时前
            const now = new Date();
            if (now >= lockTime) {
              lockedMealsCount++;
            }
          }
        });
      }
      
      userData.delivery_schedules = {
        config: {
          start_date: mealPlanConfig.start_date || null,
          end_date: mealPlanConfig.end_date || null,
          selected_dates: mealPlanConfig.selected_dates || [],
          selected_meal_types: mealPlanConfig.selected_meal_types || [],
          delivery_address_id: mealPlanConfig.delivery_address_id || null
        },
        schedules: deliverySchedules || [],
        statistics: {
          total_meals: deliverySchedules?.length || 0,
          locked_meals: lockedMealsCount,
          pending_meals: (deliverySchedules?.length || 0) - lockedMealsCount
        }
      };
    }

    // Health assessments (健康评估报告)
    if (!dataType || dataType === 'assessments') {
      const { data: assessments } = await supabaseAdmin
        .from('health_assessments')
        .select('*')
        .eq('user_id', userId)
        .order('assessment_date', { ascending: false });
      userData.assessments = assessments || [];
    }

    if (!dataType || dataType === 'emotions') {
      const { data: emotionRows } = await supabaseAdmin
        .from('health_records')
        .select('*')
        .eq('user_id', userId)
        .eq('record_type', 'emotion')
        .order('recorded_at', { ascending: false });
      const { mapHealthRowsToEmotionRecords } = require('../../utils/mapEmotionHealthRecord');
      userData.emotions = mapHealthRowsToEmotionRecords(emotionRows || []);
    }

    if (!dataType || dataType === 'exercises') {
      const { data: exerciseRows } = await supabaseAdmin
        .from('health_records')
        .select('*')
        .eq('user_id', userId)
        .eq('record_type', 'exercise')
        .order('recorded_at', { ascending: false });
      userData.exercises = (exerciseRows || []).map((row) => {
        const ed = row.exercise_data && typeof row.exercise_data === 'object' ? row.exercise_data : {};
        return {
          id: row.id,
          user_id: row.user_id,
          exercise_name: ed.name || '运动',
          duration_minutes: Number(ed.duration) || 0,
          calories_burned: Number(ed.calories_burned ?? row.value) || 0,
          exercise_type: ed.exercise_type || 'other',
          intensity: ed.intensity || 'moderate',
          notes: row.notes,
          recorded_at: row.recorded_at,
          source: ed.source || 'manual',
        };
      });
    }

    if (!dataType || dataType === 'meal_plans') {
      const { data: mealPlans } = await supabaseAdmin
        .from('meal_plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      userData.meal_plans = mealPlans || [];
    }

    if (!dataType || dataType === 'nutrition_plans') {
      const { data: nutritionPlans } = await supabaseAdmin
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      userData.nutrition_plans = nutritionPlans || [];
    }

    if (!dataType || dataType === 'supplements') {
      const { data: supplements } = await supabaseAdmin
        .from('custom_supplements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      userData.supplements = supplements || [];
    }

    // Custom reports (自定义报告)
    if (!dataType || dataType === 'reports') {
      const { data: reports } = await supabaseAdmin
        .from('custom_reports')
        .select('*')
        .eq('user_id', userId)
        .order('generation_date', { ascending: false });
      userData.reports = reports || [];
      
      // 同时返回健康评估数据（如果还没有加载）
      if (!userData.assessments) {
        const { data: assessments } = await supabaseAdmin
          .from('health_assessments')
          .select('*')
          .eq('user_id', userId)
          .order('assessment_date', { ascending: false });
        userData.assessments = assessments || [];
      }
    }

    res.json({ userData });
  } catch (error) {
    logger.error('Get user data error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

/**
 * Add health record for user
 * POST /api/admin/users/:id/health-records
 */
router.post('/:id/health-records', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;
    const {
      record_type,
      value,
      unit,
      nutrition_data,
      exercise_data,
      measurement_data,
      emotion_data,
      notes,
      recorded_at,
    } = req.body;

    if (!record_type || value === undefined) {
      return res.status(400).json({ error: 'record_type and value are required' });
    }

    const row = {
      user_id: userId,
      record_type,
      value,
      unit,
      nutrition_data,
      exercise_data,
      measurement_data,
      notes,
      recorded_at: recorded_at || new Date().toISOString(),
    };

    if (record_type === 'emotion') {
      const inten = Number(value);
      const base = {
        emotion: 'neutral',
        intensity: Number.isFinite(inten) ? inten : 0.5,
        message: notes ?? null,
      };
      row.emotion_data =
        emotion_data && typeof emotion_data === 'object' ? { ...base, ...emotion_data } : base;
    }

    const { data, error } = await supabaseAdmin.from('health_records').insert(row)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ message: 'Health record added successfully', record: data });
  } catch (error) {
    logger.error('Add health record error:', error);
    res.status(500).json({ error: 'Failed to add health record' });
  }
});

/**
 * Update health record
 * PUT /api/admin/users/:id/health-records/:recordId
 */
router.put('/:id/health-records/:recordId', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;
    const recordId = req.params.recordId;
    const updateData = req.body;

    delete updateData.id;
    delete updateData.user_id;
    delete updateData.created_at;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('health_records')
      .update(updateData)
      .eq('id', recordId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ message: 'Health record updated successfully', record: data });
  } catch (error) {
    logger.error('Update health record error:', error);
    res.status(500).json({ error: 'Failed to update health record' });
  }
});

/**
 * Delete health record
 * DELETE /api/admin/users/:id/health-records/:recordId
 */
router.delete('/:id/health-records/:recordId', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;
    const recordId = req.params.recordId;

    const { error } = await supabaseAdmin
      .from('health_records')
      .delete()
      .eq('id', recordId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Health record deleted successfully' });
  } catch (error) {
    logger.error('Delete health record error:', error);
    res.status(500).json({ error: 'Failed to delete health record' });
  }
});

/**
 * Generate AI health analysis report
 * POST /api/admin/users/:id/ai-analysis
 */
router.post('/:id/ai-analysis', checkPermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Parallelize all database queries for better performance
    const [
      { data: profile, error: profileError },
      { data: authData },
      { data: healthRecords },
      { data: assessments },
      { data: reports },
      { data: orders },
      { data: schedulesData },
      { data: addresses }
    ] = await Promise.all([
      // Get user profile (only once, with meal_plan_config_data)
      supabaseAdmin
        .from('user_profiles')
        .select('*, meal_plan_config_data')
        .eq('user_id', userId)
        .single(),
      // Get auth user info
      supabaseAdmin.auth.admin.getUserById(userId),
      // Get health records (limit to 100 most recent for performance)
      supabaseAdmin
        .from('health_records')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(100),
      // Get health assessments (limit to 5 most recent)
      supabaseAdmin
        .from('health_assessments')
        .select('*')
        .eq('user_id', userId)
        .order('assessment_date', { ascending: false })
        .limit(5),
      // Get custom reports (limit to 5 most recent)
      supabaseAdmin
        .from('custom_reports')
        .select('*')
        .eq('user_id', userId)
        .order('generation_date', { ascending: false })
        .limit(5),
      // Get orders
      supabaseAdmin
        .from('orders')
        .select('*, products(id, product_name, product_code, duration_days)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      // Get delivery schedules (last 7 days)
      supabaseAdmin
        .from('delivery_schedules')
        .select('*')
        .eq('user_id', userId)
        .gte('delivery_date', toBeijingDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        .order('delivery_date', { ascending: true }),
      // Get delivery addresses
      supabaseAdmin
        .from('delivery_addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('is_default', { ascending: false })
    ]);

    if (profileError) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mealPlanConfig = profile?.meal_plan_config_data || {};
    const deliverySchedules = schedulesData || [];

    // Calculate latest data update timestamp
    const latestUpdateTimes = [
      healthRecords?.[0]?.recorded_at,
      healthRecords?.[0]?.updated_at,
      assessments?.[0]?.assessment_date,
      assessments?.[0]?.updated_at,
      orders?.[0]?.created_at,
      orders?.[0]?.updated_at,
      schedulesData?.[schedulesData.length - 1]?.updated_at,
      profile?.updated_at,
      authData?.user?.last_sign_in_at
    ].filter(Boolean).map(time => new Date(time).getTime());
    
    const latestDataUpdateTime = latestUpdateTimes.length > 0 
      ? Math.max(...latestUpdateTimes) 
      : Date.now();

    // Check for cached AI analysis report
    const { data: cachedReports, error: cacheError } = await supabaseAdmin
      .from('custom_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('report_type', 'ai_analysis')
      .order('generation_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If cached report exists and data hasn't been updated, return cached report
    if (cachedReports && cachedReports.report_data?.html) {
      const cacheTime = new Date(cachedReports.generation_date).getTime();
      // If cache is newer than latest data update, return cached report
      if (cacheTime >= latestDataUpdateTime) {
        logger.info(`Returning cached AI analysis report for user ${userId}, cached at: ${cachedReports.generation_date}`);
        return res.json({ 
          html: cachedReports.report_data.html,
          cached: true,
          cached_at: cachedReports.generation_date
        });
      }
      logger.info(`Data updated since last report generation for user ${userId}, regenerating...`);
    }

    // Organize health records by type
    const healthRecordsByType = {};
    (healthRecords || []).forEach(record => {
      if (!healthRecordsByType[record.record_type]) {
        healthRecordsByType[record.record_type] = [];
      }
      healthRecordsByType[record.record_type].push(record);
    });

    // Prepare data for AI
    const userDataSummary = {
      // 个人数据
      personal: {
        name: profile.name || profile.nickname || '未命名',
        email: authData?.user?.email || null,
        age: profile.age,
        gender: profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '其他',
        height: profile.height,
        current_weight: profile.current_weight,
        target_weight: profile.target_weight,
        initial_weight: profile.initial_weight,
        activity_level: profile.activity_level,
        fitness_goal: profile.fitness_goal,
        bmr: profile.bmr,
        created_at: authData?.user?.created_at || profile.created_at,
        last_sign_in_at: authData?.user?.last_sign_in_at || null,
      },
      // 健康数据统计
      health_summary: {
        total_records: healthRecords?.length || 0,
        record_types: Object.keys(healthRecordsByType),
        latest_weight: healthRecordsByType['weight']?.[0]?.value || null,
        latest_blood_glucose: healthRecordsByType['blood_glucose']?.[0]?.value || null,
        latest_sleep: healthRecordsByType['sleep']?.[0]?.value || null,
        latest_steps: healthRecordsByType['steps']?.[0]?.value || null,
        latest_water: healthRecordsByType['water']?.[0]?.value || null,
        latest_hrv: healthRecordsByType['hrv']?.[0]?.value || null,
        calories_records: healthRecordsByType['calories']?.length || 0,
        measurements_records: healthRecordsByType['measurements']?.length || 0,
        nutrition_records: healthRecordsByType['food']?.length || 0,
        exercise_records: healthRecordsByType['exercise']?.length || 0,
      },
      // 健康记录详情（最近30条，已在查询时限制为100条）
      health_records: (healthRecords || []).slice(0, 30).map(record => ({
        type: record.record_type,
        value: record.value,
        unit: record.unit,
        recorded_at: record.recorded_at,
        notes: record.notes,
        nutrition_data: record.nutrition_data,
        exercise_data: record.exercise_data,
        measurement_data: record.measurement_data,
      })),
      // 报告数据（已在查询时限制为5条）
      assessments: (assessments || []).map(assessment => ({
        assessment_date: assessment.assessment_date,
        overall_score: assessment.overall_score,
        diet_score: assessment.diet_score,
        fitness_score: assessment.fitness_score,
        rest_score: assessment.rest_score,
        psychology_score: assessment.psychology_score,
        exercise_score: assessment.exercise_score,
        primary_improvement_area: assessment.primary_improvement_area,
      })),
      reports: (reports || []).map(report => ({
        title: report.title,
        generation_date: report.generation_date,
        report_type: report.report_type,
      })),
      // 订单数据
      orders: (orders || []).map(order => ({
        order_number: order.order_number,
        product_name: order.products?.product_name || null,
        quantity: order.quantity,
        total_amount: order.total_amount,
        payment_status: order.payment_status,
        order_status: order.order_status,
        created_at: order.created_at,
      })),
      // 配送数据
      delivery: {
        total_schedules: deliverySchedules?.length || 0,
        config: mealPlanConfig,
        addresses: (addresses || []).map(addr => ({
          label: addr.label,
          address: addr.address,
          is_default: addr.is_default,
        })),
      },
    };

    // Build AI prompt (optimized for faster processing)
    const systemPrompt = `你是专业的健康数据分析师。基于用户数据生成HTML健康解读报告。

要求：
1. 数据综合分析：整合个人信息、健康记录、评估报告、订单配送数据，识别趋势和改善机会
2. 可视化：使用Chart.js创建3-5个数据图表（体重、血糖、睡眠等），使用浅绿色背景(#f0f9f4)，简洁设计，不用渐变/玻璃态/动画
3. 个性化建议：提供5条具体可操作建议，每条包含触发条件、微习惯、进阶路径、预期收益
4. 报告结构：执行摘要、数据概览(含图表)、健康评估、关键发现、个性化建议、行动计划
5. 技术：HTML5，TailwindCSS和Chart.js通过CDN引入，响应式设计
6. 设计：浅绿色背景，白色卡片，深色文字，清晰层次
7. 开头标注："本报告仅供参考，不构成医疗建议"和生成时间
8. 语气：友好专业，通俗易懂，避免医学术语`;

    const userPrompt = `基于以下用户数据生成HTML健康解读报告：

${JSON.stringify(userDataSummary, null, 2)}

生成要求：
1. 完整HTML文档(<!DOCTYPE html>、<head>、<body>)
2. <head>中引入TailwindCSS和Chart.js CDN
3. 浅绿色背景(#f0f9f4)，简洁设计，不用渐变/玻璃态/动画
4. 创建3-5个Chart.js图表
5. 提供5条具体可操作的健康建议
6. 开头显示免责声明和生成时间
7. 响应式设计
8. **重要**：只生成报告内容，不包含任何说明性文字`;

    // Call DeepSeek API
    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    logger.info(`Generating AI analysis report for user ${userId}`);
    logger.info(`User data summary: ${JSON.stringify({
      personal: userDataSummary.personal.name,
      health_records_count: userDataSummary.health_summary.total_records,
      assessments_count: userDataSummary.assessments.length,
      orders_count: userDataSummary.orders.length
    })}`);

    try {
      const htmlReport = await aiService.chatWithDeepSeek(messages, {
        maxTokens: 8000,
        temperature: 0.7,
        timeout: 120000, // 120 seconds
      });

      logger.info(`AI analysis report generated successfully for user ${userId}, length: ${htmlReport?.length || 0}`);
      
      // Save report to cache (custom_reports table)
      try {
        // Check if report already exists
        const { data: existingReport } = await supabaseAdmin
          .from('custom_reports')
          .select('id')
          .eq('user_id', userId)
          .eq('report_type', 'ai_analysis')
          .order('generation_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingReport) {
          // Update existing report
          await supabaseAdmin
            .from('custom_reports')
            .update({
              report_data: { html: htmlReport },
              generation_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingReport.id);
          logger.info(`Updated cached AI analysis report for user ${userId}`);
        } else {
          // Insert new report
          await supabaseAdmin
            .from('custom_reports')
            .insert({
              user_id: userId,
              report_type: 'ai_analysis',
              title: 'AI健康数据解读报告',
              report_data: { html: htmlReport },
              status: 'active',
              generation_date: new Date().toISOString()
            });
          logger.info(`Saved new AI analysis report to cache for user ${userId}`);
        }
      } catch (cacheError) {
        // Log cache error but don't fail the request
        logger.error(`Failed to cache AI analysis report for user ${userId}:`, cacheError);
      }

      res.json({ html: htmlReport, cached: false });
    } catch (aiError) {
      logger.error(`DeepSeek API error for user ${userId}:`, {
        message: aiError.message,
        stack: aiError.stack
      });
      throw aiError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    logger.error('Generate AI analysis error:', {
      userId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    
    const errorMessage = error.message || 'Failed to generate AI analysis report';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;


