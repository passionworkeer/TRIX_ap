# 服务器操作指南

本文档记录通用的服务器连接和操作方法。

## 连接服务器

### Windows (使用 OpenSSH)

```bash
# 基本连接
ssh -o StrictHostKeyChecking=no -i <私钥路径> <用户名>@<服务器IP>

# 示例
ssh -o StrictHostKeyChecking=no -i C:/Users/wang/.ssh/id_ed25519_server root@120.77.36.107
```

### 常用快捷命令

```bash
# 查看 PM2 进程状态
pm2 list

# 查看 API 日志
pm2 logs <服务名>

# 重启 API 服务
pm2 restart <服务名>

# 停止 API 服务
pm2 stop <服务名>

# 查看系统资源
top
df -h
free -h
```

## 部署流程

### 1. 本地构建

```bash
cd <项目目录>
npm run build
```

### 2. 上传到服务器

```bash
# 上传 dist 目录
scp -i <私钥路径> -r <本地路径> <用户名>@<服务器IP>:<目标路径>/

# 示例：上传编译后的文件
scp -i C:/Users/wang/.ssh/id_ed25519_server -r ./dist/* root@120.77.36.107:/root/backend/dist/

# 上传环境变量文件
scp -i C:/Users/wang/.ssh/id_ed25519_server .env root@120.77.36.107:/root/backend/.env
```

### 3. 重启服务

```bash
pm2 restart <服务名>
```

### 4. 测试 API

```bash
# 健康检查
curl http://<服务器IP>:<端口>/api/health

# 测试注册
curl -X POST http://<服务器IP>:<端口>/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}'
```

## 目录结构 (通用)

服务器上的文件结构：

```
/<用户名>/
├── <项目名>/                    # 项目代码
│   ├── dist/                  # 编译后的 JavaScript
│   ├── node_modules/          # 依赖
│   ├── prisma/                # 数据库 schema
│   ├── .env                   # 环境变量
│   └── package.json
├── .pm2/                      # PM2 配置
└── .npm/                     # npm 缓存
```

## 数据库操作

### 连接数据库

```bash
mysql -u<用户名> -p<密码> <数据库名>
```

### 常用 SQL

```sql
-- 查看所有表
SHOW TABLES;

-- 查看用户表
SELECT * FROM users;

-- 删除测试数据
DELETE FROM users WHERE email = 'test@example.com';
```

## 端口开放

在云服务器控制台添加安全组规则：

| 协议 | 端口范围 | 授权对象 |
|------|---------|---------|
| TCP | <端口>/<端口> | 0.0.0.0/0 |

## 故障排查

### 服务未启动

```bash
pm2 list                    # 查看状态
pm2 start npm --name <服务名> -- run start  # 手动启动
```

### 查看错误日志

```bash
pm2 logs <服务名> --err --lines 50
```

### 数据库连接失败

```bash
# 检查 MySQL 状态
systemctl status mysql

# 重启 MySQL
systemctl restart mysql
```
