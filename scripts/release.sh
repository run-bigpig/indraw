#!/bin/bash
# 发布脚本 - Bash 版本
# 功能：检测 GitHub 上是否存在指定版本，存在则删除，不存在则创建

set -e

# 默认参数
VERSION=""
REPO_OWNER="run-bigpig"
REPO_NAME="indraw"
CHANGELOG_PATH="CHANGELOG.md"
DRY_RUN=false

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 输出函数
info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        --repo-owner)
            REPO_OWNER="$2"
            shift 2
            ;;
        --repo-name)
            REPO_NAME="$2"
            shift 2
            ;;
        --changelog)
            CHANGELOG_PATH="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "用法: $0 [选项]"
            echo "选项:"
            echo "  -v, --version VERSION    指定版本号（默认从 core/version.go 读取）"
            echo "  --repo-owner OWNER       GitHub 仓库所有者（默认: run-bigpig）"
            echo "  --repo-name NAME         GitHub 仓库名称（默认: indraw）"
            echo "  --changelog PATH         CHANGELOG 文件路径（默认: CHANGELOG.md）"
            echo "  --dry-run                仅显示将要执行的操作，不实际执行"
            echo "  -h, --help               显示此帮助信息"
            exit 0
            ;;
        *)
            error "未知参数: $1"
            exit 1
            ;;
    esac
done

# 检查 GitHub CLI 是否安装
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        error "GitHub CLI (gh) 未安装，请先安装: https://cli.github.com/"
        exit 1
    fi
}

# 检查 GitHub 认证
check_gh_auth() {
    if ! gh auth status &> /dev/null; then
        error "GitHub CLI 未认证，请运行: gh auth login"
        exit 1
    fi
}

# 从 version.go 读取版本号
get_version_from_file() {
    local version_file="core/version.go"
    if [ ! -f "$version_file" ]; then
        error "找不到版本文件: $version_file"
        exit 1
    fi
    
    local version=$(grep -oP 'const Version = "\K[^"]+' "$version_file" || echo "")
    if [ -z "$version" ]; then
        error "无法从 $version_file 中解析版本号"
        exit 1
    fi
    echo "$version"
}

# 检查 release 是否存在
release_exists() {
    local tag=$1
    if gh release view "$tag" --repo "$REPO_OWNER/$REPO_NAME" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# 删除 release
remove_release() {
    local tag=$1
    
    info "正在删除 release: $tag"
    
    if [ "$DRY_RUN" = true ]; then
        warning "[DRY RUN] 将删除 release: $tag"
        return 0
    fi
    
    # 删除 release
    if gh release delete "$tag" --repo "$REPO_OWNER/$REPO_NAME" --yes &> /dev/null; then
        success "Release $tag 已删除"
    else
        warning "删除 release 失败，可能不存在"
    fi
    
    # 删除 tag
    info "正在删除 tag: $tag"
    if gh api "repos/$REPO_OWNER/$REPO_NAME/git/refs/tags/$tag" -X DELETE &> /dev/null; then
        success "Tag $tag 已删除"
    else
        warning "删除 tag 失败，可能不存在"
    fi
    
    return 0
}

# 创建 release
create_release() {
    local tag=$1
    local notes=$2
    
    info "正在创建 release: $tag"
    
    if [ "$DRY_RUN" = true ]; then
        warning "[DRY RUN] 将创建 release: $tag"
        info "Release Notes:"
        echo "$notes"
        return 0
    fi
    
    # 创建临时文件存储 notes
    local notes_file=$(mktemp)
    echo "$notes" > "$notes_file"
    
    if gh release create "$tag" \
        --repo "$REPO_OWNER/$REPO_NAME" \
        --title "$tag" \
        --notes-file "$notes_file" &> /dev/null; then
        success "Release $tag 已创建"
        rm -f "$notes_file"
        return 0
    else
        error "创建 release 失败"
        rm -f "$notes_file"
        return 1
    fi
}

# 从 CHANGELOG 提取版本说明
get_release_notes() {
    local version=$1
    local tag="v$version"
    
    if [ ! -f "$CHANGELOG_PATH" ]; then
        warning "找不到 CHANGELOG.md，将使用默认说明"
        echo "Release $tag"
        return
    fi
    
    # 提取版本块（格式：## [1.0.0] - 2024-01-01）
    # 提取到下一个版本或分隔线为止
    local notes=$(awk -v version="$version" '
        BEGIN { in_version = 0; found = 0 }
        /^## \[/ {
            if (in_version) {
                exit
            }
            if ($0 ~ "\\[" version "\\]") {
                in_version = 1
                found = 1
                next
            }
        }
        in_version && /^---/ {
            # 跳过分隔线，但继续读取直到下一个版本
            next
        }
        in_version && /^## \[/ {
            exit
        }
        in_version {
            print
        }
        END {
            if (!found) {
                exit 1
            }
        }
    ' "$CHANGELOG_PATH")
    
    if [ $? -ne 0 ] || [ -z "$notes" ]; then
        warning "在 CHANGELOG.md 中找不到版本 $version 的说明"
        echo "Release $tag

查看完整更新日志: https://github.com/$REPO_OWNER/$REPO_NAME/blob/main/CHANGELOG.md"
    else
        # 清理末尾的空行和分隔线
        echo "$notes" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | sed '/^---$/d'
    fi
}

# 主函数
main() {
    info "=== GitHub Release 管理脚本 ==="
    info "仓库: $REPO_OWNER/$REPO_NAME"
    
    # 检查 GitHub CLI
    check_gh_cli
    
    # 检查认证
    check_gh_auth
    
    # 获取版本号
    if [ -z "$VERSION" ]; then
        VERSION=$(get_version_from_file)
    fi
    local tag="v$VERSION"
    
    info "目标版本: $tag"
    
    if [ "$DRY_RUN" = true ]; then
        warning "=== DRY RUN 模式（不会实际执行操作）==="
    fi
    
    # 检查 release 是否存在
    if release_exists "$tag"; then
        warning "Release $tag 已存在"
        read -p "是否删除并重新创建? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            info "操作已取消"
            exit 0
        fi
        
        if remove_release "$tag"; then
            info "等待 2 秒后创建新 release..."
            sleep 2
        else
            error "删除失败，退出"
            exit 1
        fi
    fi
    
    # 创建 release
    local notes=$(get_release_notes "$VERSION")
    if create_release "$tag" "$notes"; then
        success "=== 完成 ==="
        info "Release URL: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/$tag"
    else
        error "创建 release 失败"
        exit 1
    fi
}

# 运行主函数
main

