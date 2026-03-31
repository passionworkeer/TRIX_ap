---
name: trix-canvas-skill
description: OpenClaw 风格 Canvas 技能，提供短剧剧本解析、分镜节点编排、图片/视频排队生成和结果下载。
allowed-tools: Bash, Read, Glob
---

# TRIX Canvas Skill

## 环境要求

- **Canvas 服务**: 默认监听 `127.0.0.1:8789`
- **Python**: `python3`
- **Node.js**: `node`（启动 Canvas 服务用）

## 安装到 OpenClaw

```bash
# 自动把技能包复制到当前 OpenClaw agent workspace 的 skills 目录
python3 skills/trix-canvas-skill/scripts/install_openclaw_skill.py \
  --agent-id trix-native \
  --install-deps \
  --update-agents-md
```

安装后，OpenClaw workspace 内会得到一个完整的 `trix-canvas-skill/`，其中包含：

- `SKILL.md`
- `agents/openai.yaml`
- `scripts/`
- `assets/canvas-service/`（自带 canvas server / proxy / UI）

## 启动 Canvas 服务

```bash
# 从 skill 目录直接启动，首次会自动安装 canvas-service 的 npm 依赖
python3 skills/trix-canvas-skill/scripts/start_canvas.py --with-proxy --open

# 如果你已经在 OpenClaw workspace 内安装过这个 skill，也可以直接运行安装后的路径
# python3 ~/.openclaw/workspace-trix-native/skills/trix-canvas-skill/scripts/start_canvas.py --with-proxy --open
```

默认只绑定本机回环地址。需要对外暴露时，显式传环境变量：

```bash
CANVAS_HOST=0.0.0.0 \
CANVAS_BASE_URL=https://your-host.example.com \
python3 skills/trix-canvas-skill/scripts/start_canvas.py --with-proxy
```

或者直接指定浏览器访问地址：

```bash
python3 skills/trix-canvas-skill/scripts/start_canvas.py \
  --host 0.0.0.0 \
  --base-url https://your-host.example.com \
  --with-proxy
```

如果开启了 `CANVAS_REQUIRE_AUTH=true`，浏览器首次访问 `/canvas` 时会自动弹出令牌登录面板；CLI / Python 脚本会优先读取 `CANVAS_ACCESS_TOKEN`，未显式设置时再回退读取 `CANVAS_AUTH_TOKEN_FILE` 并自动走 `Authorization: Bearer ...`。不要通过 `?token=` 或 `#token=` 把访问令牌放进 URL。
如果未显式设置 `CANVAS_ACCESS_TOKEN`，服务会自动把生成的 token 写到 `CANVAS_AUTH_TOKEN_FILE`（默认 `runtime/data/.canvas-access-token`）并在启动日志里打印文件路径。
如果你要把画布服务直接暴露到非回环地址但又不启用鉴权，必须显式设置 `CANVAS_ALLOW_INSECURE_PUBLIC=true`。

## 脚本索引

所有脚本在 `skills/trix-canvas-skill/scripts/`。

| 脚本 | 用途 | 关键参数 |
|------|------|------------|
| `create_session.py` | 标准生成入口：创建图片/视频生成任务，并自动生成对应画布节点 | `message`, `--project-id`, `--type`, `--aspect`, `--parent-node-id` |
| `query_session.py` | 轮询会话结果、获取 `resultUrls` | `session_id`, `--after-seq` |
| `change_project.py` | 切换到一个新的项目 UUID | 无参数 |
| `upload_file.py` | 上传本地图片/视频作为参考素材 | `project_id`, `file`, `--type`, `--prompt` |
| `download_results.py` | 批量下载项目的 `files` | `project_id`, `--dest`, `--media-types` |
| `check_env.py` | 端口、ffmpeg、目录自检 | 无参数 |
| `sync_canvas_runtime.py` | 将 repo 下 `packages/trix-canvas-service` 同步回 skill 内嵌 runtime，或做一致性检查 | `--check` |
| `start_all.js` | 兼容入口：自动补 runtime 目录、缺失依赖后，再转发到 skill runtime 的 `assets/canvas-service/start-all.js` | 透传 Node 参数 |
| `parse_script.py` | 将剧本拆解成按镜头排序的 JSON | `script` 文本或文件路径 |
| `workflow.py` | 一条命令自动完成解析、按镜头顺序生成、失败重试、轮询、字幕导出、最终视频导出 | `script`, `--project-name`, `--concurrent`, `--retries`, `--skip-final-video` |
| `generate.py` | 调用 AI Adapter 生成单个 media（image/video） | `--prompt`, `--type` |
| `create_node.py` | 手工创建备注/素材/占位节点；普通生成不要先调它 | `project_id`, `--prompt`, `--x`, `--y` |
| `create_edge.py` | 建立节点之间的场景/转场关系 | `project_id`, `source_id`, `target_id` |
| `export_subtitle.py` | 生成精确 .srt + 脚本说明 | `project_id`, `--output-dir` |
| `export_video.py` | 调用 ffmpeg 拼各镜头视频 | `project_id`, `--aspect`, `--output` |

## 使用约定

- 普通图片/视频生成优先用 `create_session.py`，它会自动创建生成节点并挂上 `sessionId` / `nodeId`
- `create_node.py` 只用于手工加注释、参考素材、占位节点，不要在标准生成流里先手动建一个空节点
- 做视频续写、图生视频或变体时，再把上一个图片节点通过 `create_session.py --parent-node-id <node_id>` 传进去
- 混合短剧请直接在剧本文本里用 `image::` / `video::` 前缀标记每个镜头；`workflow.py` 会按镜头顺序执行，并让视频镜头自动依赖最近一个成功生成的图片镜头
- 对 OpenClaw / Agent：混合短剧默认优先执行 `workflow.py`，不要自己并行排图片和视频；如果必须手工调用 `create_session.py`，必须先等待父图片会话 `status=completed`，再创建对应视频会话
- 如果你要给 Agent 一个最稳的 mixed-media 输入，优先用 JSON 数组：

```json
[
  { "text": "地铁站台，女孩回头寻找男主", "media_type": "image" },
  { "text": "镜头穿过人群推进到女孩侧脸", "media_type": "video" },
  { "text": "男主停下脚步望向站台尽头", "media_type": "image" },
  { "text": "两人终于对视，站台灯光闪过", "media_type": "video" }
]
```

## 分发元数据

- `agents/openai.yaml` 已提供 UI/调用元数据，可直接作为技能包的一部分分发
- `SKILL.md` + `scripts/` + `agents/openai.yaml` + `assets/canvas-service/` 构成完整可复用 skill
- 如果你修改了 `packages/trix-canvas-service/`，在提交或发布前运行 `python3 skills/trix-canvas-skill/scripts/sync_canvas_runtime.py`，确保 skill 内嵌 runtime 与 repo runtime 一致

## Python API（`_common.py`）

```python
import sys; sys.path.insert(0, 'skills/trix-canvas-skill/scripts')
from _common import (
    create_project, get_project, list_projects,
    create_node, update_node, create_edge,
    upload_file, list_project_files, download_media,
)
```

## Canvas API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 `{name, script_text?}` |
| GET | `/api/projects/:id` | 项目详情 |
| GET | `/api/projects/:id/files` | 项目文件列表 |
| POST | `/api/upload` | 上传文件（JSON base64）|
| POST | `/api/nodes` | 创建节点 |
| PATCH | `/api/nodes/:id` | 更新节点 |
| POST | `/api/edges` | 创建连线 |
| GET | `/health` | 健康检查 |
| GET | `/canvas` | Canvas UI 页面 |

## 典型工作流

```bash
# 1. 检查环境
python3 skills/trix-canvas-skill/scripts/check_env.py

# 2. 创建项目
python3 -c "import sys; sys.path.insert(0, 'skills/trix-canvas-skill/scripts'); from _common import create_project; print(create_project('My Project'))"

# 3. 解析剧本
python3 skills/trix-canvas-skill/scripts/parse_script.py "第一幕：女孩在草地跳舞\n第二幕：天空下雨"

# 4. 如需手工注释节点再创建节点；普通生成可跳过这步
python3 skills/trix-canvas-skill/scripts/create_node.py <project_id> --prompt "导演备注：草地跳舞" --x 0 --y 0

# 5. 创建边（仅当你手工编排节点时需要）
python3 skills/trix-canvas-skill/scripts/create_edge.py <project_id> <source_node_id> <target_node_id>

# 6. 标准 AI 生成（推荐入口）
python3 skills/trix-canvas-skill/scripts/create_session.py \
  "草地跳舞的镜头，电影感，雨后夜景" \
  --project-id <project_id> \
  --type image \
  --aspect origin

# 7. 查询会话
python3 skills/trix-canvas-skill/scripts/query_session.py <session_id>

# 8. 端到端工作流（一条命令完成上面全部）
python3 skills/trix-canvas-skill/scripts/workflow.py \
  "image:: 地铁站台上女孩回头寻找男主
video:: 镜头穿过人群推进到女孩侧脸
image:: 男主拖着旅行包走出车门
video:: 两人终于对视，灯光扫过站台" \
  --project-name "Metro Reunion"
```

## OpenClaw 调用示例

```bash
openclaw agent --agent trix-native --session-id trix-canvas-demo --message \
  "Use trix-canvas-skill to create a four-shot mixed short drama. Use image:: / video:: markers or equivalent JSON scene metadata, actually generate the assets, export subtitle and final video, and report project id, session ids, subtitle path, final video path, downloaded asset paths, and canvas URL." --json
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CANVAS_BASE_URL` | `http://localhost:8789` | Canvas 服务地址（渲染 /session + /projects） |
| `CANVAS_HOST` | `127.0.0.1` | Canvas 服务实际监听地址 |
| `AI_API_BASE` | `""` | 生成服务地址（Canvas 后端会使用此 URL 调用第二跳生成接口；`start:all` 时会自动改为本地 proxy） |
| `AI_API_KEY` | `""` | 上游 AIGC 的 Bearer Token |
| `AI_GENERATE_PATH` | `/generate` | 创建任务路径 |
| `AI_TASK_PATH_TEMPLATE` | `/tasks/:taskId` | 轮询路径模板 |
| `AI_EXTRA_HEADERS` | `""` | 每行 `Key: Value`，用于补充上游 API 请求头 |
| `CANVAS_REQUIRE_AUTH` | `false` | 是否开启 Canvas API 访问令牌鉴权 |
| `CANVAS_ACCESS_TOKEN` | `""` | Canvas API / media 访问令牌；CLI 与 Python 封装会自动带上 |
| `CANVAS_AUTH_TOKEN_FILE` | `runtime/data/.canvas-access-token` | 未显式设置访问令牌时，自动生成 token 的落盘路径 |
| `CANVAS_ALLOWED_ORIGINS` | `""` | 若浏览器要从其他 origin 访问 Canvas API / media，显式填写允许来源；未列出的 `Origin` 会被拒绝 |
| `CANVAS_ALLOW_INSECURE_PUBLIC` | `false` | 是否允许把未鉴权的 Canvas 服务直接暴露到非回环地址 |
| `PROXY_ALLOWED_ORIGINS` | `""` | 若浏览器要直连 proxy，显式填写允许来源；默认拒绝带外部 `Origin` 的浏览器请求 |
| `PROXY_ACCESS_TOKEN` | `""` | 当 proxy 暴露到非回环地址时必须配置的 Bearer 访问令牌 |
| `PROXY_MAX_TASKS` | `500` | proxy 内存任务表硬上限，达到后拒绝新任务 |
| `PROXY_MAX_SESSIONS` | `500` | proxy 内存会话表硬上限，达到后拒绝新会话 |
| `RELAY_ALLOWED_ORIGINS` | `""` | 若浏览器要直连 relay，显式填写允许来源；默认拒绝带外部 `Origin` 的浏览器请求 |
| `RELAY_ACCESS_TOKEN` | `""` | 当 relay 暴露到非回环地址时必须配置的 Bearer 访问令牌 |
| `TRIX_CANVAS_ALLOW_OPENCLAW_CONFIG` | `false` | 是否允许 `start-all.js` 从 `~/.openclaw/openclaw.json` 回退读取上游 key；本机回环模式下也会自动允许 |
| `TRIX_CANVAS_SERVICE_DIR` | `""` | 手动覆盖 skill 内置 canvas-service runtime 路径 |
| `TRIX_CANVAS_RUNTIME_DIR` | `skills/trix-canvas-skill/runtime` | skill 运行时数据目录（含 data/exports） |
