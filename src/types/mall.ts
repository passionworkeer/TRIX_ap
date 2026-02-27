/**
 * Mall Types - 积分商城类型定义
 *
 * 定义积分商城的相关数据类型接口
 */

/**
 * 商城商品分类
 */
export type MallCategory = 'clothing' | 'accessory' | 'prop';

/**
 * 商城商品项
 */
export interface MallItem {
  /** 商品唯一 ID */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品描述 */
  description: string;
  /** 商品图片 URL */
  image: string;
  /** 所需积分价格 */
  price: number;
  /** 商品分类 */
  category: MallCategory;
  /** 用户是否已拥有 */
  isOwned: boolean;
}

/**
 * 积分购买请求
 */
export interface MallPurchaseRequest {
  /** 商品 ID */
  itemId: string;
  /** 购买数量 */
  quantity?: number;
}

/**
 * 积分购买响应
 */
export interface MallPurchaseResponse {
  /** 是否成功 */
  success: boolean;
  /** 消息 */
  message: string;
  /** 剩余积分 */
  remainingPoints: number;
  /** 购买的商品 */
  item?: MallItem;
}

/**
 * 用户积分余额
 */
export interface PointsBalance {
  /** 用户 ID */
  userId: string;
  /** 当前积分余额 */
  balance: number;
  /** 累计获得积分 */
  totalEarned: number;
  /** 累计消费积分 */
  totalSpent: number;
  /** 最后更新时间 */
  updatedAt: string;
}

/**
 * 积分交易记录
 */
export interface PointsTransaction {
  /** 交易 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 积分变动数量 (正数为获得，负数为消费) */
  amount: number;
  /** 交易类型 */
  type: 'earn' | 'spend' | 'bonus' | 'refund';
  /** 交易描述 */
  description: string;
  /** 关联商品 ID (如有) */
  relatedItemId?: string;
  /** 交易时间 */
  createdAt: string;
}

/**
 * 购买历史项
 */
export interface PurchaseHistoryItem {
  /** 购买记录 ID */
  id: string;
  /** 商品信息 */
  item: MallItem;
  /** 购买时间 */
  purchasedAt: string;
  /** 购买时消耗的积分 */
  pointsSpent: number;
}

/**
 * 商城筛选选项
 */
export interface MallFilterOptions {
  /** 分类筛选 */
  category?: MallCategory;
  /** 是否只显示未拥有 */
  showUnownedOnly?: boolean;
  /** 搜索关键词 */
  searchQuery?: string;
  /** 价格范围 */
  priceRange?: {
    min: number;
    max: number;
  };
}

/**
 * 商城状态
 */
export interface MallState {
  /** 商品列表 */
  items: MallItem[];
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前筛选选项 */
  filter: MallFilterOptions;
  /** 用户积分余额 */
  userPoints: number;
  /** 购买历史 */
  purchaseHistory: PurchaseHistoryItem[];
}
