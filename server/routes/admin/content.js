const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const { authenticateAdmin, checkPermission, auditLog } = require('../../middleware/adminAuth');
const logger = require('../../utils/logger');
const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(auditLog);

// ==================== Content Templates ====================

/**
 * Get content templates list
 * GET /api/admin/content/templates?type=ai_prompts&page=1&limit=20
 */
router.get('/templates', checkPermission('manage_content'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const type = req.query.type;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    let query = supabaseAdmin
      .from('content_templates')
      .select('*', { count: 'exact' });

    if (type) {
      query = query.eq('content_type', type);
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      templates: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    logger.error('Get content templates error:', error);
    res.status(500).json({ error: 'Failed to get content templates' });
  }
});

/**
 * Create content template
 * POST /api/admin/content/templates
 */
router.post('/templates', checkPermission('manage_content'), async (req, res) => {
  try {
    const { content_type, title, content, metadata, is_active } = req.body;

    if (!content_type || !title) {
      return res.status(400).json({ error: 'content_type and title are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('content_templates')
      .insert({
        content_type,
        title,
        content: content || {},
        metadata: metadata || {},
        is_active: is_active !== undefined ? is_active : true,
        created_by: req.admin.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Content template created successfully',
      template: data
    });
  } catch (error) {
    logger.error('Create content template error:', error);
    res.status(500).json({ error: 'Failed to create content template' });
  }
});

/**
 * Update content template
 * PUT /api/admin/content/templates/:id
 */
router.put('/templates/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const templateId = req.params.id;
    const { title, content, metadata, is_active } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from('content_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Template not found' });
      }
      throw error;
    }

    res.json({
      message: 'Content template updated successfully',
      template: data
    });
  } catch (error) {
    logger.error('Update content template error:', error);
    res.status(500).json({ error: 'Failed to update content template' });
  }
});

/**
 * Delete content template
 * DELETE /api/admin/content/templates/:id
 */
router.delete('/templates/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const templateId = req.params.id;

    const { error } = await supabaseAdmin
      .from('content_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Content template deleted successfully' });
  } catch (error) {
    logger.error('Delete content template error:', error);
    res.status(500).json({ error: 'Failed to delete content template' });
  }
});

// ==================== Supplement Products ====================

async function generateSupplementItemCode() {
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

/**
 * 预览下一单颗补剂编号（保存前展示）
 * GET /api/admin/content/supplements/preview-item-code
 */
router.get('/supplements/preview-item-code', checkPermission(['manage_content', 'manage_menu']), async (req, res) => {
  try {
    const item_code = await generateSupplementItemCode();
    res.json({ item_code });
  } catch (error) {
    logger.error('Preview supplement item code error:', error);
    res.status(500).json({ error: error.message || 'Failed to preview item code' });
  }
});

/**
 * Get supplement products list
 * GET /api/admin/content/supplements?page=1&limit=20
 */
router.get('/supplements', checkPermission('manage_content'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    let query = supabaseAdmin
      .from('supplement_products')
      .select('*', { count: 'exact' });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    query = query.order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Parse metadata from description field
    const supplementsWithMetadata = (data || []).map(supplement => {
      let metadata = {};
      try {
        if (supplement.description && supplement.description.startsWith('{')) {
          metadata = JSON.parse(supplement.description);
        }
      } catch (e) {
        // If parsing fails, metadata remains empty
      }

      return {
        ...supplement,
        metadata,
        subtitle: metadata.subtitle,
        benefits: metadata.benefits || [],
        scenarios: metadata.scenarios || [],
        references: metadata.references || []
      };
    });

    res.json({
      supplements: supplementsWithMetadata,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    logger.error('Get supplement products error:', error);
    res.status(500).json({ error: 'Failed to get supplement products' });
  }
});

/**
 * Create supplement product
 * POST /api/admin/content/supplements
 */
router.post('/supplements', checkPermission('manage_content'), async (req, res) => {
  try {
    const { 
      name, 
      description, 
      dosage, 
      frequency, 
      supplement_type, 
      icon_path, 
      tags, 
      is_active, 
      display_order,
      subtitle,
      benefits,
      scenarios,
      references,
      metadata
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Prepare metadata object
    const supplementMetadata = metadata || {
      subtitle,
      benefits: benefits || [],
      scenarios: scenarios || [],
      references: references || []
    };

    // Store metadata in description as JSON string for backward compatibility
    // Also store in a metadata field if the table supports it
    const finalDescription = description || JSON.stringify(supplementMetadata);

    const item_code = await generateSupplementItemCode();
    const { data, error } = await supabaseAdmin
      .from('supplement_products')
      .insert({
        name,
        item_code,
        description: finalDescription,
        dosage,
        frequency,
        supplement_type: supplement_type || 'general',
        icon_path: icon_path || '/buji.png',
        tags: tags || [],
        is_active: is_active !== undefined ? is_active : true,
        display_order: display_order || 0,
        created_by: req.admin.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Parse and attach metadata to response
    let parsedData = { ...data };
    try {
      const parsedMetadata = typeof data.description === 'string' && data.description.startsWith('{') 
        ? JSON.parse(data.description) 
        : supplementMetadata;
      parsedData = {
        ...data,
        metadata: parsedMetadata,
        subtitle: parsedMetadata.subtitle,
        benefits: parsedMetadata.benefits,
        scenarios: parsedMetadata.scenarios,
        references: parsedMetadata.references
      };
    } catch (e) {
      // If parsing fails, use original data
    }

    res.status(201).json({
      message: 'Supplement product created successfully',
      supplement: parsedData
    });
  } catch (error) {
    logger.error('Create supplement product error:', error);
    res.status(500).json({ error: 'Failed to create supplement product' });
  }
});

/**
 * Update supplement product
 * PUT /api/admin/content/supplements/:id
 */
router.put('/supplements/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const supplementId = req.params.id;
    const { 
      subtitle,
      benefits,
      scenarios,
      references,
      metadata,
      description,
      ...updateData 
    } = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;
    delete updateData.item_code;

    // Prepare metadata object
    const supplementMetadata = metadata || {
      subtitle,
      benefits: benefits || [],
      scenarios: scenarios || [],
      references: references || []
    };

    // Update description with metadata if provided
    if (subtitle || benefits || scenarios || references || metadata) {
      updateData.description = description || JSON.stringify(supplementMetadata);
    }

    const { data, error } = await supabaseAdmin
      .from('supplement_products')
      .update(updateData)
      .eq('id', supplementId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Supplement product not found' });
      }
      throw error;
    }

    // Parse and attach metadata to response
    let parsedData = { ...data };
    try {
      const parsedMetadata = typeof data.description === 'string' && data.description.startsWith('{') 
        ? JSON.parse(data.description) 
        : supplementMetadata;
      parsedData = {
        ...data,
        metadata: parsedMetadata,
        subtitle: parsedMetadata.subtitle,
        benefits: parsedMetadata.benefits,
        scenarios: parsedMetadata.scenarios,
        references: parsedMetadata.references
      };
    } catch (e) {
      // If parsing fails, use original data
    }

    res.json({
      message: 'Supplement product updated successfully',
      supplement: parsedData
    });
  } catch (error) {
    logger.error('Update supplement product error:', error);
    res.status(500).json({ error: 'Failed to update supplement product' });
  }
});

/**
 * Delete supplement product
 * DELETE /api/admin/content/supplements/:id
 */
router.delete('/supplements/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const supplementId = req.params.id;

    const { error } = await supabaseAdmin
      .from('supplement_products')
      .delete()
      .eq('id', supplementId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Supplement product deleted successfully' });
  } catch (error) {
    logger.error('Delete supplement product error:', error);
    res.status(500).json({ error: 'Failed to delete supplement product' });
  }
});

// ==================== Nutrition Solution Content ====================

/**
 * Get nutrition solution content
 * GET /api/admin/content/nutrition-solutions?section_type=supplement
 */
router.get('/nutrition-solutions', checkPermission('manage_content'), async (req, res) => {
  try {
    const sectionType = req.query.section_type;

    let query = supabaseAdmin
      .from('nutrition_solution_content')
      .select('*')
      .order('display_order', { ascending: true });

    if (sectionType) {
      query = query.eq('section_type', sectionType);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ content: data || [] });
  } catch (error) {
    logger.error('Get nutrition solution content error:', error);
    res.status(500).json({ error: 'Failed to get nutrition solution content' });
  }
});

/**
 * Update nutrition solution content (bulk update)
 * PUT /api/admin/content/nutrition-solutions
 */
router.put('/nutrition-solutions', checkPermission('manage_content'), async (req, res) => {
  try {
    const { content } = req.body; // Array of content items

    if (!Array.isArray(content)) {
      return res.status(400).json({ error: 'content must be an array' });
    }

    // Delete all existing content
    await supabaseAdmin
      .from('nutrition_solution_content')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    // Insert new content
    const contentWithAdmin = content.map(item => ({
      ...item,
      created_by: req.admin.id
    }));

    const { data, error } = await supabaseAdmin
      .from('nutrition_solution_content')
      .insert(contentWithAdmin)
      .select();

    if (error) {
      throw error;
    }

    res.json({
      message: 'Nutrition solution content updated successfully',
      content: data
    });
  } catch (error) {
    logger.error('Update nutrition solution content error:', error);
    res.status(500).json({ error: 'Failed to update nutrition solution content' });
  }
});

/**
 * Create or update single nutrition solution content item
 * POST /api/admin/content/nutrition-solutions
 */
router.post('/nutrition-solutions', checkPermission('manage_content'), async (req, res) => {
  try {
    const { section_type, content_data, display_order, is_active } = req.body;

    if (!section_type || !content_data) {
      return res.status(400).json({ error: 'section_type and content_data are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('nutrition_solution_content')
      .insert({
        section_type,
        content_data,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        created_by: req.admin.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Nutrition solution content created successfully',
      content: data
    });
  } catch (error) {
    logger.error('Create nutrition solution content error:', error);
    res.status(500).json({ error: 'Failed to create nutrition solution content' });
  }
});

/**
 * Update single nutrition solution content item
 * PUT /api/admin/content/nutrition-solutions/:id
 */
router.put('/nutrition-solutions/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const contentId = req.params.id;
    const updateData = req.body;

    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    const { data, error } = await supabaseAdmin
      .from('nutrition_solution_content')
      .update(updateData)
      .eq('id', contentId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Content not found' });
      }
      throw error;
    }

    res.json({
      message: 'Nutrition solution content updated successfully',
      content: data
    });
  } catch (error) {
    logger.error('Update nutrition solution content error:', error);
    res.status(500).json({ error: 'Failed to update nutrition solution content' });
  }
});

/**
 * Delete nutrition solution content item
 * DELETE /api/admin/content/nutrition-solutions/:id
 */
router.delete('/nutrition-solutions/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const contentId = req.params.id;

    const { error } = await supabaseAdmin
      .from('nutrition_solution_content')
      .delete()
      .eq('id', contentId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Nutrition solution content deleted successfully' });
  } catch (error) {
    logger.error('Delete nutrition solution content error:', error);
    res.status(500).json({ error: 'Failed to delete nutrition solution content' });
  }
});

// ==================== Supplement Packages Management ====================

/**
 * Generate supplement package code
 * Format: spXXXX (supplement package)
 */
async function generatePackageCode() {
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    const num = Math.floor(Math.random() * 10000);
    const code = `sp${String(num).padStart(4, '0')}`;
    
    const { data } = await supabaseAdmin
      .from('supplement_packages')
      .select('id')
      .eq('package_code', code)
      .single();
    
    if (!data) {
      return code;
    }
  }
  throw new Error('Failed to generate unique package code');
}

/**
 * Get supplement packages list
 * GET /api/admin/content/supplement-packages?page=1&limit=20
 */
router.get('/supplement-packages', checkPermission('manage_content'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const search = req.query.search;

    let query = supabaseAdmin
      .from('supplement_packages')
      .select('*', { count: 'exact' });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,package_code.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false })
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
    logger.error('Get supplement packages error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Check if table doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Failed to get supplement packages',
        details: errorMessage,
        code: errorCode,
        hint: 'Database table "supplement_packages" may not exist. Please run migration: 20251201000006_create_supplement_packages_tables.sql'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get supplement packages',
      details: errorMessage,
      code: errorCode
    });
  }
});

/**
 * Get single supplement package with items
 * GET /api/admin/content/supplement-packages/:id
 */
router.get('/supplement-packages/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const packageId = req.params.id;

    // Get package
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('supplement_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (packageError) {
      if (packageError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Supplement package not found' });
      }
      throw packageError;
    }

    // Get package items with supplement details
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('supplement_package_items')
      .select(`
        *,
        supplement:supplement_products(*)
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
    logger.error('Get supplement package error:', error);
    res.status(500).json({ error: 'Failed to get supplement package' });
  }
});

/**
 * Create supplement package
 * POST /api/admin/content/supplement-packages
 */
router.post('/supplement-packages', checkPermission('manage_content'), async (req, res) => {
  try {
    let {
      package_code,
      name,
      description,
      cover_image_url,
      is_active,
      items
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Package name is required' });
    }

    // Auto-generate package_code if not provided
    if (!package_code) {
      package_code = await generatePackageCode();
    }

    // Create package
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('supplement_packages')
      .insert({
        package_code,
        name,
        description,
        cover_image_url,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (packageError) {
      throw packageError;
    }

    // Create package items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const packageItems = items.map((item, index) => ({
        package_id: packageData.id,
        supplement_id: item.supplement_id,
        quantity: item.quantity || 1,
        sort_order: item.sort_order !== undefined ? item.sort_order : index
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('supplement_package_items')
        .insert(packageItems);

      if (itemsError) {
        // Rollback: delete package if items insert fails
        await supabaseAdmin.from('supplement_packages').delete().eq('id', packageData.id);
        throw itemsError;
      }
    }

    // Get created package with items
    const { data: itemsData } = await supabaseAdmin
      .from('supplement_package_items')
      .select(`
        *,
        supplement:supplement_products(*)
      `)
      .eq('package_id', packageData.id)
      .order('sort_order', { ascending: true });

    res.status(201).json({
      message: 'Supplement package created successfully',
      package: packageData,
      items: itemsData || []
    });
  } catch (error) {
    logger.error('Create supplement package error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Package code already exists' });
    }
    res.status(500).json({ error: 'Failed to create supplement package' });
  }
});

/**
 * Update supplement package
 * PUT /api/admin/content/supplement-packages/:id
 */
router.put('/supplement-packages/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const packageId = req.params.id;
    const {
      name,
      description,
      cover_image_url,
      is_active,
      items
    } = req.body;

    // Update package
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('supplement_packages')
      .update(updateData)
      .eq('id', packageId)
      .select()
      .single();

    if (packageError) {
      if (packageError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Supplement package not found' });
      }
      throw packageError;
    }

    // Update items if provided
    if (items !== undefined) {
      // Delete existing items
      await supabaseAdmin
        .from('supplement_package_items')
        .delete()
        .eq('package_id', packageId);

      // Insert new items
      if (Array.isArray(items) && items.length > 0) {
        const packageItems = items.map((item, index) => ({
          package_id: packageId,
          supplement_id: item.supplement_id,
          quantity: item.quantity || 1,
          sort_order: item.sort_order !== undefined ? item.sort_order : index
        }));

        const { error: itemsError } = await supabaseAdmin
          .from('supplement_package_items')
          .insert(packageItems);

        if (itemsError) {
          throw itemsError;
        }
      }
    }

    // Get updated package with items
    const { data: itemsData } = await supabaseAdmin
      .from('supplement_package_items')
      .select(`
        *,
        supplement:supplement_products(*)
      `)
      .eq('package_id', packageId)
      .order('sort_order', { ascending: true });

    res.json({
      message: 'Supplement package updated successfully',
      package: packageData,
      items: itemsData || []
    });
  } catch (error) {
    logger.error('Update supplement package error:', error);
    res.status(500).json({ error: 'Failed to update supplement package' });
  }
});

/**
 * Delete supplement package
 * DELETE /api/admin/content/supplement-packages/:id
 */
router.delete('/supplement-packages/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const packageId = req.params.id;

    const { error } = await supabaseAdmin
      .from('supplement_packages')
      .delete()
      .eq('id', packageId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Supplement package deleted successfully' });
  } catch (error) {
    logger.error('Delete supplement package error:', error);
    res.status(500).json({ error: 'Failed to delete supplement package' });
  }
});

/**
 * Toggle supplement package status
 * PATCH /api/admin/content/supplement-packages/:id/toggle-status
 */
router.patch('/supplement-packages/:id/toggle-status', checkPermission('manage_content'), async (req, res) => {
  try {
    const packageId = req.params.id;

    const { data: packageData, error: fetchError } = await supabaseAdmin
      .from('supplement_packages')
      .select('is_active')
      .eq('id', packageId)
      .single();

    if (fetchError || !packageData) {
      return res.status(404).json({ error: 'Supplement package not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('supplement_packages')
      .update({ is_active: !packageData.is_active })
      .eq('id', packageId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'Supplement package status updated successfully',
      package: data
    });
  } catch (error) {
    logger.error('Toggle supplement package status error:', error);
    res.status(500).json({ error: 'Failed to toggle supplement package status' });
  }
});

// ==================== Food Library ====================

/**
 * Get food library list
 * GET /api/admin/content/food-library
 */
router.get('/food-library', checkPermission('manage_content'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('food_library')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ foods: data || [] });
  } catch (error) {
    logger.error('Get food library error:', error);
    res.status(500).json({ error: 'Failed to get food library' });
  }
});

/**
 * Create food item
 * POST /api/admin/content/food-library
 */
router.post('/food-library', checkPermission('manage_content'), async (req, res) => {
  try {
    const { name, icon, image_url, category, calories, unit, protein, carbs, fat, fiber, is_active, display_order } = req.body;

    if (!name || !icon) {
      return res.status(400).json({ error: 'name and icon are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('food_library')
      .insert({
        name,
        icon,
        image_url: image_url || null,
        category: category || '常用',
        calories: calories || 0,
        unit: unit || '份',
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        fiber: fiber || 0,
        is_active: is_active !== undefined ? is_active : true,
        display_order: display_order || 0
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Food item created successfully',
      food: data
    });
  } catch (error) {
    logger.error('Create food item error:', error);
    res.status(500).json({ error: 'Failed to create food item' });
  }
});

/**
 * Update food item
 * PUT /api/admin/content/food-library/:id
 */
router.put('/food-library/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const foodId = req.params.id;
    const updateData = req.body;

    delete updateData.id;
    delete updateData.created_at;

    const { data, error } = await supabaseAdmin
      .from('food_library')
      .update(updateData)
      .eq('id', foodId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Food item not found' });
      }
      throw error;
    }

    res.json({
      message: 'Food item updated successfully',
      food: data
    });
  } catch (error) {
    logger.error('Update food item error:', error);
    res.status(500).json({ error: 'Failed to update food item' });
  }
});

/**
 * Delete food item
 * DELETE /api/admin/content/food-library/:id
 */
router.delete('/food-library/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const foodId = req.params.id;

    // Get food name first
    const { data: foodData, error: fetchError } = await supabaseAdmin
      .from('food_library')
      .select('name')
      .eq('id', foodId)
      .single();

    if (fetchError || !foodData) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    // Check if food is used in health_records (nutrition_data contains food name)
    const { data: healthRecords, error: healthError } = await supabaseAdmin
      .from('health_records')
      .select('id')
      .eq('record_type', 'food')
      .not('nutrition_data', 'is', null)
      .limit(1);

    if (healthError) {
      throw healthError;
    }

    // Check if any health record uses this food
    if (healthRecords && healthRecords.length > 0) {
      // Get all food records to check names
      const { data: allFoodRecords } = await supabaseAdmin
        .from('health_records')
        .select('nutrition_data')
        .eq('record_type', 'food')
        .not('nutrition_data', 'is', null);

      if (allFoodRecords) {
        const isUsed = allFoodRecords.some(record => {
          const nutritionData = record.nutrition_data;
          if (typeof nutritionData === 'object' && nutritionData !== null) {
            return nutritionData.name === foodData.name || nutritionData.originalId === foodId;
          }
          return false;
        });

        if (isUsed) {
          return res.status(400).json({ 
            error: '无法删除：该食物正在被用户使用中',
            details: '有用户记录中使用了此食物，请先清理相关记录后再删除'
          });
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('food_library')
      .delete()
      .eq('id', foodId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Food item deleted successfully' });
  } catch (error) {
    logger.error('Delete food item error:', error);
    res.status(500).json({ error: 'Failed to delete food item' });
  }
});

// ==================== Exercise Library ====================

/**
 * Get exercise library list
 * GET /api/admin/content/exercise-library
 */
router.get('/exercise-library', checkPermission('manage_content'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('exercise_library')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ exercises: data || [] });
  } catch (error) {
    logger.error('Get exercise library error:', error);
    res.status(500).json({ error: 'Failed to get exercise library' });
  }
});

/**
 * Create exercise item
 * POST /api/admin/content/exercise-library
 */
router.post('/exercise-library', checkPermission('manage_content'), async (req, res) => {
  try {
    const { name, icon, category, calories, duration, is_active, display_order } = req.body;

    if (!name || !icon) {
      return res.status(400).json({ error: 'name and icon are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('exercise_library')
      .insert({
        name,
        icon,
        category: category || '常用',
        calories: calories || 0,
        duration: duration || 30,
        is_active: is_active !== undefined ? is_active : true,
        display_order: display_order || 0
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Exercise item created successfully',
      exercise: data
    });
  } catch (error) {
    logger.error('Create exercise item error:', error);
    res.status(500).json({ error: 'Failed to create exercise item' });
  }
});

/**
 * Update exercise item
 * PUT /api/admin/content/exercise-library/:id
 */
router.put('/exercise-library/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const exerciseId = req.params.id;
    const updateData = req.body;

    delete updateData.id;
    delete updateData.created_at;

    const { data, error } = await supabaseAdmin
      .from('exercise_library')
      .update(updateData)
      .eq('id', exerciseId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Exercise item not found' });
      }
      throw error;
    }

    res.json({
      message: 'Exercise item updated successfully',
      exercise: data
    });
  } catch (error) {
    logger.error('Update exercise item error:', error);
    res.status(500).json({ error: 'Failed to update exercise item' });
  }
});

/**
 * Delete exercise item
 * DELETE /api/admin/content/exercise-library/:id
 */
router.delete('/exercise-library/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const exerciseId = req.params.id;

    // Get exercise name first
    const { data: exerciseData, error: fetchError } = await supabaseAdmin
      .from('exercise_library')
      .select('name')
      .eq('id', exerciseId)
      .single();

    if (fetchError || !exerciseData) {
      return res.status(404).json({ error: 'Exercise item not found' });
    }

    // Check if exercise is used in health_records (exercise_data contains exercise name)
    const { data: healthRecords, error: healthError } = await supabaseAdmin
      .from('health_records')
      .select('id, exercise_data')
      .eq('record_type', 'exercise')
      .not('exercise_data', 'is', null)
      .limit(10);

    if (healthError) {
      throw healthError;
    }

    if (healthRecords && healthRecords.length > 0) {
      const isUsed = healthRecords.some(record => {
        const exerciseDataRecord = record.exercise_data;
        if (typeof exerciseDataRecord === 'object' && exerciseDataRecord !== null) {
          return exerciseDataRecord.name === exerciseData.name || exerciseDataRecord.originalId === exerciseId;
        }
        return false;
      });

      if (isUsed) {
        return res.status(400).json({ 
          error: '无法删除：该运动正在被用户使用中',
          details: '有用户记录中使用了此运动，请先清理相关记录后再删除'
        });
      }
    }

    const { error } = await supabaseAdmin
      .from('exercise_library')
      .delete()
      .eq('id', exerciseId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Exercise item deleted successfully' });
  } catch (error) {
    logger.error('Delete exercise item error:', error);
    res.status(500).json({ error: 'Failed to delete exercise item' });
  }
});

// ==================== Food Categories ====================

/**
 * Get food categories list
 * GET /api/admin/content/food-categories
 */
router.get('/food-categories', checkPermission('manage_content'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('food_categories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ categories: data || [] });
  } catch (error) {
    logger.error('Get food categories error:', error);
    res.status(500).json({ error: 'Failed to get food categories' });
  }
});

/**
 * Create food category
 * POST /api/admin/content/food-categories
 */
router.post('/food-categories', checkPermission('manage_content'), async (req, res) => {
  try {
    const { name, description, icon, display_order, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('food_categories')
      .insert({
        name,
        description: description || null,
        icon: icon || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        is_system: false
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Category name already exists' });
      }
      throw error;
    }

    res.status(201).json({
      message: 'Food category created successfully',
      category: data
    });
  } catch (error) {
    logger.error('Create food category error:', error);
    res.status(500).json({ error: 'Failed to create food category' });
  }
});

/**
 * Update food category
 * PUT /api/admin/content/food-categories/:id
 */
router.put('/food-categories/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const updateData = req.body;

    delete updateData.id;
    delete updateData.created_at;
    delete updateData.is_system; // Cannot change system flag

    // Check if trying to delete a system category
    const { data: existing } = await supabaseAdmin
      .from('food_categories')
      .select('is_system')
      .eq('id', categoryId)
      .single();

    if (existing?.is_system && updateData.is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate system category' });
    }

    const { data, error } = await supabaseAdmin
      .from('food_categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Food category not found' });
      }
      throw error;
    }

    res.json({
      message: 'Food category updated successfully',
      category: data
    });
  } catch (error) {
    logger.error('Update food category error:', error);
    res.status(500).json({ error: 'Failed to update food category' });
  }
});

/**
 * Delete food category
 * DELETE /api/admin/content/food-categories/:id
 */
router.delete('/food-categories/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Check if it's a system category
    const { data: category } = await supabaseAdmin
      .from('food_categories')
      .select('is_system')
      .eq('id', categoryId)
      .single();

    if (category?.is_system) {
      return res.status(400).json({ error: 'Cannot delete system category' });
    }

    // Get category name first
    const { data: categoryData } = await supabaseAdmin
      .from('food_categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    if (!categoryData) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if any foods are using this category (by name)
    const { data: foods } = await supabaseAdmin
      .from('food_library')
      .select('id')
      .eq('category', categoryData.name)
      .limit(1);

    if (foods && foods.length > 0) {
      return res.status(400).json({ 
        error: '无法删除：该分类正在被使用中',
        details: '有食物项目使用了此分类，请先修改或删除相关食物后再删除分类'
      });
    }

    // Check if any health_records are using foods with this category
    const { data: foodItems } = await supabaseAdmin
      .from('food_library')
      .select('name')
      .eq('category', categoryData.name)
      .limit(10);

    if (foodItems && foodItems.length > 0) {
      const foodNames = foodItems.map(f => f.name);
      const { data: healthRecords } = await supabaseAdmin
        .from('health_records')
        .select('nutrition_data')
        .eq('record_type', 'food')
        .not('nutrition_data', 'is', null)
        .limit(100);

      if (healthRecords) {
        const isUsed = healthRecords.some(record => {
          const nutritionData = record.nutrition_data;
          if (typeof nutritionData === 'object' && nutritionData !== null) {
            return foodNames.includes(nutritionData.name);
          }
          return false;
        });

        if (isUsed) {
          return res.status(400).json({ 
            error: '无法删除：该分类下的食物正在被用户使用中',
            details: '有用户记录中使用了此分类下的食物，请先清理相关记录后再删除分类'
          });
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('food_categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Food category deleted successfully' });
  } catch (error) {
    logger.error('Delete food category error:', error);
    res.status(500).json({ error: 'Failed to delete food category' });
  }
});

// ==================== Exercise Categories ====================

/**
 * Get exercise categories list
 * GET /api/admin/content/exercise-categories
 */
router.get('/exercise-categories', checkPermission('manage_content'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('exercise_categories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ categories: data || [] });
  } catch (error) {
    logger.error('Get exercise categories error:', error);
    res.status(500).json({ error: 'Failed to get exercise categories' });
  }
});

/**
 * Create exercise category
 * POST /api/admin/content/exercise-categories
 */
router.post('/exercise-categories', checkPermission('manage_content'), async (req, res) => {
  try {
    const { name, description, icon, display_order, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('exercise_categories')
      .insert({
        name,
        description: description || null,
        icon: icon || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        is_system: false
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Category name already exists' });
      }
      throw error;
    }

    res.status(201).json({
      message: 'Exercise category created successfully',
      category: data
    });
  } catch (error) {
    logger.error('Create exercise category error:', error);
    res.status(500).json({ error: 'Failed to create exercise category' });
  }
});

/**
 * Update exercise category
 * PUT /api/admin/content/exercise-categories/:id
 */
router.put('/exercise-categories/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const updateData = req.body;

    delete updateData.id;
    delete updateData.created_at;
    delete updateData.is_system; // Cannot change system flag

    // Check if trying to delete a system category
    const { data: existing } = await supabaseAdmin
      .from('exercise_categories')
      .select('is_system')
      .eq('id', categoryId)
      .single();

    if (existing?.is_system && updateData.is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate system category' });
    }

    const { data, error } = await supabaseAdmin
      .from('exercise_categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Exercise category not found' });
      }
      throw error;
    }

    res.json({
      message: 'Exercise category updated successfully',
      category: data
    });
  } catch (error) {
    logger.error('Update exercise category error:', error);
    res.status(500).json({ error: 'Failed to update exercise category' });
  }
});

/**
 * Delete exercise category
 * DELETE /api/admin/content/exercise-categories/:id
 */
router.delete('/exercise-categories/:id', checkPermission('manage_content'), async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Check if it's a system category
    const { data: category } = await supabaseAdmin
      .from('exercise_categories')
      .select('is_system')
      .eq('id', categoryId)
      .single();

    if (category?.is_system) {
      return res.status(400).json({ error: 'Cannot delete system category' });
    }

    // Get category name first
    const { data: categoryData } = await supabaseAdmin
      .from('exercise_categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    if (!categoryData) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if any exercises are using this category (by name)
    const { data: exercises } = await supabaseAdmin
      .from('exercise_library')
      .select('id')
      .eq('category', categoryData.name)
      .limit(1);

    if (exercises && exercises.length > 0) {
      return res.status(400).json({ 
        error: '无法删除：该分类正在被使用中',
        details: '有运动项目使用了此分类，请先修改或删除相关运动后再删除分类'
      });
    }

    // Check if health_records are using exercises with this category
    const { data: exerciseItems } = await supabaseAdmin
      .from('exercise_library')
      .select('name')
      .eq('category', categoryData.name)
      .limit(10);

    if (exerciseItems && exerciseItems.length > 0) {
      const exerciseNames = exerciseItems.map(e => e.name);

      // Check health_records
      const { data: healthRecords } = await supabaseAdmin
        .from('health_records')
        .select('exercise_data')
        .eq('record_type', 'exercise')
        .not('exercise_data', 'is', null)
        .limit(100);

      if (healthRecords) {
        const isUsed = healthRecords.some(record => {
          const exerciseData = record.exercise_data;
          if (typeof exerciseData === 'object' && exerciseData !== null) {
            return exerciseNames.includes(exerciseData.name);
          }
          return false;
        });

        if (isUsed) {
          return res.status(400).json({ 
            error: '无法删除：该分类下的运动正在被用户使用中',
            details: '有用户记录中使用了此分类下的运动，请先清理相关记录后再删除分类'
          });
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('exercise_categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Exercise category deleted successfully' });
  } catch (error) {
    logger.error('Delete exercise category error:', error);
    res.status(500).json({ error: 'Failed to delete exercise category' });
  }
});

module.exports = router;


