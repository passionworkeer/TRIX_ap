/**
 * Mall Service - 积分商城服务
 *
 * 处理积分商城的商品查询、购买等业务逻辑
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import type {
  MallItem,
  MallCategory,
  MallPurchaseRequest,
  MallPurchaseResponse,
  PointsBalance,
  PointsTransaction,
  PurchaseHistoryItem,
  MallFilterOptions,
} from '../types/mall';

/**
 * 获取商城商品列表
 * @param filter - 筛选选项
 * @returns 商品列表
 */
export async function getMallItems(filter?: MallFilterOptions): Promise<MallItem[]> {
  try {
    let query = supabase
      .from('mall_items')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    // 应用分类筛选
    if (filter?.category) {
      query = query.eq('category', filter.category);
    }

    // 应用搜索筛选
    if (filter?.searchQuery) {
      query = query.or(`name.ilike.%${filter.searchQuery}%,description.ilike.%${filter.searchQuery}%`);
    }

    // 应用价格范围筛选
    if (filter?.priceRange) {
      query = query
        .gte('price', filter.priceRange.min)
        .lte('price', filter.priceRange.max);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[MallService] Failed to fetch mall items:', error);
      throw new Error(`获取商品列表失败: ${error.message}`);
    }

    // 获取用户已拥有的商品
    const userId = (await supabase.auth.getUser()).data.user?.id;
    let ownedItemIds: string[] = [];

    if (userId) {
      const { data: ownedData } = await supabase
        .from('user_purchased_items')
        .select('item_id')
        .eq('user_id', userId);

      ownedItemIds = ownedData?.map(item => item.item_id) || [];
    }

    // 映射数据并添加已拥有状态
    const items: MallItem[] = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      image: item.image_url,
      price: item.price,
      category: item.category as MallCategory,
      isOwned: ownedItemIds.includes(item.id),
    }));

    // 如果只显示未拥有，筛选掉已拥有的
    if (filter?.showUnownedOnly) {
      return items.filter(item => !item.isOwned);
    }

    return items;
  } catch (error) {
    logger.error('[MallService] Error in getMallItems:', error);
    throw error;
  }
}

/**
 * 按分类获取商品
 * @param category - 商品分类
 * @returns 分类下的商品列表
 */
export async function getMallItemsByCategory(category: MallCategory): Promise<MallItem[]> {
  return getMallItems({ category });
}

/**
 * 购买商品
 * @param request - 购买请求
 * @returns 购买结果
 */
export async function purchaseItem(request: MallPurchaseRequest): Promise<MallPurchaseResponse> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: '请先登录',
        remainingPoints: 0,
      };
    }

    // 获取商品信息
    const { data: item, error: itemError } = await supabase
      .from('mall_items')
      .select('*')
      .eq('id', request.itemId)
      .eq('is_active', true)
      .single();

    if (itemError || !item) {
      return {
        success: false,
        message: '商品不存在或已下架',
        remainingPoints: 0,
      };
    }

    // 获取用户积分余额
    const { data: pointsData, error: pointsError } = await supabase
      .from('user_points')
      .select('balance, total_spent')
      .eq('user_id', user.id)
      .single();

    if (pointsError || !pointsData) {
      return {
        success: false,
        message: '获取积分余额失败',
        remainingPoints: 0,
      };
    }

    const currentBalance = pointsData.balance;
    const currentTotalSpent = pointsData.total_spent || 0;

    // 检查积分是否足够
    if (currentBalance < item.price) {
      return {
        success: false,
        message: `积分不足，需要 ${item.price} 积分，当前 ${currentBalance} 积分`,
        remainingPoints: currentBalance,
      };
    }

    // 检查是否已拥有
    const { data: owned } = await supabase
      .from('user_purchased_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', request.itemId)
      .single();

    if (owned) {
      return {
        success: false,
        message: '您已拥有此商品',
        remainingPoints: currentBalance,
      };
    }

    // 使用数据库事务扣减积分并添加购买记录
    // 注意: Supabase 使用行级安全策略 (RLS)，需要确保有相应权限

    // 1. 扣减积分
    const { error: deductError } = await supabase
      .from('user_points')
      .update({
        balance: currentBalance - item.price,
        total_spent: currentTotalSpent + item.price,
      })
      .eq('user_id', user.id);

    if (deductError) {
      logger.error('[MallService] Failed to deduct points:', deductError);
      return {
        success: false,
        message: '积分扣减失败，请重试',
        remainingPoints: currentBalance,
      };
    }

    // 2. 添加购买记录
    const quantity = request.quantity || 1;
    const { error: purchaseError } = await supabase
      .from('user_purchased_items')
      .insert({
        user_id: user.id,
        item_id: item.id,
        quantity,
        points_spent: item.price * quantity,
      });

    if (purchaseError) {
      // 积分已扣减但购买记录失败，回滚积分
      await supabase
        .from('user_points')
        .update({
          balance: currentBalance,
        })
        .eq('user_id', user.id);

      logger.error('[MallService] Failed to record purchase:', purchaseError);
      return {
        success: false,
        message: '购买记录失败，请重试',
        remainingPoints: currentBalance,
      };
    }

    // 3. 记录积分交易
    await supabase.from('points_transactions').insert({
      user_id: user.id,
      amount: -item.price,
      type: 'spend',
      description: `购买商品: ${item.name}`,
      related_item_id: item.id,
    });

    logger.info(`[MallService] Purchase successful: user=${user.id}, item=${item.id}, points=${item.price}`);

    return {
      success: true,
      message: `成功购买 ${item.name}！`,
      remainingPoints: currentBalance - item.price,
      item: {
        id: item.id,
        name: item.name,
        description: item.description,
        image: item.image_url,
        price: item.price,
        category: item.category as MallCategory,
        isOwned: true,
      },
    };
  } catch (error) {
    logger.error('[MallService] Error in purchaseItem:', error);
    return {
      success: false,
      message: '购买失败，请稍后重试',
      remainingPoints: 0,
    };
  }
}

/**
 * 获取用户积分余额
 * @returns 积分余额信息
 */
export async function getUserPointsBalance(): Promise<PointsBalance | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      logger.error('[MallService] Failed to fetch points balance:', error);
      return null;
    }

    return {
      userId: data.user_id,
      balance: data.balance,
      totalEarned: data.total_earned || 0,
      totalSpent: data.total_spent || 0,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    logger.error('[MallService] Error in getUserPointsBalance:', error);
    return null;
  }
}

/**
 * 获取购买历史
 * @returns 购买历史列表
 */
export async function getPurchaseHistory(): Promise<PurchaseHistoryItem[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_purchased_items')
      .select(`
        id,
        item_id,
        quantity,
        points_spent,
        purchased_at,
        mall_items (
          id,
          name,
          description,
          image_url,
          price,
          category
        )
      `)
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });

    if (error) {
      logger.error('[MallService] Failed to fetch purchase history:', error);
      return [];
    }

    return (data || []).map((record: any) => {
      const mallItem = Array.isArray(record.mall_items) ? record.mall_items[0] : record.mall_items;
      return {
        id: record.id,
        item: {
          id: mallItem?.id || '',
          name: mallItem?.name || '',
          description: mallItem?.description || '',
          image: mallItem?.image_url || '',
          price: mallItem?.price || 0,
          category: (mallItem?.category || 'clothing') as MallCategory,
          isOwned: true,
        },
        purchasedAt: record.purchased_at,
        pointsSpent: record.points_spent,
      };
    });
  } catch (error) {
    logger.error('[MallService] Error in getPurchaseHistory:', error);
    return [];
  }
}

/**
 * 获取积分交易记录
 * @param limit - 返回记录数量限制
 * @returns 交易记录列表
 */
export async function getPointsTransactions(limit: number = 20): Promise<PointsTransaction[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[MallService] Failed to fetch points transactions:', error);
      return [];
    }

    return (data || []).map(t => ({
      id: t.id,
      userId: t.user_id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      relatedItemId: t.related_item_id,
      createdAt: t.created_at,
    }));
  } catch (error) {
    logger.error('[MallService] Error in getPointsTransactions:', error);
    return [];
  }
}
