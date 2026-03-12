import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppRoutes } from "../types";
import StudyRoom from "../components/StudyRoom";
import TimerView from "../features/study/components/TimerView";
import { supabase } from "../config/supabase";
import { useAuth } from "../contexts/AuthContext";
import { IMAGES } from "../constants";
import { SummaryModal } from "../features/study/components/SummaryModal";
import StudyHeader from "../features/study/components/StudyHeader";
import DurationSelector from "../features/study/components/DurationSelector";
import StudyStats from "../features/study/components/StudyStats";
import { PointsModal } from "../features/study/components/PointsModal";
import { FocusStartAnimation } from "../features/study/components/FocusStartAnimation";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { DynamicBackground } from "../components/DynamicBackground";
import { useStudyTimer, useCompanionSync, useStudySession } from "../features/study/hooks";
import { initializeUserPoints } from "../services/pointsService";
import { logger } from "../utils/logger";

const BG_IMAGE = IMAGES.ROOM_BG;

export default function Study() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const isTimer = location.pathname.includes("/timer");

  // 时长选择状态
  const [selectedDuration, setSelectedDuration] = useState(25);
  const timePresets = [25, 45, 60];

  // 累计专注时长状态
  const [totalStudyTime, setTotalStudyTime] = useState(0);

  // 好友列表弹窗状态
  const [isStudyRoomOpen, setIsStudyRoomOpen] = useState(false);

  // 结算弹窗状态
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [studyDuration, setStudyDuration] = useState(0);

  // 积分弹窗状态
  const [showPointsModal, setShowPointsModal] = useState(false);

  // 背景音乐播放器
  const audioPlayer = useAudioPlayer();

  // 专注开始动画状态
  const [showStartAnimation, setShowStartAnimation] = useState(false);

  // 防止重复触发的 ref
  const hasTriggeredSummaryRef = useRef(false);

  // ===== 使用自定义 Hooks =====

  // 计时器逻辑
  const {
    timeLeft,
    isActive: _isActive,
    isCompleted,
    initialDuration: _timerInitialDuration,
    startTimer: _startTimer,
    formatTime
  } = useStudyTimer({
    initialDuration: selectedDuration,
    isTimerPage: isTimer,
    onComplete: useCallback(() => {
      // 计时完成时自动触发结算
      if (!hasTriggeredSummaryRef.current) {
        setShowSummaryModal(true);
      }
    }, [])
  });

  // 好友同步逻辑
  const { companion } = useCompanionSync({
    userId: user?.id,
    isTimerPage: isTimer
  });

  // 专注会话管理（处理数据库更新和积分奖励）
  const {
    focusStartTime: _focusStartTime,
    initialDuration: sessionInitialDuration,
    startStudy,
    stopStudy,
    setFocusStartTime,
    setInitialDuration
  } = useStudySession({
    userId: user?.id,
    onSessionComplete: useCallback((minutes: number) => {
      setStudyDuration(minutes);
      setTotalStudyTime(prev => prev + minutes);
    }, [])
  });

  // ===== 查询累计专注时长 =====
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
          logger.study.error('查询 total_study_time 失败:', error);
        } else {
          setTotalStudyTime(data?.total_study_time || 0);
        }
      } catch (err) {
        logger.study.error('查询时长异常:', err);
      }
    };

    // 初始化用户积分
    initializeUserPoints(user.id).catch(err => {
      logger.study.error('初始化积分失败:', err);
    });

    fetchTotalStudyTime();
  }, [user?.id]);

  // ===== 事件处理函数 =====

  const handleStartFocus = useCallback(() => {
    // 重置触发标记
    hasTriggeredSummaryRef.current = false;
    // 触发开始动画
    setShowStartAnimation(true);
  }, []);

  const handleStartAnimationComplete = useCallback(async () => {
    setShowStartAnimation(false);

    // 开始专注
    await startStudy(selectedDuration);

    // 记录开始时间
    setFocusStartTime(Date.now());
    setInitialDuration(selectedDuration);

    // 跳转到计时器页面
    navigate(AppRoutes.STUDY_TIMER, {
      state: {
        duration: selectedDuration,
        companion
      }
    });
  }, [selectedDuration, companion, startStudy, setFocusStartTime, setInitialDuration, navigate]);

  const handleStopFocus = useCallback(async () => {
    if (hasTriggeredSummaryRef.current || showSummaryModal) {
      return;
    }

    hasTriggeredSummaryRef.current = true;
    audioPlayer.stop();

    // 停止专注并获取实际专注时长
    const studiedMinutes = await stopStudy();

    // 显示结算弹窗
    setStudyDuration(studiedMinutes);
    setShowSummaryModal(true);
  }, [audioPlayer, stopStudy, showSummaryModal]);

  const handleCloseButtonClick = useCallback(() => {
    if (showSummaryModal) {
      handleCloseSummary();
    } else {
      handleStopFocus();
    }
  }, [showSummaryModal, handleStopFocus]);

  const handleCloseSummary = useCallback(() => {
    setShowSummaryModal(false);

    // 重置计时器状态
    setFocusStartTime(null);
    setInitialDuration(25);
    setStudyDuration(0);

    // 返回自习室主页
    navigate(AppRoutes.STUDY);
  }, [navigate, setFocusStartTime, setInitialDuration]);

  const timeObj = formatTime(timeLeft);

  // ===== 渲染 =====

  // 计时器视图
  if (isTimer) {
    // 从 session hook 获取 initialDuration
    const duration = location.state?.duration || selectedDuration;

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
            initialDuration={sessionInitialDuration || duration}
            companion={companion}
            profile={profile || undefined}
            onClose={handleCloseSummary}
          />
        }
      />
    );
  }

  // 主界面
  return (
    <div className="h-screen w-full relative overflow-hidden" style={{ background: 'transparent' }}>
      {/* 背景层 */}
      <div className="fixed inset-0 w-full h-full" style={{ zIndex: 0, pointerEvents: 'none' }}>
        <img src={BG_IMAGE} alt="Background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />
      </div>

      {/* 动态背景 */}
      <DynamicBackground
        type="both"
        primaryColor="rgba(139, 92, 246, 0.12)"
        secondaryColor="rgba(236, 72, 153, 0.12)"
        particleCount={30}
      />

      {/* 内容层 */}
      <div className="relative z-10 h-full">
        {/* 顶部导航 */}
        <StudyHeader
          totalStudyTime={totalStudyTime}
          onBuddyListOpen={() => setIsStudyRoomOpen(true)}
          onPointsClick={() => setShowPointsModal(true)}
        />

        <StudyRoom isOpen={isStudyRoomOpen} onClose={() => setIsStudyRoomOpen(false)} />

        {/* 时长选择器 */}
        <DurationSelector
          timePresets={timePresets}
          selectedDuration={selectedDuration}
          onSelectDuration={setSelectedDuration}
          onStartFocus={handleStartFocus}
        />

        {/* 统计卡片 */}
        <StudyStats totalStudyTime={totalStudyTime} />
      </div>

      {/* 积分弹窗 */}
      {user?.id && (
        <PointsModal
          show={showPointsModal}
          onClose={() => setShowPointsModal(false)}
          userId={user.id}
        />
      )}

      {/* 专注开始动画 */}
      <FocusStartAnimation
        show={showStartAnimation}
        duration={selectedDuration}
        onComplete={handleStartAnimationComplete}
      />
    </div>
  );
}
