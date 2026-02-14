# Nanobot Supabase 用户认证集成指南

## 目标

在 App 端发送配对请求时，自动附加 Supabase User ID，实现用户身份验证。

---

## 需要修改的文件

### 文件 1: `src/services/NanobotBridge.ts`

#### 修改 1：添加导入

在文件顶部添加：
```typescript
import { supabase } from '../config/supabase';
```

#### 修改 2：添加获取 User ID 的方法

在类中添加新方法：
```typescript
/**
 * 获取 Supabase User ID
 */
private async getSupabaseUserId(): Promise<string | null> {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('[NanobotBridge] 获取 session 错误:', error);
            return null;
        }

        if (!session || !session.user) {
            console.warn('[NanobotBridge] 用户未登录');
            return null;
        }

        return session.user.id;
    } catch (error) {
        console.error('[NanobotBridge] getSupabaseUserId 错误:', error);
        return null;
    }
}
```

#### 修改 3：修改 `bindPairingCode` 函数

```typescript
async bindPairingCode(code: string, userName?: string): Promise<{ success: boolean; message: string }> {
    // 先保存配对码
    this.pairingCode = code.toUpperCase();
    localStorage.setItem('nanobot_pairing_code', this.pairingCode);

    // 获取 Supabase User ID
    const userId = await this.getSupabaseUserId();
    if (!userId) {
        console.warn('[NanobotBridge] 未登录，将使用匿名模式');
    }

    // 如果已连接，直接发送配对请求
    if (this.connected && this.ws) {
        this.sendAppPairing(userId || undefined);
        return { success: true, message: '正在配对...' };
    }

    // 否则先连接
    return new Promise((resolve) => {
        const onConnected = () => {
            this.off('connected', onConnected);
            this.off('error', onError);
            this.sendAppPairing(userId || undefined);
            resolve({ success: true, message: '正在配对...' });
        };

        const onError = (error: any) => {
            this.off('connected', onConnected);
            this.off('error', onError);
            resolve({ success: false, message: error.message || '连接失败' });
        };

        this.on('connected', onConnected);
        this.on('error', onError);

        this.connect(code);
    });
}
```

#### 修改 4：修改 `sendAppPairing` 函数

```typescript
/**
 * 发送配对请求
 */
private sendAppPairing(userId?: string): void {
    if (!this.ws || !this.pairingCode) return;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const pairingData: any = {
        type: 'app_pairing',
        code: this.pairingCode,
        device_id: this.deviceId,
        client_info: {
            device_name: isMobile ? 'Mobile' : 'Desktop',
            platform: isMobile ? 'mobile' : 'web',
            user_agent: navigator.userAgent
        }
    };

    // 如果有 User ID，添加到请求中
    if (userId) {
        pairingData.user_id = userId;
    }

    this.ws.send(JSON.stringify(pairingData));

    console.log('[NanobotBridge] 发送配对请求:', this.pairingCode, userId ? `(User: ${userId})` : '(匿名)');
}
```

---

## 云端服务器配置

云端服务器已经支持 Supabase 认证（`cloud_server_advanced.py`），包括：

1. **接收 User ID**：在 `handle_app_pairing` 函数中接收 `user_id` 字段
2. **验证 Token**：`verify_supabase_token` 函数（可选，需要配置 Supabase URL）
3. **数据库存储**：将 User ID 存储到 SQLite 数据库

---

## 数据库表结构

云端服务器使用的 SQLite 表结构：

### 表：`pairings`

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | TEXT | 配对码（主键） |
| `nanobot_device_id` | TEXT | Nanobot 设备 ID |
| `app_device_id` | TEXT | App 设备 ID |
| `user_id` | TEXT | Supabase User ID |
| `status` | TEXT | 状态（waiting/connected） |
| `created_at` | TIMESTAMP | 创建时间 |
| `connected_at` | TIMESTAMP | 连接时间 |
| `expires_at` | TIMESTAMP | 过期时间 |
| `client_info` | TEXT | 客户端信息（JSON） |

### 表：`user_bindings`

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | TEXT | Supabase User ID |
| `nanobot_device_id` | TEXT | Nanobot 设备 ID |
| `bound_at` | TIMESTAMP | 绑定时间 |
| `status` | TEXT | 状态（active/inactive） |

---

## 配对流程（带用户认证）

```
┌──────────┐                  ┌──────────┐                  ┌──────────┐
│  App     │                  │ 云端服务器 │                  │ Nanobot  │
└──────────┘                  └──────────┘                  └──────────┘
     │                              │                              │
     │ 1. 获取 Supabase Session      │                              │
     ├─────────────────┐             │                              │
     │                 │             │                              │
     │◄────────────────┘             │                              │
     │                              │                              │
     │ 2. 连接 WebSocket             │                              │
     ├─────────────────────────────►│                              │
     │                              │                              │
     │ 3. 发送配对请求               │                              │
     │   {                          │                              │
     │     type: 'app_pairing',     │                              │
     │     code: 'A1B2C3D4',        │                              │
     │     user_id: 'uuid-xxx',     │                              │
     │     device_id: 'app_xxx'     │                              │
     │   }                          │                              │
     ├─────────────────────────────►│                              │
     │                              │                              │
     │                              │ 4. 验证配对码                  │
     │                              ├─────────────────────────────►│
     │                              │                              │
     │                              │ 5. 查询数据库                  │
     │                              │   SELECT * FROM pairings      │
     │                              │   WHERE code = 'A1B2C3D4'     │
     │                              ├──────────┐                   │
     │                              │          │                   │
     │                              │◄─────────┘                   │
     │                              │                              │
     │                              │ 6. 更新配对关系                │
     │                              │   UPDATE pairings             │
     │                              │   SET user_id = 'uuid-xxx',  │
     │                              │       status = 'connected'   │
     │                              ├──────────┐                   │
     │                              │          │                   │
     │                              │◄─────────┘                   │
     │                              │                              │
     │                              │ 7. 通知 Nanobot               │
     │                              │   {                          │
     │                              │     type: 'pairing_success', │
     │                              │     user_id: 'uuid-xxx'      │
     │                              │   }                          │
     │                              ├─────────────────────────────►│
     │                              │                              │
     │ 8. 返回配对成功               │                              │
     │   {                          │                              │
     │     type: 'pairing_success', │                              │
     │     nanobot_device_id: 'xxx' │                              │
     │   }                          │                              │
     │◄─────────────────────────────┤                              │
     │                              │                              │
     ✅ 配对完成                     │                              │
```

---

## 测试步骤

### 步骤 1：确保 Supabase 已配置

检查 `.env.local` 文件：
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 步骤 2：启动 App 并登录

```bash
cd e:\desktop\trix-3d-companion
npm run dev
```

访问 `http://localhost:5173` 并登录。

### 步骤 3：启动本地 Nanobot

```bash
cd e:\desktop\nanobot\nanobot
python web_interface_final.py
```

访问 `http://localhost:5000`，生成配对码。

### 步骤 4：在 App 中输入配对码

1. 在 App 中进入配对界面
2. 输入 Nanobot 显示的配对码
3. 点击"配对"

### 步骤 5：验证配对成功

**在浏览器控制台（F12）中查看**：
```
[NanobotBridge] 获取 Supabase User ID: uuid-xxx
[NanobotBridge] 发送配对请求: A1B2C3D4 (User: uuid-xxx)
[NanobotBridge] 配对成功
```

**在云端服务器日志中查看**：
```bash
ssh root@47.243.55.130 "tail -20 /tmp/cloud_server.log"
```

应该看到：
```
2026-02-14 15:00:00 - INFO - ✅ 配对成功: A1B2C3D4 (App: app_xxx, Nanobot: nanobot_xxx, User: uuid-xxx)
```

### 步骤 6：验证数据库

```bash
ssh root@47.243.55.130
sqlite3 /tmp/nanobot.db "SELECT * FROM pairings WHERE code = 'A1B2C3D4';"
```

应该看到包含 `user_id` 的记录。

---

## 常见问题

### Q1: User ID 为空？

**原因**：用户未登录 Supabase

**解决**：
1. 确保在 App 中已登录
2. 检查 Supabase 配置是否正确
3. 查看浏览器控制台是否有错误

### Q2: 云端未存储 User ID？

**原因**：云端服务器版本过旧

**解决**：
```bash
# 重启云端服务器
ssh root@47.243.55.130
pkill -f cloud_server.py
python3 /root/cloud_server_advanced.py > /tmp/cloud_server.log 2>&1 &
```

### Q3: 如何查看当前登录的用户？

在浏览器控制台（F12）中运行：
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('User ID:', session?.user?.id);
console.log('Email:', session?.user?.email);
```

---

## 下一步

完成用户认证集成后，可以继续：

1. ✅ 实现用户权限管理
2. ✅ 实现一个用户绑定多个 Nanobot
3. ✅ 实现聊天记录云端同步
4. ✅ 实现 SSL/TLS 加密

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-14
