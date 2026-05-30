/**
 * Wardrobe/Avatar system service
 */
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import type {
  Outfit,
  OutfitRow,
  OutfitCategory,
  UserOutfits,
  EquipResponse,
  UnequipResponse,
  OutfitCategoryFilter,
} from '../types/wardrobe';

/**
 * Get all user outfits
 */
export async function getUserOutfits(): Promise<Outfit[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('请先登录');
  }

  // Get all outfits from database
  const { data: outfits, error } = await supabase
    .from('outfits')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    logger.ui.error('Failed to fetch outfits:', error);
    throw new Error('获取服装列表失败');
  }

  // Get user's owned outfits
  const { data: ownedOutfits } = await supabase
    .from<Array<{ outfit_id: string; is_equipped: boolean }>>('user_outfits')
    .select('outfit_id, is_equipped')
    .eq('user_id', user.id);

  // Get user's equipped outfits
  const equippedIds = new Set(
    (ownedOutfits ?? [])
      .filter((o) => o.is_equipped)
      .map((o) => o.outfit_id)
  );

  const ownedIds = new Set(
    (ownedOutfits ?? []).map((o) => o.outfit_id)
  );

  // Map outfits with ownership status
  const result: Outfit[] = (outfits ?? []).map((outfit: OutfitRow) => ({
    id: outfit.id,
    name: outfit.name,
    category: outfit.category as OutfitCategory,
    image: outfit.image_url,
    previewImage: outfit.preview_image_url || outfit.image_url,
    isOwned: ownedIds.has(outfit.id),
    isEquipped: equippedIds.has(outfit.id),
    description: outfit.description || undefined,
    price: outfit.price || undefined,
  }));

  return result;
}

/**
 * Get outfits filtered by category
 */
export async function getOutfitsByCategory(
  category: OutfitCategoryFilter
): Promise<Outfit[]> {
  const outfits = await getUserOutfits();

  if (category === 'all') {
    return outfits;
  }

  return outfits.filter((outfit) => outfit.category === category);
}

/**
 * Get user's equipped outfits
 */
export async function getEquippedOutfits(): Promise<Outfit[]> {
  const outfits = await getUserOutfits();
  return outfits.filter((outfit) => outfit.isEquipped);
}

/**
 * Equip an outfit
 */
export async function equipOutfit(outfitId: string): Promise<EquipResponse> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: '请先登录',
    };
  }

  // Check if user owns this outfit
  const { data: owned } = await supabase
    .from('user_outfits')
    .select('id, is_equipped')
    .eq('user_id', user.id)
    .eq('outfit_id', outfitId)
    .single();

  if (!owned) {
    return {
      success: false,
      message: '您尚未拥有此服装',
    };
  }

  // Get outfit category for uniqueness check
  const { data: outfit } = await supabase
    .from('outfits')
    .select('category')
    .eq('id', outfitId)
    .single();

  if (!outfit) {
    return {
      success: false,
      message: '服装不存在',
    };
  }

  // Unequip other outfits of the same category
  const { data: sameCategoryOutfits } = await supabase
    .from<Array<{ id: string }>>('outfits')
    .select('id')
    .eq('category', outfit.category);

  if (sameCategoryOutfits && sameCategoryOutfits.length > 0) {
    const categoryOutfitIds = sameCategoryOutfits.map((o) => o.id);

    await supabase
      .from('user_outfits')
      .update({ is_equipped: false })
      .eq('user_id', user.id)
      .in('outfit_id', categoryOutfitIds);
  }

  // Equip the selected outfit
  const { error } = await supabase
    .from('user_outfits')
    .update({ is_equipped: true })
    .eq('user_id', user.id)
    .eq('outfit_id', outfitId);

  if (error) {
    logger.ui.error('Failed to equip outfit:', error);
    return {
      success: false,
      message: '装备失败，请重试',
    };
  }

  // Get updated equipped outfits
  const equippedOutfits = await getEquippedOutfits();

  return {
    success: true,
    message: '装备成功',
    equippedOutfits,
  };
}

/**
 * Unequip an outfit
 */
export async function unequipOutfit(outfitId: string): Promise<UnequipResponse> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: '请先登录',
    };
  }

  const { error } = await supabase
    .from('user_outfits')
    .update({ is_equipped: false })
    .eq('user_id', user.id)
    .eq('outfit_id', outfitId);

  if (error) {
    logger.ui.error('Failed to unequip outfit:', error);
    return {
      success: false,
      message: '卸下失败，请重试',
    };
  }

  // Get updated equipped outfits
  const equippedOutfits = await getEquippedOutfits();

  return {
    success: true,
    message: '已卸下',
    equippedOutfits,
  };
}

/**
 * Get user's wardrobe summary
 */
export async function getUserWardrobeSummary(): Promise<UserOutfits> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('请先登录');
  }

  const outfits = await getUserOutfits();
  const ownedOutfits = outfits.filter((o) => o.isOwned);
  const equippedOutfits = outfits.filter((o) => o.isEquipped);

  return {
    userId: user.id,
    ownedOutfits,
    equippedOutfits,
    totalOutfits: outfits.length,
    ownedCount: ownedOutfits.length,
    equippedCount: equippedOutfits.length,
  };
}
