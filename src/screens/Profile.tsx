import React from 'react';
import { Verified, Plus, Globe, Moon, Lock, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';

const Profile: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-slate-800 relative pb-32">
       {/* Aurora Background */}
       <div className="fixed inset-0 z-0">
          <div className="absolute top-[15%] left-[15%] w-64 h-64 bg-cyan-300/25 rounded-full blur-[80px]"></div>
          <div className="absolute top-[15%] right-[15%] w-64 h-64 bg-yellow-200/35 rounded-full blur-[80px]"></div>
          <div className="absolute bottom-[15%] left-[15%] w-64 h-64 bg-pink-300/25 rounded-full blur-[80px]"></div>
       </div>

       <div className="relative z-10 flex flex-col items-center pt-8 px-6">
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
                <div className="text-center cursor-pointer hover:scale-105 transition-transform">
                   <div className="text-lg font-black text-slate-700">128</div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">陪伴天数</div>
                </div>
                <div className="w-[1px] h-8 bg-slate-200/80"></div>
                <div className="text-center cursor-pointer hover:scale-105 transition-transform">
                   <div className="text-lg font-black text-slate-700">42</div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">等级</div>
                </div>
                <div className="w-[1px] h-8 bg-slate-200/80"></div>
                <div className="text-center cursor-pointer hover:scale-105 transition-transform">
                   <div className="text-lg font-black text-slate-700">1.2k</div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">互动</div>
                </div>
             </div>
          </div>

          <div className="w-full flex flex-col gap-6">
             <div className="w-full">
                <div className="flex items-center justify-between mb-4 pl-1">
                   <h3 className="text-lg font-bold text-slate-800">我的衣橱</h3>
                   <button className="text-xs font-bold text-cyan-600">查看全部</button>
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-6 -mx-6 px-6 no-scrollbar scroll-smooth">
                   {[
                      { name: '巫师帽', img: IMAGES.CLOTHES_HAT, hasDot: true },
                      { name: '披风', img: IMAGES.CLOTHES_CAPE, hasDot: false },
                      { name: '魔杖', img: IMAGES.CLOTHES_WAND, hasDot: false }
                   ].map((item, i) => (
                      <GlassPanel 
                         key={i} 
                         onClick={() => console.log('Outfit changed: ' + item.name)}
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
                   
                   <div className="flex-shrink-0 w-32 h-44 border-2 border-dashed border-slate-200 rounded-[28px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-cyan-300 hover:bg-cyan-50/20 transition-all group">
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
                   <GlassPanel className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer group hover:bg-white/80 transition-all duration-300">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 transform group-hover:scale-105 transition-transform duration-300">
                            <Moon size={20} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">深色模式</span>
                      </div>
                      <div className="relative w-12 h-7 rounded-full bg-slate-200 p-1 transition-colors">
                          <div className="w-5 h-5 bg-white rounded-full shadow-sm transform translate-x-0 transition-transform"></div>
                      </div>
                   </GlassPanel>

                   <GlassPanel className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer group hover:bg-white/80 transition-all duration-300">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-200 transform group-hover:scale-105 transition-transform duration-300">
                            <Globe size={20} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">语言</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                         <span className="text-xs font-medium">简体中文</span>
                         <ChevronRight size={16} />
                      </div>
                   </GlassPanel>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-3 pl-1 mt-6">通用</h3>
                <div className="flex flex-col gap-3">
                   <GlassPanel className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer group hover:bg-white/80 transition-all duration-300">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200 transform group-hover:scale-105 transition-transform duration-300">
                            <Lock size={20} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">隐私与安全</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                   </GlassPanel>
                   
                   <GlassPanel className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer group hover:bg-white/80 transition-all duration-300">
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
                     onClick={() => navigate(AppRoutes.LOGIN)}
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
