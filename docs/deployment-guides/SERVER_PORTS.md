# 服务器端口分配

## 当前生效配置（MVP）

| 服务 | 端口 | 协议 | 状态 |
|---|---:|---|---|
| Clawbot Channel | 8765 | HTTP + Socket.io(WebSocket) | 生产使用中 |
| OpenClaw Gateway | 18789 | WebSocket | 内网/网关侧 |

## 运维命令

```bash
# 服务状态
pm2 status clawbot-channel

# 日志
pm2 logs clawbot-channel --lines 100

# 本机健康检查
curl http://127.0.0.1:8765/health
```

## 注意事项

1. `deploy.sh restart` 现仅重启 `clawbot-channel`。
2. 任何 nanobot 相关端口和服务均视为归档，不再纳入当前部署流程。
3. 生产环境请通过反向代理暴露 `8765`，并使用 `wss`。
