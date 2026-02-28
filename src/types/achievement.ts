// Achievement types for TRIX 3D Companion

export interface Achievement {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  requirement: number;
  type: AchievementType;
  rarity: AchievementRarity;
  unlockedAt?: string; // ISO date string when unlocked
}

export type AchievementCategory =
  | 'duration'    // 专注时长相关
  | 'streak'      // 连续学习相关
  | 'social'      // 社交相关
  | 'milestone'   // 里程碑
  | 'special';   // 特殊成就

export type AchievementType =
  | 'total_minutes'      // 累计分钟数
  | 'single_session'     // 单次专注时长
  | 'daily_streak'      // 连续天数
  | 'weekly_streak'      // 连续周数
  | 'total_sessions'    // 累计专注次数
  | 'friends_studied'   // 和好友一起学习
  | 'early_bird'        // 早起学习
  | 'night_owl'        // 熬夜学习
  | 'weekend_warrior'  // 周末学习
  | 'perfect_month';   // 完美月份

export type AchievementRarity =
  | 'common'    // 普通
  | 'rare'      // 稀有
  | 'epic'      // 史诗
  | 'legendary'; // 传说

// 成就列表
export const ACHIEVEMENTS: Achievement[] = [
  // 累计时长成就
  {
    id: 'duration_10',
    name: '初学者',
    nameEn: 'Beginner',
    description: '累计专注 10 分钟',
    icon: '🌱',
    category: 'duration',
    requirement: 10,
    type: 'total_minutes',
    rarity: 'common'
  },
  {
    id: 'duration_60',
    name: '一小时学者',
    nameEn: 'Hour Scholar',
    description: '累计专注 60 分钟',
    icon: '📖',
    category: 'duration',
    requirement: 60,
    type: 'total_minutes',
    rarity: 'common'
  },
  {
    id: 'duration_300',
    name: '五小时大师',
    nameEn: 'Five Hour Master',
    description: '累计专注 300 分钟',
    icon: '🎓',
    category: 'duration',
    requirement: 300,
    type: 'total_minutes',
    rarity: 'rare'
  },
  {
    id: 'duration_1000',
    name: '千分钟达人',
    nameEn: 'Thousand Minute Pro',
    description: '累计专注 1000 分钟',
    icon: '🏆',
    category: 'duration',
    requirement: 1000,
    type: 'total_minutes',
    rarity: 'epic'
  },
  {
    id: 'duration_5000',
    name: '专注传奇',
    nameEn: 'Focus Legend',
    description: '累计专注 5000 分钟',
    icon: '👑',
    category: 'duration',
    requirement: 5000,
    type: 'total_minutes',
    rarity: 'legendary'
  },

  // 单次专注成就
  {
    id: 'single_25',
    name: '番茄达人',
    nameEn: 'Pomodoro Master',
    description: '单次专注 25 分钟',
    icon: '🍅',
    category: 'duration',
    requirement: 25,
    type: 'single_session',
    rarity: 'common'
  },
  {
    id: 'single_45',
    name: '深度学习者',
    nameEn: 'Deep Learner',
    description: '单次专注 45 分钟',
    icon: '🧠',
    category: 'duration',
    requirement: 45,
    type: 'single_session',
    rarity: 'rare'
  },
  {
    id: 'single_60',
    name: '一小时王者',
    nameEn: 'Hour Champion',
    description: '单次专注 60 分钟',
    icon: '⚡',
    category: 'duration',
    requirement: 60,
    type: 'single_session',
    rarity: 'epic'
  },

  // 连续天数成就
  {
    id: 'streak_3',
    name: '三天坚持',
    nameEn: 'Three Day Streak',
    description: '连续学习 3 天',
    icon: '🔥',
    category: 'streak',
    requirement: 3,
    type: 'daily_streak',
    rarity: 'common'
  },
  {
    id: 'streak_7',
    name: '一周达人',
    nameEn: 'Week Warrior',
    description: '连续学习 7 天',
    icon: '💪',
    category: 'streak',
    requirement: 7,
    type: 'daily_streak',
    rarity: 'rare'
  },
  {
    id: 'streak_30',
    name: '月度冠军',
    nameEn: 'Monthly Champion',
    description: '连续学习 30 天',
    icon: '🌟',
    category: 'streak',
    requirement: 30,
    type: 'daily_streak',
    rarity: 'epic'
  },
  {
    id: 'streak_100',
    name: '百日英雄',
    nameEn: 'Hundred Day Hero',
    description: '连续学习 100 天',
    icon: '🦸',
    category: 'streak',
    requirement: 100,
    type: 'daily_streak',
    rarity: 'legendary'
  },

  // 社交成就
  {
    id: 'social_first',
    name: '结伴学习',
    nameEn: 'Study Buddy',
    description: '和好友一起学习 1 次',
    icon: '🤝',
    category: 'social',
    requirement: 1,
    type: 'friends_studied',
    rarity: 'common'
  },
  {
    id: 'social_10',
    name: '学习伙伴',
    nameEn: 'Learning Partner',
    description: '和好友一起学习 10 次',
    icon: '👥',
    category: 'social',
    requirement: 10,
    type: 'friends_studied',
    rarity: 'rare'
  },

  // 特殊成就
  {
    id: 'early_bird',
    name: '早起鸟',
    nameEn: 'Early Bird',
    description: '在早上 7 点前开始学习',
    icon: '🌅',
    category: 'special',
    requirement: 1,
    type: 'early_bird',
    rarity: 'rare'
  },
  {
    id: 'night_owl',
    name: '夜猫子',
    nameEn: 'Night Owl',
    description: '在晚上 10 点后开始学习',
    icon: '🦉',
    category: 'special',
    requirement: 1,
    type: 'night_owl',
    rarity: 'rare'
  },
  {
    id: 'perfect_month',
    name: '完美月份',
    nameEn: 'Perfect Month',
    description: '一个月内每天都有学习',
    icon: '📅',
    category: 'milestone',
    requirement: 30,
    type: 'perfect_month',
    rarity: 'legendary'
  }
];

// 获取成就稀有度颜色
export function getAchievementColor(rarity: AchievementRarity): string {
  switch (rarity) {
    case 'common':
      return '#9ca3af'; // gray
    case 'rare':
      return '#3b82f6'; // blue
    case 'epic':
      return '#8b5cf6'; // purple
    case 'legendary':
      return '#f59e0b'; // yellow
  }
}

// 获取成就稀有度背景色
export function getAchievementBgColor(rarity: AchievementRarity): string {
  switch (rarity) {
    case 'common':
      return 'rgba(156, 163, 175, 0.1)';
    case 'rare':
      return 'rgba(59, 130, 246, 0.1)';
    case 'epic':
      return 'rgba(139, 92, 246, 0.1)';
    case 'legendary':
      return 'rgba(245, 158, 11, 0.1)';
  }
}
