# 项目目录整理说明

## 整理日期
2026-02-18

## 整理内容

### 1. 文档整理
将根目录下的文档移动到 `docs/project/` 目录：
- `PROJECT_COMPREHENSIVE_GUIDE.md` → `docs/project/PROJECT_COMPREHENSIVE_GUIDE.md`
- `DEPLOYMENT_SUMMARY.md` → `docs/project/DEPLOYMENT_SUMMARY.md`
- `TESTING_REPORT.md` → `docs/project/TESTING_REPORT.md`

### 2. 部署脚本整理
将分散的部署脚本统一到 `deployments/` 目录：

#### 后端服务部署
- `server/deploy.sh` → `deployments/backend/nanobot/deploy.sh`
- `server/clawbot-channel/deploy.sh` → `deployments/backend/clawbot-channel/deploy.sh`
- `update-server.sh` → `deployments/backend/clawbot-channel/update.sh`
- `upload-server-sftp.sh` → `deployments/backend/clawbot-channel/upload-sftp.sh`

#### 前端部署
- `deploy/deploy-frontend.sh` → `deployments/frontend/deploy-frontend.sh`
- `scripts/deploy.sh` → `deployments/frontend/build-and-deploy.sh`

#### 服务器设置
- `scripts/server-setup.sh` → `deployments/server-setup/init-server.sh`
- `scripts/restart_cloud_server.sh` → `deployments/server-setup/restart-services.sh`

### 3. 数据库文件整理
- `src/database/SCHEMA.md` → `database/docs/SCHEMA.md`
- `src/database/README.md` → `database/docs/README.md`
- `src/database/complete-init.sql` → `database/init/complete-init.sql`

### 4. 新建文件
- `deploy.sh` - 统一的部署入口脚本

## 整理后的目录结构

```
trix-3d-companion/
├── deploy.sh                    # 统一部署入口（新增）
├── deployments/                 # 部署脚本目录（新建）
│   ├── backend/
│   │   ├── nanobot/
│   │   │   └── deploy.sh
│   │   └── clawbot-channel/
│   │       ├── deploy.sh
│   │       ├── update.sh
│   │       └── upload-sftp.sh
│   ├── frontend/
│   │   ├── build-and-deploy.sh
│   │   └── deploy-frontend.sh
│   └── server-setup/
│       ├── init-server.sh
│       └── restart-services.sh
├── database/                    # 数据库目录
│   ├── docs/                    # 数据库文档（整理）
│   │   ├── SCHEMA.md
│   │   └── README.md
│   ├── init/                    # 初始化脚本（整理）
│   │   └── complete-init.sql
│   └── migrations/              # 迁移文件（保持不变）
├── docs/
│   └── project/                 # 项目文档（整理）
│       ├── PROJECT_COMPREHENSIVE_GUIDE.md
│       ├── DEPLOYMENT_SUMMARY.md
│       └── TESTING_REPORT.md
├── server/                      # 服务器代码
│   ├── clawbot-channel/
│   ├── cloud_server.py
│   └── cloud_server_advanced.py
└── src/                         # 前端源代码
```

## 使用方式

### 部署命令
```bash
# 部署前端
./deploy.sh frontend

# 部署 Nanobot 服务
./deploy.sh nanobot

# 部署 Clawbot Channel 服务
./deploy.sh clawbot

# 更新 Clawbot Channel
./deploy.sh update-clawbot

# 初始化服务器
./deploy.sh init-server

# 重启所有服务
./deploy.sh restart

# 查看帮助
./deploy.sh --help
```

## 待清理的旧目录

以下目录在确认新结构正常后可以删除：
- `deploy/` - 内容已迁移到 `deployments/`
- `scripts/` - 内容已迁移到 `deployments/`

## 注意事项

1. 所有文件移动都使用 `git mv`，保留了 Git 历史
2. 旧目录暂时保留，待确认新结构正常后再删除
3. 部署脚本需要更新引用路径
4. CI/CD 配置需要更新路径

## 后续工作

- [ ] 更新 CI/CD 配置中的路径引用
- [ ] 更新文档中的路径引用
- [ ] 确认所有部署脚本正常工作
- [ ] 删除旧的 `deploy/` 和 `scripts/` 目录
