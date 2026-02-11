# ✅ 双向自习功能测试清单

## 🚀 测试前准备

### 1. 确保数据库已迁移
在 Supabase Dashboard -> SQL Editor 执行：
```sql
-- 检查 companion_id 字段是否存在
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'companion_id';

-- 如果不存在，执行迁移脚本
-- 文件: database/add-companion-to-profiles.sql
```

### 2. 刷新浏览器
- 按 `Ctrl + Shift + R` (硬刷新)
- 清除缓存后刷新

### 3. 打开浏览器控制台
- 按 `F12` 打开开发者工具
- 切换到 Console 标签

---

## 🧪 测试场景 1: 用户 A 加入用户 B

### 操作步骤

**用户 B (被加入者):**
1. 登录账号 B
2. 进入自习室页面 (`/study`)
3. 点击"开始专注"按钮
4. 进入计时器页面 (`/study/timer`)
5. **验证**: 底部导航栏消失 ✅
6. **验证**: 只显示自己的单个头像（无双头像）

**预期控制台日志:**
```
🚀 [Study] 开始自习，更新数据库状态...
✅ [Study] 已更新 is_studying = true
🔌 [Study] 启动 Realtime 监听 companion_id 变化
📡 [Study] Realtime 订阅状态: SUBSCRIBED
=== [Study] Companion 状态调试 ===
📍 Is Timer Page: true
👤 User ID: <B_USER_ID>
🤝 Companion Data: undefined
================================
```

**用户 A (加入者):**
1. 登录账号 A (另一个浏览器窗口或隐私模式)
2. 进入自习室页面
3. 点击"查看正在自习的好友"按钮（假设已实现好友功能）
4. 看到用户 B 在列表中
5. 点击"加入"按钮

**预期控制台日志 (用户 A):**
```
🚀 [StudyBuddies] 准备加入 <B_USERNAME> 的自习室
🔗 [StudyBuddies] 建立双向连接: <A_USER_ID> ↔️ <B_USER_ID>
✅ [StudyBuddies] 双向连接建立成功！
🚀 [StudyBuddies] 传递给计时器页面的数据: {...}

// 页面跳转后
🔌 [Study] 启动 Realtime 监听 companion_id 变化
🔍 [Study] location.state 没有 companion，从数据库查询...
📊 [Study] 我的 companion_id: <B_USER_ID>
✅ [Study] 成功查询到好友信息: {...}

=== [Study] Companion 状态调试 ===
📍 Is Timer Page: true
👤 User ID: <A_USER_ID>
🤝 Companion Data: { id: <B_ID>, username: <B_NAME>, avatar: <B_AVATAR> }
================================
```

**预期控制台日志 (用户 B - 自动触发):**
```
🔥 [Study] 检测到自己的 profile 更新: {...}
📊 [Study] companion_id 变化: null → <A_USER_ID>
🎉 [Study] 有好友加入了自习室，查询信息...
✅ [Study] 成功获取加入者信息，更新显示

=== [Study] Companion 状态调试 ===
📍 Is Timer Page: true
👤 User ID: <B_USER_ID>
🤝 Companion Data: { id: <A_ID>, username: <A_NAME>, avatar: <A_AVATAR> }
================================
```

### 验证结果

**用户 A 的页面应该显示:**
- ✅ 双头像（我 + 用户 B）
- ✅ 蓝色光晕（我的头像）
- ✅ 紫色光晕（好友头像）
- ✅ 中间的连接线动画
- ✅ 头像下方显示用户名
- ✅ 底部导航栏已隐藏

**用户 B 的页面应该显示:**
- ✅ 双头像（我 + 用户 A）
- ✅ 双头像自动出现（无需刷新）
- ✅ 蓝色光晕（我的头像）
- ✅ 紫色光晕（好友头像）
- ✅ 底部导航栏已隐藏

---

## 🧪 测试场景 2: 用户 A 停止自习

### 操作步骤

**用户 A:**
1. 在计时器页面点击右上角的 "X" 按钮
2. 返回自习室主页

**预期控制台日志 (用户 A):**
```
🛑 [Study] 停止自习，更新数据库状态...
📊 [Study] 我的 companion_id: <B_USER_ID>
🔗 [Study] 清除好友 <B_USER_ID> 的关联
✅ [Study] 已更新 is_studying = false, companion_id = null
✅ [Study] 已清除好友的 companion_id
```

**预期控制台日志 (用户 B - 自动触发):**
```
🔥 [Study] 检测到自己的 profile 更新: {...}
📊 [Study] companion_id 变化: <A_USER_ID> → null
👋 [Study] 好友离开了自习室

=== [Study] Companion 状态调试 ===
📍 Is Timer Page: true
👤 User ID: <B_USER_ID>
🤝 Companion Data: undefined
================================
```

### 验证结果

**用户 A:**
- ✅ 返回自习室主页
- ✅ 底部导航栏重新显示

**用户 B:**
- ✅ 双头像自动消失（无需刷新）
- ✅ 只显示单个头像
- ✅ 继续计时（不受影响）

---

## 🧪 测试场景 3: 刷新页面

### 操作步骤

**前置条件:**
- 用户 A 和用户 B 正在一起自习（双头像显示中）

**用户 A:**
1. 按 `F5` 刷新页面

**预期结果:**
- ✅ 页面重新加载
- ✅ 双头像依然显示（从数据库查询）
- ✅ location.state 丢失但不影响显示

**预期控制台日志:**
```
🔌 [Study] 启动 Realtime 监听 companion_id 变化
🔍 [Study] location.state 没有 companion，从数据库查询...
📊 [Study] 我的 companion_id: <B_USER_ID>
✅ [Study] 成功查询到好友信息: {...}

=== [Study] Companion 状态调试 ===
📍 Is Timer Page: true
👤 User ID: <A_USER_ID>
🤝 Companion Data: { id: <B_ID>, username: <B_NAME>, avatar: <B_AVATAR> }
================================
```

---

## 🧪 测试场景 4: 浏览器关闭

### 操作步骤

**前置条件:**
- 用户 A 和用户 B 正在一起自习

**用户 A:**
1. 关闭浏览器标签页（或整个浏览器）

**预期控制台日志 (用户 A - beforeunload):**
```
🌐 [Study] 浏览器关闭，清理自习状态...
```

**预期控制台日志 (用户 B - 自动触发):**
```
🔥 [Study] 检测到自己的 profile 更新: {...}
📊 [Study] companion_id 变化: <A_USER_ID> → null
👋 [Study] 好友离开了自习室
```

**数据库验证:**
```sql
SELECT id, username, is_studying, companion_id 
FROM profiles 
WHERE id IN ('<A_USER_ID>', '<B_USER_ID>');

-- 预期结果:
-- A: is_studying = false, companion_id = null
-- B: is_studying = true, companion_id = null
```

---

## ❌ 常见问题排查

### 问题 1: 双头像不显示

**检查清单:**
1. 控制台是否有 `🤝 Companion Data: undefined`?
   - 是 → 继续下一步
   - 否 → 查看 UI 渲染逻辑

2. 是否看到 `🔍 [Study] location.state 没有 companion，从数据库查询...`?
   - 是 → 继续下一步
   - 否 → location.state 有值但格式错误

3. 是否看到 `📊 [Study] 我的 companion_id: <ID>`?
   - 是且不为 null → 继续下一步
   - 否或为 null → companion_id 未建立

4. 是否看到 `✅ [Study] 成功查询到好友信息`?
   - 是 → 数据查询成功，检查 setCompanion 是否触发
   - 否 → 查看错误日志

5. 数据库验证:
```sql
SELECT id, username, companion_id 
FROM profiles 
WHERE id IN ('<A_ID>', '<B_ID>');
```

### 问题 2: Realtime 不触发

**检查清单:**
1. 是否看到 `📡 [Study] Realtime 订阅状态: SUBSCRIBED`?
   - 否 → Realtime 连接失败

2. Supabase Dashboard 检查:
   - Table Editor → profiles 表
   - Realtime 标签 → 确保已启用

3. 手动触发测试:
```sql
-- 在 SQL Editor 执行
UPDATE profiles 
SET companion_id = '<SOME_ID>' 
WHERE id = '<YOUR_ID>';
```
查看控制台是否有 `🔥 [Study] 检测到自己的 profile 更新`

### 问题 3: 加入失败

**检查清单:**
1. 是否看到 `❌ [StudyBuddies] 更新自己的状态失败` 或类似错误?
   - 是 → 查看完整错误信息
   - 检查 Supabase RLS 策略是否允许 UPDATE

2. 数据库权限检查:
```sql
-- 检查 profiles 表的 RLS 策略
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

3. 网络检查:
   - 打开 Network 标签
   - 筛选 "supabase"
   - 查看是否有 400/401/403 错误

---

## 🎯 成功标准

完成以上所有测试场景后，应该满足：

- ✅ 用户 A 加入后，双方都能看到双头像
- ✅ 双头像实时更新（无需刷新页面）
- ✅ 停止自习后，双头像自动消失
- ✅ 刷新页面后，双头像依然显示
- ✅ 浏览器关闭后，自动清理状态
- ✅ 计时器页面底部导航栏隐藏
- ✅ 所有关键日志正常输出

---

**测试时间**: 2026-02-11  
**版本**: v2.0.0 (数据库查询 + Realtime 双向更新)  
**相关 Commit**: b231dbe
