const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');
const {
  hasActivePaidOrdersForProduct,
  SERVICE_STRUCTURE_IN_USE_ZH,
} = require('../../services/serviceStructureLock');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(auditLog);

// Validation helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
  }
  next();
};

function successResponse(res, payload = {}, message = 'OK', code = 'OK', httpStatus = 200) {
  return res.status(httpStatus).json({
    success: true,
    code,
    message,
    ...payload,
  });
}

function errorResponse(res, httpStatus, code, message, details = null, extra = {}) {
  return res.status(httpStatus).json({
    success: false,
    code,
    message,
    error: message,
    details,
    ...extra,
  });
}

/** 商品 duration_days 须与所挂疗程天数一致，避免履约与展示漂移 */
async function assertProductDurationMatchesPlans(res, { meal_plan_id, supplement_plan_id, duration_days }) {
  const d = Number(duration_days);
  if (!Number.isFinite(d) || d < 1) return true;
  if (meal_plan_id) {
    const { data, error } = await supabaseAdmin
      .from('meal_plans')
      .select('duration_days, plan_code')
      .eq('id', meal_plan_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      errorResponse(res, 400, 'MEAL_PLAN_NOT_FOUND', '餐食疗程不存在');
      return false;
    }
    if (Number(data.duration_days) !== d) {
      errorResponse(
        res,
        400,
        'DURATION_MISMATCH_MEAL',
        `商品服务天数（${d}）与餐食疗程天数（${data.duration_days}）不一致，请对齐后保存`,
        data.plan_code ? `疗程编号: ${data.plan_code}` : null
      );
      return false;
    }
  }
  if (supplement_plan_id) {
    const { data, error } = await supabaseAdmin
      .from('supplement_plans')
      .select('duration_days, plan_code')
      .eq('id', supplement_plan_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      errorResponse(res, 400, 'SUPPLEMENT_PLAN_NOT_FOUND', '补剂疗程不存在');
      return false;
    }
    if (Number(data.duration_days) !== d) {
      errorResponse(
        res,
        400,
        'DURATION_MISMATCH_SUPPLEMENT',
        `商品服务天数（${d}）与补剂疗程天数（${data.duration_days}）不一致，请对齐后保存`,
        data.plan_code ? `疗程编号: ${data.plan_code}` : null
      );
      return false;
    }
  }
  return true;
}

async function writeAdminChangeAudit({
  adminId = null,
  module,
  action,
  entityId = null,
  beforeData = null,
  afterData = null,
  reason = null,
}) {
  try {
    await supabaseAdmin.from('admin_change_audit_logs').insert({
      admin_id: adminId,
      module,
      action,
      entity_id: entityId,
      before_data: beforeData,
      after_data: afterData,
      reason,
    });
  } catch (error) {
    logger.warn('[admin/products] write admin_change_audit_logs failed:', error?.message || error);
  }
}

// Helper function to generate product code (proXXXX)
const generateProductCode = async () => {
  try {
    const { data: existingProducts } = await supabaseAdmin
      .from('products')
      .select('product_code')
      .like('product_code', 'pro%')
      .order('product_code', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (existingProducts && existingProducts.length > 0) {
      const lastCode = existingProducts[0].product_code;
      const lastNumber = parseInt(lastCode.replace('pro', ''));
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `pro${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    logger.error('Generate product code error:', error);
    const timestamp = Date.now().toString().slice(-4);
    return `pro${timestamp}`;
  }
};

/**
 * Get products list
 * GET /api/admin/products?page=1&limit=20&is_active=true
 */
router.get('/', checkPermission('manage_menu'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const search = req.query.search;
    const productCode = req.query.product_code;
    const productName = req.query.product_name;

    let query = supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    if (search) {
      query = query.or(`product_name.ilike.%${search}%,product_code.ilike.%${search}%`);
    }

    // 筛选条件（products 表字段）
    if (productCode) query = query.ilike('product_code', `%${productCode}%`);
    if (productName) query = query.ilike('product_name', `%${productName}%`);

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    let products = data || [];

    if (products.length > 0) {
      const mealIds = [...new Set(products.map(p => p.meal_plan_id).filter(Boolean))];
      const supplementIds = [...new Set(products.map(p => p.supplement_plan_id).filter(Boolean))];
      const productIds = [...new Set(products.map(p => p.id).filter(Boolean))];

      const mealMap = {};
      const suppMap = {};
      const activePaidProductSet = new Set();
      const referencedProductSet = new Set();

      if (mealIds.length > 0) {
        const { data: meals } = await supabaseAdmin
          .from('meal_plans')
          .select('id, plan_name, plan_code, duration_days, included_meal_types')
          .in('id', mealIds);
        (meals || []).forEach(m => { mealMap[m.id] = m; });
      }

      if (supplementIds.length > 0) {
        const { data: supps } = await supabaseAdmin
          .from('supplement_plans')
          .select('id, plan_name, plan_code, duration_days')
          .in('id', supplementIds);
        (supps || []).forEach(s => { suppMap[s.id] = s; });
      }

      if (productIds.length > 0) {
        const { data: activePaidOrders, error: activePaidErr } = await supabaseAdmin
          .from('orders')
          .select('product_id')
          .in('product_id', productIds)
          .eq('payment_status', 'paid')
          .neq('order_status', 'cancelled')
          .neq('order_status', 'completed');
        if (activePaidErr) throw activePaidErr;
        (activePaidOrders || []).forEach((o) => {
          if (o?.product_id) activePaidProductSet.add(String(o.product_id));
        });

        const { data: referencedOrders, error: referencedErr } = await supabaseAdmin
          .from('orders')
          .select('product_id')
          .in('product_id', productIds);
        if (referencedErr) throw referencedErr;
        (referencedOrders || []).forEach((o) => {
          if (o?.product_id) referencedProductSet.add(String(o.product_id));
        });
      }

      products = products.map(p => ({
        ...p,
        meal_plans: p.meal_plan_id ? mealMap[p.meal_plan_id] || null : null,
        supplement_plans: p.supplement_plan_id ? suppMap[p.supplement_plan_id] || null : null,
        has_active_paid_orders: activePaidProductSet.has(String(p.id)),
        has_order_references: referencedProductSet.has(String(p.id)),
      }));
    }

    return successResponse(
      res,
      {
        products,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      },
      'Products loaded',
      'OK'
    );
  } catch (error) {
    logger.error('Get products list error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Check if table doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      return errorResponse(
        res,
        500,
        'SYSTEM_INTERNAL_ERROR',
        'Failed to get products list',
        errorMessage,
        { hint: 'Database table "products" may not exist. Please run migration: 20251201000005_create_products_and_orders_tables.sql' }
      );
    }

    return errorResponse(res, 500, errorCode, 'Failed to get products list', errorMessage);
  }
});

/**
 * Get single product
 * GET /api/admin/products/:id
 */
router.get('/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const productId = req.params.id;

    const { data: baseProduct, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !baseProduct) {
      return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    let meal = null;
    let supp = null;
    if (baseProduct.meal_plan_id) {
      const { data: m } = await supabaseAdmin
        .from('meal_plans')
        .select('id, plan_name, plan_code, duration_days, included_meal_types')
        .eq('id', baseProduct.meal_plan_id)
        .maybeSingle();
      meal = m || null;
    }
    if (baseProduct.supplement_plan_id) {
      const { data: s } = await supabaseAdmin
        .from('supplement_plans')
        .select('id, plan_name, plan_code, duration_days')
        .eq('id', baseProduct.supplement_plan_id)
        .maybeSingle();
      supp = s || null;
    }

    const hasActivePaidOrders = await hasActivePaidOrdersForProduct(productId);
    const { count: referencedOrderCount, error: refCountErr } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);
    if (refCountErr) throw refCountErr;

    return successResponse(
      res,
      {
        product: {
          ...baseProduct,
          meal_plans: meal,
          supplement_plans: supp,
          has_active_paid_orders: hasActivePaidOrders,
          has_order_references: (referencedOrderCount || 0) > 0,
        }
      },
      'Product loaded',
      'OK'
    );
  } catch (error) {
    logger.error('Get product error:', error);
    return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to get product', error.message);
  }
});

/**
 * Get product audit history
 * GET /api/admin/products/:id/history?limit=50
 */
router.get('/:id/history', checkPermission('manage_menu'), async (req, res) => {
  try {
    const productId = req.params.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const { data: product, error: productErr } = await supabaseAdmin
      .from('products')
      .select('id, product_code, product_name')
      .eq('id', productId)
      .maybeSingle();
    if (productErr) throw productErr;
    if (!product?.id) {
      return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    const { data: logs, error: logsErr } = await supabaseAdmin
      .from('admin_change_audit_logs')
      .select('id, admin_id, module, action, entity_id, before_data, after_data, reason, created_at')
      .eq('module', 'products')
      .eq('entity_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (logsErr) throw logsErr;

    const rows = logs || [];
    const adminIds = [...new Set(rows.map((r) => r.admin_id).filter(Boolean))];
    const adminUserById = {};
    if (adminIds.length > 0) {
      const { data: adminUsers, error: adminErr } = await supabaseAdmin
        .from('admin_users')
        .select('id, user_id')
        .in('id', adminIds);
      if (adminErr) throw adminErr;
      (adminUsers || []).forEach((a) => {
        adminUserById[a.id] = a;
      });
    }

    const adminUserIds = [...new Set(Object.values(adminUserById).map((a) => a.user_id).filter(Boolean))];
    const profileByUserId = {};
    if (adminUserIds.length > 0) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, nickname, name')
        .in('user_id', adminUserIds);
      if (profileErr) throw profileErr;
      (profiles || []).forEach((p) => {
        profileByUserId[p.user_id] = p;
      });
    }

    return successResponse(
      res,
      {
        product,
        history: rows.map((r) => {
          const adminUser = r.admin_id ? adminUserById[r.admin_id] : null;
          const profile = adminUser?.user_id ? profileByUserId[adminUser.user_id] : null;
          const adminName =
            (profile && (profile.nickname || profile.name)) ||
            (r.admin_id ? `管理员(${String(r.admin_id).slice(0, 8)})` : '-');
          return {
            ...r,
            admin_name: adminName,
          };
        }),
      },
      'Product history loaded',
      'OK'
    );
  } catch (error) {
    logger.error('Get product history error:', error);
    return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to get product history', error.message);
  }
});

/**
 * Create product
 * POST /api/admin/products
 */
router.post('/',
  checkPermission('manage_menu'),
  [
    body('product_name').notEmpty().withMessage('Product name is required'),
    body('meal_plan_id').optional().isUUID(),
    body('supplement_plan_id').optional().isUUID(),
    body('duration_days').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be >= 0'),
    validate
  ],
  async (req, res) => {
    try {
      const {
        product_code,
        product_name,
        description,
        meal_plan_id,
        supplement_plan_id,
        duration_days,
        price,
        original_price,
        cover_image_url,
        is_active
      } = req.body;

      // At least one component must be provided
      if (!meal_plan_id && !supplement_plan_id) {
        return errorResponse(
          res,
          400,
          'PRODUCT_COMPONENTS_REQUIRED',
          'At least one of meal_plan_id or supplement_plan_id must be provided'
        );
      }

      const durationOk = await assertProductDurationMatchesPlans(res, {
        meal_plan_id,
        supplement_plan_id,
        duration_days,
      });
      if (!durationOk) return;

      // Auto-generate product_code if not provided
      let finalProductCode = product_code;
      if (!finalProductCode) {
        finalProductCode = await generateProductCode();
      }

      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .insert({
          product_code: finalProductCode,
          product_name,
          description: description || null,
          meal_plan_id: meal_plan_id || null,
          supplement_plan_id: supplement_plan_id || null,
          duration_days,
          price,
          original_price: original_price || null,
          cover_image_url: cover_image_url || null,
          is_active: is_active !== undefined ? is_active : true
        })
        .select(`
          *,
          supplement_plans (*)
        `)
        .single();

      if (productError) {
        throw productError;
      }

      await writeAdminChangeAudit({
        adminId: req.admin?.id || null,
        module: 'products',
        action: 'create',
        entityId: product.id,
        beforeData: null,
        afterData: {
          product_name: product.product_name,
          product_code: product.product_code,
          price: product.price,
          is_active: product.is_active,
        },
        reason: 'admin_create_product',
      });

      return successResponse(res, { product }, 'Product created successfully', 'OK', 201);
    } catch (error) {
      logger.error('Create product error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to create product', error.message);
    }
  }
);

/**
 * Update product
 * PUT /api/admin/products/:id
 */
router.put('/:id',
  checkPermission('manage_menu'),
  [
    body('product_name').optional().notEmpty().withMessage('Product name cannot be empty'),
    body('duration_days').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be >= 0'),
    validate
  ],
  async (req, res) => {
    try {
      const productId = req.params.id;
      const {
        product_name,
        description,
        meal_plan_id,
        supplement_plan_id,
        duration_days,
        price,
        original_price,
        cover_image_url,
        is_active
      } = req.body;

      const updateData = {};
      if (product_name !== undefined) updateData.product_name = product_name;
      if (description !== undefined) updateData.description = description;
      if (meal_plan_id !== undefined) updateData.meal_plan_id = meal_plan_id;
      if (supplement_plan_id !== undefined) updateData.supplement_plan_id = supplement_plan_id;
      if (duration_days !== undefined) updateData.duration_days = duration_days;
      if (price !== undefined) updateData.price = price;
      if (original_price !== undefined) updateData.original_price = original_price;
      if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data: beforeProduct } = await supabaseAdmin
        .from('products')
        .select('id, product_name, product_code, price, is_active, meal_plan_id, supplement_plan_id, duration_days')
        .eq('id', productId)
        .maybeSingle();

      if (!beforeProduct?.id) {
        return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
      }

      const effMeal = meal_plan_id !== undefined ? meal_plan_id : beforeProduct.meal_plan_id;
      const effSupp = supplement_plan_id !== undefined ? supplement_plan_id : beforeProduct.supplement_plan_id;
      const effDur = duration_days !== undefined ? duration_days : beforeProduct.duration_days;
      const durationOk = await assertProductDurationMatchesPlans(res, {
        meal_plan_id: effMeal,
        supplement_plan_id: effSupp,
        duration_days: effDur,
      });
      if (!durationOk) return;

      const touchingServiceStructureFields =
        (duration_days !== undefined && Number(duration_days) !== Number(beforeProduct.duration_days || 0)) ||
        (meal_plan_id !== undefined && String(meal_plan_id || '') !== String(beforeProduct.meal_plan_id || '')) ||
        (supplement_plan_id !== undefined && String(supplement_plan_id || '') !== String(beforeProduct.supplement_plan_id || ''));

      if (touchingServiceStructureFields) {
        const inService = await hasActivePaidOrdersForProduct(productId);
        if (inService) {
          return errorResponse(
            res,
            409,
            'PRODUCT_IN_ACTIVE_SERVICE',
            'Product has active paid orders; service-structure fields are immutable',
            SERVICE_STRUCTURE_IN_USE_ZH
          );
        }
      }

      const { data: product, error } = await supabaseAdmin
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select(`
          *,
          supplement_plans (*)
        `)
        .single();

      if (error) {
        const dbMessage = String(error.message || '');
        if (
          error.code === '55000' ||
          dbMessage.includes('product settlement fields are immutable while active paid orders exist') ||
          dbMessage.includes('product service structure fields are immutable while active paid orders exist')
        ) {
          return errorResponse(
            res,
            409,
            'PRODUCT_IN_ACTIVE_SERVICE',
            'Product has active paid orders; service-structure fields are immutable',
            SERVICE_STRUCTURE_IN_USE_ZH
          );
        }
        throw error;
      }

      if (!product) {
        return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
      }

      await writeAdminChangeAudit({
        adminId: req.admin?.id || null,
        module: 'products',
        action: 'update',
        entityId: product.id,
        beforeData: beforeProduct,
        afterData: {
          id: product.id,
          product_name: product.product_name,
          product_code: product.product_code,
          price: product.price,
          is_active: product.is_active,
          meal_plan_id: product.meal_plan_id,
          supplement_plan_id: product.supplement_plan_id,
          duration_days: product.duration_days,
        },
        reason: 'admin_update_product',
      });

      return successResponse(res, { product }, 'Product updated successfully', 'OK');
    } catch (error) {
      logger.error('Update product error:', error);
      return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to update product', error.message);
    }
  }
);

/**
 * Delete product
 * DELETE /api/admin/products/:id
 */
router.delete('/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const productId = req.params.id;

    const { data: beforeProduct } = await supabaseAdmin
      .from('products')
      .select('id, product_name, product_code, price, is_active')
      .eq('id', productId)
      .maybeSingle();

    if (!beforeProduct?.id) {
      return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    const { count: referencedOrderCount, error: refErr } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);
    if (refErr) {
      throw refErr;
    }
    if ((referencedOrderCount || 0) > 0) {
      return errorResponse(
        res,
        409,
        'PRODUCT_REFERENCED_BY_ORDERS',
        'Product is referenced by existing orders and cannot be deleted',
        { referenced_order_count: referencedOrderCount }
      );
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      throw error;
    }

    await writeAdminChangeAudit({
      adminId: req.admin?.id || null,
      module: 'products',
      action: 'delete',
      entityId: beforeProduct.id,
      beforeData: beforeProduct,
      afterData: null,
      reason: 'admin_delete_product',
    });

    return successResponse(res, {}, 'Product deleted successfully', 'OK');
  } catch (error) {
    logger.error('Delete product error:', error);
    return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to delete product', error.message);
  }
});

/**
 * Toggle product status
 * PATCH /api/admin/products/:id/toggle-status
 */
router.patch('/:id/toggle-status', checkPermission('manage_menu'), async (req, res) => {
  try {
    const productId = req.params.id;

    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, product_name, product_code, price, is_active')
      .eq('id', productId)
      .single();

    if (!product) {
      return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    const { data: updatedProduct, error } = await supabaseAdmin
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await writeAdminChangeAudit({
      adminId: req.admin?.id || null,
      module: 'products',
      action: 'toggle_status',
      entityId: updatedProduct.id,
      beforeData: {
        id: product.id,
        is_active: product.is_active,
      },
      afterData: {
        id: updatedProduct.id,
        is_active: updatedProduct.is_active,
      },
      reason: 'admin_toggle_product_status',
    });

    return successResponse(
      res,
      { product: updatedProduct },
      `Product ${updatedProduct.is_active ? 'activated' : 'deactivated'} successfully`,
      'OK'
    );
  } catch (error) {
    logger.error('Toggle product status error:', error);
    return errorResponse(res, 500, 'SYSTEM_INTERNAL_ERROR', 'Failed to toggle product status', error.message);
  }
});

module.exports = router;
