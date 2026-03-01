# TRIX3DCompanion iOS 项目

这个项目使用 XcodeGen 来管理 Xcode 项目配置。

## 前置要求

- Xcode 15.0 或更高版本
- XcodeGen (通过 Homebrew 安装)

## 安装 XcodeGen

```bash
brew install xcodegen
```

## 生成 Xcode 项目

每次修改 `project.yml` 后，运行以下命令重新生成项目：

```bash
xcodegen generate
```

这将创建 `TRIX3DCompanion.xcodeproj` 文件。

## 打开项目

```bash
open TRIX3DCompanion.xcodeproj
```

## 项目结构

- `project.yml` - XcodeGen 配置文件（这是源文件，应该提交到 Git）
- `TRIX3DCompanion.xcodeproj` - 生成的 Xcode 项目（不提交到 Git）
- `TRIX3DCompanion.entitlements` - 应用权限配置

## 依赖包

项目使用 Swift Package Manager 管理以下依赖：

- Supabase
- Alamofire
- Starscream
- Kingfisher
- KeychainAccess
- SQLite.swift
- CodeScanner

## 构建和运行

1. 生成项目：`xcodegen generate`
2. 打开项目：`open TRIX3DCompanion.xcodeproj`
3. 在 Xcode 中选择目标设备
4. 点击运行按钮或按 `Cmd+R`

## 注意事项

- 不要直接在 Xcode 中修改项目设置，而是修改 `project.yml` 文件
- 修改 `project.yml` 后记得重新运行 `xcodegen generate`
- `.xcodeproj` 文件已被添加到 `.gitignore`，不会被提交
