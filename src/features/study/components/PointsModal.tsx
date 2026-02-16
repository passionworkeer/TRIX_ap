import React, { useEffect, useState } from 'react';
import { Zap, Trophy, TrendingUp, Clock, X, Loader2 } from 'lucide-react';
import { getUserPointsStats, getPointsHistory, PointsTransaction } from '../../../services/pointsService';

interface PointsModalProps {
  show: boolean;
  onClose: () => void;
  userId: string;
}

/**
 * PointsModal - 积分详情模态框组件
 *
 * 显示用户积分统计和历史记录
 */
export const PointsModal: React.FC<PointsModalProps> = ({ show, onClose, userId }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<PointsTransaction[]>([]);

  useEffect(() => {
    if (show && userId) {
      loadPointsData();
    }
  }, [show, userId]);

  const loadPointsData = async () => {
    setLoading(true);
    try {
      const [statsData, historyData] = await Promise.all([
        getUserPointsStats(userId),
        getPointsHistory(userId, 10)
      ]);

      setStats(statsData);
      setHistory(historyData);
    } catch (error) {
      console.error('加载积分数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'study_complete': '完成学习',
      'study_streak': '连续学习',
      'daily_login': '每日登录',
      'achievement': '成就解锁',
      'social_share': '社交分享',
      'redeem': '兑换奖励',
      'admin_adjust': '系统调整'
    };
    return labels[type] || type;
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div
        role="presentation"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal内容 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="points-title"
          className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto animate-scale-in"
        >
          {/* 头部 */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="points-title" className="text-2xl font-bold text-gray-900">
                  我的积分
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  学习赚积分，解锁更多功能
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                aria-label="关闭"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : stats ? (
            <>
              {/* 积分概览 */}
              <div className="p-6 space-y-4">
                {/* 总积分卡片 */}
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm font-medium mb-1">总积分</p>
                      <p className="text-4xl font-bold">{stats.total_points}</p>
                    </div>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Zap size={28} fill="white" className="text-white" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Trophy size={16} className="text-yellow-100" />
                    <span className="text-sm text-yellow-100">等级 {stats.level}</span>
                  </div>
                </div>

                {/* 统计数据 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={16} className="text-blue-500" />
                      <span className="text-xs text-blue-600 font-medium">今日获得</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">+{stats.today_earned}</p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={16} className="text-green-500" />
                      <span className="text-xs text-green-600 font-medium">本周获得</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">+{stats.week_earned}</p>
                  </div>
                </div>

                {/* 说明文字 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    💡 <strong>积分规则：</strong>每专注学习1分钟获得2积分。积分可以提升等级，解锁更多功能和奖励。
                  </p>
                </div>
              </div>

              {/* 历史记录 */}
              {history.length > 0 && (
                <div className="border-t border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    最近记录
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {history.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {getTransactionTypeLabel(record.transaction_type)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {record.description || new Date(record.created_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            record.points_change > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {record.points_change > 0 ? '+' : ''}{record.points_change}
                          </p>
                          <p className="text-xs text-gray-400">
                            余额 {record.balance_after}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">暂无积分数据</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PointsModal;
