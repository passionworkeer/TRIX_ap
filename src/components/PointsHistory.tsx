/**
 * 积分历史记录组件 - Points History
 * 显示用户的积分获得和消费历史
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, History } from 'lucide-react';
import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';

interface PointTransaction {
  id: string;
  created_at: string;
  transaction_type: string;
  points_change: number;
  description: string;
  balance_after: number;
}

interface PointsHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  study_complete: '完成学习',
  study_streak: '连续学习',
  daily_login: '每日登录',
  achievement: '成就解锁',
  social_share: '社交分享',
  redeem: '兑换奖励',
  admin_adjust: '管理员调整'
};

export const PointsHistory: React.FC<PointsHistoryProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      loadTransactions();
    }
  }, [isOpen, userId, page]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * 20, page * 20 - 1);

      if (error) throw error;

      if (data) {
        setTransactions(page === 1 ? data : [...transactions, ...data]);
        setHasMore(data.length === 20);
      }
    } catch (error: any) {
      console.error('加载积分历史失败:', error);
      toast.error('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶部标题栏 */}
              <div className="bg-gradient-to-br from-amber-400 to-yellow-500 p-6 text-white flex-shrink-0">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <History size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">积分历史</h2>
                      <p className="text-white/90 text-sm">查看积分变动记录</p>
                    </div>
                  </div>
                  <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-4 overflow-y-auto flex-1">
                {transactions.length === 0 && !loading ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <p>暂无积分记录</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          tx.points_change > 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {tx.points_change > 0 ? (
                            <TrendingUp size={18} className="text-white" />
                          ) : (
                            <TrendingDown size={18} className="text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {TRANSACTION_TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {tx.description || '无描述'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${
                            tx.points_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {tx.points_change > 0 ? '+' : ''}{tx.points_change}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(tx.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 加载更多 */}
              {hasMore && transactions.length > 0 && (
                <div className="p-4 flex-shrink-0">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-white font-semibold rounded-2xl transition-colors disabled:opacity-50"
                  >
                    {loading ? '加载中...' : '加载更多'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PointsHistory;
