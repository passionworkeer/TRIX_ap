# Nanobot 三端通信方案（已归档）

> **状态**: 已废弃
> **原因**: 项目已切换到 Clawbot Channel 方案
> **归档日期**: 2026-02-17

---

## 📋 概述

Nanobot 方案是通过云端中转实现 App ↔ 云端服务器 ↔ 本地 Nanobot 的三端实时通信。

**架构图**:
```
┌─────────────────┐                    ┌─────────────────┐
│   手机 App      │                    │   阿里云服务器   │
│  (React/Vue)    │◄───WebSocket──────►│  (Python/WS)    │
│                 │    ws://47.243...   │   :8765         │
└─────────────────┘                    └────────┬────────┘
                                                │
                                        WebSocket
                                                │
                                       ┌────────▼────────┐
                                       │  本地 Nanobot   │
                                       │  (Python Flask) │
                                       │  localhost:5000 │
                                       └─────────────────┘
```

---

## 🔧 实现总结

### 1. 云端服务器

**文件**: `/root/cloud_server_advanced.py`

**已实现功能**:
- ✅ SQLite 数据库持久化
- ✅ QR 码生成（Base64 编码）
- ✅ Supabase Token 验证接口
- ✅ 配对关系持久化存储
- ✅ 用户绑定关系管理
- ✅ 过期配对码自动清理

### 2. 本地 Nanobot

**文件**: `e:\desktop\nanobot\nanobot\web_interface_final.py`

**已实现功能**:
- ✅ QR 码显示区域
- ✅ QR 码显示/隐藏函数
- ✅ 配对状态管理
- ✅ 与云端 WebSocket 通信

### 3. App 前端

**文件**: `e:\desktop\trix-3d-companion\src\services\NanobotBridge.ts`

**功能**:
- WebSocket 连接管理
- 配对码输入配对
- 消息收发
- Supabase 用户认证集成

---

## 📊 消息协议

### WebSocket 消息类型

#### 设备 → 云端

| 类型 | 说明 | 发送方 |
|------|------|--------|
| `register` | 设备注册 | App + Nanobot |
| `register_pairing` | 注册配对码 | Nanobot |
| `app_pairing` | 配对请求 | App |
| `chat_message` | 发送消息 | App |
| `chat_response` | AI 回复 | Nanobot |
| `ping` | 心跳 | 双方 |

#### 云端 → 设备

| 类型 | 说明 |
|------|------|
| `register_success` | 注册成功 |
| `pairing_registered` | 配对码注册成功 |
| `pairing_success` | 配对成功 |
| `pairing_failed` | 配对失败 |
| `chat_message` | 转发消息 |
| `chat_response` | 转发回复 |
| `error` | 错误信息 |
| `pong` | 心跳响应 |

---

## ⚠️ 与 Clawbot Channel 方案对比

| 维度 | Nanobot 方案 | Clawbot Channel 方案 |
|------|-------------|---------------------|
| **架构** | 云端中转三端通信 | 直连 OpenClaw |
| **配对方式** | QR 码 + 配对码 | QR 码扫码 |
| **延迟** | 较高（需云端中转） | 低（直连） |
| **复杂度** | 高（三端） | 中（两端） |
| **可靠性** | 依赖云端稳定性 | 依赖本地连接 |
| **数据持久化** | 需要 SQLite | 使用 Supabase |

---

## 📁 原文档列表

以下三个文档已合并归档：

1. `NANOBOT_INTEGRATION_GUIDE.md` - 完整集成指南
2. `NANOBOT_IMPLEMENTATION_SUMMARY.md` - 实现总结
3. `NANOBOT_QR_CODE_MODIFICATION_GUIDE.md` - QR 码修改指南

---

## 🔗 相关链接

- 云端服务器: `ws://47.243.55.130:8765`
- Nanobot Web: `http://localhost:5000`
- 云端日志: `/tmp/cloud_server.log`
- 数据库: `/tmp/nanobot.db`

---

**归档原因**: 项目已采用 Clawbot Channel 方案实现本地 OpenClaw 直连，不再需要云端中转。

**当前方案**: 请参考 [Clawbot Channel 集成文档](../archive/clawbot/)
