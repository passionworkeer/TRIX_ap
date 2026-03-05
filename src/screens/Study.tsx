import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppRoutes } from "../types";
import StudyRoom from "../components/StudyRoom";
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";
import { IMAGES } from "../constants";
import { SummaryModal } from "../features/study/components/SummaryModal";
import TimerView from "../features/study/components/TimerView";
import StudyHeader from "../features/study/components/StudyHeader";
import DurationSelector from "../features/study/components/DurationSelector";
import StudyStats from "../features/study/components/StudyStats";
import { PointsModal } from "../features/study/components/PointsModal";
import { FocusStartAnimation } from "../features/study/components/FocusStartAnimation";
import { rewardStudyCompletion, initializeUserPoints } from "../services/pointsService";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { DynamicBackground } from "../components/DynamicBackground";
import { logger } from "../utils/logger";

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
  const [isStudyRoomOpen, setIsStudyRoomOpen] = useState(false);

  // 🎉 结算弹窗状态
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [studyDuration, setStudyDuration] = useState(0); // 本次实际专注时长(分钟)

  // 💎 积分弹窗状态
  const [showPointsModal, setShowPointsModal] = useState(false);

  // 🎵 背景音乐播放器
  const audioPlayer = useAudioPlayer();

  // ✨ 专注开始动画状态
  const [showStartAnimation, setShowStartAnimation] = useState(false);

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
          logger.study.error('❌ [Study] 查询 total_study_time 失败:', error);
        } else {
          setTotalStudyTime(data?.total_study_time || 0);
          logger.study.debug('📊 [Study] 累计专注时长:', data?.total_study_time, '分钟');
        }
      } catch (err) {
        logger.study.error('❌ [Study] 查询时长异常:', err);
      }
    };

    // 💎 初始化用户积分（如果是新用户）
    initializeUserPoints(user.id).catch(err => {
      logger.study.error('❌ [Study] 初始化积分失败:', err);
    });

    fetchTotalStudyTime();
  }, [user?.id]);

  // 🧹 浏览器关闭/刷新时清理自习状态
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (isStudyingRef.current && userIdRef.current) {
        logger.study.debug('🌐 [Study] 浏览器关闭，清理自习状态...');
        
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
        logger.study.error('❌ [Study] 查询 companion_id 失败:', profileError);
        return;
      }

      logger.study.debug('📊 [Study] 我的 companion_id:', myProfile?.companion_id);

      if (!myProfile?.companion_id) {
        logger.study.debug('⚠️ [Study] 没有 companion_id，单人自习模式');
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
        logger.study.error('❌ [Study] 查询好友信息失败:', companionError);
        return;
      }

      logger.study.debug('✅ [Study] 成功查询到好友信息:', companionProfile);

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
      logger.study.error('❌ [Study] 查询 companion 异常:', err);
    }
  }, [user?.id]); // 依赖数组保持简单

  // 🎯 初始加载：从 location.state 或数据库获取 companion
  useEffect(() => {
    if (!isTimer) return;
    
    // 如果 location.state 有数据，直接使用
    if ((location.state as any)?.companion) {
      logger.study.debug('📦 [Study] 使用 location.state 的 companion 数据');
      setCompanion((location.state as any).companion);
    } else {
      // 否则从数据库查询
      logger.study.debug('🔍 [Study] location.state 没有 companion，从数据库查询...');
      fetchCompanionInfo();
    }
  }, [isTimer, fetchCompanionInfo]); // 添加 fetchCompanionInfo 依赖

  // 🔔 实时监听 companion_id 变化（作为快速响应）
  useEffect(() => {
    if (!isTimer || !user?.id) return;

    logger.study.debug('🔌 [Study] 启动 Realtime 监听 companion_id 变化');

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
          logger.study.debug('🔥 [Study] 检测到自己的 profile 更新:', payload);

          // 🎯 检查 companion_id 是否真的变化了
          if ('companion_id' in payload.new && payload.old?.companion_id !== payload.new.companion_id) {
            const newCompanionId = payload.new.companion_id;
            logger.study.debug(`📊 [Study] companion_id 变化: ${payload.old?.companion_id} → ${newCompanionId}`);
            
            if (newCompanionId) {
              // 有人加入了我的自习室，查询好友信息
              logger.study.debug('🎉 [Study] 有好友加入了自习室，查询信息...');
              
              supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', newCompanionId)
                .single()
                .then(({ data, error }) => {
                  if (error) {
                    logger.study.error('❌ [Study] 查询加入者信息失败:', error);
                    return;
                  }
                  
                  if (data) {
                    logger.study.debug('✅ [Study] 成功获取加入者信息，更新显示');
                    setCompanion({
                      id: data.id,
                      username: data.username || 'Unknown',
                      avatar: data.avatar_url || ''
                    });
                  }
                });
            } else {
              // 好友离开了自习室
              logger.study.debug('👋 [Study] 好友离开了自习室');
              setCompanion(undefined);
            }
          }
        }
      )
      .subscribe((status) => {
        logger.study.debug(`📡 [Study] Realtime 订阅状态: ${status}`);
      });

    return () => {
      logger.study.debug('🧹 [Study] 清理 Realtime 订阅');
      supabase.removeChannel(channel);
    };
  }, [isTimer, user?.id]);

  // 🔍 调试：打印 companion 最终状态
  useEffect(() => {
    logger.study.debug('=== [Study] Companion 状态调试 ===');
    logger.study.debug('📍 Is Timer Page:', isTimer);
    logger.study.debug('👤 User ID:', user?.id);
    logger.study.debug('🤝 Companion Data:', companion);
    logger.study.debug('⏱️ Focus Start Time:', focusStartTime ? new Date(focusStartTime).toLocaleTimeString() : 'null');
    logger.study.debug('⏱️ Initial Duration:', initialDuration);
    logger.study.debug('================================');
  }, [isTimer, user?.id, companion, focusStartTime, initialDuration]);

  useEffect(() => {
    if (isTimer) {
      const duration = location.state?.duration || 25;
      setTimeLeft(duration * 60);
      setIsActive(true);
      setIsCompleted(false);

      // 🎯 每次进入计时器页面时都重新初始化开始时间
      const startTime = Date.now();
      logger.study.debug('⏱️ [Study] 初始化专注计时:', { duration, startTime });
      setFocusStartTime(startTime);
      setInitialDuration(duration);

      // ❌ 不在这里重置标记！这会导致弹窗反复触发
      // 标记重置应该在 handleStartFocus 中进行
    } else {
      setIsActive(false);
    }
  }, [isTimer, location.state?.duration]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (isTimer && isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive && !hasCompletedRef.current) {
      // ⚡ 倒计时结束，触发完成逻辑（只执行一次）
      logger.study.debug('🛑 [Study] 倒计时结束，触发结算');
      
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
      logger.study.debug('🎊 [Study] 专注完成，触发结算Modal');
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

    // 🎯 触发开始动画
    setShowStartAnimation(true);
  };

  // 🎬 动画完成后跳转到计时器页面
  const handleStartAnimationComplete = async () => {
    setShowStartAnimation(false);

    // 更新数据库：标记用户开始自习
    if (user?.id) {
      try {
        logger.study.debug('🚀 [Study] 开始自习，更新数据库状态...');
        const { error } = await supabase
          .from('profiles')
          .update({ is_studying: true })
          .eq('id', user.id);

        if (error) {
          logger.study.error('❌ [Study] 更新 is_studying 失败:', error);
        } else {
          logger.study.debug('✅ [Study] 已更新 is_studying = true');
          // 🎯 标记正在自习
          isStudyingRef.current = true;
        }
      } catch (err) {
        logger.study.error('❌ [Study] 数据库更新异常:', err);
      }
    }

    // 🎯 记录开始时间和初始时长
    setFocusStartTime(Date.now());
    setInitialDuration(selectedDuration);

    // 跳转到计时器页面
    navigate('/study/timer', {
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
      logger.study.debug('⚠️ [Study] 结算已触发或弹窗已显示，跳过重复调用');
      return;
    }

    hasTriggeredSummaryRef.current = true; // 🎯 立即标记，防止并发调用
    setIsActive(false); // ⚡ 停止计时器
    audioPlayer.stop(); // 🎵 停止背景音乐
    setShowSummaryModal(true); // ⚡ 立即显示弹窗，防止异步操作期间重复触发

    // 🏅 计算本次专注时长并保存
    let studiedMinutes = 0;
    
    logger.study.debug('🔍 [Study] 计算专注时长 - 当前状态:', {
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
      logger.study.debug(`📊 [Study] 本次专注时长计算:`, {
        开始时间: new Date(focusStartTime).toLocaleTimeString(),
        当前时间: new Date().toLocaleTimeString(),
        经过毫秒: elapsedMs,
        经过分钟: elapsedMinutes,
        设定时长: initialDuration,
        最终时长: studiedMinutes
      });
    } else {
      logger.study.warn('⚠️ [Study] 无法计算时长 - 缺少必要数据:', {
        focusStartTime,
        initialDuration
      });
    }

    // 🎉 保存专注时长用于结算显示
    setStudyDuration(studiedMinutes);

    // 💎 奖励积分（每分钟2积分）
    if (user?.id && studiedMinutes > 0) {
      try {
        const pointsEarned = await rewardStudyCompletion(user.id, studiedMinutes);
        logger.study.debug(`💎 [Study] 已奖励 ${pointsEarned} 积分`);
      } catch (error) {
        logger.study.error('❌ [Study] 奖励积分失败:', error);
        // 积分奖励失败不影响学习流程，仅记录错误
      }
    }

    // 更新数据库：标记用户停止自习,并清除双向关联
    if (user?.id) {
      try {
        logger.study.debug('🛑 [Study] 停止自习,更新数据库状态...');
        
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
        logger.study.debug(`🏅 [Study] 累计专注时长: ${currentTotal} + ${studiedMinutes} = ${newTotal} 分钟`);
        
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
          logger.study.error('❌ [Study] 更新自己的状态失败:', error);
          return; // 停止执行，避免数据不一致
        } else {
          logger.study.debug('✅ [Study] 已更新 is_studying = false, companion_id = null, total_study_time =', newTotal);
          // 🎉 更新前端显示的总时长
          setTotalStudyTime(newTotal);
        }

        // 2. 如果有好友在一起自习,也清除好友的 companion_id
        if (companionId) {
          logger.study.debug(`🔗 [Study] 清除好友 ${companionId} 的关联`);
          const { error: companionError } = await supabase
            .from('profiles')
            .update({ companion_id: null })
            .eq('id', companionId);
          
          if (companionError) {
            logger.study.error('❌ [Study] 清除好友关联失败:', companionError);
          } else {
            logger.study.debug('✅ [Study] 已清除好友的 companion_id');
          }
        }
      } catch (err) {
        logger.study.error('❌ [Study] 数据库更新异常:', err);
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

  // 计时器视图
  if (isTimer) {
    return (
      <TimerView
        timeObj={timeObj}
        isCompleted={isCompleted}
        companion={companion}
        profile={profile || undefined}
        userEmail={user?.email}
        onCloseClick={handleCloseButtonClick}
        onStopFocus={handleStopFocus}
        audioPlayer={audioPlayer}
        summaryModal={
          <SummaryModal
            show={showSummaryModal}
            studyDuration={studyDuration}
            initialDuration={initialDuration}
            companion={companion}
            profile={profile || undefined}
            onClose={handleCloseSummary}
          />
        }
      />
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

      {/* 动态背景效果 */}
      <DynamicBackground
        type="both"
        primaryColor="rgba(139, 92, 246, 0.12)"
        secondaryColor="rgba(236, 72, 153, 0.12)"
        particleCount={30}
      />

      {/* 内容层：z-index: 10 */}
      <div className="relative z-10 h-full">
        {/* 顶部导航栏 - Header */}
        <StudyHeader
          totalStudyTime={totalStudyTime}
          onBuddyListOpen={() => setIsStudyRoomOpen(true)}
          onPointsClick={() => setShowPointsModal(true)}
        />

        <StudyRoom
          isOpen={isStudyRoomOpen}
          onClose={() => setIsStudyRoomOpen(false)}
        />

        {/* 中部：Focus Timer 组件 - 绝对定位，z-index: 20 */}
        <DurationSelector
          timePresets={timePresets}
          selectedDuration={selectedDuration}
          onSelectDuration={setSelectedDuration}
          onStartFocus={handleStartFocus}
        />

        {/* 底部：Today's Focus 统计卡片 - 绝对定位，右下角 */}
        <StudyStats totalStudyTime={totalStudyTime} />

      </div>

      {/* 💎 积分弹窗 */}
      {user?.id && (
        <PointsModal
          show={showPointsModal}
          onClose={() => setShowPointsModal(false)}
          userId={user.id}
        />
      )}

      {/* ✨ 专注开始动画 */}
      <FocusStartAnimation
        show={showStartAnimation}
        duration={selectedDuration}
        onComplete={handleStartAnimationComplete}
      />
    </div>
  );
}
