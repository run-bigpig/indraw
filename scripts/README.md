# 发布脚本使用说明

本目录包含用于管理 GitHub Releases 的发布脚本。

## 功能

- ✅ 自动从 `core/version.go` 读取版本号
- ✅ 检测 GitHub 上是否已存在该版本的 release
- ✅ 如果存在，可选择删除并重新创建
- ✅ 如果不存在，直接创建新的 release
- ✅ 自动从 `CHANGELOG.md` 提取版本说明
- ✅ 支持 dry-run 模式（预览操作，不实际执行）

## 前置要求

1. **安装 GitHub CLI (gh)**
   - Windows: 使用 [Scoop](https://scoop.sh/) 或 [Chocolatey](https://chocolatey.org/)
     ```powershell
     # Scoop
     scoop install gh
     
     # Chocolatey
     choco install gh
   - macOS: `brew install gh`
   - Linux: 参考 [GitHub CLI 官方文档](https://cli.github.com/manual/installation)

2. **认证 GitHub CLI**
   ```bash
   gh auth login
   ```

## 使用方法

### PowerShell (Windows)

```powershell
# 使用默认版本（从 core/version.go 读取）
.\scripts\release.ps1

# 指定版本号
.\scripts\release.ps1 -Version "1.1.0"

# Dry-run 模式（预览操作）
.\scripts\release.ps1 -DryRun

# 自定义仓库
.\scripts\release.ps1 -RepoOwner "your-username" -RepoName "your-repo"
```

### Bash (Linux/macOS/Git Bash)

```bash
# 使用默认版本（从 core/version.go 读取）
./scripts/release.sh

# 指定版本号
./scripts/release.sh --version 1.1.0

# Dry-run 模式（预览操作）
./scripts/release.sh --dry-run

# 自定义仓库
./scripts/release.sh --repo-owner your-username --repo-name your-repo

# 查看帮助
./scripts/release.sh --help
```

## 工作流程

1. **读取版本号**
   - 如果未指定版本，从 `core/version.go` 的 `Version` 常量读取
   - 版本标签格式为 `v{版本号}`（例如：`v1.1.0`）

2. **检查 Release 是否存在**
   - 使用 GitHub API 检查是否存在对应标签的 release

3. **如果存在**
   - 提示用户是否删除并重新创建
   - 用户确认后，删除 release 和对应的 tag
   - 等待 2 秒后创建新的 release

4. **如果不存在**
   - 直接创建新的 release

5. **提取 Release Notes**
   - 从 `CHANGELOG.md` 中提取对应版本的更新日志
   - 如果找不到，使用默认说明

## 示例

### 场景 1: 首次发布版本 1.1.0

```powershell
# PowerShell
.\scripts\release.ps1 -Version "1.1.0"
```

输出：
```
[INFO] === GitHub Release 管理脚本 ===
[INFO] 仓库: run-bigpig/indraw
[INFO] 目标版本: v1.1.0
[INFO] 正在创建 release: v1.1.0
[SUCCESS] Release v1.1.0 已创建
[SUCCESS] === 完成 ===
[INFO] Release URL: https://github.com/run-bigpig/indraw/releases/tag/v1.1.0
```

### 场景 2: 重新发布已存在的版本

```powershell
# PowerShell
.\scripts\release.ps1 -Version "1.1.0"
```

输出：
```
[INFO] === GitHub Release 管理脚本 ===
[INFO] 仓库: run-bigpig/indraw
[INFO] 目标版本: v1.1.0
[WARNING] Release v1.1.0 已存在
是否删除并重新创建? (y/N): y
[INFO] 正在删除 release: v1.1.0
[SUCCESS] Release v1.1.0 已删除
[INFO] 正在删除 tag: v1.1.0
[SUCCESS] Tag v1.1.0 已删除
[INFO] 等待 2 秒后创建新 release...
[INFO] 正在创建 release: v1.1.0
[SUCCESS] Release v1.1.0 已创建
[SUCCESS] === 完成 ===
[INFO] Release URL: https://github.com/run-bigpig/indraw/releases/tag/v1.1.0
```

### 场景 3: Dry-run 模式

```powershell
# PowerShell
.\scripts\release.ps1 -Version "1.1.0" -DryRun
```

输出：
```
[INFO] === GitHub Release 管理脚本 ===
[INFO] 仓库: run-bigpig/indraw
[INFO] 目标版本: v1.1.0
[WARNING] === DRY RUN 模式（不会实际执行操作）===
[WARNING] Release v1.1.0 已存在
是否删除并重新创建? (y/N): y
[WARNING] [DRY RUN] 将删除 release: v1.1.0
[WARNING] [DRY RUN] 将创建 release: v1.1.0
[INFO] Release Notes:
### 🐛 Bug Fixes
...
```

## CHANGELOG 格式要求

脚本会从 `CHANGELOG.md` 中提取版本说明。支持的格式：

```markdown
## [1.1.0] - 2024-01-01

### ✨ New Features
- 新增功能 1
- 新增功能 2

### 🐛 Bug Fixes
- 修复问题 1

---

## [1.0.0] - 2023-12-01
...
```

脚本会提取 `## [版本号]` 到下一个版本之间的所有内容作为 release notes。

## 注意事项

1. **权限要求**: 需要对该 GitHub 仓库有写入权限
2. **网络连接**: 需要能够访问 GitHub API
3. **版本格式**: 版本号应该符合语义化版本规范（SemVer）
4. **CHANGELOG**: 建议保持 `CHANGELOG.md` 格式规范，以便正确提取版本说明

## 故障排除

### 错误: GitHub CLI 未认证
```bash
gh auth login
```

### 错误: 找不到版本文件
确保 `core/version.go` 文件存在，且包含 `const Version = "x.x.x"` 格式的版本定义。

### 错误: 权限不足
确保你的 GitHub 账户对该仓库有写入权限，或者使用有权限的 token 进行认证。

### 错误: Release 创建失败
- 检查网络连接
- 确认 GitHub API 可用性
- 检查版本号格式是否正确
- 确认仓库名称和所有者是否正确

