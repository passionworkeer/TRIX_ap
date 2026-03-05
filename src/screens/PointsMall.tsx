/**
 * PointsMall - 积分商城页面
 *
 * 展示积分商品，支持分类筛选和购买
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Sparkles, Loader2 } from 'lucide-react';
import GlassPanel from '../components/GlassPanel';
import { getMallItems, getUserPointsBalance, purchaseItem } from '../services/mallService';
import type { MallItem, MallCategory, PointsBalance } from '../types/mall';
import { useTheme } from '../contexts/ThemeContext';
import { logger } from '../utils/logger';
import { IMAGES } from '../constants';
import toast from 'react-hot-toast';

const PointsMall: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // 状态管理
  const [items, setItems] = useState<MallItem[]>([]);
  const [pointsBalance, setPointsBalance] = useState<PointsBalance | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MallCategory | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);

  // 分类配置
  const categories: { key: MallCategory | 'all'; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'clothing', label: '服装' },
    { key: 'accessory', label: '配饰' },
    { key: 'prop', label: '道具' },
  ];

  // 样式类
  const titleTextClass = isDark ? 'text-white/90' : 'text-slate-900';
  const primaryTextClass = isDark ? 'text-white' : 'text-slate-900';
  const secondaryTextClass = isDark ? 'text-gray-400' : 'text-slate-600';
  const mutedTextClass = isDark ? 'text-gray-500' : 'text-slate-500';
  const panelClass = isDark
    ? 'bg-white/10 border-white/20 hover:bg-white/15'
    : 'bg-white/75 border-slate-200/80 hover:bg-white';

  const BG_IMAGE = IMAGES.BACKGROUND;

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 分类变化时重新加载商品
  useEffect(() => {
    loadItems();
  }, [selectedCategory]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadItems(), loadPointsBalance()]);
    } catch (error) {
      logger.points.error('Failed to load mall data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const filter = selectedCategory !== 'all' ? { category: selectedCategory as MallCategory } : undefined;
      const data = await getMallItems(filter);
      setItems(data);
    } catch (error) {
      logger.points.error('Failed to load items:', error);
      toast.error('加载商品失败');
    }
  };

  const loadPointsBalance = async () => {
    try {
      const balance = await getUserPointsBalance();
      setPointsBalance(balance);
    } catch (error) {
      logger.points.error('Failed to load points balance:', error);
    }
  };

  const handlePurchase = async (item: MallItem) => {
    if (item.isOwned) {
      toast('您已拥有此商品', { icon: '✨' });
      return;
    }

    if (!pointsBalance || pointsBalance.balance < item.price) {
      toast.error('积分不足，请先赚取更多积分');
      return;
    }

    setIsPurchasing(item.id);
    try {
      const result = await purchaseItem({ itemId: item.id });

      if (result.success) {
        toast.success(result.message);
        // 刷新数据和积分余额
        await Promise.all([loadItems(), loadPointsBalance()]);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      logger.points.error('Purchase failed:', error);
      toast.error('购买失败，请稍后重试');
    } finally {
      setIsPurchasing(null);
    }
  };

  const renderCategoryTags = () => (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scroll-smooth">
      {categories.map((cat) => (
        <button
          key={cat.key}
          onClick={() => setSelectedCategory(cat.key)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 active:scale-95 ${
            selectedCategory === cat.key
              ? isDark
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
              : isDark
                ? 'bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20'
                : 'bg-white/75 text-slate-600 border border-slate-200 hover:bg-white'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );

  const renderPointsHeader = () => (
    <GlassPanel
      className={`p-4 !rounded-2xl mb-4 ${panelClass}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isDark
              ? 'bg-gradient-to-br from-amber-400 to-yellow-500'
              : 'bg-gradient-to-br from-amber-400 to-yellow-500'
          } shadow-lg shadow-amber-500/30`}>
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <p className={`text-xs font-bold ${mutedTextClass}`}>我的积分</p>
            <p className={`text-2xl font-black ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              {pointsBalance?.balance ?? 0}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-[10px] font-bold ${mutedTextClass}`}>累计消费</p>
          <p className={`text-sm font-bold ${secondaryTextClass}`}>
            {pointsBalance?.totalSpent ?? 0}
          </p>
        </div>
      </div>
    </GlassPanel>
  );

  const renderItemCard = (item: MallItem) => (
    <GlassPanel
      key={item.id}
      className={`!rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1 ${
        item.isOwned ? 'opacity-75' : ''
      } ${panelClass}`}
      onClick={() => handlePurchase(item)}
    >
      {/* 商品图片 */}
      <div className={`relative aspect-square overflow-hidden ${
        isDark ? 'bg-white/5' : 'bg-slate-100/80'
      }`}>
        <img
          src={item.image || IMAGES.CLOTHES_HAT}
          alt={item.name}
          className="w-full h-full object-contain p-4 transform group-hover:scale-105 transition-transform duration-500"
        />
        {/* 已拥有标签 */}
        {item.isOwned && (
          <div className="absolute top-2 right-2 bg-green-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
            已拥有
          </div>
        )}
        {/* 积分价格标签 */}
        <div className={`absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
          isDark
            ? 'bg-black/50 text-amber-300 backdrop-blur-sm'
            : 'bg-white/90 text-amber-700 shadow-sm'
        }`}>
          <Sparkles size={12} className="text-amber-400" />
          {item.price}
        </div>
      </div>

      {/* 商品信息 */}
      <div className="p-3">
        <h3 className={`font-bold text-sm truncate ${primaryTextClass}`}>
          {item.name}
        </h3>
        <p className={`text-[10px] line-clamp-2 mt-1 ${mutedTextClass}`}>
          {item.description}
        </p>

        {/* 购买按钮 */}
        <button
          className={`mt-3 w-full py-2 rounded-lg text-xs font-bold transition-all duration-300 active:scale-95 ${
            item.isOwned
              ? isDark
                ? 'bg-green-500/20 text-green-400 cursor-default'
                : 'bg-green-100 text-green-600 cursor-default'
              : isPurchasing === item.id
                ? 'bg-amber-500/50 text-white cursor-wait'
                : isDark
                  ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20'
          }`}
          disabled={item.isOwned || isPurchasing === item.id}
        >
          {isPurchasing === item.id ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              购买中...
            </span>
          ) : item.isOwned ? (
            '已拥有'
          ) : (
            '立即兑换'
          )}
        </button>
      </div>
    </GlassPanel>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
        isDark ? 'bg-white/10' : 'bg-slate-100'
      }`}>
        <ShoppingBag size={40} className={mutedTextClass} />
      </div>
      <p className={`text-lg font-bold ${secondaryTextClass}`}>
        暂无商品
      </p>
      <p className={`text-sm mt-1 ${mutedTextClass}`}>
        {selectedCategory !== 'all'
          ? '该分类下暂无商品，请切换其他分类'
          : '敬请期待更多商品上线'}
      </p>
    </div>
  );

  return (
    <div className="h-screen w-full relative overflow-hidden" style={{ background: 'transparent' }}>
      {/* 背景层 */}
      <div
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0, pointerEvents: 'none' }}
      >
        <img
          src={BG_IMAGE}
          alt="Background"
          className="w-full h-full object-cover"
          style={{ filter: isDark ? 'brightness(0.3)' : 'brightness(0.65)' }}
        />
        <div
          className={`absolute inset-0 ${
            isDark
              ? 'bg-gradient-to-b from-black/20 via-transparent to-black/50'
              : 'bg-gradient-to-b from-white/35 via-white/10 to-white/40'
          }`}
        />
      </div>

      {/* 内容层 */}
      <div className="relative z-10 h-full flex flex-col overflow-hidden">
        {/* 头部标题 - 固定不滚动 */}
        <div className="pt-20 pb-4 px-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate(-1)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isDark
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white/75 hover:bg-white text-slate-900'
              }`}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className={`text-lg font-bold tracking-tight ${titleTextClass}`}>
              积分商城
            </h1>
          </div>

          {/* 积分余额 */}
          {renderPointsHeader()}

          {/* 分类标签 */}
          {renderCategoryTags()}
        </div>

        {/* 滚动内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 pb-28">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={40} className={`animate-spin ${isDark ? 'text-white' : 'text-slate-600'}`} />
            </div>
          ) : items.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {items.map(renderItemCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PointsMall;
