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
          
          <div className="relative group mt-4">
             <div className="relative w-36 h-36 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white">
                <div className="w-full h-full bg-cover bg-center transform transition-transform hover:scale-110 duration-700" 
                     style={{ backgroundImage: `url(${IMAGES.SHIBA_AVATAR})` }}></div>
             </div>
             <div className="absolute -bottom-3 -right-2 bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 text-yellow-900 text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg border border-white flex items-center gap-1">
                <Verified size={14} fill="currentColor" /> VIP
             </div>
          </div>

          <div className="mt-5 text-center mb-8">
             <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Trixie</h2>
             <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/50 border border-white/60 backdrop-blur-md shadow-sm">
                <span className="text-cyan-700 font-bold text-xs tracking-wide">Level 42 探索者</span>
             </div>
          </div>

          <div className="w-full flex flex-col gap-6">
             <div className="w-full">
                <div className="flex items-center justify-between mb-4 pl-1">
                   <h3 className="text-lg font-bold text-slate-800">我的衣橱</h3>
                   <button className="text-xs font-bold text-cyan-600">查看全部</button>
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                   {[
                      { name: '巫师帽', img: IMAGES.CLOTHES_HAT, hasDot: true },
                      { name: '披风', img: IMAGES.CLOTHES_CAPE, hasDot: false },
                      { name: '魔杖', img: IMAGES.CLOTHES_WAND, hasDot: false }
                   ].map((item, i) => (
                      <GlassPanel 
                         key={i} 
                         onClick={() => console.log('Outfit changed: ' + item.name)}
                         className="flex-shrink-0 w-28 h-40 !rounded-[24px] p-3 flex flex-col items-center justify-between cursor-pointer hover:bg-white/80 transition-transform hover:-translate-y-1 relative"
                       >
                         {item.hasDot && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm"></div>}
                         <div className="flex-1 w-full flex items-center justify-center">
                            <img src={item.img} className="w-20 h-20 object-contain drop-shadow-md" alt={item.name} />
                         </div>
                         <p className="font-bold text-xs text-slate-700 pb-1">{item.name}</p>
                      </GlassPanel>
                   ))}
                   
                   <div className="flex-shrink-0 w-28 h-40 border border-dashed border-slate-300 rounded-[24px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/40 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-400">
                         <Plus size={18} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">获取更多</span>
                   </div>
                </div>
             </div>

             <div className="w-full">
                <h3 className="text-lg font-bold text-slate-800 mb-3 pl-1">设置</h3>
                <div className="flex flex-col gap-3">
                   <GlassPanel className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer hover:bg-white/80 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Globe size={18} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">语言</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                         <span className="text-xs">简体中文</span>
                         <ChevronRight size={16} />
                      </div>
                   </GlassPanel>

                   <GlassPanel className="p-4 !rounded-[24px] flex items-center justify-between cursor-pointer hover:bg-white/80 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                            <Lock size={18} />
                         </div>
                         <span className="font-bold text-sm text-slate-700">隐私</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                   </GlassPanel>

                   <button 
                     onClick={() => navigate(AppRoutes.LOGIN)}
                     className="mt-2 w-full bg-white/60 border border-red-100 p-4 rounded-[24px] flex items-center justify-center text-red-500 font-bold text-sm hover:bg-red-50 transition-colors shadow-sm"
                   >
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