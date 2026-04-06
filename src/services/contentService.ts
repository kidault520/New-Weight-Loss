import { supabase } from '../config/supabase';

/**
 * Get active supplement products
 */
export async function getSupplementProducts() {
  const { data, error } = await supabase
    .from('supplement_products')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching supplement products:', error);
    return [];
  }

  return data || [];
}

/**
 * Get nutrition solution content by section type
 */
export async function getNutritionSolutionContent(sectionType?: 'supplement' | 'diet' | 'lifestyle') {
  let query = supabase
    .from('nutrition_solution_content')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (sectionType) {
    query = query.eq('section_type', sectionType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching nutrition solution content:', error);
    return [];
  }

  return data || [];
}

/**
 * Get content templates by type
 */
export async function getContentTemplates(contentType: string) {
  const { data, error } = await supabase
    .from('content_templates')
    .select('*')
    .eq('content_type', contentType)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching content templates:', error);
    return [];
  }

  return data || [];
}











