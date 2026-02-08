# TRIX - 技术指南

## 网络与网关配置

### 网关网络访问配置指南

#### 问题诊断
- 当前状态：
  - ✅ Vite 前端: `http://192.168.101.4:3000`（所有网络接口）
  - ⚠️ Gateway: `ws://127.0.0.1:18789`（仅本地回环）

#### 网络监听详情
```powershell
# Gateway 当前监听:
TCP    127.0.0.1:18789        LISTENING       （仅本机可访问）
TCP    [::1]:18789            LISTENING       （仅本机可访问 IPv6）

# Vite 服务器监听:
TCP    0.0.0.0:3000          LISTENING       （所有网络接口）
```

#### 解决方案
- **方案 A**: 前端本地访问 Gateway
  - 配置：
    ```env
    VITE_PC_WEBSOCKET_URL=ws://localhost:18789
    ```
  - 优点：
    - ✅ 无需修改 Gateway 配置
    - ✅ 更安全（不暴露到局域网）
    - ✅ 立即生效

---

### Gateway 快速启动指南

#### 当前状态
- ❌ Clawdbot Gateway 未运行
- ✅ Vite 前端准备就绪（`http://192.168.101.4:3000`）
- ✅ 配置文件已更新（`ws://192.168.101.4:18789`）

#### 解决方案
- **方案 A**: 使用 Mock Gateway
  - 启动 Clawdbot Gateway：
    ```powershell
    openclaw-cn gateway
    ```
  - 启动前端：
    ```powershell
    npm run dev
    ```

---

### WebSocket 连接问题完整解决方案

#### 问题确认
- 检测结果：
  - ✅ Vite 前端: `http://192.168.101.4:3000`（正常，所有设备可访问）
  - ❌ Gateway: `ws://127.0.0.1:18789`（仅本地，手机/浏览器无法连接）

#### 问题原因
- Gateway 当前配置仅监听 `127.0.0.1:18789`，导致：
  - ✅ 本机程序可以连接（如本地测试工具）
  - ❌ 浏览器中的 Web 应用无法连接（跨源安全限制）
  - ❌ 手机/平板无法连接（不在同一设备）

#### 解决方案
- **方案 A**: 修改 Gateway 配置
  - 查找 Gateway 进程路径：
    ```powershell
    Get-Process -Id 16332 | Format-List *
    ```
  - 常见配置文件位置：
    - `gateway.config.json`

---

## 防火墙问题快速修复指南

### 问题确认
- 症状：
  - ✅ `localhost` 能连接到 Gateway
  - ❌ `192.168.101.4`（局域网 IP）无法连接
  - 错误: `WebSocket connection to 'ws://192.168.101.4:18789/' failed`

#### 快速修复（推荐）
- **方法 1: 使用自动化脚本**
  - 运行修复脚本：
    ```powershell
    cd E:\desktop\trix-3d-companion
    .\fix-firewall.ps1
    ```
  - 测试连接：
    ```
    http://192.168.101.4:5173/#/diagnostic
    ```

---

## 功能实现总结

### 已完成的所有功能

#### 1. 聊天历史记录持久化 ✅
- **文件**: `screens/ChatDetail.tsx` + `src/services/storageService.ts`
- **功能**:
  - ✅ 使用 localStorage 保存所有聊天记录
  - ✅ 页面刷新后自动加载历史消息
  - ✅ 每个好友独立的聊天历史
  - ✅ Clawbot AI 对话完整保存
  - ✅ 实时自动保存新消息

#### 2. 真实的项目报告进度数据 ✅
- **文件**: 
  - `src/services/projectService.ts`（项目数据管理）
  - `components/ProjectProgress.tsx`（进度展示组件）
  - `screens/Home.tsx`（集成）
- **功能**:
  - ✅ 真实的任务列表（默认 10 个任务）
  - ✅ 动态进度条 + 流光动画效果
  - ✅ 点击任务切换完成状态

---

更多详细信息，请参考 [项目概览](docs/PROJECT_OVERVIEW.md)。