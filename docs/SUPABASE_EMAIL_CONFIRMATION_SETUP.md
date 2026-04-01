# Supabase Email Confirmation — 三端需要做的事

> iOS 端已实现（commit `d831731`）。Web 和 Desktop 需要同等处理。

---

## Supabase Dashboard 配置（必须）

登录 [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目 → **Authentication** → **URL Configuration**：

| 字段 | 值 | 说明 |
|------|----|------|
| **Site URL** | `https://trix.love` | Web 端确认邮件的默认跳转地址 |
| **Redirect URLs** | `https://trix.love/**` | Web 允许的 redirect 模式 |
| **Redirect URLs** | `trix3dcompanion://auth/v1/callback` | iOS/Android 自定义 scheme（新增） |
| **Redirect URLs** | `https://trix.love/#/auth/v1/callback` | Web hash 路由确认页（新增） |

**重要**：Supabase 对 Redirect URLs 有白名单校验。如果只配了 `https://trix.love`，自定义 scheme 链接不会被 Supabase 接受（注册时会报错）。

**测试方式**：在 Supabase Dashboard → Authentication → Users → 手动"发送确认邮件"，看邮件里链接的域名是否是允许的。

---

## Web 端（`src/`）

### 现状

`AuthContext.tsx` 第 310 行：
```ts
emailRedirectTo: undefined, // ← Supabase 用 Site URL 生成默认邮件链接
```

`App.tsx`：使用 `HashRouter`，无 `/auth/v1/callback` 路由。

### 需要做什么

**方案 A — 让 Supabase SDK 自动处理（最简，推荐）**

Supabase JS SDK 内置了对 hash redirect 的处理。当 URL 是 `{siteUrl}/#/auth/v1/callback?token=XXX` 时，SDK 会在页面加载时自动解析 token 并建立 session，**无需手动写代码**。

只需要确保：

1. `siteUrl` 配置正确（已在 Dashboard 配置好）
2. `emailRedirectTo` 保持 `undefined`（已有），Supabase 会生成 `#/auth/v1/callback` 格式链接
3. App 加载时，SDK 的 `onAuthStateChange` listener 会收到 `SIGNED_IN` 事件，自动更新用户态

**方案 B — 自定义 Web 确认页（可选，如果 SDK 自动处理不够可靠）**

如果需要更可控的 UX，可以：

1. 在 `AppRoutes` 添加 `#/auth/confirm` 路由
2. 在该路由组件里解析 URL 参数，手动调用 `supabase.auth.exchangeCodeForSession(token)`
3. 把 `emailRedirectTo` 显式设为 `https://trix.love/#/auth/confirm`

```ts
// src/contexts/AuthContext.tsx
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { username },
    emailRedirectTo: `${window.location.origin}/#/auth/confirm`,
  },
});
```

然后在 `App.tsx` 添加：
```tsx
<Route path="/auth/confirm" element={<EmailConfirmPage />} />
```

`EmailConfirmPage` 组件里：
```ts
// 解析 ?token=XXX
const params = new URLSearchParams(location.search);
const token = params.get('token');
if (token) {
  const { error } = await supabase.auth.exchangeCodeForSession(token);
  // 成功 → navigate(AppRoutes.HOME)
}
```

**建议先用方案 A**，跑一遍真实注册流程验证。

---

## Desktop 端（`desktop/src/`）

### 现状

Electron 主进程（`index.ts`）**没有注册自定义协议**，`trix3dcompanion://` 链接无法唤醒 App。

### 需要做什么

参考 Electron 文档：需要两步。

**1. 注册自定义协议（主进程）**

在 `desktop/src/main/index.ts` 的 `app.whenReady()` 里注册：

```ts
import { app } from 'electron';

// 安全要求：Linux 和 Windows 需要注册默认协议
// macOS 会在 app bundle 的 Info.plist 里配置
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('trix3dcompanion');
  }
} else {
  app.setAsDefaultProtocolClient('trix3dcompanion');
}
```

**2. 处理 open-url 事件（主进程）**

在 `app.whenReady()` 里监听协议唤起：

```ts
// 处理 macOS / Windows 的协议唤起
app.on('open-url', (event, url) => {
  event.preventDefault();
  // 转发给渲染进程处理
  mainWindow?.webContents.send('deep-link', url);
});
```

对于 Electron，还要处理 Windows 单实例和 Linux 的特殊情况：

```ts
// 单实例 + 协议唤起（处理 Windows/Linux）
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // Windows/Linux: 协议 URL 在命令行参数里
    const url = commandLine.find(arg => arg.startsWith('trix3dcompanion://'));
    if (url) {
      mainWindow?.webContents.send('deep-link', url);
    }
    mainWindow?.show();
    mainWindow?.focus();
  });
}
```

**3. 在渲染进程处理 deep link（web 层）**

和 iOS 类似的逻辑，在 Renderer 进程收到 `deep-link` 事件后：

```ts
// desktop/src/renderer/ 相关文件
window.electron.ipc.on('deep-link', async (url: string) => {
  if (url.includes('/auth/v1/callback')) {
    // 用 Supabase SDK 的 exchangeCodeForSession
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (!error) {
      // 跳转到主页
    }
  }
});
```

注意：Desktop 用的是 Web 技术栈（React），`@supabase/supabase-js` 同样在 renderer 进程运行，所以可以直接用 SDK 的 `exchangeCodeForSession`。

**macOS 额外配置**：在打包时，需要在 Electron-builder 或打包配置里声明 `trix3dcompanion` 为支持的协议（通过 `build.protocols` 或 `Info.plist`）。如果用 `@electron/rebuild` 或 `electron-builder`，在 `electron-builder.yml` / `package.json` 的 `build` 配置里加上：

```yaml
# electron-builder.yml
protocols:
  - name: TRIX Companion
    schemes:
      - trix3dcompanion
```

---

## 验证清单

完成上述配置后，跑一遍完整注册流程：

```
注册页输入邮箱/密码/用户名
  → 收到 Supabase 确认邮件
  → 邮件里链接格式确认：
      Web:  https://trix.love/#/auth/v1/callback?token=XXX  ✅
      iOS:  trix3dcompanion://auth/v1/callback?token=XXX  ✅（已实现）
      Desktop: trix3dcompanion://auth/v1/callback?token=XXX ✅（待实现）
  → 点链接 → App/页面打开 → 自动进入已登录状态
```

---

## 关联文档

- iOS 实现：commit `d831731`
- Supabase Email Confirm 文档：https://supabase.com/docs/guides/auth/auth-email-confirm
- Electron Deep Link：https://www.electronjs.org/docs/api/app#appsetasdefaultprotocolclientprotocol-path
- `@supabase/supabase-js` `exchangeCodeForSession`：https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession
