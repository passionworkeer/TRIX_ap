# TRIX Canvas Service

TRIX Canvas Service 提供画布界面、项目/节点管理和会话 API。它本身不绑定任何固定 AI 厂商，使用者可以将环境变量指向任意自选的图片/视频生成服务，然后通过 Canvas Skill 或手动脚本向其提交 prompt。

## 快速启动

```bash
cd packages/trix-canvas-service
npm install
cp .env.example .env
# 方式 1：直接让 server.js 调你的上游
# 编辑 .env，填入 AI_API_BASE / AI_API_KEY / AI_GENERATE_PATH / AI_TASK_PATH_TEMPLATE
npm start

# 方式 2：本地 proxy 适配上游厂商，再让 server.js 调 proxy
# 先配置 AI_API_KEY
# 本机回环模式下也支持回退读取 ~/.openclaw/openclaw.json
npm run start:all

# 如果你要把这个服务作为 skill 发布，先把 package runtime 同步回 skill 内嵌 runtime
npm run sync:skill-runtime
```

默认只监听本机回环地址，画布地址: `http://127.0.0.1:8789/canvas`

如果需要外部访问，显式设置：

```bash
CANVAS_HOST=0.0.0.0 \
CANVAS_BASE_URL=https://your-host.example.com \
CANVAS_REQUIRE_AUTH=true \
npm start
```

如果你打开了 `CANVAS_REQUIRE_AUTH=true` 但没有手动设置 `CANVAS_ACCESS_TOKEN`，服务会自动生成一个 token 并写入 `CANVAS_AUTH_TOKEN_FILE`（默认 `./data/.canvas-access-token`），启动日志会打印这个文件路径，但不会把 token 明文打印到终端。浏览器端只应在登录面板内手动粘贴 token，不要通过 `?token=` 或 `#token=` 把访问令牌放进 URL。

如果你确实要把未鉴权的 Canvas 暴露到非回环地址，必须显式设置 `CANVAS_ALLOW_INSECURE_PUBLIC=true`；否则服务会直接拒绝启动。

## 目录结构

```
packages/trix-canvas-service/
├── server.js             # 主 API 服务（项目/节点/会话 + 静态页面）
├── relay.js              # 可选的通用边车：将 Canvas /generate 转换至任意厂商
├── proxy.js              # AI Proxy：/generate + /tasks/:id
├── start-all.js          # 一键启动 proxy + canvas
├── public/
│   └── canvas.html      # 画布 SPA
├── data/                # 运行时目录，存放 JSON 数据
├── exports/             # 导出文件（字幕/视频）
├── .env.example         # 环境变量模板
└── trix-canvas.service   # systemd 单元（参考）
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/session | 创建会话 / 提交生成任务 |
| GET  | /api/session/:id | 查询会话状态 |
| POST | /api/session/change-project | 创建或切换项目 |
| POST | /api/file/upload | 上传 base64 或 OSS 文件 |
| POST | /api/projects | 创建项目（Skill 直接调用） |
| GET  | /api/projects/:projectId | 项目详情（包含 nodes/edges/files/sessions） |
| GET  | /api/projects | 项目列表 |
| GET  | /api/projects/:projectId/export/subtitle | 导出 SRT+脚本 |
| GET  | /api/projects/:projectId/export/video | 拼接视频（需 FFmpeg 可用） |
| GET  | /media/files/:filename | 下载存储的图片/视频 |
| GET  | /health | 健康检查 |

## 运行策略

1. 先准备好 AI 生成端点（如你自己的 APIs 或第三方服务），确保它们能接收 `prompt` + `model` 等字段并返回 `url` 或 `base64`。
2. 在 `.env` 里设置 `AI_API_BASE` + `AI_API_KEY` 供 Canvas 服务向外部生成。若你的上游协议不兼容，也可以启动 `proxy.js` 或 `relay.js` 作为本地适配层。
3. 运行 `npm start` 即可启动 Canvas API；运行 `npm run proxy` 或 `npm run start:all` 可附带本地适配服务。  
4. 安装 Python Skill 或用 `curl` 调 `/api/session` 提交 prompt，随后 Canvas 会在 `/canvas?projectId=...` 显示结果。

## start-all 约定

`npm run start:all` 会：

1. 启动 `proxy.js`（默认端口 `8790`，避免占用 `trix-native` 通道默认的 `8788`）
2. 自动把 Canvas 服务的 `AI_API_BASE` 指向 `http://127.0.0.1:8790`
3. 将 Canvas 生成接口固定为 `/generate` + `/tasks/:taskId`

它优先读取这些环境变量：

- `AI_API_KEY` / `PROXY_UPSTREAM_KEY`
- `AI_API_BASE`
- `AI_IMAGE_PATH`
- `AI_IMAGE_MODEL`
- `AI_GENERATE_PATH`
- `AI_VIDEO_MODEL`

如果这些都没配，本机回环模式下会尝试回退读取 `~/.openclaw/openclaw.json` 里的 `AI_API_KEY`。
若你在非本机环境运行，请显式设置 `TRIX_CANVAS_ALLOW_OPENCLAW_CONFIG=true` 才会允许这一回退。
如果你额外给 proxy 配了 `PROXY_ACCESS_TOKEN`，`start-all.js` 会自动把这个 token 传给 Canvas 服务，保证 Canvas -> proxy 的内部请求也能通过鉴权。

`proxy.js` 默认也只允许绑定回环地址；若你确实要远程暴露 proxy，必须显式设置 `PROXY_ALLOW_REMOTE=true`，并同时配置 `PROXY_ACCESS_TOKEN`，之后调用方需要带 `Authorization: Bearer <token>`。

## Relay 配置（可选）

`relay.js` 是一个轻量适配器，用来把 `/generate` 和 `/tasks/:id` 请求转发到任意厂商。它默认也只监听 `127.0.0.1`。只需设置以下环境变量（见 `.env.example`），然后用 `node relay.js` 启动即可；若要远程暴露，需显式设置 `RELAY_ALLOW_REMOTE=true` 并配置 `RELAY_ACCESS_TOKEN`：

- `RELAY_PORT`：监听端口（默认 8791）
- `IMAGE_API_URL`, `IMAGE_API_METHOD`, `IMAGE_API_KEY`, `IMAGE_API_MODEL`
- `VIDEO_API_URL`, `VIDEO_API_METHOD`, `VIDEO_API_KEY`, `VIDEO_API_MODEL`
- `RELAY_OUTPUT_PREFIX`：如果仓库需要本地 assets，可把 base64 写入 relay 自己的 `outputs/` 并用 `http://localhost:8791/outputs/...` 访问；Canvas 主服务的导出目录仍是 `exports/`

## 授权与开放

因为本服务是开源的，所以不再嵌入任何第三方 key。请把实际的 AI 供应商密钥存放在环境变量，并确保 `.env` 写入内容不会纳入 Git（本项目已在 `.gitignore` 默认排除 `.env`、`data/`、`exports/`）。

## 环境变量概览

| 变量 | 默认 | 说明 |
|------|------|------|
| `CANVAS_PORT` | `8789` | HTTP 服务监听端口（canvas UI + API） |
| `CANVAS_HOST` | `127.0.0.1` | HTTP 服务监听地址 |
| `CANVAS_BASE_URL` | `http://127.0.0.1:8789` | Canvas UI 的公共地址 |
| `CANVAS_DATA_DIR` | `./data` | JSON 数据目录 |
| `CANVAS_EXPORT_DIR` | `./exports` | 导出字幕/视频目录 |
| `CANVAS_JSON_LIMIT` | `50mb` | API JSON 请求体大小上限 |
| `CANVAS_AI_REQUEST_TIMEOUT_MS` | `60000` | Canvas -> upstream AI 请求超时 |
| `CANVAS_REMOTE_FETCH_TIMEOUT_MS` | `30000` | 远程结果下载超时 |
| `CANVAS_MAX_UPLOAD_BYTES` | `209715200` | 上传 / 拉取到本地的单文件大小上限 |
| `CANVAS_MAX_REMOTE_DOWNLOAD_BYTES` | `209715200` | 远程下载大小上限（默认 200MB） |
| `CANVAS_ALLOW_PRIVATE_REMOTE_URLS` | `false` | 是否允许 `external_url`/上游结果访问内网地址 |
| `CANVAS_REQUIRE_AUTH` | `false` | 是否开启 Canvas API / media 访问令牌鉴权 |
| `CANVAS_ACCESS_TOKEN` | 自动生成或显式提供 | 开启鉴权后使用的访问令牌；浏览器会弹出登录面板，CLI/skill 可直接带 Bearer |
| `CANVAS_AUTH_TOKEN_FILE` | `./data/.canvas-access-token` | 未显式配置 `CANVAS_ACCESS_TOKEN` 时，自动生成 token 的落盘路径 |
| `CANVAS_ALLOWED_ORIGINS` |  | 若浏览器需要从其他 origin 访问 Canvas API / media，显式填写允许来源；未列出的 `Origin` 会被直接拒绝 |
| `CANVAS_ALLOW_INSECURE_PUBLIC` | `false` | 是否允许把未鉴权的 Canvas 绑定到非回环地址 |
| `AI_API_BASE` | (必填) | upstream AI 生成服务（canvas 会向 `/api/session` 直接请求） |
| `AI_API_KEY` | (必填) | Bearer 鉴权 |
| `AI_EXTRA_HEADERS` |  | 附加 Headers，换行分隔 |
| `AI_GENERATE_PATH` | `/generate` | 创建任务路径 |
| `AI_TASK_PATH_TEMPLATE` | `/tasks/:taskId` | 轮询路径模板 |
| `PROXY_UPSTREAM_BASE` | `https://api.apiyi.com` | `proxy.js` 上游 base URL |
| `PROXY_UPSTREAM_KEY` |  | `proxy.js` 上游鉴权 |
| `PROXY_PORT` | `8790` | `proxy.js` 监听端口 |
| `PROXY_HOST` | `127.0.0.1` | `proxy.js` 监听地址 |
| `PROXY_ALLOWED_ORIGINS` |  | 若你需要浏览器直连 proxy，显式配置允许来源；默认拒绝带外部 `Origin` 的浏览器请求 |
| `PROXY_ALLOW_REMOTE` | `false` | 是否允许把 proxy 绑定到非回环地址 |
| `PROXY_ACCESS_TOKEN` |  | 当 proxy 绑定到非回环地址时，必须配置的 Bearer 访问令牌 |
| `PROXY_MAX_BODY_BYTES` | `262144` | proxy 请求体上限 |
| `PROXY_REQUEST_TIMEOUT_MS` | `120000` | proxy 上游请求超时 |
| `PROXY_TASK_TTL_MS` | `3600000` | proxy 内存任务保留时长 |
| `PROXY_SESSION_TTL_MS` | `3600000` | proxy 内存会话保留时长 |
| `PROXY_MAX_TASKS` | `500` | proxy 内存任务表硬上限，达到后拒绝新任务 |
| `PROXY_MAX_SESSIONS` | `500` | proxy 内存会话表硬上限，达到后拒绝新会话 |
| `PROXY_IMAGE_PATH` | `/v1/image_generation` | `proxy.js` 图片接口 |
| `PROXY_IMAGE_MODEL` | `image-01` | `proxy.js` 图片模型 |
| `PROXY_GENERATE_PATH` | `/anthropic/v1/messages` | `proxy.js` 非图片生成接口 |
| `PROXY_MODEL` | — | `proxy.js` 非图片模型（已废弃，统一使用 AI_GENERATE_PATH） |
| `IMAGE_API_URL` |  | Relay 发送图片 prompt 的供应商地址 |
| `IMAGE_API_KEY` |  | 图片供应商鉴权 |
| `IMAGE_API_MODEL` | `image-01` | 可选模型标识 |
| `VIDEO_API_URL` |  | Relay 发送视频 prompt 的供应商地址 |
| `VIDEO_API_KEY` |  | 视频供应商鉴权 |
| `VIDEO_API_MODEL` | `veo-3.1-fast` | 可选模型标识 |
| `RELAY_OUTPUT_PREFIX` | `http://localhost:8791/outputs` | base64 输出归属 URL |
| `RELAY_PORT` | `8791` | Relay 监听端口 |
| `RELAY_HOST` | `127.0.0.1` | Relay 监听地址 |
| `RELAY_ALLOWED_ORIGINS` |  | 若你需要浏览器直连 relay，显式配置允许来源；默认拒绝带外部 `Origin` 的浏览器请求 |
| `RELAY_ALLOW_REMOTE` | `false` | 是否允许把 relay 绑定到非回环地址 |
| `RELAY_ACCESS_TOKEN` |  | 当 relay 绑定到非回环地址时，必须配置的 Bearer 访问令牌 |
| `RELAY_MAX_BODY_BYTES` | `262144` | relay 请求体上限 |
| `RELAY_REQUEST_TIMEOUT_MS` | `120000` | relay 上游请求超时 |
| `RELAY_TASK_TTL_MS` | `3600000` | relay 内存任务保留时长 |
