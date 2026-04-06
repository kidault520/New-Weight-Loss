const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const { toBeijingDateString } = require('../../utils/timezone');
const logger = require('../../utils/logger');
const { syncMealScheduleActivation } = require('../../services/mealScheduleActivationService');
const {
  mealPlanInActiveService,
  supplementScheduleInActiveService,
  SERVICE_STRUCTURE_IN_USE_ZH,
  attachStructureInServiceToMealPlans,
  attachStructureInServiceToSupplementScheduleRows,
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
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

const MEAL_SLOT_LABELS = ['早餐', '午餐', '晚餐'];

/** @returns {{ ok: true, value: string[] } | { ok: false, error: string }} */
function normalizeIncludedMealTypes(input) {
  if (input === undefined || input === null) {
    return { ok: true, value: ['午餐', '晚餐'] };
  }
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: '每天包含餐次至少选择一餐' };
  }
  const allowed = new Set(MEAL_SLOT_LABELS);
  const seen = new Set();
  const value = [];
  for (const x of input) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (!allowed.has(t) || seen.has(t)) continue;
    seen.add(t);
    value.push(t);
  }
  if (value.length === 0) {
    return { ok: false, error: '每天包含餐次须为早餐、午餐、晚餐中的一项或多项' };
  }
  return { ok: true, value };
}

const generateMealScheduleCode = async () => {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `MS-${ym}-`;
  const { data } = await supabaseAdmin
    .from('meal_schedules')
    .select('schedule_code')
    .like('schedule_code', `${prefix}%`)
    .order('schedule_code', { ascending: false })
    .limit(1);
  const latest = data?.[0]?.schedule_code || '';
  const m = latest.match(/MS-\d{6}-(\d{3})$/);
  const seq = m ? parseInt(m[1], 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
};

/** 餐食疗程编号 MTP0001 */
const generateMealTreatmentPlanCode = async () => {
  const { data } = await supabaseAdmin
    .from('meal_plans')
    .select('plan_code')
    .like('plan_code', 'MTP%')
    .order('plan_code', { ascending: false })
    .limit(1);
  const latest = data?.[0]?.plan_code || '';
  const m = String(latest).match(/^MTP(\d+)$/i);
  const next = m ? parseInt(m[1], 10) + 1 : 1;
  return `MTP${String(next).padStart(4, '0')}`;
};

/** 补剂疗程（supplement_plans）编号 STP0001 */
const generateSupplementTreatmentPlanCode = async () => {
  const { data } = await supabaseAdmin
    .from('supplement_plans')
    .select('plan_code')
    .like('plan_code', 'STP%')
    .order('plan_code', { ascending: false })
    .limit(1);
  const latest = data?.[0]?.plan_code || '';
  const m = String(latest).match(/^STP(\d+)$/i);
  const next = m ? parseInt(m[1], 10) + 1 : 1;
  return `STP${String(next).padStart(4, '0')}`;
};

// Helper function to generate dish code (cpXXXX)
const generateDishCode = async () => {
  try {
    // Find the highest existing dish code
    const { data: existingDishes } = await supabaseAdmin
      .from('dishes')
      .select('dish_code')
      .like('dish_code', 'cp%')
      .order('dish_code', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (existingDishes && existingDishes.length > 0) {
      const lastCode = existingDishes[0].dish_code;
      const lastNumber = parseInt(lastCode.replace('cp', ''));
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `cp${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    logger.error('Generate dish code error:', error);
    // Fallback: use timestamp-based code
    const timestamp = Date.now().toString().slice(-4);
    return `cp${timestamp}`;
  }
};

// Helper function to generate package code (tcXXXX)
const generatePackageCode = async () => {
  try {
    // Find the highest existing package code
    const { data: existingPackages } = await supabaseAdmin
      .from('meal_packages')
      .select('package_code')
      .like('package_code', 'tc%')
      .order('package_code', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (existingPackages && existingPackages.length > 0) {
      const lastCode = existingPackages[0].package_code;
      const lastNumber = parseInt(lastCode.replace('tc', ''));
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `tc${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    logger.error('Generate package code error:', error);
    // Fallback: use timestamp-based code
    const timestamp = Date.now().toString().slice(-4);
    return `tc${timestamp}`;
  }
};

// Helper function to calculate package nutrition from items
const calculatePackageNutrition = async (packageId) => {
  try {
    const { data: items, error } = await supabaseAdmin
      .from('package_items')
      .select(`
        quantity,
        dishes (
          carbohydrate_g,
          protein_g,
          fat_g,
          fiber_g,
          weight_g,
          calories_kcal
        )
      `)
      .eq('package_id', packageId);

    if (error) {
      throw error;
    }

    let totalCarb = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalWeight = 0;
    let totalCalories = 0;

    (items || []).forEach(item => {
      const dish = item.dishes;
      const quantity = item.quantity || 1;
      
      if (dish) {
        totalCarb += (dish.carbohydrate_g || 0) * quantity;
        totalProtein += (dish.protein_g || 0) * quantity;
        totalFat += (dish.fat_g || 0) * quantity;
        totalFiber += (dish.fiber_g || 0) * quantity;
        totalWeight += (dish.weight_g || 0) * quantity;
        totalCalories += (dish.calories_kcal || 0) * quantity;
      }
    });

    // Update package with calculated totals
    const { error: updateError } = await supabaseAdmin
      .from('meal_packages')
      .update({
        total_carbohydrate_g: totalCarb,
        total_protein_g: totalProtein,
        total_fat_g: totalFat,
        total_fiber_g: totalFiber,
        total_weight_g: totalWeight,
        total_calories_kcal: totalCalories,
        updated_at: new Date().toISOString()
      })
      .eq('id', packageId);

    if (updateError) {
      throw updateError;
    }

    return {
      total_carbohydrate_g: totalCarb,
      total_protein_g: totalProtein,
      total_fat_g: totalFat,
      total_fiber_g: totalFiber,
      total_weight_g: totalWeight,
      total_calories_kcal: totalCalories
    };
  } catch (error) {
    logger.error('Calculate package nutrition error:', error);
    throw error;
  }
};

// ==================== Dishes Management ====================

/**
 * Get dishes list
 * GET /api/admin/menu/dishes?dish_type=主食&cuisine=粤菜&page=1&limit=20
 */
router.get('/dishes', checkPermission('manage_menu'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const dishType = req.query.dish_type;
    const cuisine = req.query.cuisine;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const search = req.query.search;

    let query = supabaseAdmin
      .from('dishes')
      .select('*', { count: 'exact' });

    if (dishType) {
      query = query.eq('dish_type', dishType);
    }

    if (cuisine) {
      query = query.eq('cuisine', cuisine);
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,dish_code.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      dishes: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    logger.error('Get dishes list error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Check if table doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Database table not found. Please run the migration file: 20251201000003_create_menu_management_tables.sql',
        details: error.message,
        code: 'TABLE_NOT_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get dishes list',
      details: errorMessage,
      code: errorCode
    });
  }
});

/**
 * Get single dish
 * GET /api/admin/menu/dishes/:id
 */
router.get('/dishes/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const dishId = req.params.id;

    const { data, error } = await supabaseAdmin
      .from('dishes')
      .select('*')
      .eq('id', dishId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Dish not found' });
      }
      throw error;
    }

    res.json({ dish: data });
  } catch (error) {
    logger.error('Get dish error:', error);
    res.status(500).json({ error: 'Failed to get dish' });
  }
});

/**
 * Create dish
 * POST /api/admin/menu/dishes
 */
router.post('/dishes', 
  checkPermission('manage_menu'),
  [
    body('name').notEmpty().withMessage('Dish name is required'),
    body('dish_type').isIn(['主食', '主荤菜', '副荤菜', '主素菜', '副素菜', '饮品', '汤']).withMessage('Invalid dish type'),
    body('carbohydrate_g').optional().isFloat({ min: 0 }),
    body('protein_g').optional().isFloat({ min: 0 }),
    body('fat_g').optional().isFloat({ min: 0 }),
    body('fiber_g').optional().isFloat({ min: 0 }),
    body('calories_kcal').optional().isFloat({ min: 0 }),
    validate
  ],
  async (req, res) => {
    try {
      let {
        dish_code,
        name,
        image_url,
        dish_type,
        cuisine,
        flavor,
        production_methods,
        weight_g,
        edible_weight_g,
        carbohydrate_g,
        protein_g,
        fat_g,
        fiber_g,
        calories_kcal,
        is_active
      } = req.body;

      // Auto-generate dish_code if not provided
      if (!dish_code) {
        dish_code = await generateDishCode();
      }

      // Check if dish_code already exists
      const { data: existing } = await supabaseAdmin
        .from('dishes')
        .select('id')
        .eq('dish_code', dish_code)
        .single();

      if (existing) {
        // If auto-generated code exists, generate a new one
        dish_code = await generateDishCode();
        // Double check
        const { data: existingAgain } = await supabaseAdmin
          .from('dishes')
          .select('id')
          .eq('dish_code', dish_code)
          .single();
        if (existingAgain) {
          return res.status(400).json({ error: 'Failed to generate unique dish code. Please try again.' });
        }
      }

      const { data, error } = await supabaseAdmin
        .from('dishes')
        .insert({
          dish_code,
          name,
          image_url: image_url || null,
          dish_type,
          cuisine: cuisine || null,
          flavor: flavor || null,
          production_methods: Array.isArray(production_methods) ? production_methods : (production_methods ? [production_methods] : []),
          weight_g: weight_g || null,
          edible_weight_g: edible_weight_g || null,
          carbohydrate_g: carbohydrate_g || 0,
          protein_g: protein_g || 0,
          fat_g: fat_g || 0,
          fiber_g: fiber_g || 0,
          calories_kcal: calories_kcal || 0,
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({
        message: 'Dish created successfully',
        dish: data
      });
    } catch (error) {
      logger.error('Create dish error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Dish code already exists' });
      }
      res.status(500).json({ error: 'Failed to create dish' });
    }
  }
);

/**
 * Update dish
 * PUT /api/admin/menu/dishes/:id
 */
router.put('/dishes/:id', 
  checkPermission('manage_menu'),
  [
    body('dish_type').optional().isIn(['主食', '主荤菜', '副荤菜', '主素菜', '副素菜', '饮品', '汤']).withMessage('Invalid dish type'),
    body('carbohydrate_g').optional().isFloat({ min: 0 }),
    body('protein_g').optional().isFloat({ min: 0 }),
    body('fat_g').optional().isFloat({ min: 0 }),
    body('fiber_g').optional().isFloat({ min: 0 }),
    body('calories_kcal').optional().isFloat({ min: 0 }),
    validate
  ],
  async (req, res) => {
    try {
      const dishId = req.params.id;
      const {
        dish_code,
        name,
        image_url,
        dish_type,
        cuisine,
        flavor,
        production_methods,
        weight_g,
        edible_weight_g,
        carbohydrate_g,
        protein_g,
        fat_g,
        fiber_g,
        calories_kcal,
        is_active
      } = req.body;

      const updateData = {};
      if (dish_code !== undefined) updateData.dish_code = dish_code;
      if (name !== undefined) updateData.name = name;
      if (image_url !== undefined) updateData.image_url = image_url;
      if (dish_type !== undefined) updateData.dish_type = dish_type;
      if (cuisine !== undefined) updateData.cuisine = cuisine;
      if (flavor !== undefined) updateData.flavor = flavor;
      if (production_methods !== undefined) {
        updateData.production_methods = Array.isArray(production_methods) 
          ? production_methods 
          : (production_methods ? [production_methods] : []);
      }
      if (weight_g !== undefined) updateData.weight_g = weight_g;
      if (edible_weight_g !== undefined) updateData.edible_weight_g = edible_weight_g;
      if (carbohydrate_g !== undefined) updateData.carbohydrate_g = carbohydrate_g;
      if (protein_g !== undefined) updateData.protein_g = protein_g;
      if (fat_g !== undefined) updateData.fat_g = fat_g;
      if (fiber_g !== undefined) updateData.fiber_g = fiber_g;
      if (calories_kcal !== undefined) updateData.calories_kcal = calories_kcal;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data, error } = await supabaseAdmin
        .from('dishes')
        .update(updateData)
        .eq('id', dishId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Dish not found' });
        }
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Dish code already exists' });
        }
        throw error;
      }

      // If nutrition values changed, recalculate packages containing this dish
      if (carbohydrate_g !== undefined || protein_g !== undefined || fat_g !== undefined || 
          fiber_g !== undefined || calories_kcal !== undefined || weight_g !== undefined) {
        const { data: packages } = await supabaseAdmin
          .from('package_items')
          .select('package_id')
          .eq('dish_id', dishId);
        
        if (packages && packages.length > 0) {
          for (const item of packages) {
            await calculatePackageNutrition(item.package_id);
          }
        }
      }

      res.json({
        message: 'Dish updated successfully',
        dish: data
      });
    } catch (error) {
      logger.error('Update dish error:', error);
      res.status(500).json({ error: 'Failed to update dish' });
    }
  }
);

/**
 * Delete dish
 * DELETE /api/admin/menu/dishes/:id
 */
router.delete('/dishes/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const dishId = req.params.id;

    // Check if dish is used in any package
    const { data: packages } = await supabaseAdmin
      .from('package_items')
      .select('package_id')
      .eq('dish_id', dishId)
      .limit(1);

    if (packages && packages.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete dish. It is used in one or more packages.' 
      });
    }

    const { error } = await supabaseAdmin
      .from('dishes')
      .delete()
      .eq('id', dishId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Dish deleted successfully' });
  } catch (error) {
    logger.error('Delete dish error:', error);
    res.status(500).json({ error: 'Failed to delete dish' });
  }
});

/**
 * Toggle dish status
 * PATCH /api/admin/menu/dishes/:id/toggle-status
 */
router.patch('/dishes/:id/toggle-status', checkPermission('manage_menu'), async (req, res) => {
  try {
    const dishId = req.params.id;

    // Get current status
    const { data: dish, error: fetchError } = await supabaseAdmin
      .from('dishes')
      .select('is_active')
      .eq('id', dishId)
      .single();

    if (fetchError || !dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    // Toggle status
    const { data, error } = await supabaseAdmin
      .from('dishes')
      .update({ is_active: !dish.is_active })
      .eq('id', dishId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'Dish status updated successfully',
      dish: data
    });
  } catch (error) {
    logger.error('Toggle dish status error:', error);
    res.status(500).json({ error: 'Failed to toggle dish status' });
  }
});

// ==================== Meal Packages Management ====================

/**
 * Get packages list
 * GET /api/admin/menu/packages?package_type=早餐&supply_date=2025-01-15&page=1&limit=20
 */
router.get('/packages', checkPermission('manage_menu'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const packageType = req.query.package_type;
    const supplyDate = req.query.supply_date;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const search = req.query.search;

    let query = supabaseAdmin
      .from('meal_packages')
      .select('*', { count: 'exact' });

    if (packageType) {
      query = query.eq('package_type', packageType);
    }

    if (supplyDate) {
      query = query.eq('supply_date', supplyDate);
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,package_code.ilike.%${search}%`);
    }

    query = query.order('supply_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      packages: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    logger.error('Get packages list error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Check if table doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Database table not found. Please run the migration file: 20251201000003_create_menu_management_tables.sql',
        details: error.message,
        code: 'TABLE_NOT_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get packages list',
      details: errorMessage,
      code: errorCode
    });
  }
});

/**
 * Get single package with items
 * GET /api/admin/menu/packages/:id
 */
router.get('/packages/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const packageId = req.params.id;

    // Get package
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('meal_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (packageError || !packageData) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Get package items with dish details
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('package_items')
      .select(`
        id,
        dish_id,
        quantity,
        sort_order,
        dishes (
          id,
          dish_code,
          name,
          image_url,
          dish_type,
          cuisine,
          flavor,
          carbohydrate_g,
          protein_g,
          fat_g,
          fiber_g,
          weight_g,
          calories_kcal
        )
      `)
      .eq('package_id', packageId)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    res.json({
      package: packageData,
      items: items || []
    });
  } catch (error) {
    logger.error('Get package error:', error);
    res.status(500).json({ error: 'Failed to get package' });
  }
});

/**
 * Create package
 * POST /api/admin/menu/packages
 */
router.post('/packages',
  checkPermission('manage_menu'),
  [
    body('name').notEmpty().withMessage('Package name is required'),
    body('package_type').isIn(['早餐', '午餐', '晚餐']).withMessage('Invalid package type'),
    body('items').optional().isArray().withMessage('Items must be an array'),
    body('items.*.dish_id').optional().notEmpty().withMessage('Dish ID is required for each item'),
    body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validate
  ],
  async (req, res) => {
    try {
      let {
        package_code,
        name,
        package_type,
        cover_image_url,
        supply_date,
        items,
        is_active
      } = req.body;

      // Auto-generate package_code if not provided
      if (!package_code) {
        package_code = await generatePackageCode();
      }

      // Check if package_code already exists
      const { data: existing } = await supabaseAdmin
        .from('meal_packages')
        .select('id')
        .eq('package_code', package_code)
        .single();

      if (existing) {
        // If auto-generated code exists, generate a new one
        package_code = await generatePackageCode();
        // Double check
        const { data: existingAgain } = await supabaseAdmin
          .from('meal_packages')
          .select('id')
          .eq('package_code', package_code)
          .single();
        if (existingAgain) {
          return res.status(400).json({ error: 'Failed to generate unique package code. Please try again.' });
        }
      }

      // Create package
      const { data: packageData, error: packageError } = await supabaseAdmin
        .from('meal_packages')
        .insert({
          package_code,
          name,
          package_type,
          cover_image_url: cover_image_url || null,
          supply_date: supply_date || null,
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single();

      if (packageError) {
        throw packageError;
      }

      // Add items if provided
      if (items && items.length > 0) {
        const packageItems = items.map((item, index) => ({
          package_id: packageData.id,
          dish_id: item.dish_id,
          quantity: item.quantity || 1,
          sort_order: item.sort_order !== undefined ? item.sort_order : index
        }));

        const { error: itemsError } = await supabaseAdmin
          .from('package_items')
          .insert(packageItems);

        if (itemsError) {
          // Rollback package creation
          await supabaseAdmin
            .from('meal_packages')
            .delete()
            .eq('id', packageData.id);
          throw itemsError;
        }

        // Calculate nutrition totals (trigger will also do this, but we do it here for immediate response)
        await calculatePackageNutrition(packageData.id);
      }

      // Fetch package with updated totals
      const { data: updatedPackage } = await supabaseAdmin
        .from('meal_packages')
        .select('*')
        .eq('id', packageData.id)
        .single();

      res.status(201).json({
        message: 'Package created successfully',
        package: updatedPackage
      });
    } catch (error) {
      logger.error('Create package error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Package code already exists' });
      }
      res.status(500).json({ error: 'Failed to create package' });
    }
  }
);

/**
 * Update package
 * PUT /api/admin/menu/packages/:id
 */
router.put('/packages/:id',
  checkPermission('manage_menu'),
  [
    body('package_type').optional().isIn(['早餐', '午餐', '晚餐']).withMessage('Invalid package type'),
    validate
  ],
  async (req, res) => {
    try {
      const packageId = req.params.id;
      const {
        package_code,
        name,
        package_type,
        cover_image_url,
        supply_date,
        is_active
      } = req.body;

      const updateData = {};
      if (package_code !== undefined) updateData.package_code = package_code;
      if (name !== undefined) updateData.name = name;
      if (package_type !== undefined) updateData.package_type = package_type;
      if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url;
      if (supply_date !== undefined) updateData.supply_date = supply_date;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data, error } = await supabaseAdmin
        .from('meal_packages')
        .update(updateData)
        .eq('id', packageId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Package not found' });
        }
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Package code already exists' });
        }
        throw error;
      }

      res.json({
        message: 'Package updated successfully',
        package: data
      });
    } catch (error) {
      logger.error('Update package error:', error);
      res.status(500).json({ error: 'Failed to update package' });
    }
  }
);

/**
 * Delete package
 * DELETE /api/admin/menu/packages/:id
 */
router.delete('/packages/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const packageId = req.params.id;

    // Package items will be cascade deleted
    const { error } = await supabaseAdmin
      .from('meal_packages')
      .delete()
      .eq('id', packageId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    logger.error('Delete package error:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

/**
 * Toggle package status
 * PATCH /api/admin/menu/packages/:id/toggle-status
 */
router.patch('/packages/:id/toggle-status', checkPermission('manage_menu'), async (req, res) => {
  try {
    const packageId = req.params.id;

    const { data: packageData, error: fetchError } = await supabaseAdmin
      .from('meal_packages')
      .select('is_active')
      .eq('id', packageId)
      .single();

    if (fetchError || !packageData) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('meal_packages')
      .update({ is_active: !packageData.is_active })
      .eq('id', packageId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'Package status updated successfully',
      package: data
    });
  } catch (error) {
    logger.error('Toggle package status error:', error);
    res.status(500).json({ error: 'Failed to toggle package status' });
  }
});

// ==================== Package Items Management ====================

/**
 * Add item to package
 * POST /api/admin/menu/packages/:id/items
 */
router.post('/packages/:id/items',
  checkPermission('manage_menu'),
  [
    body('dish_id').notEmpty().withMessage('Dish ID is required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validate
  ],
  async (req, res) => {
    try {
      const packageId = req.params.id;
      const { dish_id, quantity, sort_order } = req.body;

      // Verify package exists
      const { data: packageData } = await supabaseAdmin
        .from('meal_packages')
        .select('id')
        .eq('id', packageId)
        .single();

      if (!packageData) {
        return res.status(404).json({ error: 'Package not found' });
      }

      // Get current max sort_order
      const { data: existingItems } = await supabaseAdmin
        .from('package_items')
        .select('sort_order')
        .eq('package_id', packageId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = sort_order !== undefined 
        ? sort_order 
        : ((existingItems && existingItems[0]?.sort_order !== undefined) 
          ? existingItems[0].sort_order + 1 
          : 0);

      const { data, error } = await supabaseAdmin
        .from('package_items')
        .insert({
          package_id: packageId,
          dish_id,
          quantity: quantity || 1,
          sort_order: nextSortOrder
        })
        .select(`
          *,
          dishes (
            id,
            dish_code,
            name,
            image_url,
            dish_type,
            carbohydrate_g,
            protein_g,
            fat_g,
            fiber_g,
            weight_g,
            calories_kcal
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      // Recalculate package nutrition (trigger will also do this)
      await calculatePackageNutrition(packageId);

      res.status(201).json({
        message: 'Item added to package successfully',
        item: data
      });
    } catch (error) {
      logger.error('Add package item error:', error);
      res.status(500).json({ error: 'Failed to add item to package' });
    }
  }
);

/**
 * Update package item
 * PUT /api/admin/menu/packages/:id/items/:itemId
 */
router.put('/packages/:id/items/:itemId',
  checkPermission('manage_menu'),
  [
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validate
  ],
  async (req, res) => {
    try {
      const packageId = req.params.id;
      const itemId = req.params.itemId;
      const { quantity, sort_order } = req.body;

      const updateData = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (sort_order !== undefined) updateData.sort_order = sort_order;

      const { data, error } = await supabaseAdmin
        .from('package_items')
        .update(updateData)
        .eq('id', itemId)
        .eq('package_id', packageId)
        .select(`
          *,
          dishes (
            id,
            dish_code,
            name,
            image_url,
            dish_type,
            carbohydrate_g,
            protein_g,
            fat_g,
            fiber_g,
            weight_g,
            calories_kcal
          )
        `)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Package item not found' });
        }
        throw error;
      }

      // Recalculate package nutrition
      await calculatePackageNutrition(packageId);

      res.json({
        message: 'Package item updated successfully',
        item: data
      });
    } catch (error) {
      logger.error('Update package item error:', error);
      res.status(500).json({ error: 'Failed to update package item' });
    }
  }
);

/**
 * Delete package item
 * DELETE /api/admin/menu/packages/:id/items/:itemId
 */
router.delete('/packages/:id/items/:itemId', checkPermission('manage_menu'), async (req, res) => {
  try {
    const packageId = req.params.id;
    const itemId = req.params.itemId;

    const { error } = await supabaseAdmin
      .from('package_items')
      .delete()
      .eq('id', itemId)
      .eq('package_id', packageId);

    if (error) {
      throw error;
    }

    // Recalculate package nutrition
    await calculatePackageNutrition(packageId);

    res.json({ message: 'Package item deleted successfully' });
  } catch (error) {
    logger.error('Delete package item error:', error);
    res.status(500).json({ error: 'Failed to delete package item' });
  }
});

// ==================== Image Upload ====================

/**
 * Upload image to Supabase Storage
 * POST /api/admin/menu/upload-image
 */
router.post('/upload-image', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { file, fileName, folder } = req.body;

    if (!file || !fileName) {
      return res.status(400).json({ error: 'File and fileName are required' });
    }

    // Convert base64 to buffer
    const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Determine file type
    const fileMatch = file.match(/^data:image\/(\w+);base64/);
    const fileType = fileMatch ? fileMatch[1] : 'png';
    const mimeType = `image/${fileType}`;

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = folder 
      ? `${folder}/${timestamp}_${fileName}`
      : `menu/${timestamp}_${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('images')
      .upload(uniqueFileName, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('images')
      .getPublicUrl(uniqueFileName);

    res.json({
      message: 'Image uploaded successfully',
      url: urlData.publicUrl,
      path: uniqueFileName
    });
  } catch (error) {
    logger.error('Upload image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ==================== Meal Plans Management ====================

/**
 * 预览下一餐食疗程编号 / 下一补剂计划编号（保存前展示；实际以写入为准）
 * GET /api/admin/menu/preview-treatment-plan-codes
 */
router.get('/preview-treatment-plan-codes', checkPermission('manage_menu'), async (req, res) => {
  try {
    const meal_plan_code = await generateMealTreatmentPlanCode();
    const supplement_plan_code = await generateSupplementTreatmentPlanCode();
    const dish_code = await generateDishCode();
    const package_code = await generatePackageCode();
    const meal_schedule_code = await generateMealScheduleCode();
    res.json({
      meal_plan_code,
      supplement_plan_code,
      dish_code,
      package_code,
      meal_schedule_code,
    });
  } catch (error) {
    logger.error('Preview treatment plan codes error:', error);
    res.status(500).json({ error: error.message || 'Failed to preview codes' });
  }
});

/**
 * 预览下一单颗补剂编号 SPM（与 content 路由逻辑一致；供 content 接口异常或权限组合时兜底）
 * GET /api/admin/menu/preview-supplement-item-code
 */
async function generateSupplementItemCodePreview() {
  const { data } = await supabaseAdmin
    .from('supplement_products')
    .select('item_code')
    .like('item_code', 'SPM%')
    .order('item_code', { ascending: false })
    .limit(1);
  const latest = data?.[0]?.item_code || '';
  const m = String(latest).match(/^SPM(\d+)$/i);
  const next = m ? parseInt(m[1], 10) + 1 : 1;
  return `SPM${String(next).padStart(4, '0')}`;
}

router.get(
  '/preview-supplement-item-code',
  checkPermission(['manage_content', 'manage_menu']),
  async (req, res) => {
    try {
      const item_code = await generateSupplementItemCodePreview();
      res.json({ item_code });
    } catch (error) {
      logger.error('Preview supplement item code (menu) error:', error);
      res.status(500).json({ error: error.message || 'Failed to preview item code' });
    }
  }
);

/**
 * Get meal plans list
 * GET /api/admin/menu/plans?page=1&limit=20&is_active=true
 */
router.get('/plans', checkPermission('manage_menu'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const search = req.query.search;

    let query = supabaseAdmin
      .from('meal_plans')
      .select('*', { count: 'exact' });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    if (search) {
      query = query.or(`plan_name.ilike.%${search}%,description.ilike.%${search}%,plan_code.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const plansWithFlag = await attachStructureInServiceToMealPlans(data || []);

    res.json({
      plans: plansWithFlag,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    logger.error('Get meal plans list error:', error);
    res.status(500).json({ 
      error: 'Failed to get meal plans list',
      details: error.message 
    });
  }
});

/**
 * Get single meal plan
 * GET /api/admin/menu/plans/:id
 */
router.get('/plans/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const planId = req.params.id;

    const { data: planData, error: planError } = await supabaseAdmin
      .from('meal_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    const lock = await mealPlanInActiveService(planId);

    res.json({
      plan: { ...planData, structure_in_service: lock.inUse },
    });
  } catch (error) {
    logger.error('Get meal plan error:', error);
    res.status(500).json({ error: 'Failed to get meal plan' });
  }
});

/**
 * Create meal plan
 * POST /api/admin/menu/plans
 */
router.post('/plans',
  checkPermission('manage_menu'),
  [
    body('plan_name').notEmpty().withMessage('Plan name is required'),
    body('duration_days').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('start_date').isISO8601().withMessage('Start date must be a valid date'),
    validate
  ],
  async (req, res) => {
    try {
      const {
        plan_name,
        duration_days,
        start_date,
        description,
        is_active,
        included_meal_types: includedMealTypesBody
      } = req.body;

      const includedNorm = normalizeIncludedMealTypes(includedMealTypesBody);
      if (!includedNorm.ok) {
        return res.status(400).json({ error: includedNorm.error });
      }

      // Parse dates - handle both ISO format and YYYY-MM-DD format
      let startDateObj;
      if (typeof start_date === 'string') {
        // If already in YYYY-MM-DD format, use it directly
        if (/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
          startDateObj = new Date(`${start_date}T00:00:00+08:00`);
        } else {
          startDateObj = new Date(start_date);
        }
      } else {
        startDateObj = new Date(start_date);
      }

      // Validate date
      if (isNaN(startDateObj.getTime())) {
        throw new Error('Invalid start date format');
      }

      // Calculate end_date (date only, no time component)
      const startDateStr = toBeijingDateString(startDateObj);
      let endDateObj = new Date(startDateObj);
      endDateObj.setDate(endDateObj.getDate() + duration_days - 1);
      let endDateStr = toBeijingDateString(endDateObj);

      // Verify duration calculation matches database constraint
      // Database constraint: end_date - start_date + 1 = duration_days
      const daysDiff = Math.floor((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (daysDiff !== duration_days) {
        logger.warn(`Duration mismatch: expected ${duration_days}, calculated ${daysDiff}. Adjusting end_date.`);
        // Recalculate end_date to match duration exactly
        endDateObj = new Date(startDateObj);
        endDateObj.setDate(endDateObj.getDate() + duration_days - 1);
        endDateStr = toBeijingDateString(endDateObj);
      }

      // Log for debugging
      logger.info(`Creating meal plan: ${plan_name}, start: ${startDateStr}, end: ${endDateStr}, duration: ${duration_days}`);

      const planCode = await generateMealTreatmentPlanCode();
      // Create plan
      const { data: planData, error: planError } = await supabaseAdmin
        .from('meal_plans')
        .insert({
          plan_name,
          plan_code: planCode,
          duration_days,
          start_date: startDateStr,
          end_date: endDateStr,
          description: description || null,
          is_active: is_active !== undefined ? is_active : true,
          included_meal_types: includedNorm.value
        })
        .select()
        .single();

      if (planError) {
        logger.error('Meal plan insert error:', planError);
        throw new Error(planError.message || 'Failed to create meal plan');
      }

      res.status(201).json({
        plan: planData,
        message: 'Meal plan created successfully'
      });
    } catch (error) {
      logger.error('Create meal plan error:', error);
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN_ERROR';
      const errorDetails = error.details || error.hint || '';
      
      // Check for constraint violation
      if (error.code === '23514') { // Check constraint violation
        return res.status(400).json({
          error: 'Failed to create meal plan: Date or duration constraint violation',
          details: errorMessage,
          hint: 'Please ensure end_date - start_date + 1 equals duration_days'
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to create meal plan',
        details: errorMessage,
        code: errorCode,
        hint: errorDetails
      });
    }
  }
);

/**
 * Update meal plan
 * PUT /api/admin/menu/plans/:id
 */
router.put('/plans/:id',
  checkPermission('manage_menu'),
  [
    body('plan_name').optional().notEmpty().withMessage('Plan name cannot be empty'),
    body('duration_days').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('start_date').optional().isISO8601().withMessage('Start date must be a valid date'),
    validate
  ],
  async (req, res) => {
    try {
      const planId = req.params.id;
      const {
        plan_name,
        duration_days,
        start_date,
        description,
        is_active,
        included_meal_types: includedMealTypesBody
      } = req.body;

      const { data: currentFull, error: curErr } = await supabaseAdmin
        .from('meal_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();
      if (curErr) throw curErr;
      if (!currentFull) {
        return res.status(404).json({ error: 'Meal plan not found' });
      }

      const lock = await mealPlanInActiveService(planId);
      const structureErr = () =>
        res.status(400).json({
          error: SERVICE_STRUCTURE_IN_USE_ZH,
          code: 'MEAL_PLAN_STRUCTURE_LOCKED',
        });

      if (lock.inUse) {
        if (duration_days !== undefined && Number(duration_days) !== Number(currentFull.duration_days)) {
          return structureErr();
        }
        if (start_date !== undefined) {
          const curS = toBeijingDateString(new Date(currentFull.start_date));
          const reqS = toBeijingDateString(new Date(start_date));
          if (curS !== reqS) return structureErr();
        }
        if (includedMealTypesBody !== undefined) {
          const includedNorm = normalizeIncludedMealTypes(includedMealTypesBody);
          if (!includedNorm.ok) {
            return res.status(400).json({ error: includedNorm.error });
          }
          const curTypes = Array.isArray(currentFull.included_meal_types) && currentFull.included_meal_types.length
            ? [...currentFull.included_meal_types].sort().join('|')
            : ['午餐', '晚餐'].sort().join('|');
          const nextTypes = [...includedNorm.value].sort().join('|');
          if (curTypes !== nextTypes) return structureErr();
        }

        const updateDataLocked = {};
        if (plan_name !== undefined) updateDataLocked.plan_name = plan_name;
        if (description !== undefined) updateDataLocked.description = description;
        if (is_active !== undefined) updateDataLocked.is_active = is_active;

        if (Object.keys(updateDataLocked).length === 0) {
          return res.json({
            plan: { ...currentFull, structure_in_service: true },
            message: 'Meal plan updated successfully',
          });
        }

        const { data: planData, error: planError } = await supabaseAdmin
          .from('meal_plans')
          .update(updateDataLocked)
          .eq('id', planId)
          .select()
          .single();
        if (planError) throw planError;
        return res.json({
          plan: { ...planData, structure_in_service: true },
          message: 'Meal plan updated successfully',
        });
      }

      const updateData = {};
      if (plan_name !== undefined) updateData.plan_name = plan_name;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;

      if (includedMealTypesBody !== undefined) {
        const includedNorm = normalizeIncludedMealTypes(includedMealTypesBody);
        if (!includedNorm.ok) {
          return res.status(400).json({ error: includedNorm.error });
        }
        updateData.included_meal_types = includedNorm.value;
      }

      if (duration_days !== undefined || start_date !== undefined) {
        const newStartDate = start_date ? new Date(start_date) : new Date(currentFull.start_date);
        const newDuration = duration_days !== undefined ? duration_days : currentFull.duration_days;
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + newDuration - 1);

        updateData.start_date = toBeijingDateString(newStartDate);
        updateData.end_date = toBeijingDateString(newEndDate);
        updateData.duration_days = newDuration;
      }

      const { data: planData, error: planError } = await supabaseAdmin
        .from('meal_plans')
        .update(updateData)
        .eq('id', planId)
        .select()
        .single();

      if (planError) {
        throw planError;
      }

      if (!planData) {
        return res.status(404).json({ error: 'Meal plan not found' });
      }

      const lockAfter = await mealPlanInActiveService(planId);
      res.json({
        plan: { ...planData, structure_in_service: lockAfter.inUse },
        message: 'Meal plan updated successfully'
      });
    } catch (error) {
      logger.error('Update meal plan error:', error);
      res.status(500).json({ 
        error: 'Failed to update meal plan',
        details: error.message 
      });
    }
  }
);

/**
 * Delete meal plan
 * DELETE /api/admin/menu/plans/:id
 */
router.delete('/plans/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const planId = req.params.id;
    const lock = await mealPlanInActiveService(planId);
    if (lock.inUse) {
      return res.status(400).json({
        error: lock.message || SERVICE_STRUCTURE_IN_USE_ZH,
        code: 'MEAL_PLAN_IN_ACTIVE_SERVICE',
      });
    }

    const { error } = await supabaseAdmin
      .from('meal_plans')
      .delete()
      .eq('id', planId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Meal plan deleted successfully' });
  } catch (error) {
    logger.error('Delete meal plan error:', error);
    res.status(500).json({ 
      error: 'Failed to delete meal plan',
      details: error.message 
    });
  }
});

/**
 * Toggle meal plan status
 * PATCH /api/admin/menu/plans/:id/toggle-status
 */
router.patch('/plans/:id/toggle-status', checkPermission('manage_menu'), async (req, res) => {
  try {
    const planId = req.params.id;

    // Get current status
    const { data: plan, error: getError } = await supabaseAdmin
      .from('meal_plans')
      .select('is_active')
      .eq('id', planId)
      .single();

    if (getError || !plan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    // Toggle status
    const { data: updatedPlan, error: updateError } = await supabaseAdmin
      .from('meal_plans')
      .update({ is_active: !plan.is_active })
      .eq('id', planId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.json({
      plan: updatedPlan,
      message: `Meal plan ${updatedPlan.is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    logger.error('Toggle meal plan status error:', error);
    res.status(500).json({ 
      error: 'Failed to toggle meal plan status',
      details: error.message 
    });
  }
});

// ==================== Supplement Plans Management ====================

/**
 * Get supplement plans list
 * GET /api/admin/menu/supplement-plans?page=1&limit=20&is_active=true
 */
router.get('/supplement-plans', checkPermission('manage_menu'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const search = req.query.search;

    let query = supabaseAdmin
      .from('supplement_plans')
      .select('*', { count: 'exact' });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    if (search) {
      query = query.or(`plan_name.ilike.%${search}%,description.ilike.%${search}%,plan_code.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      plans: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    logger.error('Get supplement plans list error:', error);
    res.status(500).json({ 
      error: 'Failed to get supplement plans list',
      details: error.message 
    });
  }
});

/**
 * Get single supplement plan
 * GET /api/admin/menu/supplement-plans/:id
 */
router.get('/supplement-plans/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const planId = req.params.id;

    const { data: plan, error } = await supabaseAdmin
      .from('supplement_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error || !plan) {
      return res.status(404).json({ error: 'Supplement plan not found' });
    }

    res.json({ plan });
  } catch (error) {
    logger.error('Get supplement plan error:', error);
    res.status(500).json({ error: 'Failed to get supplement plan' });
  }
});

/**
 * Create supplement plan
 * POST /api/admin/menu/supplement-plans
 */
router.post('/supplement-plans', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { plan_name, duration_days, description } = req.body;
    if (!plan_name || !duration_days) {
      return res.status(400).json({ error: 'plan_name and duration_days are required' });
    }
    const planCode = await generateSupplementTreatmentPlanCode();
    const totalD = parseInt(duration_days, 10) || 30;
    const { data: plan, error } = await supabaseAdmin
      .from('supplement_plans')
      .insert({
        plan_name,
        plan_code: planCode,
        duration_days: totalD,
        description: description || null,
      })
      .select()
      .single();
    if (error) throw error;
    // 避免仅有 plan、无排期导致 C 端 active-supplement-stage 报「未找到补剂排班」
    const { error: schErr } = await supabaseAdmin
      .from('supplement_schedules')
      .insert({
        schedule_name: plan_name,
        total_days: totalD,
        course_id: plan.id,
      });
    if (schErr) {
      logger.error('Create companion supplement_schedule for plan error:', schErr);
      await supabaseAdmin.from('supplement_plans').delete().eq('id', plan.id);
      return res.status(400).json({
        error: schErr.message?.includes('duplicate') || String(schErr).includes('duplicate')
          ? '该补剂疗程已存在排期记录，请勿重复创建'
          : '创建补剂排期失败，请稍后重试',
        details: schErr.message,
      });
    }
    res.status(201).json({ plan });
  } catch (error) {
    logger.error('Create supplement plan error:', error);
    res.status(500).json({ error: 'Failed to create supplement plan' });
  }
});

module.exports = router;
// ==================== Meal & Supplement Schedules ====================
/**
 * Create meal schedule
 * POST /api/admin/menu/meal-schedules
 */
router.post('/meal-schedules', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { schedule_name, entries, start_time, end_time } = req.body;
    if (!schedule_name) return res.status(400).json({ error: 'schedule_name is required' });
    const insertPayload = { schedule_name, schedule_code: await generateMealScheduleCode() };
    if (start_time) insertPayload.start_time = start_time;
    if (end_time) insertPayload.end_time = end_time;
    let schedule = null;
    let sErr = null;
    ({ data: schedule, error: sErr } = await supabaseAdmin
      .from('meal_schedules')
      .insert(insertPayload)
      .select()
      .single());
    if (sErr && String(sErr.message || '').includes('schedule_code')) {
      const fallbackPayload = { schedule_name };
      if (start_time) fallbackPayload.start_time = start_time;
      if (end_time) fallbackPayload.end_time = end_time;
      ({ data: schedule, error: sErr } = await supabaseAdmin
        .from('meal_schedules')
        .insert(fallbackPayload)
        .select()
        .single());
    }
    if (sErr) throw sErr;
    if (Array.isArray(entries) && entries.length) {
      const toInsert = entries.map(e => ({
        schedule_id: schedule.id,
        date: e.date,
        package_id: e.package_id,
        package_type: e.package_type
      }));
      const { error: eErr } = await supabaseAdmin.from('meal_schedule_entries').insert(toInsert);
      if (eErr) throw eErr;
    }
    res.status(201).json({ schedule });
  } catch (error) {
    logger.error('Create meal schedule error:', error);
    res.status(500).json({ error: 'Failed to create meal schedule' });
  }
});

router.get('/meal-schedules/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    let schedule = null;
    let sErr = null;
    ({ data: schedule, error: sErr } = await supabaseAdmin
      .from('meal_schedules')
      .select('id, schedule_code, schedule_name, start_time, end_time, created_at, created_by, is_enabled, enabled_at, enabled_by')
      .eq('id', id)
      .single());
    if (sErr && String(sErr.message || '').includes('is_enabled')) {
      ({ data: schedule, error: sErr } = await supabaseAdmin
        .from('meal_schedules')
        .select('id, schedule_code, schedule_name, start_time, end_time, created_at, created_by')
        .eq('id', id)
        .single());
      if (schedule) {
        schedule.is_enabled = false;
        schedule.enabled_at = null;
        schedule.enabled_by = null;
      }
    }
    if (sErr || !schedule) return res.status(404).json({ error: 'Not found' });
    const { data: entries, error: eErr } = await supabaseAdmin
      .from('meal_schedule_entries')
      .select('id, date, package_id, package_type')
      .eq('schedule_id', id)
      .order('date', { ascending: true });
    if (eErr) throw eErr;
    res.json({ schedule, entries });
  } catch (error) {
    logger.error('Get meal schedule detail error:', error);
    res.status(500).json({ error: 'Failed to get meal schedule' });
  }
});

router.post('/meal-schedules/:id/entries', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    const { date, package_id, package_type } = req.body;
    if (!date || !package_id || !package_type) return res.status(400).json({ error: 'date, package_id, package_type required' });
    const { error } = await supabaseAdmin
      .from('meal_schedule_entries')
      .insert({ schedule_id: id, date, package_id, package_type });
    if (error) throw error;
    res.status(201).json({ ok: true });
  } catch (error) {
    logger.error('Add meal schedule entry error:', error);
    res.status(500).json({ error: 'Failed to add entry' });
  }
});

/** 批量替换排期明细：删除旧条目，插入新条目 */
router.put('/meal-schedules/:id/entries', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });
    const { error: delErr } = await supabaseAdmin
      .from('meal_schedule_entries')
      .delete()
      .eq('schedule_id', id);
    if (delErr) throw delErr;
    if (entries.length > 0) {
      const toInsert = entries
        .filter(e => e.date && e.package_id && e.package_type)
        .map(e => ({ schedule_id: id, date: e.date, package_id: e.package_id, package_type: e.package_type }));
      if (toInsert.length > 0) {
        const { error: insErr } = await supabaseAdmin
          .from('meal_schedule_entries')
          .insert(toInsert);
        if (insErr) throw insErr;
      }
    }
    res.json({ ok: true });
  } catch (error) {
    logger.error('Replace meal schedule entries error:', error);
    res.status(500).json({ error: 'Failed to replace entries' });
  }
});

router.delete('/meal-schedules/:id/entries/:entryId', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { id, entryId } = req.params;
    const { error } = await supabaseAdmin
      .from('meal_schedule_entries')
      .delete()
      .eq('id', entryId)
      .eq('schedule_id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    logger.error('Delete meal schedule entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

router.get('/meal-schedules', checkPermission('manage_menu'), async (req, res) => {
  try {
    // 每次列表查询前先同步一次，确保“使用中/待使用/已过期”与后端启用状态一致。
    await syncMealScheduleActivation({ trigger: 'admin_list_api' });

    let data = null;
    let error = null;
    ({ data, error } = await supabaseAdmin
      .from('meal_schedules')
      .select('id, schedule_code, schedule_name, start_time, end_time, created_at, created_by, is_enabled, enabled_at, enabled_by')
      .order('start_time', { ascending: true }));
    if (error && String(error.message || '').includes('is_enabled')) {
      ({ data, error } = await supabaseAdmin
        .from('meal_schedules')
        .select('id, schedule_code, schedule_name, start_time, end_time, created_at, created_by')
        .order('start_time', { ascending: true }));
      data = (data || []).map((s) => ({
        ...s,
        is_enabled: false,
        enabled_at: null,
        enabled_by: null
      }));
    }
    if (error) throw error;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schedules = (data || []).map(s => {
      let inUse = false;
      if (s.start_time && s.end_time) {
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        inUse = today >= start && today <= end;
      }
      return { ...s, in_use_this_week: inUse };
    });
    const formatted = schedules.map((s, idx) => {
      if (s.schedule_code) return s;
      const dt = new Date(s.created_at || Date.now());
      const ym = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}`;
      return { ...s, schedule_code: `MS-${ym}-${String(idx + 1).padStart(3, '0')}` };
    });
    res.json({ schedules: formatted });
  } catch (error) {
    logger.error('List meal schedules error:', error);
    res.status(500).json({ error: 'Failed to list meal schedules' });
  }
});

router.post('/meal-schedules/sync-activation', checkPermission('manage_menu'), async (req, res) => {
  try {
    const result = await syncMealScheduleActivation({
      trigger: 'manual_api',
      actorId: req.admin?.user_id || null,
    });
    res.json({
      message: result.changed ? '排期启用状态已同步' : '排期启用状态已是最新',
      ...result,
    });
  } catch (error) {
    logger.error('Sync meal schedule activation error:', error);
    res.status(500).json({ error: 'Failed to sync meal schedule activation' });
  }
});

router.patch('/meal-schedules/:id/activate', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    const now = new Date().toISOString();

    const { data: exists, error: exErr } = await supabaseAdmin
      .from('meal_schedules')
      .select('id')
      .eq('id', id)
      .single();
    if (exErr || !exists) return res.status(404).json({ error: 'Not found' });

    const { error: resetErr } = await supabaseAdmin
      .from('meal_schedules')
      .update({ is_enabled: false })
      .eq('is_enabled', true);
    if (resetErr) {
      if (String(resetErr.message || '').includes('is_enabled')) {
        return res.status(400).json({
          error: '排班启用功能未初始化，请先执行数据库迁移 20260327000000_add_meal_schedule_activation_fields.sql'
        });
      }
      throw resetErr;
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from('meal_schedules')
      .update({
        is_enabled: true,
        enabled_at: now,
        enabled_by: req.admin?.user_id || null
      })
      .eq('id', id)
      .select('id, schedule_name, is_enabled, enabled_at, enabled_by')
      .single();
    if (upErr) throw upErr;

    res.json({ schedule: updated, message: '排班已开启使用' });
  } catch (error) {
    logger.error('Activate meal schedule error:', error);
    res.status(500).json({ error: 'Failed to activate meal schedule' });
  }
});

router.patch('/meal-schedules/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    const { schedule_name, start_time, end_time } = req.body;
    const updates = {};
    if (schedule_name !== undefined) updates.schedule_name = schedule_name;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updates provided' });
    const { data, error } = await supabaseAdmin
      .from('meal_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    logger.error('Update meal schedule error:', error);
    res.status(500).json({ error: 'Failed to update meal schedule' });
  }
});

router.delete('/meal-schedules/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    const { data: schedule, error: fetchErr } = await supabaseAdmin
      .from('meal_schedules')
      .select('start_time, end_time')
      .eq('id', id)
      .single();
    if (fetchErr || !schedule) return res.status(404).json({ error: 'Not found' });
    if (schedule.start_time && schedule.end_time) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(schedule.start_time);
      const end = new Date(schedule.end_time);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (today >= start && today <= end) {
        return res.status(400).json({ error: '本周使用中的排期无法删除' });
      }
    }
    // 先删除关联的 meal_schedule_entries（若 CASCADE 未生效则需显式删除）
    const { error: entriesErr } = await supabaseAdmin.from('meal_schedule_entries').delete().eq('schedule_id', id);
    if (entriesErr) {
      logger.warn('Delete meal_schedule_entries (may be empty):', entriesErr);
    }
    const { error: delErr } = await supabaseAdmin.from('meal_schedules').delete().eq('id', id);
    if (delErr) throw delErr;
    res.json({ ok: true });
  } catch (error) {
    logger.error('Delete meal schedule error:', error);
    res.status(500).json({ error: error?.message || '删除失败' });
  }
});

/**
 * Create supplement schedule
 * POST /api/admin/menu/supplement-schedules
 * 支持 course_id 关联补剂疗程，或自动创建 plan 并关联
 */

function normalizeStageSupplementItems(stage) {
  const rawItems = Array.isArray(stage?.supplement_items)
    ? stage.supplement_items
    : Array.isArray(stage?.supplements)
      ? stage.supplements
      : [];

  const items = rawItems
    .map((item) => ({
      supplement_id: item?.supplement_id || item?.id || null,
      per_day_qty: Math.max(1, parseInt(item?.per_day_qty ?? 1, 10) || 1),
    }))
    .filter((item) => item.supplement_id);

  if (items.length > 0) return items;
  if (stage?.supplement_id) {
    return [{
      supplement_id: stage.supplement_id,
      per_day_qty: Math.max(1, parseInt(stage?.per_day_qty ?? 1, 10) || 1),
    }];
  }
  return [];
}

/** 同一阶段内每种补剂仅允许一条 */
function validateStagesNoDuplicateSupplements(stages) {
  if (!Array.isArray(stages)) return null;
  for (let i = 0; i < stages.length; i++) {
    const items = normalizeStageSupplementItems(stages[i]);
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item.supplement_id)) {
        return `第${i + 1}阶段内不能重复添加同一种补剂，请合并为一条并调整每日颗数`;
      }
      seen.add(item.supplement_id);
    }
  }
  return null;
}

/**
 * 商品侧 supplement_plans 与排期 supplement_schedules 通过 course_id 对齐：
 * 排期为编排真相，同步 plan_name / duration_days，避免商品下拉与 C 端解析不一致。
 */
async function syncSupplementPlanFromSchedule(courseId, { schedule_name, total_days }) {
  if (!courseId) return;
  const payload = {};
  if (schedule_name != null && String(schedule_name).trim() !== '') {
    payload.plan_name = String(schedule_name).trim();
  }
  const d = parseInt(total_days, 10);
  if (!Number.isNaN(d) && d > 0) {
    payload.duration_days = d;
  }
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabaseAdmin
    .from('supplement_plans')
    .update(payload)
    .eq('id', courseId);
  if (error) throw error;
}

async function insertStageItems(stageRows, stagesInput) {
  const itemRows = [];
  stageRows.forEach((row, idx) => {
    const items = normalizeStageSupplementItems(stagesInput[idx]);
    items.forEach((item, itemIdx) => {
      itemRows.push({
        stage_id: row.id,
        supplement_id: item.supplement_id,
        per_day_qty: item.per_day_qty,
        sort_order: itemIdx,
      });
    });
  });

  if (!itemRows.length) return;

  const { error } = await supabaseAdmin
    .from('supplement_schedule_stage_items')
    .insert(itemRows);

  // 兼容尚未执行迁移时的环境
  if (error && !String(error.message || '').includes('supplement_schedule_stage_items')) {
    throw error;
  }
}

async function attachStageItems(stages) {
  if (!Array.isArray(stages) || stages.length === 0) return [];
  const stageIds = stages.map((s) => s.id).filter(Boolean);
  if (stageIds.length === 0) return stages;

  const { data: items, error } = await supabaseAdmin
    .from('supplement_schedule_stage_items')
    .select('id, stage_id, supplement_id, per_day_qty, sort_order, supplements:supplement_products(id, name)')
    .in('stage_id', stageIds)
    .order('sort_order', { ascending: true });

  if (error) {
    if (!String(error.message || '').includes('supplement_schedule_stage_items')) throw error;
    return stages.map((st) => ({
      ...st,
      supplement_items: st.supplement_id ? [{
        supplement_id: st.supplement_id,
        per_day_qty: st.per_day_qty ?? 1,
        supplements: st.supplement_products || null,
      }] : [],
    }));
  }

  const byStage = new Map();
  (items || []).forEach((item) => {
    if (!byStage.has(item.stage_id)) byStage.set(item.stage_id, []);
    byStage.get(item.stage_id).push(item);
  });

  return stages.map((st) => {
    const mappedItems = byStage.get(st.id) || [];
    if (mappedItems.length > 0) {
      return { ...st, supplement_items: mappedItems };
    }
    return {
      ...st,
      supplement_items: st.supplement_id ? [{
        supplement_id: st.supplement_id,
        per_day_qty: st.per_day_qty ?? 1,
        supplements: st.supplement_products || null,
      }] : [],
    };
  });
}

router.post('/supplement-schedules', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { schedule_name, total_days, stages, course_id, create_plan } = req.body;
    if (!schedule_name || !total_days) return res.status(400).json({ error: 'schedule_name and total_days are required' });
    let finalCourseId = course_id;
    if (create_plan && !course_id) {
      const planCode = await generateSupplementTreatmentPlanCode();
      const { data: plan, error: pErr } = await supabaseAdmin
        .from('supplement_plans')
        .insert({
          plan_name: schedule_name,
          plan_code: planCode,
          duration_days: parseInt(total_days) || 30,
        })
        .select()
        .single();
      if (pErr) throw pErr;
      finalCourseId = plan.id;
    }
    const insertPayload = { schedule_name, total_days };
    if (finalCourseId) insertPayload.course_id = finalCourseId;
    const { data: schedule, error: sErr } = await supabaseAdmin
      .from('supplement_schedules')
      .insert(insertPayload)
      .select()
      .single();
    if (sErr) {
      const dup =
        sErr.code === '23505' ||
        String(sErr.message || '').includes('supplement_schedules_course_id_key') ||
        String(sErr.message || '').toLowerCase().includes('duplicate key');
      if (dup) {
        if (create_plan && !course_id && finalCourseId) {
          await supabaseAdmin.from('supplement_plans').delete().eq('id', finalCourseId);
        }
        return res.status(409).json({
          error: '该补剂疗程已存在排期，请在列表中编辑现有排期，不要重复创建。',
          code: 'SUPPLEMENT_SCHEDULE_DUPLICATE_COURSE',
        });
      }
      throw sErr;
    }
    if (Array.isArray(stages) && stages.length) {
      const dupMsg = validateStagesNoDuplicateSupplements(stages);
      if (dupMsg) return res.status(400).json({ error: dupMsg });
      const sumDays = stages.reduce((acc, st) => acc + (st.duration_days || 0), 0);
      if (sumDays !== total_days) {
        return res.status(400).json({ error: `Stage days total (${sumDays}) must equal total_days (${total_days})` });
      }
      const toInsert = stages.map((st, idx) => {
        const normalizedItems = normalizeStageSupplementItems(st);
        return {
        schedule_id: schedule.id,
        stage_name: st.stage_name,
        duration_days: st.duration_days,
        sort_order: idx,
        supplement_id: normalizedItems[0]?.supplement_id || st.supplement_id || null,
        per_day_qty: normalizedItems[0]?.per_day_qty || st.per_day_qty || null,
      };
      });
      const { data: insertedStages, error: eErr } = await supabaseAdmin
        .from('supplement_schedule_stages')
        .insert(toInsert)
        .select('id, sort_order');
      if (eErr) throw eErr;
      await insertStageItems(insertedStages || [], stages);
    }
    const totalDaysNum = parseInt(total_days, 10) || 30;
    if (finalCourseId) {
      await syncSupplementPlanFromSchedule(finalCourseId, {
        schedule_name,
        total_days: totalDaysNum,
      });
    }
    res.status(201).json({ schedule });
  } catch (error) {
    logger.error('Create supplement schedule error:', error);
    res.status(500).json({ error: 'Failed to create supplement schedule' });
  }
});

router.get('/supplement-schedules', checkPermission('manage_menu'), async (req, res) => {
  try {
    const courseId = req.query.course_id ? String(req.query.course_id) : null;
    let query = supabaseAdmin
      .from('supplement_schedules')
      .select(`
        id, schedule_name, total_days, start_time, end_time, created_at, created_by, course_id,
        supplement_plans ( id, plan_name, duration_days, plan_code )
      `)
      .order('created_at', { ascending: false });
    if (courseId) {
      query = query.eq('course_id', courseId);
    }
    const { data, error } = await query;
    if (error) throw error;
    const formatted = (data || []).map(s => ({
      id: s.id,
      schedule_name: s.schedule_name,
      total_days: s.total_days,
      start_time: s.start_time,
      end_time: s.end_time,
      created_at: s.created_at,
      created_by: s.created_by,
      course_id: s.course_id,
      course_name: s.supplement_plans?.plan_name,
      course_duration: s.supplement_plans?.duration_days,
      /** 与商品 supplement_plan_id 对齐的编号，如 STP0001 */
      course_plan_code: s.supplement_plans?.plan_code || null,
    }));
    const withFlags = await attachStructureInServiceToSupplementScheduleRows(formatted);
    res.json({ schedules: withFlags });
  } catch (error) {
    logger.error('List supplement schedules error:', error);
    res.status(500).json({ error: 'Failed to list supplement schedules' });
  }
});

router.get('/supplement-schedules/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    /**
     * 疗程主表与阶段并行拉取，减少串行 RTT。
     * structure_in_service 不在此计算（原逻辑需查 products+orders，订单多时极慢）；
     * 管理端列表已带该标记，详情/编辑弹窗由前端用卡片上的 structure_in_service 合并；写操作仍服务端校验。
     */
    const schedulePromise = supabaseAdmin
      .from('supplement_schedules')
      .select(`
        id, schedule_name, total_days, start_time, end_time, created_at, created_by, course_id,
        supplement_plans ( id, plan_name, duration_days, plan_code )
      `)
      .eq('id', id)
      .single();
    const stagesFlatPromise = supabaseAdmin
      .from('supplement_schedule_stages')
      .select('id, stage_name, duration_days, per_day_qty, supplement_id, supplement_products(id, name)')
      .eq('schedule_id', id)
      .order('sort_order', { ascending: true });

    const [{ data: schedule, error: sErr }, { data: stagesFlat, error: stErr }] = await Promise.all([
      schedulePromise,
      stagesFlatPromise,
    ]);
    if (sErr || !schedule) return res.status(404).json({ error: 'Not found' });
    const coursePlanCode = schedule.supplement_plans?.plan_code || null;
    const scheduleFlat = {
      id: schedule.id,
      schedule_name: schedule.schedule_name,
      total_days: schedule.total_days,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      created_at: schedule.created_at,
      created_by: schedule.created_by,
      course_id: schedule.course_id,
      course_plan_code: coursePlanCode,
    };
    if (stErr) throw stErr;
    const stages = await attachStageItems(stagesFlat || []);
    res.json({
      schedule: scheduleFlat,
      stages,
    });
  } catch (error) {
    logger.error('Get supplement schedule error:', error);
    res.status(500).json({ error: 'Failed to get supplement schedule' });
  }
});

router.post('/supplement-schedules/:id/stages', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    const { inUse, message } = await checkSupplementScheduleInUse(id);
    if (inUse) {
      return res.status(400).json({
        error: message || '该补剂疗程使用中，无法修改',
        code: 'SUPPLEMENT_SCHEDULE_IN_USE',
      });
    }
    const { stage_name, duration_days, supplement_id, per_day_qty, supplement_items } = req.body;
    if (!stage_name || !duration_days) return res.status(400).json({ error: 'stage_name and duration_days required' });
    const dupOne = validateStagesNoDuplicateSupplements([{ supplement_items, supplement_id, per_day_qty }]);
    if (dupOne) return res.status(400).json({ error: dupOne });
    const normalizedItems = normalizeStageSupplementItems({ supplement_id, per_day_qty, supplement_items });
    const { data: insertedStage, error } = await supabaseAdmin
      .from('supplement_schedule_stages')
      .insert({
        schedule_id: id,
        stage_name,
        duration_days,
        supplement_id: normalizedItems[0]?.supplement_id || supplement_id || null,
        per_day_qty: normalizedItems[0]?.per_day_qty || per_day_qty || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    await insertStageItems(insertedStage ? [insertedStage] : [], [{ supplement_items, supplement_id, per_day_qty }]);
    res.status(201).json({ ok: true });
  } catch (error) {
    logger.error('Add supplement stage error:', error);
    res.status(500).json({ error: 'Failed to add stage' });
  }
});

router.delete('/supplement-schedules/:id/stages/:stageId', checkPermission('manage_menu'), async (req, res) => {
  try {
    const { id, stageId } = req.params;
    const { inUse, message } = await checkSupplementScheduleInUse(id);
    if (inUse) {
      return res.status(400).json({
        error: message || '该补剂疗程使用中，无法修改',
        code: 'SUPPLEMENT_SCHEDULE_IN_USE',
      });
    }
    const { error } = await supabaseAdmin
      .from('supplement_schedule_stages')
      .delete()
      .eq('id', stageId)
      .eq('schedule_id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    logger.error('Delete supplement stage error:', error);
    res.status(500).json({ error: 'Failed to delete stage' });
  }
});

/**
 * Update supplement schedule
 * PUT /api/admin/menu/supplement-schedules/:id
 */
router.put('/supplement-schedules/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    const { schedule_name, total_days, stages } = req.body;
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('supplement_schedules')
      .select('id, total_days, course_id, schedule_name')
      .eq('id', id)
      .single();
    if (exErr || !existing) return res.status(404).json({ error: 'Not found' });

    const { inUse } = await checkSupplementScheduleInUse(id);
    const structureErr = () =>
      res.status(400).json({
        error: SERVICE_STRUCTURE_IN_USE_ZH,
        code: 'SUPPLEMENT_SCHEDULE_STRUCTURE_LOCKED',
      });

    if (inUse) {
      if (total_days !== undefined && Number(total_days) !== Number(existing.total_days)) {
        return structureErr();
      }
      if (Array.isArray(stages) && stages.length > 0) {
        return structureErr();
      }
      if (schedule_name !== undefined) {
        const { error: uErr } = await supabaseAdmin
          .from('supplement_schedules')
          .update({ schedule_name })
          .eq('id', id);
        if (uErr) throw uErr;
      }
      const { data: updated } = await supabaseAdmin
        .from('supplement_schedules')
        .select('*')
        .eq('id', id)
        .single();
      if (updated?.course_id) {
        await syncSupplementPlanFromSchedule(updated.course_id, {
          schedule_name: updated.schedule_name,
          total_days: updated.total_days,
        });
      }
      return res.json({ schedule: { ...updated, structure_in_service: true } });
    }

    const updates = {};
    if (schedule_name !== undefined) updates.schedule_name = schedule_name;
    if (total_days !== undefined) updates.total_days = parseInt(total_days) || existing.total_days;
    if (Object.keys(updates).length > 0) {
      const { error: uErr } = await supabaseAdmin
        .from('supplement_schedules')
        .update(updates)
        .eq('id', id);
      if (uErr) throw uErr;
    }

    if (Array.isArray(stages) && stages.length > 0) {
      const dupMsg = validateStagesNoDuplicateSupplements(stages);
      if (dupMsg) return res.status(400).json({ error: dupMsg });
      const sumDays = stages.reduce((acc, st) => acc + (st.duration_days || 0), 0);
      const total = updates.total_days ?? existing.total_days;
      if (sumDays !== total) {
        return res.status(400).json({ error: `阶段天数之和(${sumDays})需等于总天数(${total})` });
      }
      await supabaseAdmin.from('supplement_schedule_stages').delete().eq('schedule_id', id);
      const toInsert = stages.map((st, idx) => {
        const normalizedItems = normalizeStageSupplementItems(st);
        return {
        schedule_id: id,
        stage_name: st.stage_name,
        duration_days: st.duration_days,
        sort_order: idx,
        supplement_id: normalizedItems[0]?.supplement_id || st.supplement_id || null,
        per_day_qty: normalizedItems[0]?.per_day_qty || st.per_day_qty || null,
      };
      });
      const { data: insertedStages, error: iErr } = await supabaseAdmin
        .from('supplement_schedule_stages')
        .insert(toInsert)
        .select('id, sort_order');
      if (iErr) throw iErr;
      await insertStageItems(insertedStages || [], stages);
    }

    const { data: updated } = await supabaseAdmin
      .from('supplement_schedules')
      .select('*')
      .eq('id', id)
      .single();
    if (updated?.course_id) {
      await syncSupplementPlanFromSchedule(updated.course_id, {
        schedule_name: updated.schedule_name,
        total_days: updated.total_days,
      });
    }
    const lockAfter = await checkSupplementScheduleInUse(id);
    res.json({ schedule: { ...updated, structure_in_service: lockAfter.inUse } });
  } catch (error) {
    logger.error('Update supplement schedule error:', error);
    res.status(500).json({ error: error.message || 'Update failed' });
  }
});

async function checkSupplementScheduleInUse(scheduleId) {
  return supplementScheduleInActiveService(scheduleId);
}

/**
 * Delete supplement schedule
 * DELETE /api/admin/menu/supplement-schedules/:id
 * 同时将关联的 supplement_plan 设为 is_active=false，避免商品表单下拉仍显示已删除的疗程
 */
router.delete('/supplement-schedules/:id', checkPermission('manage_menu'), async (req, res) => {
  try {
    const id = req.params.id;
    const { inUse, message } = await checkSupplementScheduleInUse(id);
    if (inUse) return res.status(400).json({ error: message || '该疗程有订单在使用中，无法删除' });
    const { data: schedule } = await supabaseAdmin
      .from('supplement_schedules')
      .select('course_id')
      .eq('id', id)
      .single();
    const { error } = await supabaseAdmin
      .from('supplement_schedules')
      .delete()
      .eq('id', id);
    if (error) throw error;
    if (schedule?.course_id) {
      await supabaseAdmin
        .from('supplement_plans')
        .update({ is_active: false })
        .eq('id', schedule.course_id);
    }
    res.json({ ok: true });
  } catch (error) {
    logger.error('Delete supplement schedule error:', error);
    res.status(500).json({ error: error.message || 'Delete failed' });
  }
});
