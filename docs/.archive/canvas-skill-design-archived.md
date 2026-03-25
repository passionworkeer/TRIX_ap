# TRIX Canvas Skill — 优化设计方案 v3

> 日期：2026-03-24
> 状态：基于 v2 优化，解决具体实现问题

---

## 一、v2 → v3 主要优化点

| 问题 | v2 处理 | v3 优化 |
|------|---------|---------|
| sync/async 未决 | Adapter 示例用 async | 明确用同步 urllib（复用现有 _common.py），Adapter 返回 `bytes` |
| ffmpeg 依赖未提 | 只说"按顺序拼接" | 显式声明 ffmpeg 依赖，写 `check_ffmpeg()` 启动自检 |
| 并发生成 | "对每个分镜并发执行" | 显式用 `ThreadPoolExecutor`，max_workers 可配置 |
| generate 脚本重复 | image.py + video.py 两个文件 | 合并为 `generate.py --type image\|video`，共用 Adapter |
| Canvas 自检 | 未提 | `start_canvas.py` 启动时检查端口、ffmpeg、创建目录 |
| Web UI 自启动 | 只说"浏览器打开" | 新增 `open_canvas.py` 或 `--open` 参数自动打开浏览器 |

---

## 二、Adapter 层（最终版）

保持同步，复用现有 `_common.py` 的 urllib 风格，不引入新依赖：

```python
# scripts/adapters/trix_adapter.py

class TRIXAdapter:
    """TRIX AI 适配器：统一同步调用，自动处理同步/异步返回"""

    def __init__(self, api_base: str, api_key: str):
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self._session_create_url = f"{api_base}/api/session"
        self._poll_count = 0
        self._max_polls = 60       # 最多轮询60次（约5分钟）
        self._poll_interval = 5    # 每5秒轮询一次

    # ---------- 统一入口 ----------

    def generate(self, prompt: str, media_type: str = "image") -> dict:
        """
        统一生成接口，返回 dict:
          { "bytes": <二进制数据>, "mime": "image/png" | "video/mp4", "ok": True }
          或 { "ok": False, "error": "..." }
        """
        if media_type == "image":
            return self._generate_image(prompt)
        else:
            return self._generate_video(prompt)

    # ---------- 内部实现 ----------

    def _generate_image(self, prompt: str) -> dict:
        session = self._create_session(prompt)
        task_id = session.get("taskId")

        if not task_id:
            # 同步返回：直接解析 URL
            return self._extract_bytes_from_session(session)

        # 异步：轮询等待
        return self._poll(task_id, session["sessionId"])

    def _generate_video(self, prompt: str) -> dict:
        # 图生视频接口路径可能不同，暂用同一 /generate 端点
        # 如有独立 video 端点，在 _common.py 中扩展
        return self._generate_image(prompt)  # TODO: 替换为 video 专用逻辑

    def _create_session(self, message: str) -> dict:
        body = json.dumps({"message": message}).encode()
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        req = urllib.request.Request(
            self._session_create_url, data=body, method="POST", headers=headers
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    def _poll(self, task_id: str, session_id: str) -> dict:
        """轮询直到 AI 生成完成，返回 bytes"""
        import time
        self._poll_count = 0
        while self._poll_count < self._max_polls:
            time.sleep(self._poll_interval)
            self._poll_count += 1

            data = query_session(session_id)  # 复用 _common.py
            status = data.get("status", "")

            if status == "completed":
                return self._extract_bytes_from_session(data)
            elif status == "failed":
                return {"ok": False, "error": f"AI 生成失败: {data.get('error')}"}

        return {"ok": False, "error": "轮询超时（5分钟）"}

    def _extract_bytes_from_session(self, session_data: dict) -> dict:
        """从 session 数据中提取图片/视频 URL 并下载为 bytes"""
        urls = session_data.get("resultUrls", [])
        if not urls:
            # 从 messages 中正则提取
            import re
            MEDIA_PATTERN = re.compile(
                r'https?://[^\s"\'<>\[\]]+\.(?:png|jpg|jpeg|webp|mp4|mov)',
                re.IGNORECASE
            )
            for msg in session_data.get("messages", []):
                found = MEDIA_PATTERN.findall(msg.get("content", ""))
                urls.extend(found)

        if not urls:
            return {"ok": False, "error": "session 中未找到产出 URL"}

        # 取第一个媒体文件下载
        url = urls[0]
        req = urllib.request.Request(url, headers={"User-Agent": "TRIX-Canvas-Skill/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            content_type = resp.headers.get("Content-Type", "")
            bytes_data = resp.read()

        mime = self._ext_to_mime(url)
        return {"ok": True, "bytes": bytes_data, "mime": content_type or mime}

    @staticmethod
    def _ext_to_mime(url: str) -> str:
        ext = url.split("?")[0].rsplit(".", 1)[-1].lower()
        return {
            "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "webp": "image/webp", "gif": "image/gif",
            "mp4": "video/mp4", "mov": "video/quicktime",
        }.get(ext, "application/octet-stream")
```

**设计要点：**
- 同步函数，不需要 asyncio，最大兼容现有代码
- `_extract_bytes_from_session`：复用 `query_session` 结果，内置 URL 正则提取，不依赖外部
- `_poll`：最外层控制超时，不无限循环
- 调用方只管 `adapter.generate(prompt)`，完全不知道 sync/async 差异

---

## 三、目录结构（最终版）

```
skills/trix-canvas-skill/
├── SKILL.md                          # OpenClaw 技能说明
├── README.md                         # 用户安装使用文档
│
├── canvas/                           # Canvas 服务（独立运行）
│   ├── canvas_server.py              # FastAPI 入口
│   ├── models.py                     # Pydantic 请求/响应模型
│   ├── database.py                    # SQLite CRUD
│   ├── storage.py                    # 文件存储（~/.trix-canvas/）
│   ├── thumbnail.py                   # 缩略图生成（PIL）
│   ├── utils.py                      # 工具函数（check_ffmpeg 等）
│   ├── requirements.txt               # fastapi, uvicorn, aiofiles, Pillow
│   │
│   ├── templates/
│   │   └── index.html                # Canvas Web UI（litegraph.js）
│   │
│   └── static/
│       ├── style.css
│       └── app.js                    # Canvas Web UI 交互逻辑
│
└── scripts/                          # Agent 调用脚本
    ├── _common.py                     # 共享配置（同现有）
    ├── adapters/
    │   ├── base.py                    # Adapter 基类（可选，文档说明用）
    │   └── trix_adapter.py            # TRIX 适配器（核心）
    ├── parse_script.py                # AI 解析剧本 → JSON 分镜
    ├── workflow.py                     # 【新增】串联全流程的主脚本
    ├── generate.py                    # 【合并】generate image/video
    ├── upload_result.py               # 上传生成结果到 Canvas
    ├── create_node.py                 # 创建节点
    ├── create_edge.py                 # 创建连线
    ├── export_video.py                # ffmpeg 拼接视频
    ├── export_subtitle.py             # 导出 .srt + 台词文档
    ├── start_canvas.py                # 一键启动 Canvas（带自检）
    └── check_env.py                   # 环境变量检查
```

**关键变更：**
- 新增 `workflow.py`：Agent 调用一个脚本就跑完整个流程，降低 Agent 操作复杂度
- `generate.py` 合并了 image/video：用 `--type image|video` 区分，共用 Adapter
- `start_canvas.py` 包含完整自检：`check_ffmpeg()` + 端口检测 + 创建目录

---

## 四、workflow.py — 主流程脚本

```python
#!/usr/bin/env python3
"""
workflow.py — 串联剧本 → 分镜 → 生成 → 节点图 的完整流程
Agent 只需调用一个脚本即完成全部工作
"""

def main():
    parser = argparse.ArgumentParser(description="TRIX Canvas 完整工作流")
    parser.add_argument("script", help="分镜剧本文本")
    parser.add_argument("--project-name", default="", help="项目名称")
    parser.add_argument("--canvas-url", default="", help="Canvas 地址")
    parser.add_argument("--concurrent", type=int, default=3, help="并发生成数（默认3）")
    parser.add_argument("--skip-video", action="store_true", help="跳过视频生成")
    args = parser.parse_args()

    # 1. 检查环境
    check_env()

    # 2. 解析剧本
    scenes = parse_script(args.script)
    print(f"解析完成：{len(scenes)} 个分镜")

    # 3. 创建项目
    project = create_project(args.project_name or "短剧项目")
    project_id = project["id"]
    print(f"项目创建：{project['name']} (id={project_id})")

    # 4. 生成图片（并发）
    adapter = TRIXAdapter(AI_API_BASE, AI_API_KEY)
    from concurrent.futures import ThreadPoolExecutor, as_completed

    nodes = []  # (scene_index, image_bytes, video_bytes)

    def gen_image(scene_idx, prompt):
        result = adapter.generate(prompt, media_type="image")
        if not result["ok"]:
            return scene_idx, None, None
        return scene_idx, result["bytes"], None

    with ThreadPoolExecutor(max_workers=args.concurrent) as pool:
        futures = {
            pool.submit(gen_image, i, s["text"]): i
            for i, s in enumerate(scenes)
        }
        for future in as_completed(futures):
            idx, img_bytes, vid_bytes = future.result()
            nodes.append((idx, img_bytes, vid_bytes))

    # 5. 上传 + 建节点 + 建连线
    nodes.sort(key=lambda x: x[0])  # 按分镜顺序
    prev_node_id = None

    for scene_idx, img_bytes, _ in nodes:
        if img_bytes is None:
            continue

        # 上传图片
        file_info = upload_result(img_bytes, mime="image/png")
        oss_url = file_info["url"]

        # 上传完成后，下载回本地给 Canvas 存储
        local_path = download_to_canvas_storage(oss_url, project_id)

        # 生成缩略图
        thumb_path = make_thumbnail(local_path)

        # 创建节点
        node = create_node(
            project_id=project_id,
            scene_id=scene_idx + 1,
            media_type="image",
            local_path=local_path,
            thumbnail_path=thumb_path,
            prompt=scenes[scene_idx]["text"],
            x=scene_idx * 300,
            y=100 + (scene_idx % 2) * 80,  # 轻微上下抖动
        )

        # 场景顺序连线
        if prev_node_id:
            create_edge(project_id, prev_node_id, node["id"], "scene_order")
        prev_node_id = node["id"]

    # 6. 生成视频（可选）
    if not args.skip_video:
        # ... 视频生成流程，同图片逻辑
        pass

    # 7. 导出
    if not args.skip_video:
        export_video(project_id)
    export_subtitle(project_id)

    print(f"\n完成！打开画布：http://localhost:8789/  查看项目 {project_id}")


if __name__ == "__main__":
    main()
```

---

## 五、Canvas Web UI（litegraph.js 接入方案）

### 接入方式

CDN 引入，不打包，保持轻量：

```html
<!-- templates/index.html -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/litegraph@0.7.9/css/litegraph.css">
<script src="https://cdn.jsdelivr.net/npm/litegraph@0.7.9/js/litegraph.core.js"></script>
<script src="/static/app.js"></script>
```

### 节点渲染

每个 Canvas 节点展示：

```
┌─────────────────────────────┐
│ [图片缩略图 / 视频预览]     │
│                             │
│ [镜头1] 城市夜景...          │  ← 可折叠/展开
│ 🟢 done | PNG | 1920×1080   │
│                             │
│ [重新生成] [删除]           │
└─────────────────────────────┘
```

### 连线类型视觉区分

| edge_type | 颜色 | 样式 |
|-----------|------|------|
| `scene_order` | 灰色 `#888` | 实线，2px |
| `image_to_video` | 蓝色 `#4a9eff` | 实线，3px，箭头 |
| `reference` | 黄色 `#f0c040` | 虚线，2px |

### 右键菜单

- **重新生成**：PATCH `/api/nodes/:id` → status=pending → WebSocket 通知 Agent 重跑
- **查看大图**：modal 全屏预览
- **复制提示词**：一键复制到剪贴板
- **删除节点**：DELETE `/api/nodes/:id`（同时删除关联边）
- **导出此分镜**：下载该节点对应的图片/视频

---

## 六、自检逻辑（start_canvas.py）

```python
def preflight_checks():
    errors = []

    # 1. 端口检测
    import socket
    sock = socket.socket()
    if sock.connect_ex(("localhost", 8789)) == 0:
        sock.close()
        print("⚠️  Canvas 已在运行于 http://localhost:8789")
        return  # 不退出，让用户直接用
    sock.close()

    # 2. ffmpeg 检测
    import subprocess
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, timeout=5
        )
        if result.returncode != 0:
            errors.append("ffmpeg 未安装或无法运行")
    except FileNotFoundError:
        errors.append("ffmpeg 未找到，请安装: pip install imageio[ffmpeg]")
    except subprocess.TimeoutExpired:
        errors.append("ffmpeg 版本检测超时")

    # 3. 目录创建
    canvas_dir = Path.home() / ".trix-canvas"
    (canvas_dir / "projects").mkdir(parents=True, exist_ok=True)

    if errors:
        for err in errors:
            print(f"❌ {err}")
        print("\n修复后重新运行 python start_canvas.py")
        sys.exit(1)

    print("✅ 自检通过")
    print("🚀 启动 Canvas 服务...")
    # 启动 uvicorn ...
```

---

## 七、API 完整清单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | Canvas Web UI |
| GET | `/api/projects` | 列出项目 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/:id` | 项目详情（含 nodes + edges） |
| DELETE | `/api/projects/:id` | 删除项目 |
| POST | `/api/upload` | 上传文件 |
| GET | `/api/files/:id` | 文件详情 |
| DELETE | `/api/files/:id` | 删除文件 |
| PATCH | `/api/files/:id` | 更新文件元信息 |
| POST | `/api/nodes` | 创建节点 |
| GET | `/api/nodes/:id` | 节点详情 |
| PATCH | `/api/nodes/:id` | 更新节点（坐标/状态/prompt） |
| DELETE | `/api/nodes/:id` | 删除节点 |
| POST | `/api/nodes/:id/regenerate` | 标记待重生成 |
| POST | `/api/edges` | 创建连线 |
| DELETE | `/api/edges/:id` | 删除连线 |
| GET | `/api/projects/:id/export/video` | 导出拼接视频 |
| GET | `/api/projects/:id/export/subtitle` | 导出字幕文件 |

---

## 八、已确认结论

| 问题 | 结论 |
|------|------|
| sync/async | 同步 urllib，复用现有 _common.py |
| ffmpeg 依赖 | 启动自检，未安装时提示安装 |
| 视频拼接顺序 | 按分镜序号（scene_id），Canvas 暂不支持手动调序 |
| 自定义AI接口 | 直接复用现有 `/api/session` 端点 |

---

## 九、实现优先级

**Phase 1（先跑通核心链路）：**
1. Canvas 服务（server + SQLite + 基础 CRUD API）
2. Web UI（litegraph.js 接入，节点+连线渲染）
3. Adapter + generate.py
4. workflow.py 串联全流程

**Phase 2（增强功能）：**
5. 视频生成 + export_video.py
6. 字幕导出 + export_subtitle.py
7. 节点重生成（右键菜单 + regenerate API）
8. 拖拽坐标持久化
