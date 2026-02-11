# 🏅 专注时长持久化 & 双人模式完善 - 功能测试指南

## 📋 实现的功能

### 1. 🏅 专注时长持久化 (Persistence)
- ✅ 在 `profiles` 表添加 `total_study_time` 字段 (单位: 分钟)
- ✅ 计时器停止时,自动累加本次专注时长到数据库
- ✅ 主页面显示累计专注时长 (Total Focus)
- ✅ 刷新页面后时长数据不会丢失

### 2. 🤝 完善双人伴读模式 (Companion Mode)
- ✅ 加入好友后自动携带好友信息到计时器
- ✅ 计时器界面显示双人头像 + 连接线动画
- ✅ 显示"正在与 XXX 共同专注中"提示
- ✅ 3秒轮询机制确保好友信息实时同步
- ✅ 停止专注时清除双方的关联状态

---

## 🗄️ 数据库准备

### Step 1: 添加 total_study_time 字段

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

### Step 2: 验证字段已添加

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'total_study_time';
```

预期结果:
```
| column_name        | data_type | is_nullable | column_default |
|--------------------|-----------|-------------|----------------|
| total_study_time   | integer   | YES         | 0              |
```

---

## ✅ 功能测试步骤

### 测试 1: 专注时长持久化

**准备:**
```sql
-- 清空测试用户的累计时长
UPDATE profiles 
SET total_study_time = 0 
WHERE username = 'admin';
```

**步骤:**
1. 用 `admin` 账号登录
2. 进入自习室页面
3. 注意右下角 "Total Focus" 显示 `0h 0m`
4. 选择 25 分钟,点击开始专注
5. **等待至少 2 分钟** (不要立即停止)
6. 点击"放弃专注"按钮停止
7. 观察控制台日志:
   ```
   📊 [Study] 本次专注时长: 2 分钟
   🏅 [Study] 累计专注时长: 0 + 2 = 2 分钟
   ✅ [Study] 已更新 total_study_time = 2
   ```
8. 返回自习室主页,右下角应显示 `0h 2m`
9. **刷新浏览器 (F5)**
10. 再次查看右下角,时长应依然是 `0h 2m` (数据持久化成功!)

**验证数据库:**
```sql
SELECT username, total_study_time 
FROM profiles 
WHERE username = 'admin';
```

预期结果: `total_study_time = 2` (或你实际专注的分钟数)

---

### 测试 2: 双人伴读模式完整流程

**准备:**
```sql
-- 清空所有人的自习状态
UPDATE profiles 
SET is_studying = false, companion_id = null;
```

**双浏览器操作:**

#### 浏览器 A (admin)
1. 登录 `admin` 账号
2. 进入自习室
3. 点击 `+` 按钮 → "开始自习"
4. **不要点击开始**,保持在主页面

#### 浏览器 B (xiaoming)
1. 登录 `xiaoming` 账号
2. 进入自习室
3. 点击 `+` 按钮 → 看到 `admin` 在自习列表中
4. 点击 `admin` 右侧的 **"加入"** 按钮
5. 观察控制台日志:
   ```
   🚀 [StudyBuddies] 传递给计时器页面的数据: {
     duration: 25,
     companion: {
       id: '<admin_id>',
       username: 'admin',
       avatar: '...'
     }
   }
   ```
6. 自动跳转到计时器页面
7. **验证 UI 显示:**
   - 顶部显示两个头像 (xiaoming + admin)
   - 中间有紫色动画连接线
   - 下方显示: **"正在与 admin 共同专注中"**

#### 浏览器 A (admin 自动同步)
1. 等待 **最多 3 秒** (轮询机制触发)
2. 观察控制台日志:
   ```
   🔄 [Study] 轮询检查 companion_id...
   📊 [Study] 我的 companion_id: <xiaoming_id>
   ✅ [Study] 成功查询到好友信息: { username: 'xiaoming', ... }
   ```
3. 点击"开始专注"
4. 计时器页面应该也显示两个头像:
   - admin (自己) + xiaoming (好友)
   - 显示: **"正在与 xiaoming 共同专注中"**

---

### 测试 3: 停止专注后的清理

**继续上面的状态:**

#### 浏览器 B (xiaoming 停止)
1. 在计时器页面点击 **"放弃专注"**
2. 观察控制台:
   ```
   📊 [Study] 本次专注时长: X 分钟
   🏅 [Study] 累计专注时长: 0 + X = X 分钟
   🔗 [Study] 清除好友 <admin_id> 的关联
   ✅ [Study] 已清除好友的 companion_id
   ```
3. 返回自习室主页

#### 浏览器 A (admin 自动同步)
1. 等待 **最多 3 秒**
2. 观察控制台:
   ```
   🔄 [Study] 轮询检查 companion_id...
   📊 [Study] 我的 companion_id: null
   ⚠️ [Study] 没有 companion_id，单人自习模式
   ```
3. 计时器页面的双人头像应该 **自动消失**
4. 只显示计时器,回到单人模式

---

## 🐞 常见问题排查

### 问题 1: Total Focus 显示 0h 0m 不更新

**检查:**
```sql
-- 查看字段是否存在
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'total_study_time';

-- 查看实际数据
SELECT username, total_study_time 
FROM profiles 
WHERE username = 'admin';
```

**解决:** 如果字段不存在,执行 `database/add-study-time-to-profiles.sql`

---

### 问题 2: 加入好友后没有显示双人头像

**检查控制台日志:**

1. `StudyBuddiesList.tsx` 应该输出:
   ```
   🚀 [StudyBuddies] 传递给计时器页面的数据: { companion: {...} }
   ```

2. `Study.tsx` 应该输出:
   ```
   📦 [Study] 使用 location.state 的 companion 数据
   ```

3. 如果看到:
   ```
   🔍 [Study] location.state 没有 companion，从数据库查询...
   ```
   说明导航时没有携带数据,检查 `StudyBuddiesList.tsx` 的 `navigate()` 调用

---

### 问题 3: 3秒后仍然看不到好友头像

**检查数据库:**
```sql
SELECT id, username, companion_id 
FROM profiles 
WHERE username IN ('admin', 'xiaoming');
```

**预期结果 (xiaoming 加入 admin 后):**
```
| username | companion_id         |
|----------|---------------------|
| admin    | <xiaoming_id>       |
| xiaoming | <admin_id>          |
```

如果 `companion_id` 为 `null`,说明更新失败,检查 RLS 策略:
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles' 
AND cmd = 'UPDATE';
```

应该包含: `Users can update any companion_id`

---

## 📊 成功标准

### ✅ 专注时长持久化
- [ ] 停止专注后 `total_study_time` 增加
- [ ] 刷新页面后时长不丢失
- [ ] UI 显示正确的时 + 分格式

### ✅ 双人伴读模式
- [ ] 加入好友后自动跳转到计时器
- [ ] 显示双人头像 + 连接线
- [ ] 显示"正在与 XXX 共同专注中"
- [ ] 3秒内另一方同步显示好友头像
- [ ] 停止专注后双方头像都消失

---

## 🚀 下一步优化建议

1. **今日专注时长** - 添加 `today_study_time` 字段,每天 00:00 重置
2. **专注历史** - 创建 `study_sessions` 表记录每次专注的详细信息
3. **伴读邀请** - 添加邀请机制,需要对方同意后才能加入
4. **双人同步计时** - 确保两人的计时器同步开始/停止
5. **伴读成就** - 统计双人伴读次数,解锁成就徽章
