# Nanobot 代码归档

归档日期: 2026-02-19
归档原因: 项目全面转向 OpenClaw/Gateway 架构

## 归档内容

### 前端代码
- `src/contexts/NanobotContext.tsx` - Nanobot React Context
- `src/services/NanobotBridge.ts` - Nanobot WebSocket Bridge
- `src/screens/NanobotPairing.tsx` - 配对页面

### 后端代码
- `nanobot/nanobot/` - Python 后端服务
- `nanobot/frontend/` - 独立前端应用

### 部署配置
- `deployments/backend/nanobot/` - 部署脚本

## 恢复方法

1. 复制文件回原位置:
   ```bash
   cp -r archive/nanobot/src/* src/
   ```

2. 恢复 App.tsx 中的 Provider 包裹

3. 添加路由:
   ```typescript
   AppRoutes.NANOBOT_PAIRING = '/nanobot-pairing'
   ```

4. 安装依赖:
   ```bash
   cd nanobot/nanobot && pip install -r requirements.txt
   ```

## 已知问题

详见 `DEBUG_GUIDE.md` 中的 P0-P3 问题列表

## 相关文档

- `docs/archive/NANOBOT_ARCHIVE.md` - 历史归档记录
- `DEBUG_GUIDE.md` - 调试指南和问题清单
