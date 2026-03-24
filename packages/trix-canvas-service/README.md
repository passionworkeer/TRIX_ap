# TRIX Canvas Service

AI 生成结果展示服务 — 画布页面 + 会话 API。

## 快速开始

```bash
cd packages/trix-canvas-service

# 1. 安装
npm install

# 2. 配置（复制并编辑 .env）
cp .env.example .env

# 3. 启动
npm start
```

访问 `http://localhost:8789/canvas`

## 目录结构

```
packages/trix-canvas-service/
├── server.js           # Express 服务端（API + 静态文件）
├── public/
│   └── canvas.html    # 画布 SPA 页面
├── data/              # 项目/会话 JSON 数据（gitignore）
├── outputs/           # 生成文件（gitignore）
├── .env.example       # 环境变量模板
└── scripts/
    └── setup.js       # 安装向导
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/session | 创建会话 / 提交生成任务 |
| GET  | /api/session/:id | 查询会话状态 |
| POST | /api/session/change-project | 切换/创建项目 |
| POST | /api/file/upload | 上传文件 |
| GET  | /api/project/:id | 获取项目详情 |
| GET  | /api/projects | 列出所有项目 |
| GET  | /health | 健康检查 |

## 服务器部署

```bash
# 1. 将整个目录复制到服务器
scp -r packages/trix-canvas-service/ root@TRIX_SERVER_HOST:/var/www/canvas

# 2. SSH 进去配置
ssh root@TRIX_SERVER_HOST
cd /var/www/canvas

# 3. 安装并配置
npm install
cp .env.example .env
nano .env  # 填入 AI_API_BASE / AI_API_KEY

# 4. 注册 systemd 服务
cp trix-canvas.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable trix-canvas
systemctl start trix-canvas

# 5. 配置 Nginx 代理到 8789 端口
# （见 deploy workflow 中的 nginx 配置片段）
```

## 与 SKILL 对接

Python Skill 位于 `skills/trix-gen-skill/`，会自动调用 Canvas 服务的 API。

1. 将 `skills/trix-gen-skill/` 目录放到 Agent 可识别的 skills 路径
2. 在 Agent 环境变量中设置 `AI_API_BASE`、`AI_API_KEY`、`CANVAS_BASE_URL`
3. Agent 即可通过自然语言调用生成任务

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| AI_API_BASE | ✅ | — | AI 生成服务基础地址 |
| AI_API_KEY | ✅ | — | Bearer 鉴权 Token |
| CANVAS_BASE_URL | — | http://localhost:8789 | 画布访问基础 URL |
| CANVAS_PORT | — | 8789 | 服务监听端口 |
| CANVAS_DATA_DIR | — | ./data | 项目数据目录 |
| CANVAS_OUTPUT_DIR | — | ./outputs | 输出文件目录 |
| UPLOAD_API_URL | — | — | OSS 上传地址 |
| UPLOAD_API_KEY | — | — | OSS 鉴权 Token |
