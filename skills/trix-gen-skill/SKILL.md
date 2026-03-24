---
name: trix-gen-skill
description: TRIX AI 生成技能 - 通过自然语言生成图片/视频。覆盖场景：文生图、文生视频、图生视频、图片编辑修改、风格转换、视频延长。当用户提到生成图片、生成视频、做图、做视频、图片处理、风格转换时触发。典型指令包括「生成一张 xxx 图片」「做一个 xxx 视频」「帮我画 xxx」「把 xxx 改成 xxx」「换个风格」「续写这段视频」等。
user-invocable: true
metadata:
  {
    "openclaw":
      {
        "emoji": "🎨",
        "requires":
          {
            "bins": ["python3"],
            "env": ["AI_API_BASE", "AI_API_KEY"]
          },
        "primaryEnv": "AI_API_KEY"
      }
  }
---

# TRIX AI 生成技能

通过自然语言指令，调用你的 AI 模型生成图片或视频，并自动展示生成结果。

## 功能

1. **生成** - 文生图、文生视频、图生视频、图片编辑
2. **查询进度** - 轮询生成任务状态
3. **项目管理** - 按项目隔离生成记录
4. **文件上传** - 上传参考图/视频到 OSS
5. **结果下载** - 下载生成的图片/视频到本地

## 前置要求

```bash
# 必填：AI 服务基础地址（末尾不要斜杠）
export AI_API_BASE="https://你的API地址/v1"

# 必填：AI 服务鉴权 Token
export AI_API_KEY="your-api-key"

# 选填：文件上传地址（上传参考图/视频用）
export UPLOAD_API_URL="https://你的上传地址/upload"

# 选填：Canvas 画布服务地址（默认自动检测）
export CANVAS_BASE_URL="http://TRIX_SERVER_HOST:8789"
```

## 使用方法

### 1. 生成图片/视频

```bash
# 创建新会话并发送生成指令
python3 {baseDir}/scripts/create_session.py "生成一张赛博朋克风格的城市夜景"

# 向已有会话追加新任务
python3 {baseDir}/scripts/create_session.py "再生成一张晴天版本" --session-id SESSION_ID
```

### 2. 查询生成进度

```bash
# 查询会话状态
python3 {baseDir}/scripts/query_session.py SESSION_ID

# 增量拉取（只返回新消息）
python3 {baseDir}/scripts/query_session.py SESSION_ID --after-seq 0
```

### 3. 下载结果

```bash
# 下载会话中所有生成的图片/视频
python3 {baseDir}/scripts/download_results.py SESSION_ID

# 指定输出目录
python3 {baseDir}/scripts/download_results.py SESSION_ID --output-dir ~/Downloads/my_project

# 指定文件名前缀
python3 {baseDir}/scripts/download_results.py SESSION_ID --prefix "cyberpunk"
```

### 4. 上传参考文件

```bash
# 上传参考图
python3 {baseDir}/scripts/upload_file.py /path/to/reference.png

# 上传视频后编辑
python3 {baseDir}/scripts/upload_file.py /path/to/video.mp4
```

### 5. 切换项目

```bash
# 创建新项目（隔离不同任务）
python3 {baseDir}/scripts/change_project.py
```

## 典型工作流

### 场景 1：文生图/文生视频（最常用）

```
1. create_session.py "描述"  →  拿到 sessionId + projectUuid
2. 每 8 秒调用 query_session.py SESSION_ID --after-seq 0 轮询
3. 检查 messages：当出现 assistant 消息含 URL → 完成
4. download_results.py SESSION_ID 下载到本地
5. 展示：本地文件路径 + canvas 画布链接
```

### 场景 2：图生视频（上传参考图）

```
1. upload_file.py /path/to/image.png  →  拿到 OSS URL
2. create_session.py "根据参考图生成一段行走动画，参考图：{oss_url}"
3. 轮询同场景 1
```

### 场景 3：编辑修改已有图片

```
1. upload_file.py /path/to/image.png  →  拿到 OSS URL
2. create_session.py "把背景换成夜景，参考图：{oss_url}"
3. 轮询同场景 1
```

## 输出格式

**create_session** 返回：
```json
{
  "projectUuid": "xxx-uuid",
  "sessionId": "xxx-session-id",
  "taskId": "可选，AI服务返回的任务ID",
  "projectUrl": "http://TRIX_SERVER_HOST:8789/canvas?projectId=xxx"
}
```

**query_session** 返回：
```json
{
  "messages": [
    {"role": "user", "content": "生成一张赛博朋克城市夜景"},
    {"role": "assistant", "content": "任务已提交: task_xxx"},
    {"role": "assistant", "content": "生成完成: https://..."}
  ],
  "status": "completed",
  "resultUrls": ["https://xxx.png"]
}
```

## API 适配说明

此 skill 对接以下 AI 服务接口：

| 端点 | 方法 | 说明 |
|------|------|------|
| `{AI_API_BASE}/generate` | POST | 提交生成任务，返回 taskId |
| `{AI_API_BASE}/tasks/{taskId}` | GET | 查询任务状态 |
| `{UPLOAD_API_URL}` | POST | 上传文件到 OSS |

如果你的 API 格式不同，只需修改 `{baseDir}/scripts/_common.py` 中的字段映射即可，无需改动工作流。

## 画布链接

生成完成后，projectUrl 指向 TRIX Canvas 画布，可在此查看所有生成记录：
`http://TRIX_SERVER_HOST:8789/canvas?projectId={projectId}`
