# 🚀 专注时长 & 伴读模式 - 快速启动

## 📦 第一步: 数据库迁移

复制以下 SQL,在 Supabase Dashboard → SQL Editor 执行:

```sql
-- 添加专注时长字段
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS total_study_time INTEGER DEFAULT 0;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_profiles_total_study_time 
ON profiles(total_study_time) 
WHERE total_study_time > 0;

-- 验证
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'total_study_time';
```

预期返回: `total_study_time | integer`

---

## ✅ 第二步: 测试专注时长持久化

### 清空测试数据
```sql
UPDATE profiles SET total_study_time = 0 WHERE username = 'admin';
```

### 操作步骤
1. 登录 `admin`
2. 自习室 → 选择 25 分钟 → 开始专注
3. **等待 2 分钟** (不要立即停止)
4. 点击 "放弃专注"
5. 查看右下角 "Total Focus" 显示 `0h 2m` ✅
6. **刷新浏览器 (F5)**
7. 时长依然是 `0h 2m` ✅ (持久化成功!)

### 验证数据库
```sql
SELECT username, total_study_time FROM profiles WHERE username = 'admin';
-- 应该返回: admin | 2 (或你实际专注的分钟数)
```

---

## 🤝 第三步: 测试双人伴读模式

### 准备: 清空自习状态
```sql
UPDATE profiles SET is_studying = false, companion_id = null;
```

### 双浏览器测试

**浏览器 A (admin):**
1. 登录 `admin`
2. 自习室 → 点击 `+` → "开始自习"
3. **停留在主页** (不要点开始)

**浏览器 B (xiaoming):**
1. 登录 `xiaoming`
2. 自习室 → 点击 `+`
3. 看到 `admin` 在列表中
4. 点击 **"加入"** ✅
5. 自动跳转到计时器
6. **检查 UI:**
   - ✅ 显示两个头像 (xiaoming + admin)
   - ✅ 中间有紫色动画连接线
   - ✅ 显示 "正在与 admin 共同专注中"

**浏览器 A (admin 自动同步):**
1. 等待 **3 秒** (轮询触发)
2. 点击 "开始专注"
3. **检查 UI:**
   - ✅ 显示两个头像 (admin + xiaoming)
   - ✅ 显示 "正在与 xiaoming 共同专注中"

### 测试停止清理

**浏览器 B (xiaoming):**
1. 点击 "放弃专注"
2. 返回主页

**浏览器 A (admin):**
1. 等待 **3 秒**
2. ✅ 双人头像自动消失
3. ✅ 回到单人模式

---

## 🎉 成功标准

- [x] 专注时长累加到数据库 (`total_study_time` 字段)
- [x] 刷新页面后时长不丢失
- [x] 加入好友后显示双人头像
- [x] 显示 "正在与 XXX 共同专注中"
- [x] 3 秒内另一方同步显示好友信息
- [x] 停止后双方头像都消失

---

## 🐞 问题排查

### Total Focus 不更新?
```sql
-- 检查字段
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'total_study_time';
```
如果返回空,重新执行第一步的 SQL

### 加入后没有显示双人头像?
打开控制台 (F12),检查是否有错误日志:
- 应该看到: `🚀 [StudyBuddies] 传递给计时器页面的数据`
- 应该看到: `📦 [Study] 使用 location.state 的 companion 数据`

### 3 秒后还是看不到?
```sql
-- 检查数据库关联
SELECT username, companion_id FROM profiles 
WHERE username IN ('admin', 'xiaoming');
```
如果 `companion_id` 都是 `null`,检查 RLS 策略:
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'UPDATE';
```
应该包含: `Users can update any companion_id`

---

## 📚 详细文档

- 完整测试步骤: `FOCUS-TIME-AND-COMPANION-MODE.md`
- 代码更新日志: Git commit `032e59e`
