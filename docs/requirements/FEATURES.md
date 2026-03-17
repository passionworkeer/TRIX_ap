# TRIX 3D Companion - 功能文档

> **最后更新**: 2026-03-17

---

## 目录

1. [双向自习功能](#1-双向自习功能-study-buddies)
2. [专注时长持久化 & 陪伴模式](#2-专注时长持久化--陪伴模式-focus--companion)
3. [学习室结算弹窗](#3-学习室结算弹窗-study-summary-modal)

---

## 1. 双向自习功能 (Study Buddies)

> **版本**: v1.0
> **最后更新**: 2026-02-11

### 功能概述

**双向自习**允许用户加入好友的自习室，实时看到彼此的学习状态：

- 🔄 **状态同步**: 用户开始/停止自习时，自动更新到数据库
- 👥 **伙伴列表**: 显示所有正在自习的好友
- 🔗 **双向关联**: 用户 A 加入用户 B 的自习室时，建立双向连接
- 📡 **实时更新**: 使用 Supabase Realtime 实现状态实时推送

### 数据流

```
┌─────────────┐       开始自习      ┌──────────────┐
│  用户 A     │ ──────────────────> │  Database    │
│             │ <──────────────────  │              │
└─────────────┘      Realtime       └──────────────┘
       │                                   │
       │     加入自习室                 │
       └──────────────────────────────────┘
                  ┌─────────────┐
                  │  用户 B     │
                  └─────────────┘
```

### 核心实现

#### 1. 数据库表结构

```sql
-- 自习室表
CREATE TABLE study_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 自习室成员表
CREATE TABLE study_room_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'studying', -- 'studying', 'paused', 'left'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);
```

#### 2. 状态同步逻辑

```typescript
// 开始自习时
async function startStudyRoom(userId: string) {
  // 1. 创建或获取自习室
  const { data: room } = await supabase
    .from('study_rooms')
    .upsert({ host_id: userId, is_active: true })
    .select();

  // 2. 添加成员
  await supabase
    .from('study_room_members')
    .upsert({
      room_id: room.id,
      user_id: userId,
      status: 'studying'
    });

  // 3. 订阅实时更新
  supabase
    .channel(`study:${room.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'study_room_members',
      filter: `room_id=eq.${room.id}`
    }, (payload) => {
      // 更新 UI 状态
      updateStudyBuddies(payload);
    })
    .subscribe();
}
```

---

## 2. 专注时长持久化 & 陪伴模式 (Focus & Companion)

### 功能概述

#### 1. 🎯 专注时长持久化 (Persistence)
- ✅ 在 `profiles` 表添加 `total_study_time` 字段 (单位: 分钟)
- ✅ 计时器停止时，自动累加本次专注时长到数据库
- ✅ 主页面显示累计专注时长 (Total Focus)
- ✅ 刷新页面后时长数据不会丢失

#### 2. 🤝 完善双人陪伴模式 (Companion Mode)
- ✅ 加入好友后自动携带好友信息到计时器
- ✅ 计时器界面显示双人头像 + 连接线动画
- ✅ 显示"正在与 XXX 共同专注中"提示
- ✅ 3秒轮询机制确保好友信息实时同步
- ✅ 停止专注时清除双方的关联状态

### 数据库准备

#### Step 1: 添加 total_study_time 字段

在 Supabase Dashboard → SQL Editor 执行:

```sql
-- 执行脚本: database/add-study-time-to-profiles.sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS total_study_time INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_total_study_time
ON profiles(total_study_time)
WHERE total_study_time > 0;

COMMENT ON COLUMN profiles.total_study_time IS '累计专注时长(分钟)';
```

#### Step 2: 验证字段已添加

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'total_study_time';
```

### 核心实现

#### 1. 专注时长持久化

```typescript
// 计时器停止时
async function stopFocusTimer(studiedMinutes: number) {
  const userId = await getCurrentUserId();

  // 更新数据库
  const { error } = await supabase
    .from('profiles')
    .update({
      total_study_time: supabase.raw(`total_study_time + ${studiedMinutes}`)
    })
    .eq('id', userId);

  if (!error) {
    // 更新本地状态
    setTotalStudyTime(prev => prev + studiedMinutes);
  }
}
```

#### 2. 双人陪伴模式

```typescript
// 陪伴模式计时器
function CompanionTimer({ friendInfo }: { friendInfo: Friend }) {
  const [studyingTogether, setStudyingTogether] = useState(false);

  // 轮询好友状态
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('friends')
        .select('is_studying, study_time')
        .eq('friend_id', friendInfo.id)
        .single();

      setStudyingTogether(data?.is_studying || false);
    }, 3000);

    return () => clearInterval(interval);
  }, [friendInfo.id]);

  return (
    <div className="timer-container">
      {/* 双人头像 */}
      <div className="avatars">
        <Avatar src={myAvatar} />
        <div className="connection-line" />
        <Avatar src={friendInfo.avatar} />
      </div>

      {/* 状态提示 */}
      {studyingTogether && (
        <p className="together-hint">
          正在与 {friendInfo.name} 共同专注中
        </p>
      )}

      <Timer />
    </div>
  );
}
```

---

## 3. 学习室结算弹窗 (Study Summary Modal)

### 功能概述

当用户点击"停止专注"或计时器自然结束时，会弹出一个精美的结算 Modal，展示：

- ⏱️ **本次专注时长** (实际完成的分钟数)
- 👥 **陪伴好友信息** (如果是双人模式)
- ⚡ **获得的积分** (每分钟2积分)
- 📊 **完成率** (实际时长/目标时长)

### 视觉特效

- 🎊 **撒花动画** - 50个彩色纸屑从顶部飘落
- 🏆 **奖杯图标** - 金色奖杯带弹跳动画
- ✨ **闪光装饰** - 星星闪烁效果
- 🎀 **Kuromi风格贴纸** - "Great Job!" 紫粉渐变标签

### 完整定律体验设计

- **完成时刻** - 计时器归零时自动弹出结算
- **中途停止** - 点击"放弃专注"也显示已完成时长
- **温馨文案** - 根据完成度显示不同鼓励语
- **积分激励** - 即时反馈，让每次专注都有成就感

### 设计细节

#### Modal 样式
- 背景: 紫粉渐变 + 毛玻璃效果
- 边框: 白色高光边框
- 阴影: 多层阴影营造悬浮感
- 动画: 缩放弹入 (0.4s cubic-bezier)

#### 数据展示

```tsx
// 单人模式
"独自专注也很棒! 继续保持 ✨"

// 双人模式
"你和 {好友名} 共度了一段高效时光"
```

#### 积分计算

```javascript
earnedPoints = studiedMinutes * 2
// 例: 专注25分钟 → +50积分
```

### 核心实现

#### 1. Modal 组件

```typescript
function StudySummaryModal({
  studiedMinutes,
  targetMinutes,
  friendInfo,
  onClose
}: StudySummaryProps) {

  const earnedPoints = studiedMinutes * 2;
  const completionRate = Math.round((studiedMinutes / targetMinutes) * 100);

  return (
    <Modal onClose={onClose}>
      <div className="summary-container">
        {/* 奖杯动画 */}
        <TrophyIcon className="trophy-animation" />

        {/* 完成文案 */}
        <h2>
          {friendInfo
            ? `你和 ${friendInfo.name} 共度了高效时光`
            : '独自专注也很棒! 继续保持 ✨'}
        </h2>

        {/* 数据展示 */}
        <div className="stats">
          <div className="stat-item">
            <span className="label">本次专注</span>
            <span className="value">{studiedMinutes} 分钟</span>
          </div>
          <div className="stat-item">
            <span className="label">获得积分</span>
            <span className="value highlight">+{earnedPoints}</span>
          </div>
          <div className="stat-item">
            <span className="label">完成率</span>
            <span className="value">{completionRate}%</span>
          </div>
        </div>

        {/* 撒花动画 */}
        <Confetti count={50} />

        {/* 按钮 */}
        <button onClick={onClose}>继续加油</button>
      </div>
    </Modal>
  );
}
```

#### 2. 动画效果 (Framer Motion)

```typescript
const trophyAnimation = {
  initial: { scale: 0, rotate: -180 },
  animate: {
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      damping: 10,
      stiffness: 200
    }
  }
};
```

---

## 常见问题

### Q: 专注时长为什么没有累加?

**A**: 检查以下几点：
1. 数据库是否已添加 `total_study_time` 字段
2. 计时器停止时是否调用了更新方法
3. 浏览器控制台是否有错误日志

### Q: 双人模式为什么看不到好友?

**A**: 确认：
1. 好友已接受你的好友请求
2. 好友当前正在自习 (is_studying = true)
3. Realtime 订阅是否正常工作

### Q: 结算弹窗不显示?

**A**: 检查：
1. 计时器停止时是否触发了 `onStop` 回调
2. Modal 组件是否正确导入
3. CSS 样式是否被正确加载

---

**维护者**: TRIX 3D Companion 开发团队
**最后更新**: 2026-02-15
