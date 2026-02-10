import React, { useState } from 'react';
import { Verified, Plus, Globe, Moon, Lock, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('简体中文');

  const handleOutfitChange = (outfitName: string) => {
    // TODO: 实现装备更换逻辑
    alert(`已装备: ${outfitName}`);
  };

  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
    // TODO: 实现深色模式切换
  };

  const handleLanguageChange = () => {
    const languages = ['简体中文', 'English', '日本語'];
    const currentIndex = languages.indexOf(language);
    const nextLanguage = languages[(currentIndex + 1) % languages.length];
    setLanguage(nextLanguage);
  };

  const handlePrivacyClick = () => {
    // TODO: 导航到隐私设置页面
    alert('隐私与安全设置页面（开发中）');
  };

  const handleAboutClick = () => {
    // TODO: 导航到关于页面
    alert('TRIX v1.2.0\n开发团队: TRIX Studio\n© 2026 All Rights Reserved');
  };

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      navigate(AppRoutes.LOGIN);
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

  return (
    <div className="h-screen w-full bg-[#FAFAFA] text-slate-800 relative flex flex-col overflow-hidden">
       {/* Aurora Background */}
       <div className="fixed inset-0 z-0">
          <div className="absolute top-[15%] left-[15%] w-64 h-64 bg-cyan-300/25 rounded-full blur-[80px]"></div>
          <div className="absolute top-[15%] right-[15%] w-64 h-64 bg-yellow-200/35 rounded-full blur-[80px]"></div>
          <div className="absolute bottom-[15%] left-[15%] w-64 h-64 bg-pink-300/25 rounded-full blur-[80px]"></div>
       </div>

       <div className="relative z-10 flex flex-col items-center pt-8 px-6 flex-1 overflow-y-auto no-scrollbar">
          <h1 className="text-base font-bold tracking-tight text-slate-700 uppercase opacity-90 mb-4">个人中心</h1>
          
          <div className="relative group mt-6">
             <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
             <div className="relative w-32 h-32 rounded-full border-[6px] border-white shadow-2xl shadow-cyan-900/10 overflow-hidden bg-white">
                <div className="w-full h-full bg-cover bg-center transform transition-transform group-hover:scale-110 duration-700" 
                     style={{ backgroundImage: `url(${IMAGES.SHIBA_AVATAR})` }}></div>
             </div>
             <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-amber-950 text-[10px] font-black px-3 py-1 rounded-full shadow-lg border-2 border-white flex items-center gap-1">
                <Verified size={12} fill="currentColor" className="text-amber-700" /> VIP
             </div>
          </div>

          <div className="mt-4 text-center mb-8 w-full max-w-xs">
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">Trixie</h2>
             
             <div className="mt-3 flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100/50 shadow-sm">
                   <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                   <span className="text-cyan-700 font-bold text-xs tracking-wide">Level 42 探索者</span>
                </div>
             </div>

             {/* Stats Row */}
             <div className="flex items-center justify-center gap-8 mt-6 w-full">
                <div 
                   className="text-center cursor-pointer hover:scale-105 transition-transform active:scale-95"
                   onClick={() => handleStatClick('陪伴天数', 128)}
                >
                   <div className="text-lg font-black text-slate-700">128</div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">陪伴天数</div>
                </div>
                <div className="w-[1px] h-8 bg-slate-200/80"></div>
                <div 
                   className="text-center cursor-pointer hover:scale-105 transition-transform active:scale-95"
                   onClick={() => handleStatClick('等级', 42)}
                >
                   <div className="text-lg font-black text-slate-700">42</div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">等级</div>
                </div>
                <div className="w-[1px] h-8 bg-slate-200/80"></div>
                <div 
                   className="text-center cursor-pointer hover:scale-105 transition-transform active:scale-95"
                   onClick={() => handleStatClick('互动', 1200)}
                >
                   <div className="text-lg font-black text-slate-700">1.2k</div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">互动</div>
                </div>
             </div>
          </div>

          <div className="w-full flex flex-col gap-6">
             <div className="w-full">
                <div className="flex items-center justify-between mb-4 pl-1">
                   <h3 className="text-lg font-bold text-slate-800">我的衣橱</h3>
                   <button 
                      onClick={handleViewAllOutfits}
                      className="text-xs font-bold text-cyan-600 hover:text-cyan-700 active:scale-95 transition-all"
                   >
                      查看全部
                   </button>
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-6 -mx-6 px-6 no-scrollbar scroll-smooth">
                   {[
                      { name: '巫师帽', img: IMAGES.CLOTHES_HAT, hasDot: true },
                      { name: '披风', img: IMAGES.CLOTHES_CAPE, hasDot: false },
                      { name: '魔杖', img: IMAGES.CLOTHES_WAND, hasDot: false }
                   ].map((item, i) => (
                      <GlassPanel 
                         key={i} 
                         onClick={() => handleOutfitChange(item.name)}
                         className="flex-shrink-0 w-32 h-44 !rounded-[28px] p-3 flex flex-col items-center gap-2 cursor-pointer group hover:bg-white/95 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-900/5 relative border border-white/60"
                       >
                         {item.hasDot && <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-sm z-10 ring-2 ring-white animate-pulse"></div>}
                         
                         <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative">
                            <div className="absolute inset-0 bg-radial-gradient from-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <img src={item.img} className="w-20 h-20 object-contain drop-shadow-lg transform group-hover:rotate-3 transition-transform duration-500" alt={item.name} />
                         </div>
                         
                         <div className="flex-1 flex flex-col items-center justify-center">
                            <p className="font-bold text-xs text-slate-700">{item.name}</p>
                            <p className="text-[10px] text-cyan-500 font-bold opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-300">点击装备</p>
                         </div>
                      </GlassPanel>
                   ))}
                   
                   <div 
                      onClick={handleGetMoreOutfits}
                      className="flex-shrink-0 w-32 h-44 border-2 border-dashed border-slate-200 rounded-[28px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-cyan-300 hover:bg-cyan-50/20 transition-all group active:scale-95"
                   >
                      <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-cyan-100 group-hover:text-cyan-600 flex items-center justify-center text-slate-400 transition-colors duration-300 shadow-sm">
                         <Plus size={22} />
                      </div>
                      <span className="text-xs font-bold text-slate-400 group-hover:text-cyan-600 transition-colors">获取更多</span>
                   </div>
                </div>
             </div>

             <div className="w-full">
                <h3 className="text-lg font-bold text-slate-800 mb-3 pl-1">外观与个性化</h3>
                <div className="flex flex-col gap-3">
                   <GlassPanel 
                      onClick={handleDarkModeToggle}
                      className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer group hover:bg-white/80 transition-all duration-300 active:scale-95"
                   >
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 transform group-hover:scale-105 transition-transform duration-300">
                            <Moon size={20} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">深色模式</span>
                      </div>
                      <div className={`relative w-12 h-7 rounded-full p-1 transition-colors ${darkMode ? 'bg-cyan-500' : 'bg-slate-200'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                   </GlassPanel>

                   <GlassPanel 
                      onClick={handleLanguageChange}
                      className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer group hover:bg-white/80 transition-all duration-300 active:scale-95"
                   >
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-200 transform group-hover:scale-105 transition-transform duration-300">
                            <Globe size={20} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">语言</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                         <span className="text-xs font-medium">{language}</span>
                         <ChevronRight size={16} />
                      </div>
                   </GlassPanel>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-3 pl-1 mt-6">通用</h3>
                <div className="flex flex-col gap-3">
                   <GlassPanel 
                      onClick={handlePrivacyClick}
                      className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer group hover:bg-white/80 transition-all duration-300 active:scale-95"
                   >
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200 transform group-hover:scale-105 transition-transform duration-300">
                            <Lock size={20} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">隐私与安全</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                   </GlassPanel>
                   
                   <GlassPanel 
                      onClick={handleAboutClick}
                      className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer group hover:bg-white/80 transition-all duration-300 active:scale-95"
                   >
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 text-white flex items-center justify-center shadow-lg shadow-slate-200 transform group-hover:scale-105 transition-transform duration-300">
                            <Verified size={20} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">关于我们</span>
                      </div>
                       <div className="flex items-center gap-2 text-slate-400">
                         <span className="text-xs font-medium">v1.2.0</span>
                         <ChevronRight size={16} />
                      </div>
                   </GlassPanel>

                   <button 
                     onClick={handleLogout}
                     className="mt-4 w-full bg-white/60 border border-red-100 p-4 rounded-[24px] flex items-center justify-center gap-2 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors shadow-sm active:scale-95 duration-200"
                   >
                      <LogOut size={18} /> 
                      退出登录
                   </button>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default Profile;
