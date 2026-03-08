import React, { useState } from 'react';
import { Verified, Plus, Globe, Moon, Lock, LogOut, ChevronRight, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AboutDialog } from '../components/AboutDialog';
import { StatsDetailDialog } from '../components/StatsDetailDialog';
import { PrivacySettings } from '../components/PrivacySettings';
import { PointsHistory } from '../components/PointsHistory';
import { AppRoutes } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useVoiceSettings } from '../contexts/VoiceSettingsContext';
import { getUserStats } from '../services/userStatsService';
import type { UserStats } from '../services/userStatsService';
import { useConfirmModal } from '../hooks/useConfirmModal';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { voiceEnabled, toggleVoiceEnabled } = useVoiceSettings();
  const { t, i18n } = useTranslation();
  const { requestConfirm, ConfirmModalRenderer } = useConfirmModal();

  // 对话框状态
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [isPrivacySettingsOpen, setIsPrivacySettingsOpen] = useState(false);
  const [isPointsHistoryOpen, setIsPointsHistoryOpen] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Get current language display name
  const languageNames: Record<string, string> = {
    zh: '简体中文',
    'zh-TW': '繁體中文',
    en: 'English',
    ja: '日本語'
  };

  // 获取标准化后的当前语言
  const getCurrentLang = () => {
    if (!i18n.language) return 'zh';
    return i18n.language.includes('zh-TW') ? 'zh-TW' :
           i18n.language.includes('zh') ? 'zh' :
           i18n.language.includes('ja') ? 'ja' :
           i18n.language.includes('en') ? 'en' :
           i18n.language; // fallback
  };
  const currentLangValue = getCurrentLang();

  // 从认证信息中获取用户名
  const username = profile?.username || (user?.email ? user.email.split('@')[0] : 'User');
  const email = user?.email || '';
  const points = profile?.points || 0;

  // 从 profile 获取统计值
  const daysActive = profile?.days_active || 0;
  const interactionCount = profile?.interaction_count || 0;

  const handleGetMoreOutfits = () => {
    navigate(AppRoutes.POINTS_MALL);
  };

  const handleOutfitChange = (_outfitName: string) => {
    // 打开衣柜页面进行换装
    navigate(AppRoutes.WARDROBE);
  };

  const handleDarkModeToggle = () => {
    toggleTheme();
  };

  const handleLanguageChange = () => {
    const languages = ['zh', 'zh-TW', 'en', 'ja'];
    const currentLang = getCurrentLang();
    const currentIndex = languages.indexOf(currentLang);
    // 如果不在列表中，默认跳转到第一个
    const nextLanguage = currentIndex >= 0 ? languages[(currentIndex + 1) % languages.length] : languages[0];
    i18n.changeLanguage(nextLanguage);
    localStorage.setItem('language', nextLanguage);
    localStorage.setItem('i18nextLng', nextLanguage);
  };

  const handleVoiceToggle = () => {
    toggleVoiceEnabled();
  };

  const handlePrivacyClick = () => {
    // 打开隐私设置对话框
    setIsPrivacySettingsOpen(true);
  };

  const handleAboutClick = () => {
    // 打开关于对话框
    setIsAboutDialogOpen(true);
  };

  const handleLogout = async () => {
    const shouldLogout = await requestConfirm({
      title: t('profile.logout'),
      message: t('profile.logoutConfirm'),
      confirmText: t('profile.logout'),
      cancelText: t('common.cancel'),
      variant: 'warning',
    });
    if (!shouldLogout) return;

    await signOut();
    navigate(AppRoutes.LOGIN, { replace: true });
  };

  const handleStatClick = async (_statName: string, _value: number) => {
    // 打开统计详情对话框并加载数据
    setIsStatsDialogOpen(true);
    setStatsLoading(true);

    try {
      if (user?.id) {
        const stats = await getUserStats(user.id);
        setUserStats(stats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleViewAllOutfits = () => {
    // 打开衣柜页面
    navigate(AppRoutes.WARDROBE);
  };

  const BG_IMAGE = IMAGES.BACKGROUND;
  const titleTextClass = isDark ? 'text-white/90' : 'text-slate-900';
  const primaryTextClass = isDark ? 'text-white' : 'text-slate-900';
  const secondaryTextClass = isDark ? 'text-gray-400' : 'text-slate-600';
  const mutedTextClass = isDark ? 'text-gray-500' : 'text-slate-500';
  const panelClass = isDark
    ? 'hover:bg-white/15 border-white/20'
    : 'hover:bg-white/85 border-slate-200/80';

  return (
    <>
      {/* 关于对话框 */}
      <AboutDialog
        isOpen={isAboutDialogOpen}
        onClose={() => setIsAboutDialogOpen(false)}
      />

      {/* 统计详情对话框 */}
      <StatsDetailDialog
        isOpen={isStatsDialogOpen}
        onClose={() => setIsStatsDialogOpen(false)}
        stats={userStats}
        loading={statsLoading}
      />

      {/* 隐私设置对话框 */}
      <PrivacySettings
        isOpen={isPrivacySettingsOpen}
        onClose={() => setIsPrivacySettingsOpen(false)}
        userId={user?.id || ''}
      />

      {/* 积分历史对话框 */}
      <PointsHistory
        isOpen={isPointsHistoryOpen}
        onClose={() => setIsPointsHistoryOpen(false)}
        userId={user?.id || ''}
      />
      <ConfirmModalRenderer />

      <div className="h-screen w-full relative overflow-hidden" style={{ background: 'transparent' }}>
       {/* 背景层：z-index: 0 - 固定背景，不阻挡交互 */}
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
            className={`absolute inset-0 ${isDark
              ? 'bg-gradient-to-b from-black/20 via-transparent to-black/50'
              : 'bg-gradient-to-b from-white/35 via-white/10 to-white/40'}`}
          />
       </div>

       {/* 内容层：z-index: 10 - 所有可交互内容 */}
       <div className="relative z-10 h-full flex flex-col overflow-hidden">
          {/* 头部标题 - 固定不滚动 */}
          <div className="pt-14 pb-2 px-6 flex-shrink-0">
             <h1 className={`text-[15px] font-black tracking-widest uppercase text-center ${titleTextClass}`}>{t('profile.title')}</h1>
          </div>

          {/* 滚动内容区域 */}
          <div className="flex-1 overflow-y-auto px-6 pb-28">
             {/* 现代极简玻璃拟物风用户信息区 */}
             <div className="w-full max-w-md mx-auto mt-4 mb-8 flex flex-col items-center">
                {/* 简约风头像 */}
                <div className="relative group cursor-pointer mb-5">
                   {/* 极简呼吸晕 */}
                   <div className="absolute -inset-2 rounded-full opacity-30 blur-lg bg-gradient-to-tr from-white/20 to-white/10 transition-all duration-700 group-hover:opacity-50" />  
                   {/* 纤细冰透边框外壳 */}
                   <div className={`relative w-[110px] h-[110px] rounded-full overflow-hidden border-[1.5px] ${isDark ? 'border-white/10' : 'border-black/5'} shadow-xl z-10 transform transition-transform duration-500 group-hover:scale-105`}>
                      <div className="w-full h-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                           style={{ backgroundImage: `url(${IMAGES.SHIBA_AVATAR})` }} />
                   </div>
                </div>

                {/* 用户文本信息 */}
                <div className="text-center w-full px-5">
                   <div className="flex items-center justify-center gap-2 mb-1">
                       <h2 className={`text-[24px] font-bold tracking-tight capitalize ${primaryTextClass}`}>{username}</h2>
                       <div className="bg-gradient-to-r from-amber-200 to-amber-500 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1 transform transition-transform hover:scale-105 cursor-pointer">
                           <Verified size={12} fill="currentColor" />
                           <span className="leading-none pr-0.5 pt-px uppercase">VIP</span>
                       </div>
                   </div>
                   <p className={`text-[13px] font-medium opacity-60 ${secondaryTextClass}`}>{email}</p>
                   
                   {/* 高级玻璃拟物风 数据卡片 */}
                   <div className={`mt-6 w-full grid grid-cols-3 divide-x ${isDark ? 'divide-white/10 bg-white/5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]' : 'divide-black/5 bg-white/60 border border-white shadow-[0_8px_32px_rgba(0,0,0,0.05)]'} rounded-[24px] backdrop-blur-xl overflow-hidden`}>
                      
                      <div className={`py-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`} onClick={() => handleStatClick('陪伴天数', daysActive)}>
                         <div className={`text-[20px] font-bold tabular-nums leading-none mb-1.5 ${primaryTextClass}`}>{daysActive}</div>
                         <div className={`text-[11px] font-bold tracking-wider opacity-60 ${secondaryTextClass}`}>{t('profile.daysActive')}</div>
                      </div>

                      {/* 积分合并进统计区域 */}
                      <div className={`py-4 flex flex-col items-center justify-center cursor-pointer transition-colors relative ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`} onClick={() => setIsPointsHistoryOpen(true)}>
                         {/* 积分发光小点提示 */}
                         <div className="absolute top-3 right-5 flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                         </div>
                         <div className={`text-[20px] font-bold tabular-nums leading-none mb-1.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                           {points}
                         </div>
                         <div className={`text-[11px] font-bold tracking-wider opacity-60 ${secondaryTextClass}`}>{t('profile.points')}</div>
                      </div>

                      <div className={`py-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`} onClick={() => handleStatClick('互动', interactionCount)}>
                         <div className={`text-[20px] font-bold tabular-nums leading-none mb-1.5 ${primaryTextClass}`}>{interactionCount}</div>
                         <div className={`text-[11px] font-bold tracking-wider opacity-60 ${secondaryTextClass}`}>{t('profile.interactions')}</div>
                      </div>
                      
                   </div>
                </div>
             </div>

             {/* 装备和设置区域 */}
             <div className="w-full max-w-md mx-auto flex flex-col gap-6">
                {/* 我的衣橱 */}
                <div className="w-full">
                   <div className="flex items-center justify-between mb-4 pl-1">
                      <h3 className={`text-lg font-bold ${primaryTextClass}`}>{t('profile.myWardrobe')}</h3>
                      <button
                         onClick={handleViewAllOutfits}
                         className={`text-xs font-bold active:scale-95 transition-all ${isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-700 hover:text-amber-600'}`}
                      >
                         {t('profile.viewAll')}
                      </button>
                   </div>

                   <div className="flex gap-4 overflow-x-auto pb-6 -mx-6 px-6 scroll-smooth">
                      {[
                         { name: '巫师帽', img: IMAGES.CLOTHES_HAT, hasDot: true },
                         { name: '披风', img: IMAGES.CLOTHES_CAPE, hasDot: false },
                         { name: '魔杖', img: IMAGES.CLOTHES_WAND, hasDot: false }
                      ].map((item, i) => (
                          <GlassPanel
                             key={i}
                             onClick={() => handleOutfitChange(item.name)}
                             className={`flex-shrink-0 w-32 h-44 !rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer group transition-all duration-300 hover:-translate-y-1 relative border ${panelClass}`}
                           >
                             {item.hasDot && <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-sm z-10 ring-2 ring-white/20 animate-pulse"></div>}

                             <div className={`w-full aspect-square rounded-xl flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative ${isDark ? 'bg-white/10' : 'bg-slate-100/80'}`}>
                                <img src={item.img} className="w-20 h-20 object-contain drop-shadow-lg transform group-hover:rotate-3 hover:scale-105 transition-all duration-500" alt={item.name} />
                             </div>

                             <div className="flex-1 flex flex-col items-center justify-center">
                                <p className={`font-bold text-xs ${secondaryTextClass}`}>{item.name}</p>
                                <p className={`text-[10px] font-bold opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-300 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>点击装备</p>
                             </div>
                          </GlassPanel>
                       ))}

                      <div
                         onClick={handleGetMoreOutfits}
                         className={`flex-shrink-0 w-32 h-44 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group active:scale-95 ${isDark ? 'border-white/20 hover:border-amber-500/50 hover:bg-white/10' : 'border-slate-300 hover:border-amber-500/60 hover:bg-white/70'}`}
                      >
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${isDark ? 'bg-white/10 group-hover:bg-white/20 group-hover:text-amber-400 text-gray-500' : 'bg-white/80 group-hover:bg-white group-hover:text-amber-700 text-slate-500'}`}>
                            <Plus size={22} />
                         </div>
                         <span className={`text-xs font-bold transition-colors ${isDark ? 'text-gray-500 group-hover:text-amber-400' : 'text-slate-500 group-hover:text-amber-700'}`}>{t('profile.getMore')}</span>
                      </div>
                   </div>
                </div>

                {/* 外观与个性化 */}
                <div className="w-full">
                   <h3 className={`text-lg font-bold mb-3 pl-1 ${primaryTextClass}`}>{t('profile.appearance')}</h3>
                   <div className="flex flex-col gap-3">
                      <GlassPanel
                         onClick={handleDarkModeToggle}
                         className={`p-4 !rounded-xl flex items-center justify-between cursor-pointer group transition-all duration-300 active:scale-95 border ${panelClass}`}
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Moon size={20} />
                            </div>
                            <span className={`font-bold text-sm ${secondaryTextClass}`}>{t('profile.darkMode')}</span>
                         </div>
                         <div className={`relative w-12 h-7 rounded-full p-1 transition-colors ${isDark ? 'bg-amber-500' : 'bg-slate-300'}`}>
                             <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`}></div>
                         </div>
                      </GlassPanel>

                      <GlassPanel
                         onClick={handleLanguageChange}
                         className={`p-4 !rounded-xl flex items-center justify-between cursor-pointer group transition-all duration-300 active:scale-95 border ${panelClass}`}
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Globe size={20} />
                            </div>
                            <span className={`font-bold text-sm ${secondaryTextClass}`}>{t('profile.language')}</span>
                         </div>
                         <div className={`flex items-center gap-2 ${mutedTextClass}`}>
                            <span className="text-xs font-medium">{languageNames[currentLangValue] || currentLangValue}</span>
                            <ChevronRight size={16} />
                         </div>
                      </GlassPanel>

                      <GlassPanel
                         onClick={handleVoiceToggle}
                         className={`p-4 !rounded-xl flex items-center justify-between cursor-pointer group transition-all duration-300 active:scale-95 border ${panelClass}`}
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Volume2 size={20} />
                            </div>
                            <span className={`font-bold text-sm ${secondaryTextClass}`}>语音沉浸模式</span>
                         </div>
                         <div className={`relative w-12 h-7 rounded-full p-1 transition-colors ${voiceEnabled ? 'bg-amber-500' : 'bg-slate-300'}`}>
                             <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${voiceEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                         </div>
                      </GlassPanel>
                   </div>

                   {/* 通用设置 */}
                   <h3 className={`text-lg font-bold mb-3 pl-1 mt-6 ${primaryTextClass}`}>{t('profile.general')}</h3>
                   <div className="flex flex-col gap-3">
                      <GlassPanel
                         onClick={handlePrivacyClick}
                         className={`p-4 !rounded-xl flex items-center justify-between cursor-pointer group transition-all duration-300 active:scale-95 border ${panelClass}`}
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Lock size={20} />
                            </div>
                            <span className={`font-bold text-sm ${secondaryTextClass}`}>{t('profile.privacy')}</span>
                         </div>
                         <ChevronRight size={16} className={mutedTextClass} />
                      </GlassPanel>

                      <GlassPanel
                         onClick={handleAboutClick}
                         className={`p-4 !rounded-xl flex items-center justify-between cursor-pointer group transition-all duration-300 active:scale-95 border ${panelClass}`}
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Verified size={20} />
                            </div>
                            <span className={`font-bold text-sm ${secondaryTextClass}`}>{t('profile.about')}</span>
                         </div>
                          <div className={`flex items-center gap-2 ${mutedTextClass}`}>
                            <span className="text-xs font-medium">v1.2.0</span>
                            <ChevronRight size={16} />
                          </div>
                      </GlassPanel>

                      <button
                        onClick={handleLogout}
                        className={`mt-4 w-full backdrop-blur-md border p-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors active:scale-95 duration-200 ${
                          isDark
                            ? 'bg-white/10 border-red-500/20 text-red-400 hover:bg-red-500/10'
                            : 'bg-white/75 border-red-200 text-red-600 hover:bg-red-50'
                        }`}
                      >
                         <LogOut size={18} />
                         {t('profile.logout')}
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
    </>
  );
};

export default Profile;
