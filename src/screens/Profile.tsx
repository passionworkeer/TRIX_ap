import React, { useState } from 'react';
import { Verified, Plus, Globe, Moon, Lock, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';
import { useAuth } from '../contexts/AuthContext';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();

  // 从 localStorage 读取初始值，实现状态持久化
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || '简体中文';
  });

  // 从认证信息中获取用户名
  const username = profile?.username || (user?.email ? user.email.split('@')[0] : 'User');
  const email = user?.email || '';
  const points = profile?.points || 0;

  // 从 profile 获取统计值
  const daysActive = profile?.days_active || 0;
  const interactionCount = profile?.interaction_count || 0;

  const handleOutfitChange = (outfitName: string) => {
    // TODO: 实现装备更换逻辑
    alert(`已装备: ${outfitName}`);
  };

  const handleDarkModeToggle = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('darkMode', String(newValue));
    // TODO: 实现深色模式切换（应用 CSS 类到 document.documentElement）
    alert(newValue ? '深色模式已开启' : '深色模式已关闭');
  };

  const handleLanguageChange = () => {
    const languages = ['简体中文', 'English', '日本語'];
    const currentIndex = languages.indexOf(language);
    const nextLanguage = languages[(currentIndex + 1) % languages.length];
    setLanguage(nextLanguage);
    localStorage.setItem('language', nextLanguage);
    // TODO: 应用语言切换到 i18n 系统
    alert(`语言已切换为: ${nextLanguage}`);
  };

  const handlePrivacyClick = () => {
    // TODO: 导航到隐私设置页面
    alert('隐私与安全设置页面（开发中）');
  };

  const handleAboutClick = () => {
    // TODO: 导航到关于页面
    alert('TRIX v1.2.0\n开发团队: TRIX Studio\n© 2026 All Rights Reserved');
  };

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      await signOut();
      navigate(AppRoutes.LOGIN, { replace: true });
    }
  };

  const handleStatClick = (statName: string, value: number) => {
    const messages: { [key: string]: string } = {
      '陪伴天数': `🎉 你已经和 TRIX 相伴 ${value} 天啦！\n继续保持，一起成长！`,
      '等级': `⭐ 当前等级: Lv.${value}\n距离下一级还需 230 经验值`,
      '互动': `💬 总互动次数: ${value}\n本周互动: 86 次`
    };
    alert(messages[statName] || `${statName}: ${value}`);
  };

  const handleViewAllOutfits = () => {
    // TODO: 导航到装备商店页面
    alert('装备商店（开发中）\n即将推出更多精美装备！');
  };

  const handleGetMoreOutfits = () => {
    // TODO: 导航到装备获取页面
    alert('获取更多装备\n\n完成任务和活动即可解锁新装备！');
  };

  const BG_IMAGE = "/assets/background.jpg";

  return (
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
             style={{ filter: 'brightness(0.3)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
       </div>

       {/* 内容层：z-index: 10 - 所有可交互内容 */}
       <div className="relative z-10 h-full flex flex-col overflow-hidden">
          {/* 头部标题 - 固定不滚动 */}
          <div className="pt-24 pb-4 px-6 flex-shrink-0">
             <h1 className="text-base font-bold tracking-tight text-white/90 uppercase text-center">个人中心</h1>
          </div>

          {/* 滚动内容区域 */}
          <div className="flex-1 overflow-y-auto px-6 pb-28">
             {/* 头像区域 */}
             <div className="flex flex-col items-center pt-6">
                <div className="relative group">
                   {/* 🌟 外层：旋转装饰环 */}
                   <div className="absolute -inset-4 rounded-full border border-amber-500/20 animate-[spin_10s_linear_infinite]">
                      <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/30 animate-[spin_15s_linear_infinite_reverse]"></div>
                   </div>

                   {/* 🌟 中层：发光神环 */}
                   <div className="absolute -inset-2 rounded-full">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400/20 via-yellow-500/30 to-amber-400/20 blur-md animate-pulse"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-amber-400/40 shadow-[0_0_40px_rgba(251,191,36,0.4)]"></div>
                   </div>

                   {/* 🌟 内层：核心头像 */}
                   <div className="relative w-32 h-32 rounded-full overflow-hidden bg-black/30 backdrop-blur-sm shadow-[0_0_30px_rgba(251,191,36,0.3)] border-2 border-amber-300/50">
                      <div className="w-full h-full bg-cover bg-center transform transition-transform group-hover:scale-110 duration-700"
                           style={{ backgroundImage: `url(${IMAGES.SHIBA_AVATAR})` }}></div>
                      {/* 头像内发光 */}
                      <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(251,191,36,0.2)]"></div>
                   </div>

                   {/* 💫 VIP 徽章 */}
                   <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-amber-950 text-[10px] font-black px-3 py-1 rounded-full shadow-lg border-2 border-white/20 flex items-center gap-1 shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                      <Verified size={12} fill="currentColor" className="text-amber-700" /> VIP
                   </div>

                   {/* ✨ 光点装饰 */}
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-300 rounded-full animate-ping"></div>
                   <div className="absolute bottom-4 left-0 w-1 h-1 bg-amber-300 rounded-full animate-ping delay-300"></div>
                   <div className="absolute bottom-4 right-0 w-1 h-1 bg-amber-300 rounded-full animate-ping delay-700"></div>
                </div>
             </div>

             {/* 用户信息 */}
             <div className="mt-4 text-center mb-8 w-full max-w-xs mx-auto">
                <h2 className="text-2xl font-black text-white tracking-tight capitalize drop-shadow-md">{username}</h2>
                <p className="text-xs text-gray-400 mt-1">{email}</p>

                <div className="mt-3 flex justify-center">
                   <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                      <span className="text-amber-300 font-bold text-xs tracking-wide">积分: {points}</span>
                   </div>
                </div>

                {/* Stats Row - 数据统计栏 */}
                <div className="flex items-center justify-center gap-0 mt-6 w-full divide-x divide-white/10">
                   <div
                      className="text-center cursor-pointer hover:scale-105 transition-transform active:scale-95 px-6"
                      onClick={() => handleStatClick('陪伴天数', daysActive)}
                   >
                      <div className="text-xl font-black text-white">{daysActive}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">陪伴天数</div>
                   </div>
                   <div
                      className="text-center cursor-pointer hover:scale-105 transition-transform active:scale-95 px-6"
                      onClick={() => handleStatClick('积分', points)}
                   >
                      <div className="text-xl font-black text-white">{points}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">积分</div>
                   </div>
                   <div
                      className="text-center cursor-pointer hover:scale-105 transition-transform active:scale-95 px-6"
                      onClick={() => handleStatClick('互动', interactionCount)}
                   >
                      <div className="text-xl font-black text-white">{interactionCount}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">互动</div>
                   </div>
                </div>
             </div>

             {/* 装备和设置区域 */}
             <div className="w-full max-w-md mx-auto flex flex-col gap-6">
                {/* 我的衣橱 */}
                <div className="w-full">
                   <div className="flex items-center justify-between mb-4 pl-1">
                      <h3 className="text-lg font-bold text-white">我的衣橱</h3>
                      <button
                         onClick={handleViewAllOutfits}
                         className="text-xs font-bold text-amber-400 hover:text-amber-300 active:scale-95 transition-all"
                      >
                         查看全部
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
                             className="flex-shrink-0 w-32 h-44 !rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer group hover:bg-white/15 transition-all duration-300 hover:-translate-y-1 relative border border-white/20"
                           >
                             {item.hasDot && <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-sm z-10 ring-2 ring-white/20 animate-pulse"></div>}

                             <div className="w-full aspect-square rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative">
                                <img src={item.img} className="w-20 h-20 object-contain drop-shadow-lg transform group-hover:rotate-3 hover:scale-105 transition-all duration-500" alt={item.name} />
                             </div>

                             <div className="flex-1 flex flex-col items-center justify-center">
                                <p className="font-bold text-xs text-gray-300">{item.name}</p>
                                <p className="text-[10px] text-amber-400 font-bold opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-300">点击装备</p>
                             </div>
                          </GlassPanel>
                       ))}

                      <div
                         onClick={handleGetMoreOutfits}
                         className="flex-shrink-0 w-32 h-44 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-amber-500/50 hover:bg-white/10 transition-all group active:scale-95"
                      >
                         <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 group-hover:text-amber-400 flex items-center justify-center text-gray-500 transition-colors duration-300">
                            <Plus size={22} />
                         </div>
                         <span className="text-xs font-bold text-gray-500 group-hover:text-amber-400 transition-colors">获取更多</span>
                      </div>
                   </div>
                </div>

                {/* 外观与个性化 */}
                <div className="w-full">
                   <h3 className="text-lg font-bold text-white mb-3 pl-1">外观与个性化</h3>
                   <div className="flex flex-col gap-3">
                      <GlassPanel
                         onClick={handleDarkModeToggle}
                         className="p-4 !rounded-xl flex items-center justify-between cursor-pointer group hover:bg-white/15 transition-all duration-300 active:scale-95 border border-white/20"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Moon size={20} />
                            </div>
                            <span className="font-bold text-sm text-gray-200">深色模式</span>
                         </div>
                         <div className={`relative w-12 h-7 rounded-full p-1 transition-colors ${darkMode ? 'bg-amber-500' : 'bg-white/10'}`}>
                             <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                         </div>
                      </GlassPanel>

                      <GlassPanel
                         onClick={handleLanguageChange}
                         className="p-4 !rounded-xl flex items-center justify-between cursor-pointer group hover:bg-white/15 transition-all duration-300 active:scale-95 border border-white/20"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Globe size={20} />
                            </div>
                            <span className="font-bold text-sm text-gray-200">语言</span>
                         </div>
                         <div className="flex items-center gap-2 text-gray-500">
                            <span className="text-xs font-medium">{language}</span>
                            <ChevronRight size={16} />
                         </div>
                      </GlassPanel>
                   </div>

                   {/* 通用设置 */}
                   <h3 className="text-lg font-bold text-white mb-3 pl-1 mt-6">通用</h3>
                   <div className="flex flex-col gap-3">
                      <GlassPanel
                         onClick={handlePrivacyClick}
                         className="p-4 !rounded-xl flex items-center justify-between cursor-pointer group hover:bg-white/15 transition-all duration-300 active:scale-95 border border-white/20"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Lock size={20} />
                            </div>
                            <span className="font-bold text-sm text-gray-200">隐私与安全</span>
                         </div>
                         <ChevronRight size={16} className="text-gray-500" />
                      </GlassPanel>

                      <GlassPanel
                         onClick={handleAboutClick}
                         className="p-4 !rounded-xl flex items-center justify-between cursor-pointer group hover:bg-white/15 transition-all duration-300 active:scale-95 border border-white/20"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-105 transition-transform duration-300">
                               <Verified size={20} />
                            </div>
                            <span className="font-bold text-sm text-gray-200">关于我们</span>
                         </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            <span className="text-xs font-medium">v1.2.0</span>
                            <ChevronRight size={16} />
                          </div>
                      </GlassPanel>

                      <button
                        onClick={handleLogout}
                        className="mt-4 w-full bg-white/10 backdrop-blur-md border border-red-500/20 p-4 rounded-xl flex items-center justify-center gap-2 text-red-400 font-bold text-sm hover:bg-red-500/10 transition-colors active:scale-95 duration-200"
                      >
                         <LogOut size={18} />
                         退出登录
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default Profile;
