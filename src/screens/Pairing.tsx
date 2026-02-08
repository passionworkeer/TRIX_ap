import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';

const Pairing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative h-screen w-full flex flex-col bg-gradient-to-br from-cyan-100 via-indigo-100 to-pink-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center p-4 pt-12 pb-2 justify-between z-20">
        <button 
            onClick={() => navigate(AppRoutes.PROFILE)}
            className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full bg-white/30 hover:bg-white/40 transition-colors backdrop-blur-sm text-slate-800 border border-white/20"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-slate-800 text-lg font-bold flex-1 text-center pr-10">设备配对</h2>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative w-full px-6 pb-24 z-10">
         {/* Scanner Frame */}
         <div className="relative w-full max-w-[300px] aspect-square rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_rgba(127,19,236,0.15)] overflow-hidden mb-8 group">
            {/* BG Placeholder */}
            <div className="absolute inset-0 bg-black/5 z-0">
               <img src={IMAGES.ROOM_BG} className="w-full h-full object-cover opacity-40 mix-blend-overlay" alt="Scan BG" />
            </div>
            
            {/* Scanning Line */}
            <div className="absolute left-0 w-full h-[2px] bg-purple-600 shadow-[0_0_10px_#9333ea] animate-scan z-20"></div>

            {/* Viewfinder Corners */}
            <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl opacity-80"></div>
            <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl opacity-80"></div>
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl opacity-80"></div>
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl opacity-80"></div>
            
            <div className="absolute inset-0 rounded-[2rem] shadow-[inset_0_0_30px_rgba(147,51,234,0.15)] pointer-events-none"></div>
         </div>

         <div className="flex flex-col items-center gap-2 mb-8">
            <p className="text-slate-800 text-base font-medium text-center max-w-[280px]">
               扫描电脑桌面球体上的二维码进行连�?            </p>
            <div className="w-12 h-1 bg-white/40 rounded-full mt-2"></div>
         </div>

         <GlassPanel className="!rounded-xl h-12 px-8 flex items-center justify-center cursor-pointer hover:bg-white/60 transition-colors">
            <span className="text-slate-800 text-sm font-bold tracking-wide">或输入配对码</span>
         </GlassPanel>
      </main>
    </div>
  );
};

export default Pairing;
