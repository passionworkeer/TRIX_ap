import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Plus, X, Play, Zap, Trophy, MapPin } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppRoutes } from "../types";
import StudyBuddiesList from "../components/StudyBuddiesList";
import Avatar from "../components/Avatar";
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";
import { IMAGES } from "../constants";
import { SummaryModal } from "../features/study/components/SummaryModal";

const BG_IMAGE = IMAGES.ROOM_BG;

interface CompanionInfo {
  id: string;
  username: string;
  avatar: string;
}

export default function Study() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth(); // 获取当前用户
  const isTimer = location.pathname.includes("/timer");

  // 🎯 使用 state 管理 companion 信息（支持从数据库查询）
  const [companion, setCompanion] = useState<CompanionInfo | undefined>(
    (location.state as any)?.companion as CompanionInfo | undefined
  );

  const [selectedDuration, setSelectedDuration] = useState(25);
  const timePresets = [25, 45, 60];

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // 🎯 追踪本次专注开始时间和初始时长
  const [focusStartTime, setFocusStartTime] = useState<number | null>(null);
  const [initialDuration, setInitialDuration] = useState(25);

  // 🏅 累计专注时长状态
  const [totalStudyTime, setTotalStudyTime] = useState(0); // 单位: 分钟

  // 好友列表弹窗状态
  const [isBuddyListOpen, setIsBuddyListOpen] = useState(false);

  // 🎉 结算弹窗状态
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [studyDuration, setStudyDuration] = useState(0); // 本次实际专注时长(分钟)

  // 🎯 使用 ref 追踪用户 ID 和自习状态
  const userIdRef = useRef(user?.id);
  const isStudyingRef = useRef(false);
  const hasTriggeredSummaryRef = useRef(false); // 🎯 防止重复弹出结算Modal
  const hasCompletedRef = useRef(false); // 🔒 一次性锁：确保完成逻辑只执行一次

  // 更新 userIdRef
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  // 🏅 查询累计专注时长
  useEffect(() => {
    if (!user?.id) return;

    const fetchTotalStudyTime = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('total_study_time')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('❌ [Study] 查询 total_study_time 失败:', error);
        } else {
          setTotalStudyTime(data?.total_study_time || 0);
          console.log('📊 [Study] 累计专注时长:', data?.total_study_time, '分钟');
        }
      } catch (err) {
        console.error('❌ [Study] 查询时长异常:', err);
      }
    };

    fetchTotalStudyTime();
  }, [user?.id]);

  // 🧹 浏览器关闭/刷新时清理自习状态
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (isStudyingRef.current && userIdRef.current) {
        console.log('🌐 [Study] 浏览器关闭，清理自习状态...');
        
        // 🎯 获取当前用户的 companion_id
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('companion_id')
          .eq('id', userIdRef.current)
          .single();

        const companionId = myProfile?.companion_id;

        // 清理自己的状态
        await supabase
          .from('profiles')
          .update({ 
            is_studying: false,
            companion_id: null 
          })
          .eq('id', userIdRef.current);

        // 如果有好友，也清除好友的关联
        if (companionId) {
          await supabase
            .from('profiles')
            .update({ companion_id: null })
            .eq('id', companionId);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 🎯 查询 companion 信息的函数（使用 useCallback 避免重复创建）
  const fetchCompanionInfo = useCallback(async () => {
    if (!user?.id) return;

    try {
      // 1. 查询自己的 companion_id
      const { data: myProfile, error: profileError } = await supabase
        .from('profiles')
        .select('companion_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ [Study] 查询 companion_id 失败:', profileError);
        return;
      }

      console.log('📊 [Study] 我的 companion_id:', myProfile?.companion_id);

      if (!myProfile?.companion_id) {
        console.log('⚠️ [Study] 没有 companion_id，单人自习模式');
        // 🎯 使用函数式更新，避免依赖 companion 状态
        setCompanion(prev => {
          // 只有当前有 companion 时才清除，避免不必要的重渲染
          return prev ? undefined : prev;
        });
        return;
      }

      // 2. 查询好友的信息
      const { data: companionProfile, error: companionError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', myProfile.companion_id)
        .single();

      if (companionError) {
        console.error('❌ [Study] 查询好友信息失败:', companionError);
        return;
      }

      console.log('✅ [Study] 成功查询到好友信息:', companionProfile);

      // 3. 设置 companion 状态（使用函数式更新）
      const newCompanion = {
        id: companionProfile.id,
        username: companionProfile.username || 'Unknown',
        avatar: companionProfile.avatar_url || ''
      };

      setCompanion(prev => {
        // 🎯 只有 companion 信息变化时才更新
        if (!prev ||
            prev.id !== newCompanion.id ||
            prev.username !== newCompanion.username ||
            prev.avatar !== newCompanion.avatar) {
          return newCompanion;
        }
        return prev; // 返回旧值，避免重渲染
      });

    } catch (err) {
      console.error('❌ [Study] 查询 companion 异常:', err);
    }
  }, [user?.id]); // 依赖数组保持简单

  // 🎯 初始加载：从 location.state 或数据库获取 companion
  useEffect(() => {
    if (!isTimer) return;
    
    // 如果 location.state 有数据，直接使用
    if ((location.state as any)?.companion) {
      console.log('📦 [Study] 使用 location.state 的 companion 数据');
      setCompanion((location.state as any).companion);
    } else {
      // 否则从数据库查询
      console.log('🔍 [Study] location.state 没有 companion，从数据库查询...');
      fetchCompanionInfo();
    }
  }, [isTimer, fetchCompanionInfo]); // 添加 fetchCompanionInfo 依赖

  // 🔄 定时轮询：每 3 秒检查一次 companion_id（Realtime 的兜底方案）
  useEffect(() => {
    if (!isTimer || !user?.id) return;

    console.log('⏰ [Study] 启动定时轮询（3秒间隔）');

    const pollInterval = setInterval(() => {
      console.log('🔄 [Study] 轮询检查 companion_id...');
      fetchCompanionInfo();
    }, 3000); // 3 秒轮询一次

    return () => {
      console.log('🧹 [Study] 清理定时轮询');
      clearInterval(pollInterval);
    };
  }, [isTimer, fetchCompanionInfo]); // 添加 fetchCompanionInfo 依赖

  // 🔔 实时监听 companion_id 变化（作为快速响应）
  useEffect(() => {
    if (!isTimer || !user?.id) return;

    console.log('🔌 [Study] 启动 Realtime 监听 companion_id 变化');

    const channel = supabase
      .channel(`study-companion-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}` // 只监听自己的记录
        },
        (payload) => {
          console.log('🔥 [Study] 检测到自己的 profile 更新:', payload);

          // 🎯 检查 companion_id 是否真的变化了
          if ('companion_id' in payload.new && payload.old?.companion_id !== payload.new.companion_id) {
            const newCompanionId = payload.new.companion_id;
            console.log(`📊 [Study] companion_id 变化: ${payload.old?.companion_id} → ${newCompanionId}`);
            
            if (newCompanionId) {
              // 有人加入了我的自习室，查询好友信息
              console.log('🎉 [Study] 有好友加入了自习室，查询信息...');
              
              supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', newCompanionId)
                .single()
                .then(({ data, error }) => {
                  if (error) {
                    console.error('❌ [Study] 查询加入者信息失败:', error);
                    return;
                  }
                  
                  if (data) {
                    console.log('✅ [Study] 成功获取加入者信息，更新显示');
                    setCompanion({
                      id: data.id,
                      username: data.username || 'Unknown',
                      avatar: data.avatar_url || ''
                    });
                  }
                });
            } else {
              // 好友离开了自习室
              console.log('👋 [Study] 好友离开了自习室');
              setCompanion(undefined);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [Study] Realtime 订阅状态: ${status}`);
      });

    return () => {
      console.log('🧹 [Study] 清理 Realtime 订阅');
      supabase.removeChannel(channel);
    };
  }, [isTimer, user?.id]);

  // 🔍 调试：打印 companion 最终状态
  useEffect(() => {
    console.log('=== [Study] Companion 状态调试 ===');
    console.log('📍 Is Timer Page:', isTimer);
    console.log('👤 User ID:', user?.id);
    console.log('🤝 Companion Data:', companion);
    console.log('⏱️ Focus Start Time:', focusStartTime ? new Date(focusStartTime).toLocaleTimeString() : 'null');
    console.log('⏱️ Initial Duration:', initialDuration);
    console.log('================================');
  }, [isTimer, user?.id, companion, focusStartTime, initialDuration]);

  useEffect(() => {
    if (isTimer) {
      const duration = location.state?.duration || 25;
      setTimeLeft(duration * 60);
      setIsActive(true);
      setIsCompleted(false);

      // 🎯 每次进入计时器页面时都重新初始化开始时间
      const startTime = Date.now();
      console.log('⏱️ [Study] 初始化专注计时:', { duration, startTime });
      setFocusStartTime(startTime);
      setInitialDuration(duration);

      // ❌ 不在这里重置标记！这会导致弹窗反复触发
      // 标记重置应该在 handleStartFocus 中进行
    } else {
      setIsActive(false);
    }
  }, [isTimer, location.state?.duration]);

  useEffect(() => {
    let interval: any = null;
    
    if (isTimer && isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive && !hasCompletedRef.current) {
      // ⚡ 倒计时结束，触发完成逻辑（只执行一次）
      console.log('🛑 [Study] 倒计时结束，触发结算');
      
      hasCompletedRef.current = true; // 🔒 立即上锁
      setIsActive(false);
      setIsCompleted(true);
      
      // 🎯 不调用 handleStopFocus，避免闭包和重渲染问题
      // 只设置一个标记，让另一个 useEffect 处理
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimer, isActive, timeLeft]);

  // 🎉 监听完成状态，触发结算（使用独立的 useEffect）
  useEffect(() => {
    if (isCompleted && isTimer && !hasTriggeredSummaryRef.current) {
      console.log('🎊 [Study] 专注完成，触发结算Modal');
      hasTriggeredSummaryRef.current = true;
      handleStopFocus();
    }
  }, [isCompleted, isTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return {
      m: mins.toString().padStart(2, "0"),
      s: secs.toString().padStart(2, "0")
    };
  };

  const handleStartFocus = async () => {
    // 🔓 重置所有触发标记（重新开始专注时解锁）
    hasTriggeredSummaryRef.current = false;
    hasCompletedRef.current = false;

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
          // 🎯 标记正在自习
          isStudyingRef.current = true;
        }
      } catch (err) {
        console.error('❌ [Study] 数据库更新异常:', err);
      }
    }
    
    // 🎯 记录开始时间和初始时长
    setFocusStartTime(Date.now());
    setInitialDuration(selectedDuration);
    
    // 跳转到计时器页面
    navigate(AppRoutes.TIMER, { 
      state: { 
        duration: selectedDuration,
        companion: companion // 携带 companion 信息
      } 
    });
  };

  // 🎉 停止专注并显示结算（统一入口）
  const handleStopFocus = async () => {
    // 🛡️ 防止重复调用（更强的检查：检查标记和弹窗状态）
    if (hasTriggeredSummaryRef.current || showSummaryModal) {
      console.log('⚠️ [Study] 结算已触发或弹窗已显示，跳过重复调用');
      return;
    }

    hasTriggeredSummaryRef.current = true; // 🎯 立即标记，防止并发调用
    setIsActive(false); // ⚡ 停止计时器
    setShowSummaryModal(true); // ⚡ 立即显示弹窗，防止异步操作期间重复触发

    // 🏅 计算本次专注时长并保存
    let studiedMinutes = 0;
    
    console.log('🔍 [Study] 计算专注时长 - 当前状态:', {
      focusStartTime,
      initialDuration,
      currentTime: Date.now(),
      hasStartTime: !!focusStartTime
    });
    
    if (focusStartTime && initialDuration) {
      const elapsedMs = Date.now() - focusStartTime;
      const elapsedMinutes = Math.floor(elapsedMs / 60000); // 转换为分钟
      // 至少完成1分钟才算有效专注
      studiedMinutes = Math.min(elapsedMinutes, initialDuration);
      console.log(`📊 [Study] 本次专注时长计算:`, {
        开始时间: new Date(focusStartTime).toLocaleTimeString(),
        当前时间: new Date().toLocaleTimeString(),
        经过毫秒: elapsedMs,
        经过分钟: elapsedMinutes,
        设定时长: initialDuration,
        最终时长: studiedMinutes
      });
    } else {
      console.warn('⚠️ [Study] 无法计算时长 - 缺少必要数据:', {
        focusStartTime,
        initialDuration
      });
    }

    // 🎉 保存专注时长用于结算显示
    setStudyDuration(studiedMinutes);

    // 更新数据库：标记用户停止自习,并清除双向关联
    if (user?.id) {
      try {
        console.log('🛑 [Study] 停止自习,更新数据库状态...');
        
        // 🎯 获取当前用户的 companion_id 和 total_study_time
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('companion_id, total_study_time')
          .eq('id', user.id)
          .single();

        const companionId = myProfile?.companion_id;
        const currentTotal = myProfile?.total_study_time || 0;

        // 🎯 取消自习标记
        isStudyingRef.current = false;
        
        // 🏅 累加专注时长
        const newTotal = currentTotal + studiedMinutes;
        console.log(`🏅 [Study] 累计专注时长: ${currentTotal} + ${studiedMinutes} = ${newTotal} 分钟`);
        
        // 1. 更新自己的状态：清除 is_studying 和 companion_id,累加时长
        const { error } = await supabase
          .from('profiles')
          .update({ 
            is_studying: false,
            companion_id: null,
            total_study_time: newTotal
          })
          .eq('id', user.id);
        
        if (error) {
          console.error('❌ [Study] 更新自己的状态失败:', error);
        } else {
          console.log('✅ [Study] 已更新 is_studying = false, companion_id = null, total_study_time =', newTotal);
          // 🎉 更新前端显示的总时长
          setTotalStudyTime(newTotal);
        }

        // 2. 如果有好友在一起自习,也清除好友的 companion_id
        if (companionId) {
          console.log(`🔗 [Study] 清除好友 ${companionId} 的关联`);
          const { error: companionError } = await supabase
            .from('profiles')
            .update({ companion_id: null })
            .eq('id', companionId);
          
          if (companionError) {
            console.error('❌ [Study] 清除好友关联失败:', companionError);
          } else {
            console.log('✅ [Study] 已清除好友的 companion_id');
          }
        }
      } catch (err) {
        console.error('❌ [Study] 数据库更新异常:', err);
      }
    }
    // ⚠️ 不需要在这里再次调用 setShowSummaryModal(true)
    // 因为已经在函数开头设置过了
  };

  // 🎯 顶部关闭按钮的处理函数
  const handleCloseButtonClick = () => {
    if (showSummaryModal) {
      // 如果弹窗已显示，关闭弹窗
      handleCloseSummary();
    } else {
      // 否则，停止专注并显示结算
      handleStopFocus();
    }
  };

  // 🎉 关闭结算弹窗并返回主页
  const handleCloseSummary = () => {
    setShowSummaryModal(false);

    // 🧹 重置计时器状态
    setFocusStartTime(null);
    setInitialDuration(25);
    setStudyDuration(0);

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

        {/* 🎉 结算Modal */}
        <SummaryModal
          show={showSummaryModal}
          studyDuration={studyDuration}
          initialDuration={initialDuration}
          companion={companion}
          profile={profile || undefined}
          onClose={handleCloseSummary}
        />

        {/* 内容层：z-index: 10 */}
        <div className="relative z-10 flex flex-col h-full">
          {/* 关闭按钮 */}
          <button
            onClick={handleCloseButtonClick}
            className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
          >
            <X size={20} className="text-white" />
          </button>

          {/* 计时器内容 */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-10">
            <div className="flex flex-col items-center">
              {/* 好友头像显示 */}
              {companion && (
                <div className="mb-8 flex flex-col items-center gap-4">
                  {/* 头像和连接线 */}
                  <div className="flex items-center gap-6">
                    {/* 我的头像 */}
                    <div className="flex flex-col items-center">
                      <div className="rounded-full ring-4 ring-blue-500/50 shadow-lg shadow-blue-500/30">
                        <Avatar
                          name={profile?.username || user?.email?.split('@')[0] || 'Me'}
                          avatar={profile?.avatar_url}
                          size="xl"
                        />
                      </div>
                      <span className="text-sm text-white/80 mt-2 font-medium">{profile?.username || '我'}</span>
                    </div>

                    {/* 连接线 */}
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shadow-lg shadow-purple-400/50"></div>
                      <div className="w-10 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse"></div>
                    </div>

                    {/* 好友头像 */}
                    <div className="flex flex-col items-center">
                      <div className="rounded-full ring-4 ring-purple-500/50 shadow-lg shadow-purple-500/30">
                        <Avatar
                          name={companion.username}
                          avatar={companion.avatar}
                          size="xl"
                        />
                      </div>
                      <span className="text-sm text-white/80 mt-2 font-medium">{companion.username}</span>
                    </div>
                  </div>
                  
                  {/* 共同专注提示 */}
                  <div className="px-4 py-2 rounded-full bg-purple-500/20 backdrop-blur-xl border border-purple-400/30 shadow-lg">
                    <p className="text-sm font-medium text-purple-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                      正在与 <span className="font-bold">{companion.username}</span> 共同专注中
                    </p>
                  </div>
                </div>
              )}

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
              <p className="text-[9px] font-semibold text-white/60 uppercase tracking-wide">Total Focus</p>
              <p className="text-lg font-bold text-white">
                {Math.floor(totalStudyTime / 60)}
                <span className="text-xs font-medium opacity-60">h</span> {totalStudyTime % 60}
                <span className="text-xs font-medium opacity-60">m</span>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
