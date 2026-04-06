 
import { supabase } from '../config/supabase';
import { toLocalDateString } from '../utils/dateUtils';
import { pickPrimaryServiceOrder } from '../utils/serviceOrderRank';

const executionProgramDebugEnabled = import.meta.env.DEV
  && typeof window !== 'undefined'
  && window.localStorage?.getItem('debug.executionProgram') === '1';

const debugExecutionLog = (...args: unknown[]) => {
  if (executionProgramDebugEnabled) {
    console.log(...args);
  }
};

export interface ExecutionProgram {
  id: string;
  user_id: string;
  order_id: string;
  program_type: number; // 21, 90等套餐天数
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'paused';
  current_day: number;
  total_days: number;
  created_at: string;
  updated_at: string;
}

export interface OrderWithProduct {
  id: string;
  user_id: string;
  product_id: string;
  payment_status: string;
  order_status?: string;
  payment_time: string | null;
  created_at: string;
  products: {
    id: string;
    duration_days: number;
    product_name: string;
  };
}

/**
 * 执行计划服务
 * 核心功能：从订单同步执行计划
 */
export const executionProgramService = {
  /**
   * 检查用户是否有已支付订单
   */
  async checkUserHasOrder(userId: string): Promise<boolean> {
    try {
      debugExecutionLog('🔍 [executionProgramService] Checking order for userId:', userId);
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, payment_status, order_status, created_at')
        .eq('user_id', userId)
        .eq('payment_status', 'paid')
        .neq('order_status', 'cancelled')
        .neq('order_status', 'completed')
        .limit(5); // 🔥 改为5条，方便调试

      debugExecutionLog('🔍 [executionProgramService] Order query result:', {
        dataCount: data?.length || 0, 
        data: data?.map(o => ({ id: o.id, payment_status: o.payment_status, order_status: o.order_status })),
        error 
      });

      if (error) {
        console.error('❌ [executionProgramService] Order query error:', error);
        throw error;
      }
      
      const hasOrder = (data?.length || 0) > 0;
      debugExecutionLog('✅ [executionProgramService] Has order:', hasOrder, 'count:', data?.length || 0);
      return hasOrder;
    } catch (error) {
      console.error('❌ [executionProgramService] Error checking user order:', error);
      return false;
    }
  },

  /**
   * 从订单获取套餐天数
   */
  async getOrderDurationDays(userId: string): Promise<number | null> {
    try {
      const { data: rows, error } = await supabase
        .from('orders')
        .select(`
          id,
          product_id,
          order_status,
          payment_time,
          created_at,
          products (
            id,
            duration_days
          )
        `)
        .eq('user_id', userId)
        .eq('payment_status', 'paid')
        .neq('order_status', 'cancelled')
        .neq('order_status', 'completed')
        .order('payment_time', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      const data = pickPrimaryServiceOrder(rows || []);
      if (data && data.products && typeof data.products === 'object' && 'duration_days' in data.products) {
        return (data.products as { duration_days: number }).duration_days;
      }
      return null;
    } catch (error) {
      console.error('Error getting order duration days:', error);
      return null;
    }
  },

  /**
   * 获取用户最新的已支付订单（用于同步执行计划）
   */
  async getLatestPaidOrder(userId: string): Promise<OrderWithProduct | null> {
    try {
      debugExecutionLog('🔍 [executionProgramService] getLatestPaidOrder called for userId:', userId);
      
      const { data: rows, error } = await supabase
        .from('orders')
        .select(`
          id,
          user_id,
          product_id,
          payment_status,
          order_status,
          payment_time,
          created_at,
          products (
            id,
            duration_days,
            product_name
          )
        `)
        .eq('user_id', userId)
        .eq('payment_status', 'paid')
        .neq('order_status', 'cancelled')
        .neq('order_status', 'completed')
        .order('payment_time', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);

      debugExecutionLog('🔍 [executionProgramService] getLatestPaidOrder query result:', {
        rowCount: rows?.length ?? 0,
        error: error?.message,
        errorCode: error?.code,
      });

      if (error) {
        console.error('❌ [executionProgramService] Error getting latest paid order:', error);
        throw error;
      }

      const data = pickPrimaryServiceOrder(rows || []);
      if (!data) {
        debugExecutionLog('⚠️ [executionProgramService] No paid order in ranked window');
        return null;
      }
      
      debugExecutionLog('✅ [executionProgramService] Found order data:', {
        orderId: data.id,
        productId: data.product_id,
        paymentStatus: data.payment_status,
        hasProducts: !!data.products,
      });

      // 处理 products 可能是数组或对象的情况
      let products: { id: string; duration_days: number; product_name: string } | null = null;
      if (data.products) {
        if (Array.isArray(data.products) && data.products.length > 0) {
          products = data.products[0] as any;
        } else if (typeof data.products === 'object') {
          products = data.products as any;
        }
      }

      if (!products) {
        console.error('❌ [executionProgramService] No products data found in order:', data.id);
        return null;
      }
      
      debugExecutionLog('✅ [executionProgramService] Extracted products:', {
        productId: products.id,
        durationDays: products.duration_days,
        productName: products.product_name,
      });

      return {
        id: data.id,
        user_id: data.user_id,
        product_id: data.product_id,
        payment_status: data.payment_status,
        order_status: data.order_status,
        payment_time: data.payment_time,
        created_at: data.created_at,
        products: {
          id: products.id,
          duration_days: products.duration_days,
          product_name: products.product_name,
        },
      };
    } catch (error) {
      console.error('Error getting latest paid order:', error);
      return null;
    }
  },

  /**
   * 核心方法：从订单同步执行计划
   * 幂等操作：如果执行计划已存在则更新，不存在则创建
   */
  async syncProgramFromOrder(userId: string): Promise<ExecutionProgram | null> {
    try {
      debugExecutionLog('🔄 [executionProgramService] syncProgramFromOrder called for userId:', userId);
      
      // 1. 获取用户最新的已支付订单
      const order = await this.getLatestPaidOrder(userId);
      if (!order) {
        debugExecutionLog('⚠️ [executionProgramService] No paid order found for user:', userId);
        return null;
      }
      
      debugExecutionLog('✅ [executionProgramService] Found order:', {
        orderId: order.id,
        productId: order.product_id,
        durationDays: order.products.duration_days,
        paymentTime: order.payment_time,
      });

      // 2. 计算开始日期和结束日期
      const startDate = order.payment_time 
        ? toLocalDateString(new Date(order.payment_time))
        : toLocalDateString(new Date(order.created_at));
      
      const start = new Date(startDate);
      const endDate = new Date(start);
      endDate.setDate(start.getDate() + order.products.duration_days - 1);
      const endDateStr = toLocalDateString(endDate);

      // 3. 计算当前是第几天
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      let currentDay = 1;
      if (today >= startDateObj) {
        const diffTime = today.getTime() - startDateObj.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        currentDay = Math.min(diffDays, order.products.duration_days);
      }

      // 4. 检查执行计划是否已存在
      const { data: existingProgram, error: checkError } = await supabase
        .from('execution_programs')
        .select('*')
        .eq('user_id', userId)
        .eq('order_id', order.id)
        .maybeSingle();

      debugExecutionLog('🔍 [executionProgramService] Checking existing program:', {
        hasExisting: !!existingProgram,
        error: checkError?.message,
        errorCode: checkError?.code,
      });

      // 🔥 如果是表不存在的错误，返回 null
      if (checkError && checkError.code === 'PGRST205') {
        console.error('❌ [executionProgramService] Database table does not exist. Please run migration:', checkError.message);
        return null;
      }

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ [executionProgramService] Error checking existing program:', checkError);
        throw checkError;
      }

      // 5. 如果存在则更新，不存在则创建
      if (existingProgram) {
        debugExecutionLog('🔄 [executionProgramService] Updating existing program:', existingProgram.id);
        // 更新现有执行计划
        const { data: updatedProgram, error: updateError } = await supabase
          .from('execution_programs')
          .update({
            current_day: currentDay,
            status: today > new Date(endDateStr) ? 'completed' : 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProgram.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ [executionProgramService] Error updating program:', updateError);
          throw updateError;
        }
        debugExecutionLog('✅ [executionProgramService] Program updated:', updatedProgram.id);
        return updatedProgram as ExecutionProgram;
      } else {
        debugExecutionLog('🆕 [executionProgramService] Creating new program for order:', order.id);
        debugExecutionLog('🔍 [executionProgramService] Program data to insert:', {
          user_id: userId,
          order_id: order.id,
          program_type: order.products.duration_days,
          start_date: startDate,
          end_date: endDateStr,
          status: today > new Date(endDateStr) ? 'completed' : 'active',
          current_day: currentDay,
          total_days: order.products.duration_days,
        });
        
        // 创建新执行计划
        const { data: newProgram, error: insertError } = await supabase
          .from('execution_programs')
          .insert({
            user_id: userId,
            order_id: order.id,
            program_type: order.products.duration_days,
            start_date: startDate,
            end_date: endDateStr,
            status: today > new Date(endDateStr) ? 'completed' : 'active',
            current_day: currentDay,
            total_days: order.products.duration_days,
          })
          .select()
          .single();

        if (insertError) {
          // 🔥 如果是表不存在的错误，返回 null
          if (insertError.code === 'PGRST205' || insertError.message?.includes('Could not find the table')) {
            console.error('❌ [executionProgramService] Database table does not exist. Please run migration:', insertError.message);
            return null;
          }
          // 🔥 详细记录所有错误信息，帮助调试
          console.error('❌ [executionProgramService] Error creating program:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            insertData: {
              user_id: userId,
              order_id: order.id,
              program_type: order.products.duration_days,
              start_date: startDate,
              end_date: endDateStr,
            }
          });
          throw insertError;
        }
        debugExecutionLog('✅ [executionProgramService] Program created:', newProgram.id);
        return newProgram as ExecutionProgram;
      }
    } catch (error: any) {
      // 🔥 如果是表不存在的错误，返回 null 而不是抛出错误
      if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
        console.error('❌ [executionProgramService] Database table does not exist. Please run migration:', error.message);
        return null; // 返回 null 而不是抛出错误，让 UI 可以显示提示
      }
      console.error('❌ [executionProgramService] Error syncing program from order:', error);
      throw error;
    }
  },

  /**
   * 获取当前活跃的执行计划
   */
  async getActiveProgram(userId: string): Promise<ExecutionProgram | null> {
    try {
      debugExecutionLog('🔍 [executionProgramService] getActiveProgram called for userId:', userId);
      
      // 先尝试同步（确保数据是最新的）
      await this.syncProgramFromOrder(userId);

      // 然后获取计划（优先获取 active，如果没有则获取最新的，包括 completed）
      let { data, error } = await supabase
        .from('execution_programs')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 如果没有 active 的计划，尝试获取最新的计划（包括 completed）
      if (!data && !error) {
        debugExecutionLog('⚠️ [executionProgramService] No active program found, trying to get latest program (including completed)');
        const latestResult = await supabase
          .from('execution_programs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        data = latestResult.data;
        error = latestResult.error;
      }

      debugExecutionLog('🔍 [executionProgramService] getActiveProgram query result:', {
        hasData: !!data,
        data: data ? { 
          id: data.id, 
          currentDay: data.current_day, 
          totalDays: data.total_days,
          status: data.status 
        } : null,
        error: error?.message,
        errorCode: error?.code,
      });

      if (error && error.code !== 'PGRST116') {
        // 🔥 如果是表不存在的错误，静默返回 null
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          console.error('❌ [executionProgramService] Database table does not exist. Please run migration:', error.message);
          return null;
        }
        console.error('❌ [executionProgramService] Error getting active program:', error);
        throw error;
      }

      return data as ExecutionProgram | null;
    } catch (error: any) {
      // 🔥 如果是表不存在的错误，静默返回 null
      if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
        console.error('❌ [executionProgramService] Database table does not exist. Please run migration:', error.message);
        return null;
      }
      console.error('❌ [executionProgramService] Error getting active program:', error);
      return null;
    }
  },

  /**
   * 更新执行计划的当前天数
   */
  async updateCurrentDay(programId: string, currentDay: number): Promise<ExecutionProgram | null> {
    try {
      const { data, error } = await supabase
        .from('execution_programs')
        .update({
          current_day: currentDay,
          updated_at: new Date().toISOString(),
        })
        .eq('id', programId)
        .select()
        .single();

      if (error) throw error;
      return data as ExecutionProgram;
    } catch (error) {
      console.error('Error updating current day:', error);
      return null;
    }
  },
};

