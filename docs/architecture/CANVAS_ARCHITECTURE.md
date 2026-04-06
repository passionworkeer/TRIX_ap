# Canvas Service 架构

> **最后更新**: 2026-04-04
> **唯一权威文档**: `packages/trix-canvas-service/README.md` & `skills/trix-canvas-skill/SKILL.md`

---

## 1. 概述

Canvas 是 TRIX 的 AI 生成结果展示与编排服务，提供：

- **节点图编排**：通过图节点（节点 + 边）组织分镜，支持图片/视频/字幕多种媒体类型
- **AI 生成**：通过后端 proxy 桥接 MiniMax / APIyi 等生成服务
- **Canvas UI**：可视化编辑器，浏览器访问
- **脚本工具**：Python CLI + Node.js 入口，供 OpenClaw Agent 调用

---

## 2. 系统架构

```
Browser / OpenClaw Agent
        │
        ▼
┌─────────────────── 8789 ───────────────────┐
│         Canvas Service (Express)             │
│  - REST API (projects, nodes, edges)        │
│  - Canvas UI (HTML/JS)                      │
│  - 文件管理 (data/)                         │
│  - Session 管理                             │
└────────────────────────┬────────────────────┘
                         │ AI_API_BASE (本地 proxy)
                         ▼
┌─────────────────── 8790 ───────────────────┐
│           Proxy (AI 网关)                   │
│  - 请求转发到 Relay                          │
│  - 任务表 / 会话表内存管理                   │
│  - 模型检测 (MiniMax / APIyi)              │
│  - 结果聚合                                  │
└────────────────────────┬────────────────────┘
                         │ HTTP → Relay
                         ▼
┌─────────────────── 8788 ───────────────────┐
│            Relay (TRIX Native)              │
│  - 实际调用 MiniMax / APIyi / VEO 等         │
│  - WebSocket 流式推送                       │
└─────────────────────────────────────────────┘
```

---

## 3. 组件详解

### 3.1 Canvas Service (`server.js`，端口 8789）

Express 服务，管理项目、节点、边、文件。

| 文件 | 职责 |
|------|------|
| `server.js` | 主入口，路由注册 |
| `canvas8791.js` | Canvas HTTP API 处理器（项目/节点/边） |
| `canvasSecurity.js` | 鉴权、CORS、安全检查 |
| `public/` | 静态资源，Canvas UI 前端 |
| `data/` | 项目数据（SQLite 数据库 `canvas.sqlite` + 导出任务 JSON）|
| `outputs/` | AI 生成的图片/视频文件 |
| `scripts/` | 辅助脚本（导出、字幕等）|

### 3.2 Proxy (`proxy.js`，端口 8790)

AI 请求代理，支持多 Provider（MiniMax、APIyi）。

- 请求转发至 Relay（8788）
- 模型自动检测（`imageToVideo` 等能力探测）
- 任务/会话内存硬上限（默认各 500）
- 终态淘汰（completed / failed 超过阈值后清理）

### 3.3 Relay（8788，TRIX Native Channel）

实际 AI 生成后端。通过 Canvas Skill 脚本调用，不直接暴露给浏览器。

支持的 Provider：`minimax`（MiniMax）、`apivyi`（APIyi，含 VEO 3.1、Nano Banana）

---

## 4. 关键端口

| 端口 | 服务 | 访问来源 |
|------|------|---------|
| 8788 | TRIX Native / Relay | Canvas Service / Proxy |
| 8789 | Canvas Service | 本机浏览器 / OpenClaw Agent |
| 8790 | Proxy | Canvas Service |
| 8791 | Canvas Service（备）| 旧版 |

默认绑定 `127.0.0.1`，外网访问需设置 `CANVAS_HOST=0.0.0.0`。

---

## 5. Canvas Skill 脚本

位于 `skills/trix-canvas-skill/scripts/`，共 20 个（19 Python + 1 JS）。

| 脚本 | 用途 |
|------|------|
| `workflow.py` | 端到端：解析剧本 → 按镜头生成 → 字幕 → 最终视频 |
| `create_session.py` | 标准 AI 生成入口（推荐）|
| `query_session.py` | 轮询会话结果 |
| `parse_script.py` | 剧本拆解为镜头 JSON |
| `upload_file.py` / `upload_result.py` | 上传素材或生成结果 |
| `download_results.py` | 批量下载项目文件 |
| `export_video.py` / `export_subtitle.py` | ffmpeg 导出 |
| `start_canvas.py` | 启动 Canvas 服务 |
| `install_openclaw_skill.py` | 安装到 OpenClaw workspace |
| `sync_canvas_runtime.py` | 同步 repo → skill runtime |

详情见 `skills/trix-canvas-skill/SKILL.md`。

---

## 6. 鉴权模型

- **本机模式（默认）**：无鉴权，只允许 `127.0.0.1`
- **API Token**：`CANVAS_REQUIRE_AUTH=true` + `CANVAS_ACCESS_TOKEN`，CLI/Python 脚本自动带 Bearer Token
- **CORS**：`CANVAS_ALLOWED_ORIGINS` 控制跨域访问
- **公开暴露**：`CANVAS_ALLOW_INSECURE_PUBLIC=true`（不推荐）

**安全红线**：禁止通过 `?token=` 或 `#token=` 把访问令牌放进 URL。

---

## 7. 数据流示例

```
OpenClaw Agent 调用 workflow.py
  → parse_script.py 拆解剧本为镜头
  → create_session.py 为每个镜头创建节点 + Session
  → Proxy (8790) → Relay (8788) → MiniMax / APIyi
  → query_session.py 轮询结果
  → Canvas Service 保存 resultUrls 到节点
  → export_video.py 调用 ffmpeg 合成最终视频
  → export_subtitle.py 生成 .srt
```

---

## 8. 与三端的关系

| 端 | 关系 |
|----|------|
| Web | 不直接集成，通过 OpenClaw Agent 间接调用 |
| iOS | 不涉及 |
| Desktop | 不涉及 |
| OpenClaw Agent | 主要调用方，通过 Canvas Skill 脚本操作 |

---

## 9. 关键环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `CANVAS_HOST` | `127.0.0.1` | 监听地址 |
| `CANVAS_BASE_URL` | `http://localhost:8789` | 外部访问基址 |
| `AI_API_KEY` | — | MiniMax / APIyi 的 Bearer Token |
| `AI_API_BASE` | — | Proxy 地址（`start:all` 时自动指向本地 8790）|
| `CANVAS_REQUIRE_AUTH` | `false` | 开启 API Token 鉴权 |
| `PROXY_MAX_TASKS` | `500` | Proxy 任务表硬上限 |
| `PROXY_MAX_SESSIONS` | `500` | Proxy 会话表硬上限 |
