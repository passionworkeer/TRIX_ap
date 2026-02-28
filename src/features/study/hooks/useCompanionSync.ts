import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../../config/supabase';

export interface CompanionInfo {
  id: string;
  username: string;
  avatar: string;
}

interface UseCompanionSyncOptions {
  /** 用户 ID */
  userId: string | undefined;
  /** 是否在计时器页面 */
  isTimerPage: boolean;
}

interface UseCompanionSyncReturn {
  /** 同伴信息 */
  companion: CompanionInfo | undefined;
  /** 设置同伴 */
  setCompanion: React.Dispatch<React.SetStateAction<CompanionInfo | undefined>>;
  /** 手动获取同伴信息 */
  fetchCompanionInfo: () => Promise<void>;
}

/**
 * useCompanionSync - 好友同步 Hook
 *
 * 管理自习室好友的实时同步
 */
export function useCompanionSync(options: UseCompanionSyncOptions): UseCompanionSyncReturn {
  const { userId, isTimerPage } = options;
  const location = useLocation();

  const [companion, setCompanion] = useState<CompanionInfo | undefined>(() => {
    // 从路由状态初始化
    return (location.state as any)?.companion as CompanionInfo | undefined;
  });

  // 防止重复查询的 ref
  const lastCompanionIdRef = useRef<string | null>(null);

  /**
   * 查询 companion 信息
   */
  const fetchCompanionInfo = useCallback(async () => {
    if (!userId) return;

    try {
      // 1. 查询自己的 companion_id
      const { data: myProfile, error: profileError } = await supabase
        .from('profiles')
        .select('companion_id')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ [useCompanionSync] 查询 companion_id 失败:', profileError);
        return;
      }

      console.log('📊 [useCompanionSync] 我的 companion_id:', myProfile?.companion_id);

      if (!myProfile?.companion_id) {
        console.log('⚠️ [useCompanionSync] 没有 companion_id，单人自习模式');
        setCompanion(prev => prev ? undefined : prev);
        lastCompanionIdRef.current = null;
        return;
      }

      // 避免重复查询相同的 companion
      if (lastCompanionIdRef.current === myProfile.companion_id) {
        return;
      }
      lastCompanionIdRef.current = myProfile.companion_id;

      // 2. 查询好友的信息
      const { data: companionProfile, error: companionError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', myProfile.companion_id)
        .single();

      if (companionError) {
        console.error('❌ [useCompanionSync] 查询好友信息失败:', companionError);
        return;
      }

      console.log('✅ [useCompanionSync] 成功查询到好友信息:', companionProfile);

      // 3. 设置 companion 状态
      const newCompanion: CompanionInfo = {
        id: companionProfile.id,
        username: companionProfile.username || 'Unknown',
        avatar: companionProfile.avatar_url || ''
      };

      setCompanion(prev => {
        if (!prev ||
            prev.id !== newCompanion.id ||
            prev.username !== newCompanion.username ||
            prev.avatar !== newCompanion.avatar) {
          return newCompanion;
        }
        return prev;
      });

    } catch (err) {
      console.error('❌ [useCompanionSync] 查询 companion 异常:', err);
    }
  }, [userId]);

  // 初始加载：从 location.state 或数据库获取 companion
  useEffect(() => {
    if (!isTimerPage) return;

    if ((location.state as any)?.companion) {
      console.log('📦 [useCompanionSync] 使用 location.state 的 companion 数据');
      setCompanion((location.state as any).companion);
      lastCompanionIdRef.current = ((location.state as any).companion as CompanionInfo).id;
    } else {
      console.log('🔍 [useCompanionSync] location.state 没有 companion，从数据库查询...');
      fetchCompanionInfo();
    }
  }, [isTimerPage, fetchCompanionInfo, location.state]);

  // Realtime 监听 companion_id 变化
  useEffect(() => {
    if (!isTimerPage || !userId) return;

    console.log('🔌 [useCompanionSync] 启动 Realtime 监听 companion_id 变化');

    const channel = supabase
      .channel(`study-companion-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          console.log('🔥 [useCompanionSync] 检测到自己的 profile 更新:', payload);

          if ('companion_id' in payload.new && payload.old?.companion_id !== payload.new.companion_id) {
            const newCompanionId = payload.new.companion_id;
            console.log(`📊 [useCompanionSync] companion_id 变化: ${payload.old?.companion_id} → ${newCompanionId}`);

            if (newCompanionId) {
              // 有人加入了自习室
              console.log('🎉 [useCompanionSync] 有好友加入了自习室，查询信息...');

              supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', newCompanionId)
                .single()
                .then(({ data, error }) => {
                  if (error) {
                    console.error('❌ [useCompanionSync] 查询加入者信息失败:', error);
                    return;
                  }

                  if (data) {
                    console.log('✅ [useCompanionSync] 成功获取加入者信息，更新显示');
                    lastCompanionIdRef.current = newCompanionId;
                    setCompanion({
                      id: data.id,
                      username: data.username || 'Unknown',
                      avatar: data.avatar_url || ''
                    });
                  }
                });
            } else {
              // 好友离开了自习室
              console.log('👋 [useCompanionSync] 好友离开了自习室');
              lastCompanionIdRef.current = null;
              setCompanion(undefined);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [useCompanionSync] Realtime 订阅状态: ${status}`);
      });

    return () => {
      console.log('🧹 [useCompanionSync] 清理 Realtime 订阅');
      supabase.removeChannel(channel);
    };
  }, [isTimerPage, userId]);

  return {
    companion,
    setCompanion,
    fetchCompanionInfo
  };
}
