---
name: trix-canvas-skill
description: |
  OpenClaw 风格 Canvas 技能：提供会话控制、剧本解析、分镜节点编排和生成结果下载。
  Canvas 服务默认在 localhost:8789，后端再调用你配置的任意生成 API（如 MiniMax/apivyi）。
  触发：用户说"用 Canvas"、"生成短剧"、"TRIX Canvas 工作流"等。
allowed-tools: Bash, Read, Glob
---

# TRIX Canvas Skill

## 环境要求

- **Canvas 服务**: `http://localhost:8789`（Node.js，packages/trix-canvas-service/）
- **Python**: `D:/python/python.exe`
- **Node.js**: `node`（启动 Canvas 服务用）

## 启动 Canvas 服务

```bash
cd packages/trix-canvas-service
node server.js
# 或指定端口：
# CANVAS_PORT=8790 node server.js
```

## 脚本索引

所有脚本在 `skills/trix-canvas-skill/scripts/`。

| 脚本 | 用途 | 关键参数 |
|------|------|------------|
| `create_session.py` | 向 Canvas session 发送消息 / 创建生成任务 | `--message`, `--project-id`, `--session-id` |
| `query_session.py` | 轮询会话结果、获取 `resultUrls` | `session_id`, `--after-seq` |
| `change_project.py` | 切换到一个新的项目 UUID | 无参数 |
| `upload_file.py` | 上传本地图片/视频作为参考素材 | `project_id`, `file`, `--type`, `--prompt` |
| `download_results.py` | 批量下载项目的 `files` | `project_id`, `--dest`, `--media-types` |
| `check_env.py` | 端口、ffmpeg、目录自检 | 无参数 |
| `parse_script.py` | 将剧本拆解成按镜头排序的 JSON | `script` 文本或文件路径 |
| `workflow.py` | 一条命令自动完成解析、生成、节点/边矩阵 | `--script`, `--project`、`--concurrent` |
| `generate.py` | 调用 AI Adapter 生成单个 media（image/video） | `--prompt`, `--type` |
| `create_node.py` | 将提示词/结果注册进 Canvas 节点 | `project_id`, `--prompt`, `--x`, `--y` |
| `create_edge.py` | 建立节点之间的场景/转场关系 | `project_id`, `source_id`, `target_id` |
| `export_subtitle.py` | 生成精确 .srt + 脚本说明 | `project_id`, `--output-dir` |
| `export_video.py` | 调用 ffmpeg 拼各镜头视频 | `project_id`, `--aspect`, `--output` |

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
python check_env.py

# 2. 创建项目
python -c "from _common import create_project; print(create_project('My Project'))"

# 3. 解析剧本
python parse_script.py "第一幕：女孩在草地跳舞\n第二幕：天空下雨"

# 4. 创建节点
python create_node.py --project-id 123 --prompt "草地跳舞" --x 0 --y 0

# 5. 创建边
python create_edge.py --project-id 123 --src 1 --tgt 2

# 6. AI 生成
python generate.py --project-id 123 --prompt "草地跳舞" --media-type image

# 7. 端到端工作流（一条命令完成上面全部）
python workflow.py --script "第一幕：女孩在草地跳舞" --project "我的视频"
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CANVAS_BASE_URL` | `http://localhost:8789` | Canvas 服务地址（渲染 /session + /projects） |
| `AI_API_BASE` | `""` | 生成服务地址（Canvas 后端会使用此 URL 调用第二跳生成接口） |
| `AI_API_KEY` | `""` | 上游 AIGC 的 Bearer Token |
| `AI_EXTRA_HEADERS` | `""` | 每行 `Key: Value`，用于补充上游 API 请求头 |
