# TRIX Web MySQL 演示与测试指南

## 1. 本地环境

| 服务 | 地址 | 说明 |
|------|------|------|
| Web | `http://127.0.0.1:5173/` | Vite React Web 端 |
| API | `http://127.0.0.1:8789/` | Express REST API |
| MySQL | `127.0.0.1:3307` | 项目专用 MySQL 8.0 实例 |

当前本机原有 `MySQL80` 仍在 `3306` 运行，作业版 API 使用 `packages/trix-web-api/.env.local` 指向项目专用 `3307` 实例，避免影响系统已有数据库服务。

## 2. 启动与导入

```powershell
# 1. 导入数据库结构
mysql --default-character-set=utf8mb4 -h 127.0.0.1 -P 3307 -u root trix_companion < database/mysql/schema.sql

# 2. 导入演示数据
mysql --default-character-set=utf8mb4 -h 127.0.0.1 -P 3307 -u root trix_companion < database/mysql/seed.sql

# 3. 启动 API
npm run dev:api

# 4. 启动 Web
npm run dev
```

## 3. 演示账号

| 账号 | 密码 | 角色 |
|------|------|------|
| `test1@trix.app` | `123456` | 主演示账号 |
| `test2@trix.app` | `123456` | 好友账号 |
| `test3@trix.app` | `123456` | 学习导师账号 |

## 4. 课堂演示流程

1. 打开 Web 端 `http://127.0.0.1:5173/`。
2. 使用 `test1@trix.app / 123456` 登录。
3. 进入首页，展示用户资料、TRIX Bot 入口和完整 Web 菜单。
4. 打开待办或学习页面，新增一条记录。
5. 修改刚新增的记录，展示更新结果。
6. 删除刚新增的记录，展示删除结果。
7. 打开学习统计，展示 MySQL 聚合查询结果。
8. 打开好友聊天，展示好友、会话和消息数据。
9. 打开积分商城/衣柜，展示积分账户、商品和用户资产。
10. 打开地图/通知/邮件，展示位置和消息类数据。
11. 使用 MySQL 客户端查询对应表，证明数据写入数据库。

## 5. 核心 API 验证

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/health
Invoke-RestMethod http://127.0.0.1:8789/api/db/health

$body = @{ email = 'test1@trix.app'; password = '123456' } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8789/api/auth/login -Method Post -ContentType 'application/json' -Body $body
```

预期结果：

- `/api/health` 返回 `ok: true`。
- `/api/db/health` 返回 `ok: true`。
- `/api/auth/login` 返回当前用户信息和会话信息。

## 6. 测试用例

| 编号 | 模块 | 操作 | 预期结果 |
|------|------|------|----------|
| T01 | 登录 | 使用正确邮箱和密码登录 | 进入首页，显示当前用户名 |
| T02 | 登录 | 使用错误密码登录 | 返回“邮箱或密码错误” |
| T03 | 资料 | 修改昵称和简介 | 页面刷新后仍显示新资料 |
| T04 | 待办 | 新增待办 | `todos` 表新增当前用户记录 |
| T05 | 待办 | 修改待办完成状态 | `completed` 字段更新 |
| T06 | 待办 | 删除待办 | 当前用户待办列表不再显示该记录 |
| T07 | 学习 | 新增学习记录 | `study_sessions` 表新增记录，统计随之变化 |
| T08 | 聊天 | 发送消息 | `chat_messages` 表新增当前用户消息 |
| T09 | 积分 | 查看积分 | `user_points` 返回当前用户账户 |
| T10 | 地图 | 更新位置 | `user_locations` 当前用户记录更新 |
| T11 | 通知 | 查看通知 | 只返回当前用户通知 |
| T12 | 权限 | 查询其他用户私有数据 | API 自动隔离，不返回越权数据 |

## 7. 已执行验证

- `npm run type-check`
- `npm run build`
- `npm run test:web-api`
- `npx vitest run src/contexts/AuthContext.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism`
- `npx vitest run src/screens/Auth.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism`
- Playwright 浏览器验证：`test1@trix.app / 123456` 可进入首页。

## 8. 演示截图

![TRIX MySQL 首页演示](../screenshots/trix-mysql-home.png)
