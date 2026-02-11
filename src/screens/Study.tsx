import React, { useState, useEffect } from "react";
import { Timer, Plus, X, Play, Zap, Trophy, MapPin } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppRoutes } from "../types";
import StudyBuddiesList from "../components/StudyBuddiesList";
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";

const BG_IMAGE = "/assets/StudyRoomBG.png";

export default function Study() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); // 获取当前用户
  const isTimer = location.pathname.includes("/timer");

  const [selectedDuration, setSelectedDuration] = useState(25);
  const timePresets = [25, 45, 60];

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // 好友列表弹窗状态
  const [isBuddyListOpen, setIsBuddyListOpen] = useState(false);

  // 🧹 清理函数：组件卸载时自动停止自习状态
  useEffect(() => {
    // 当进入计时器页面时，状态已经在 handleStartFocus 中设置为 true
    // 这里只需要在组件卸载时清理
    return () => {
      if (isTimer && user?.id) {
        console.log('🧹 [Study] 组件卸载，清理自习状态...');
        supabase
          .from('profiles')
          .update({ is_studying: false })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) {
              console.error('❌ [Study] 清理状态失败:', error);
            } else {
              console.log('✅ [Study] 已清理 is_studying = false');
            }
          });
      }
    };
  }, [isTimer, user?.id]);

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
      m: mins.toString().padStart(2, "0"),
      s: secs.toString().padStart(2, "0")
    };
  };

  const handleStartFocus = async () => {
    // 更新数据库：标记用户开始自习
    if (user?.id) {
      try {
        console.log('🚀 [Study] 开始自习，更新数据库状态...');
        const { error } = await supabase
          .from('profiles')
          .update({ is_studying: true })
          .eq('id', user.id);
        
        if (error) {
          console.error('❌ [Study] 更新 is_studying 失败:', error);
        } else {
          console.log('✅ [Study] 已更新 is_studying = true');
        }
      } catch (err) {
        console.error('❌ [Study] 数据库更新异常:', err);
      }
    }
    
    // 跳转到计时器页面
    navigate(AppRoutes.TIMER, { state: { duration: selectedDuration } });
  };

  const handleStopFocus = async () => {
    // 更新数据库：标记用户停止自习
    if (user?.id) {
      try {
        console.log('🛑 [Study] 停止自习，更新数据库状态...');
        const { error } = await supabase
          .from('profiles')
          .update({ is_studying: false })
          .eq('id', user.id);
        
        if (error) {
          console.error('❌ [Study] 更新 is_studying 失败:', error);
        } else {
          console.log('✅ [Study] 已更新 is_studying = false');
        }
      } catch (err) {
        console.error('❌ [Study] 数据库更新异常:', err);
      }
    }
    
    // 返回自习室主页
    navigate(AppRoutes.STUDY);
  };

  const timeObj = formatTime(timeLeft);

  // 计时器视图 - 三明治分层法
  if (isTimer) {
    return (
      <div className="h-screen w-full relative overflow-hidden" style={{ background: 'transparent' }}>
        {/* 背景层：z-index: 0 */}
        <div
          className="fixed inset-0 w-full h-full"
          style={{ zIndex: 0, pointerEvents: 'none' }}
        >
          <img
            src={BG_IMAGE}
            alt="Background"
            className="w-full h-full object-cover"
            style={{ filter: 'blur(8px) brightness(0.4)' }}
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* 内容层：z-index: 10 */}
        <div className="relative z-10 flex flex-col h-full">
          {/* 关闭按钮 */}
          <button
            onClick={handleStopFocus}
            className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
          >
            <X size={20} className="text-white" />
          </button>

          {/* 计时器内容 */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-10">
            <div className="flex flex-col items-center">
              <div className="flex items-baseline justify-center gap-3 mb-8">
                <span className="text-8xl font-bold text-white tracking-tight" style={{ textShadow: '0 0 60px rgba(59,130,246,0.5)' }}>
                  {timeObj.m}
                </span>
                <span className="text-6xl font-bold text-blue-400 animate-pulse">:</span>
                <span className="text-8xl font-bold text-white tracking-tight" style={{ textShadow: '0 0 60px rgba(59,130,246,0.5)' }}>
                  {timeObj.s}
                </span>
              </div>

              <div className="mb-6 px-6 py-2.5 rounded-full bg-blue-500/20 backdrop-blur-xl border border-blue-400/20 shadow-lg">
                {isCompleted ? (
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className="text-yellow-400" />
                    <span className="text-base font-semibold text-white">专注完成</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm font-semibold text-blue-100">深度专注中...</span>
                  </div>
                )}
              </div>

              {isCompleted && (
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl flex flex-col items-center shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-1">太棒了！</h3>
                  <p className="text-blue-200 text-sm mb-4">获得 +50 积分</p>
                  <button
                    onClick={handleStopFocus}
                    className="bg-white text-slate-900 px-6 py-2.5 rounded-full font-semibold hover:scale-105 transition-transform shadow-lg"
                  >
                    返回自习室
                  </button>
                </div>
              )}
            </div>
          </div>

          {!isCompleted && (
            <div className="pb-16 flex justify-center">
              <button
                onClick={handleStopFocus}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/15 backdrop-blur-md border border-red-500/20 hover:bg-red-500/25 transition-all active:scale-95"
              >
                <X size={16} className="text-red-300" />
                <span className="text-sm font-medium text-red-300">放弃专注</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 主界面 - 分层布局重构
  return (
    <div className="h-screen w-full relative overflow-hidden" style={{ background: 'transparent' }}>
      {/* 背景层：z-index: 0 */}
      <div
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0, pointerEvents: 'none' }}
      >
        <img
          src={BG_IMAGE}
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />
      </div>

      {/* 内容层：z-index: 10 */}
      <div className="relative z-10 h-full">

        {/* 顶部导航栏 - Header */}
        <div className="px-6 pt-14 pb-4 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-blue-200 uppercase tracking-[0.2em] mb-1 flex items-center gap-1">
              <MapPin size={10} /> VIRTUAL SPACE
            </span>
            <h1 className="text-2xl font-bold text-white">自习室</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all active:scale-95">
              <Zap size={18} className="text-yellow-400" />
            </button>
            <button 
              onClick={() => setIsBuddyListOpen(true)}
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all active:scale-95"
            >
              <Plus size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* 自习伙伴列表 - Modal 弹窗 */}
        <StudyBuddiesList 
          isOpen={isBuddyListOpen} 
          onClose={() => setIsBuddyListOpen(false)} 
        />

        {/* 中部：Focus Timer 组件 - 绝对定位，z-index: 20 */}
        <div
          className="absolute top-32 left-6 z-20"
          style={{ maxWidth: '240px' }}
        >
          <div className="bg-black/30 backdrop-blur-xl border border-white/20 rounded-2xl p-3.5 shadow-2xl">
            {/* 标题 */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                <Timer size={14} className="text-white" />
              </div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-white/90">Focus Timer</span>
            </div>

            {/* 时间选择器 */}
            <div className="flex gap-1.5 mb-4 p-1 bg-black/20 rounded-full">
              {timePresets.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedDuration(time)}
                  className={`flex-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    selectedDuration === time
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {time}m
                </button>
              ))}
            </div>

            {/* 时间显示和开始按钮 */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-4xl font-bold text-white leading-none">{selectedDuration}</span>
                <span className="text-[9px] font-semibold text-white/60 uppercase tracking-wider mt-1">Minutes</span>
              </div>
              <button
                onClick={handleStartFocus}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all border border-white/20"
              >
                <Play fill="white" size={18} className="ml-0.5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* 底部：Today's Focus 统计卡片 - 绝对定位，右下角 */}
        <div
          className="absolute bottom-32 right-6 z-10"
          style={{ maxWidth: '200px' }}
        >
          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-lg">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md">
              <Zap size={16} fill="white" className="text-white" />
            </div>
            <div>
              <p className="text-[9px] font-semibold text-white/60 uppercase tracking-wide">Today's Focus</p>
              <p className="text-lg font-bold text-white">1<span className="text-xs font-medium opacity-60">h</span> 45<span className="text-xs font-medium opacity-60">m</span></p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
