# iOS CI 问题修复计划

> 详细记录 GitHub Actions iOS CI 遇到的所有问题及修复方案

---

## 📋 问题清单

### 问题 1: Xcode 项目不存在

**错误信息:**
```
xcodebuild: error: The directory /Users/runner/work/TRIX_ap/TRIX_ap/ios does not contain an Xcode project, workspace or package.
```

**原因:**
- iOS 项目使用 XcodeGen，需要先运行 `xcodegen generate` 生成 Xcode 项目
- 项目结构是 `ios/TRIX3DCompanion/project.yml`，不是标准 `.xcodeproj`

**修复方案:**
```yaml
# 在每个 job 中添加 XcodeGen 步骤
- name: Install XcodeGen
  run: brew install xcodegen

- name: Generate Xcode project
  working-directory: ios/TRIX3DCompanion
  run: xcodegen generate
```

**状态:** ✅ 已修复

---

### 问题 2: 模拟器不存在 (iPhone 16)

**错误信息:**
```
xcodebuild: error: Unable to find a destination matching the provided destination specifier:
{ generic:1, platform:iOS }

Ineligible destinations for the "TRIX3DCompanion" scheme:
{ platform:iOS, id:dvtdevice-DVTiPhonePlaceholder-iphoneos:placeholder, name:Any iOS Device, error:iOS 18.1 is not installed. }
```

**原因:**
- GitHub Actions macOS runner 没有安装 iPhone 16 模拟器
- 只有 `iPhone 15 Pro` 或其他可用模拟器

**修复方案:**
```yaml
# 使用可用的模拟器
- destination 'platform=iOS Simulator,name=iPhone 15 Pro'
```

**状态:** ✅ 已修复

---

### 问题 3: 重复的 README.md 文件

**错误信息:**
```
error: Multiple commands produce '/Users/runner/.../TRIX3DCompanion.app/README.md'
- Features/Voice/README.md
- Resources/AppStore/README.md
- Shared/Theme/README.md
```

**原因:**
- `project.yml` 中包含了多个 `README.md` 文件
- XcodeGen 默认复制所有文件，导致重复

**修复方案 (三选一):**

#### 方案 A: 修改 project.yml 排除 README
```yaml
# 在每个 source 路径中添加 excludes
sources:
  - path: Features
    excludes:
      - "**/README.md"
  - path: Resources
    excludes:
      - "**/README.md"
  - path: Shared
    excludes:
      - "**/README.md"
```

#### 方案 B: 删除多余的 README.md
- 只保留 `Resources/AppStore/README.md`
- 删除其他目录的 README.md

#### 方案 C: 重命名 README.md
- 重命名为其他名称如 `FEATURES.md`

**状态:** ⏳ 待修复

---

### 问题 4: SwiftLint 配置过时

**错误信息:**
```
warning: The key(s) 'closure_signature_spacing' used as rule identifier(s) is/are invalid.
warning: Configuration for 'multiline_parameters' rule contains the invalid key(s) 'min_arrow_binding_space'.
warning: 'sorted_last_then_by' is not a valid rule identifier
```

**原因:**
- `.swiftlint.yml` 使用了新版 SwiftLint 不支持的规则名称

**修复方案:**
```yaml
# 更新 .swiftlint.yml，移除以下无效规则:
# - closure_signature_spacing
# - sorted_last_then_by

# 修改 multiline_parameters 配置，移除 min_arrow_binding_space
```

**状态:** ⏳ 待修复

---

### 问题 5: 项目编译错误 (Stringsdata 重复)

**错误信息:**
```
error: Multiple commands produce '...ChatService.stringsdata'
error: Multiple commands produce '...StudyService.stringsdata'
```

**原因:**
- 项目中有重复的 Swift 文件或资源
- 可能是因为 SwiftUI 和 Swift 代码混合导致

**修复方案:**
- 检查 `project.yml` 中的源文件配置
- 确保没有重复包含同一文件

**状态:** ⏳ 待调查

---

### 问题 6: GitHub Actions 权限不足

**错误信息:**
```
refusing to allow an OAuth App to create or update workflow `.github/workflows/deploy.yml` without `workflow` scope
```

**原因:**
- GitHub token 缺少 `workflow` 权限

**修复方案:**
```bash
gh auth refresh -s workflow -h github.com
```

**状态:** ✅ 已修复

---

## 📝 待修复 Task 清单

### Task 1: 修复 XcodeGen 配置 (高优先级)

**目标:** 修复 `ios/TRIX3DCompanion/project.yml`，排除重复文件

**步骤:**
1. 打开 `ios/TRIX3DCompanion/project.yml`
2. 修改 `sources` 配置，添加 `excludes` 排除 README.md
3. 保存文件

**修改内容:**
```yaml
targets:
  TRIX3DCompanion:
    type: application
    platform: iOS
    sources:
      - path: App
      - path: Core
      - path: Features
        excludes:
          - "**/README.md"
      - path: Shared
        excludes:
          - "**/README.md"
          - "**/Theme/README.md"
      - path: Resources
        excludes:
          - "**/README.md"
          - "**/AppStore/README.md"
```

---

### Task 2: 修复 SwiftLint 配置 (中优先级)

**目标:** 更新 `.swiftlint.yml`，移除过时的规则

**步骤:**
1. 打开 `ios/.swiftlint.yml` 或 `.swiftlint.yml`
2. 移除无效规则配置
3. 保存文件

**需要移除的配置:**
```yaml
# 移除这些不存在的规则:
# - closure_signature_spacing
# - sorted_last_then_by

# 修改 multiline_parameters:
multiline_parameters:
  min_arrow_binding_space: 2  # 移除这个无效 key
```

---

### Task 3: 验证本地构建 (高优先级)

**目标:** 在本地验证项目能否编译

**步骤:**
1. 安装 XcodeGen: `brew install xcodegen`
2. 进入目录: `cd ios/TRIX3DCompanion`
3. 生成项目: `xcodegen generate`
4. 用 Xcode 打开生成的 `.xcodeproj`
5. 尝试编译，检查是否有错误

---

### Task 4: 重新运行 CI (中优先级)

**目标:** 修复后验证 CI 通过

**步骤:**
1. 修复 Task 1 和 Task 2
2. 提交代码: `git add . && git commit -m "fix: iOS project config"`
3. 推送: `git push`
4. 查看 GitHub Actions 结果

---

## 🔄 修复流程图

```
┌─────────────────────────────────────────────────────┐
│                    开始                              │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ Task 1: 修复 project.yml                           │
│ - 添加 excludes 排除重复 README.md                   │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ Task 2: 修复 .swiftlint.yml                       │
│ - 移除无效规则配置                                  │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ Task 3: 本地验证构建                               │
│ - xcodegen generate                                │
│ - xcodebuild build                                 │
└─────────────────────────────────────────────────────┘
                         ↓
              ┌───────────────┐
              │ 编译成功?     │
              └───────────────┘
            ↙           ↘
         是              否
          ↓              ↓
┌────────────┐    ┌─────────────────────┐
│ 提交代码   │    │ 修复编译错误        │
│ CI 自动运行│    │ 回到 Task 3        │
└────────────┘    └─────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ GitHub Actions CI 运行                            │
│ - Build: 编译 iOS 项目                             │
│ - Analyze: SwiftLint 代码检查                      │
└─────────────────────────────────────────────────────┘
                         ↓
              ┌───────────────┐
              │ CI 通过?      │
              └───────────────┘
            ↙           ↘
         是              否
          ↓              ↓
┌────────────┐    ┌─────────────────────┐
│   完成!    │    │ 修复错误            │
│ iOS CI 已就绪│   │ 重新运行           │
└────────────┘    └─────────────────────┘
```

---

## 📂 相关文件路径

| 文件 | 路径 |
|------|------|
| iOS 项目配置 | `ios/TRIX3DCompanion/project.yml` |
| SwiftLint 配置 | `ios/.swiftlint.yml` 或 `.swiftlint.yml` |
| CI Workflow | `.github/workflows/ios-ci.yml` |
| iOS 源码 | `ios/TRIX3DCompanion/` |

---

## 🛠️ 所需工具

| 工具 | 安装命令 | 用途 |
|------|---------|------|
| XcodeGen | `brew install xcodegen` | 生成 Xcode 项目 |
| Xcode | Mac App Store | 编译 iOS 项目 |
| SwiftLint | `brew install swiftlint` | 代码检查 |

---

## ✅ 验收标准

修复完成后，GitHub Actions 应该显示:

| Job | 期望状态 |
|-----|---------|
| Build | ✅ SUCCESS |
| Static Analysis | ✅ SUCCESS |

---

> 最后更新: 2026-02-27
