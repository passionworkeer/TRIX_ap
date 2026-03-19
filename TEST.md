# 当前验证摘要

## 已通过

- `npm --workspace packages/trix-openclaw-native test`
- `npm --workspace packages/trix-openclaw-native run build`
- `npm run build`
- `openclaw channels status --probe`

## 当前正式验证面

- 原生 `trix-native` plugin 被 OpenClaw 正确加载
- Web / iOS 只走 Trix Service
- 服务面 `/api/service/*` 和用户面 `/api/*` 已分离
- 旧 relay / 旧 Web 直连 Gateway 主链已删除

## 不再维护

- 旧 relay 包
- 旧 Web 直连桥接
- 旧 token-only 配对测试报告
