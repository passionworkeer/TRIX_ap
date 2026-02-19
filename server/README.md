# Clawbot Channel 服务器部署指南

> 说明：当前线上唯一后端链路是 **OpenClaw/Clawbot Channel**。`nanobot` 已归档，不再参与部署与重启。

## 目录结构

```text
server/
└── clawbot-channel/
    ├── server.js
    ├── ecosystem.config.js
    ├── .env.example
    └── DEPLOYMENT_GUIDE.md
```

## 快速部署（推荐）

```bash
# 在项目根目录执行
chmod +x deploy.sh
./deploy.sh clawbot
```

## 初始化服务器

```bash
./deploy.sh init-server
```

## 重启服务

```bash
./deploy.sh restart
```

`restart` 只会管理 PM2 进程 `clawbot-channel`，不会再操作任何 nanobot Python 服务。

## 手动检查

```bash
pm2 status clawbot-channel
pm2 logs clawbot-channel --lines 100
curl http://127.0.0.1:8765/health
```

## App 端配置

```env
VITE_CLAWBOT_CHANNEL_URL=wss://<your-domain-or-ip>:8765
```

## 迁移提示

- 旧的 `server/cloud_server.py`、`server/cloud_server_advanced.py` 属于历史 nanobot 实现。
- 如需保留请迁移到 `archive/`，不要作为当前部署入口。
