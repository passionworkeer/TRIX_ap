---
name: trix-canvas-skill
description: |
  TRIX Canvas 工作流自动化技能。提供剧本解析、分镜生成、AI 生图/视频、
  节点编排、边连线等完整脚本。Canvas 服务器须在 localhost:8789 运行。
  触发：用户说"用 Canvas"、"生成视频分镜"、"TRIX Canvas 工作流"等。
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

所有脚本在 `skills/trix-canvas-skill/scripts/`，Python 路径前缀 `D:/python/python.exe`。

| 脚本 | 用途 | 关键接口 |
|------|------|---------|
| `check_env.py` | 环境自检（端口/AI API）| 无参数 |
| `parse_script.py` | 剧本 → JSON 分镜列表 | stdin / 参数 |
| `workflow.py` | 端到端自动化 | `--script`, `--project`, `--concurrent` |
| `generate.py` | AI 生图/视频 | `--project-id`, `--prompt`, `--media-type` |
| `create_node.py` | 创建节点 | `--project-id`, `--prompt`, `--x`, `--y` |
| `create_edge.py` | 创建边 | `--project-id`, `--src`, `--tgt` |
| `export_subtitle.py` | 导出字幕 | `--project-id`, `--output` |
| `export_video.py` | 导出视频 | `--project-id`, `--output` |
| `upload_result.py` | 上传生成结果 | `--project-id`, `--file` |

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
| `CANVAS_BASE_URL` | `http://localhost:8789` | Canvas API 地址 |
| `AI_API_BASE` | `""` | AI 服务地址（如不配置走回退解析）|
| `AI_API_KEY` | `""` | AI API Key |
| `AI_EXTRA_HEADERS` | `""` | 额外 Header（每行 `Key: Value`）|
