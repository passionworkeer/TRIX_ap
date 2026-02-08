import React, { useState, useEffect } from 'react';
import { Timer, Edit, Plus, X, Play, Zap, Trophy } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';

const Study: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isTimer = location.pathname.includes('/timer');

  // Setup State
  const [selectedDuration, setSelectedDuration] = useState(25);
  const timePresets = [25, 45, 60];

  // Timer State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Initialize timer when entering /timer route
  useEffect(() => {
    if (isTimer) {
      const duration = location.state?.duration || 25;
      setTimeLeft(duration * 60);
      setIsActive(true);
      setIsCompleted(false);
    } else {
      setIsActive(false);
    }
  }, [isTimer, location.state]);

  // Countdown logic
  useEffect(() => {
    let interval: any = null;
    if (isTimer && isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      setIsCompleted(true);
      if (interval) clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimer, isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return {
      m: mins.toString().padStart(2, '0'),
      s: secs.toString().padStart(2, '0')
    };
  };

  const handleStartFocus = () => {
    navigate(AppRoutes.TIMER, { state: { duration: selectedDuration } });
  };

  const timeString = formatTime(timeLeft);

  if (isTimer) {
     return (
        <div className="relative h-screen w-full bg-[#0f172a] text-white overflow-hidden flex flex-col transition-colors duration-1000">
           {/* Focus Mode Background */}
           <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] via-[#0f172a] to-[#020617] z-0"></div>
           {/* Adjusted background: larger and moved up */}
           <div className="absolute inset-0 w-full h-full bg-contain bg-center bg-no-repeat z-0 opacity-60 mix-blend-screen transform scale-125 -translate-y-16" 
                style={{ backgroundImage: `url(${IMAGES.STUDY_ROOM_DARK})` }}></div>
           
           {/* Ambient Glow */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>

           <div className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-10">
              <div className="flex flex-col items-center relative">
                 {/* Glowing Timer */}
                 <div className="flex items-baseline justify-center gap-2 drop-shadow-[0_0_30px_rgba(59,130,246,0.6)]">
                    <span className="text-[7rem] leading-none font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-blue-200">
                      {timeString.m}
                    </span>
                    <span className="text-5xl font-bold text-blue-400/50 pb-8 animate-pulse">:</span>
                    <span className="text-[7rem] leading-none font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-blue-200">
                      {timeString.s}
                    </span>
                 </div>
                 
                 <div className="mt-8 flex items-center gap-2 bg-white/5 px-5 py-2 rounded-full border border-white/10 backdrop-blur-md">
                    {isCompleted ? (
                       <>
                         <Trophy size={16} className="text-yellow-400" />
                         <span className="text-base font-bold text-yellow-100">专注完成！</span>
                       </>
                    ) : (
                       <>
                         <div className="w-2 h-2 rounded-full bg-green-400 animate-ping"></div>
                         <span className="text-sm font-medium text-blue-100/80 tracking-wide">深度专注模式</span>
                       </>
                    )}
                 </div>

                 {/* Completion Modal / Overlay */}
                 {isCompleted && (
                    <div className="absolute top-full mt-8 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl flex flex-col items-center animate-[float_3s_ease-in-out_infinite]">
                       <div className="text-4xl mb-2">🎉</div>
                       <h3 className="text-xl font-bold text-white mb-1">太棒了！</h3>
                       <p className="text-blue-200 text-sm mb-4">获得 +50 积分</p>
                       <button 
                         onClick={() => navigate(AppRoutes.STUDY)}
                         className="bg-white text-blue-900 px-6 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform"
                       >
                         返回自习室
                       </button>
                    </div>
                 )}
              </div>
           </div>

           {!isCompleted && (
             <div className="relative z-10 w-full flex flex-col items-center pb-12 gap-6">
                <button 
                  onClick={() => navigate(AppRoutes.STUDY)}
                  className="group flex items-center gap-2 rounded-full bg-white/5 px-6 py-3 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-white/30 transition-all active:scale-95"
                >
                   <X size={18} className="text-white/60 group-hover:text-white" />
                   <span className="font-medium text-white/60 group-hover:text-white text-sm">放弃专注</span>
                </button>
             </div>
           )}
        </div>
     );
  }

  return (
    <div className="h-screen w-full relative bg-[#f0f9ff] overflow-hidden text-[#101f22]">
       <div className="absolute inset-0 bg-cover bg-center z-0 scale-105" style={{ backgroundImage: `url(${IMAGES.STUDY_ISLAND})` }}></div>
       
       {/* Ambient particles */}
       <div className="absolute top-[20%] left-[15%] w-2 h-2 bg-yellow-400 rounded-full blur-[2px] opacity-80 animate-pulse"></div>
       <div className="absolute top-[25%] right-[20%] w-1.5 h-1.5 bg-cyan-400 rounded-full blur-[1px] opacity-60"></div>
       
       <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 flex justify-between items-center mt-6">
             <h1 className="text-3xl font-black tracking-tight text-slate-800 drop-shadow-sm">自习室</h1>
             <button className="w-12 h-12 rounded-full bg-white/80 text-slate-700 flex items-center justify-center shadow-sm backdrop-blur-sm hover:scale-105 active:scale-95 transition-all">
                <Plus size={28} />
             </button>
          </div>

          {/* Floating Control Panel */}
          <div className="absolute top-28 left-6 right-auto">
             <GlassPanel className="p-5 min-w-[180px] !bg-white/70 !border-white/80 !rounded-[2rem] backdrop-blur-xl shadow-xl animate-[float_4s_ease-in-out_infinite]">
                <div className="flex items-center gap-2 text-slate-600 mb-4">
                   <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                      <Timer size={18} />
                   </div>
                   <span className="text-sm font-bold tracking-wide">专注设置</span>
                </div>
                
                {/* Time Selection Pills */}
                <div className="flex gap-2 mb-6">
                   {timePresets.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedDuration(time)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 border ${
                           selectedDuration === time 
                             ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 scale-110' 
                             : 'bg-white/50 text-slate-500 border-transparent hover:bg-white'
                        }`}
                      >
                         {time}m
                      </button>
                   ))}
                </div>

                {/* Main Action Area */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                       <span className="text-4xl font-black text-slate-800 leading-none tracking-tight">
                         {selectedDuration}
                       </span>
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Minutes</span>
                    </div>
                    
                    <button 
                      onClick={handleStartFocus}
                      className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-110 active:scale-90 transition-all duration-300 group"
                    >
                       <Play fill="currentColor" size={24} className="ml-1 group-hover:text-white" />
                    </button>
                </div>
             </GlassPanel>
          </div>

          {/* Stats Teaser */}
          <div className="absolute bottom-32 right-6">
             <div className="bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl p-3 flex items-center gap-3 shadow-sm transform rotate-[-2deg] hover:rotate-0 transition-transform cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                   <Zap size={20} fill="currentColor" />
                </div>
                <div>
                   <p className="text-xs font-bold text-slate-500">今日专注</p>
                   <p className="text-base font-black text-slate-800">1h 45m</p>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default Study;