#!/bin/bash
# Release Script - Bash Version
# Function: Check if a version exists on GitHub, delete if exists, create if not exists
# Uses only git commands for tag management, GitHub API for release management

set -e

# Default parameters
VERSION=""
REPO_OWNER="run-bigpig"
REPO_NAME="indraw"
CHANGELOG_PATH="CHANGELOG.md"
GITHUB_TOKEN=""
DRY_RUN=false
TAG_ONLY=false

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Output functions
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

# Parse arguments
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
        --github-token)
            GITHUB_TOKEN="$2"
            shift 2
            ;;
        --tag-only)
            TAG_ONLY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -v, --version VERSION     Specify version number (default: read from core/version.go)"
            echo "  --repo-owner OWNER       GitHub repository owner (default: run-bigpig)"
            echo "  --repo-name NAME         GitHub repository name (default: indraw)"
            echo "  --changelog PATH         CHANGELOG file path (default: CHANGELOG.md)"
            echo "  --github-token TOKEN     GitHub personal access token"
            echo "  --tag-only               Only manage tags, skip release management"
            echo "  --dry-run                Preview operations without executing"
            echo "  -h, --help               Show this help message"
            exit 0
            ;;
        *)
            error "Unknown parameter: $1"
            exit 1
            ;;
    esac
done

# Check if git is installed
check_git() {
    if ! command -v git &> /dev/null; then
        error "Git is not installed. Please install Git from: https://git-scm.com/"
        exit 1
    fi
}

# Get GitHub token from environment or parameter
get_github_token() {
    if [ "$TAG_ONLY" = true ]; then
        return
    fi
    
    if [ -n "$GITHUB_TOKEN" ]; then
        return
    fi
    
    # Try environment variable
    if [ -n "$GITHUB_TOKEN" ]; then
        GITHUB_TOKEN="$GITHUB_TOKEN"
        return
    fi
    
    # Try git config
    GITHUB_TOKEN=$(git config --global github.token 2>/dev/null || echo "")
    if [ -z "$GITHUB_TOKEN" ]; then
        GITHUB_TOKEN=""
    fi
}

# Read version from version.go
get_version_from_file() {
    local version_file="core/version.go"
    if [ ! -f "$version_file" ]; then
        error "Version file not found: $version_file"
        exit 1
    fi
    
    local version=$(grep -oP 'const Version = "\K[^"]+' "$version_file" || echo "")
    if [ -z "$version" ]; then
        error "Failed to parse version from $version_file"
        exit 1
    fi
    echo "$version"
}

# Check if tag exists locally using git
test_tag_exists_local() {
    local tag=$1
    if git rev-parse --verify "refs/tags/$tag" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Check if tag exists remotely using git
test_tag_exists_remote() {
    local tag=$1
    if git ls-remote --tags origin "refs/tags/$tag" &> /dev/null; then
        local result=$(git ls-remote --tags origin "refs/tags/$tag" 2>&1)
        if [ -n "$result" ]; then
            return 0
        fi
    fi
    return 1
}

# Check if release exists using GitHub API (optional)
test_release_exists() {
    local tag=$1
    local token=$2
    
    if [ -z "$token" ]; then
        return 1
    fi
    
    local response=$(curl -s -w "\n%{http_code}" \
        -H "Accept: application/vnd.github.v3+json" \
        -H "Authorization: token $token" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/$tag" 2>/dev/null || echo "")
    
    local http_code=$(echo "$response" | tail -n1)
    if [ "$http_code" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Get release ID by tag (for deletion)
get_release_id() {
    local tag=$1
    local token=$2
    
    if [ -z "$token" ]; then
        echo ""
        return
    fi
    
    local response=$(curl -s \
        -H "Accept: application/vnd.github.v3+json" \
        -H "Authorization: token $token" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/$tag" 2>/dev/null || echo "")
    
    if [ -n "$response" ]; then
        echo "$response" | grep -oP '"id":\s*\K\d+' | head -n1 || echo ""
    else
        echo ""
    fi
}

# Delete tag using git commands
remove_tag() {
    local tag=$1
    
    info "Deleting tag: $tag"
    
    if [ "$DRY_RUN" = true ]; then
        warning "[DRY RUN] Would delete tag: $tag"
        return 0
    fi
    
    # Delete local tag
    if test_tag_exists_local "$tag"; then
        if git tag -d "$tag" &> /dev/null; then
            success "Local tag $tag deleted"
        else
            warning "Failed to delete local tag"
        fi
    else
        info "Local tag $tag does not exist"
    fi
    
    # Delete remote tag
    if test_tag_exists_remote "$tag"; then
        if git push origin ":refs/tags/$tag" &> /dev/null; then
            success "Remote tag $tag deleted"
        else
            warning "Failed to delete remote tag"
            return 1
        fi
    else
        info "Remote tag $tag does not exist"
    fi
    
    return 0
}

# Delete release using GitHub API (optional)
remove_release() {
    local tag=$1
    local token=$2
    
    if [ -z "$token" ]; then
        warning "No GitHub token provided, skipping release deletion"
        return 0
    fi
    
    info "Deleting release: $tag"
    
    if [ "$DRY_RUN" = true ]; then
        warning "[DRY RUN] Would delete release: $tag"
        return 0
    fi
    
    local release_id=$(get_release_id "$tag" "$token")
    if [ -n "$release_id" ]; then
        local http_code=$(curl -s -w "%{http_code}" -o /dev/null \
            -X DELETE \
            -H "Accept: application/vnd.github.v3+json" \
            -H "Authorization: token $token" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$release_id" 2>/dev/null || echo "000")
        
        if [ "$http_code" = "204" ]; then
            success "Release $tag deleted"
        else
            warning "Failed to delete release (HTTP $http_code)"
        fi
    else
        warning "Release $tag not found, may already be deleted"
    fi
    
    return 0
}

# Create tag using git commands
new_tag() {
    local tag=$1
    
    info "Creating tag: $tag"
    
    if [ "$DRY_RUN" = true ]; then
        warning "[DRY RUN] Would create tag: $tag"
        return 0
    fi
    
    # Check if tag already exists locally
    if test_tag_exists_local "$tag"; then
        warning "Local tag $tag already exists, skipping creation"
    else
        # Create tag pointing to current HEAD
        if git tag "$tag" &> /dev/null; then
            success "Local tag $tag created"
        else
            error "Failed to create local tag"
            return 1
        fi
    fi
    
    # Push tag to remote
    info "Pushing tag to remote: $tag"
    if git push origin "$tag" &> /dev/null; then
        success "Tag $tag pushed to remote"
    else
        warning "Failed to push tag, may already exist remotely"
    fi
    
    return 0
}

# Create release using GitHub API (optional)
create_release() {
    local tag=$1
    local notes=$2
    local token=$3
    
    if [ -z "$token" ]; then
        warning "No GitHub token provided, skipping release creation"
        info "You can create the release manually at: https://github.com/$REPO_OWNER/$REPO_NAME/releases/new"
        return 0
    fi
    
    info "Creating release: $tag"
    
    if [ "$DRY_RUN" = true ]; then
        warning "[DRY RUN] Would create release: $tag"
        info "Release Notes:"
        echo "$notes"
        return 0
    fi
    
    # Create JSON body
    local notes_escaped=$(echo "$notes" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
    local json_body=$(cat <<EOF
{
  "tag_name": "$tag",
  "name": "$tag",
  "body": "$notes_escaped",
  "draft": false,
  "prerelease": false
}
EOF
)
    
    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Accept: application/vnd.github.v3+json" \
        -H "Authorization: token $token" \
        -H "Content-Type: application/json" \
        -d "$json_body" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases" 2>/dev/null || echo "")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "201" ]; then
        success "Release $tag created"
        return 0
    else
        error "Failed to create release (HTTP $http_code)"
        if [ -n "$body" ]; then
            warning "API Response: $body"
        fi
        return 1
    fi
}

# Extract release notes from CHANGELOG
get_release_notes() {
    local version=$1
    local tag="v$version"
    
    if [ ! -f "$CHANGELOG_PATH" ]; then
        warning "CHANGELOG.md not found, using default notes"
        echo "Release $tag"
        return
    fi
    
    # Extract version block (format: ## [1.0.0] - 2024-01-01)
    # Extract until next version or separator
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
            # Skip separator but continue reading until next version
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
        warning "Release notes for version $version not found in CHANGELOG.md"
        echo "Release $tag

View full changelog: https://github.com/$REPO_OWNER/$REPO_NAME/blob/main/CHANGELOG.md"
    else
        # Clean trailing empty lines and separators
        echo "$notes" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | sed '/^---$/d'
    fi
}

# Main function
main() {
    info "=== GitHub Release Management Script ==="
    info "Repository: $REPO_OWNER/$REPO_NAME"
    
    # Check git
    check_git
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir &> /dev/null; then
        error "Not in a git repository. Please run this script from within your git repository."
        exit 1
    fi
    
    # Check remote origin
    local remote_url=$(git remote get-url origin 2>/dev/null || echo "")
    if [ -z "$remote_url" ]; then
        warning "No 'origin' remote found. Tag operations may fail."
    else
        info "Remote origin: $remote_url"
    fi
    
    # Get GitHub token (only if not tag-only mode)
    if [ "$TAG_ONLY" = false ]; then
        get_github_token
        if [ -z "$GITHUB_TOKEN" ]; then
            warning "GitHub token not found. Release management will be skipped."
            warning "Tag operations will still work. To enable release management:"
            warning "  1. Use --github-token parameter"
            warning "  2. Set GITHUB_TOKEN environment variable"
            warning "  3. Set git config --global github.token"
            warning ""
            warning "You can create a token at: https://github.com/settings/tokens"
        fi
    fi
    
    # Get version number
    if [ -z "$VERSION" ]; then
        VERSION=$(get_version_from_file)
    fi
    local tag="v$VERSION"
    
    info "Target version: $tag"
    
    if [ "$DRY_RUN" = true ]; then
        warning "=== DRY RUN MODE (no actual operations will be performed) ==="
    fi
    
    if [ "$TAG_ONLY" = true ]; then
        info "Tag-only mode: Only managing git tags, skipping release management"
    fi
    
    # Check if tag exists
    local tag_exists_local=false
    local tag_exists_remote=false
    local release_exists=false
    
    if test_tag_exists_local "$tag"; then
        tag_exists_local=true
    fi
    
    if test_tag_exists_remote "$tag"; then
        tag_exists_remote=true
    fi
    
    if [ "$TAG_ONLY" = false ] && [ -n "$GITHUB_TOKEN" ]; then
        if test_release_exists "$tag" "$GITHUB_TOKEN"; then
            release_exists=true
        fi
    fi
    
    if [ "$tag_exists_local" = true ] || [ "$tag_exists_remote" = true ] || [ "$release_exists" = true ]; then
        warning "Tag or release $tag already exists"
        info "  Local tag exists: $tag_exists_local"
        info "  Remote tag exists: $tag_exists_remote"
        if [ "$TAG_ONLY" = false ]; then
            info "  Release exists: $release_exists"
        fi
        
        read -p "Delete and recreate? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            info "Operation cancelled"
            exit 0
        fi
        
        # Delete release first (if token available)
        if [ "$TAG_ONLY" = false ] && [ -n "$GITHUB_TOKEN" ]; then
            remove_release "$tag" "$GITHUB_TOKEN"
        fi
        
        # Delete tag
        if remove_tag "$tag"; then
            info "Waiting 2 seconds before creating new tag..."
            sleep 2
        else
            error "Failed to delete tag, exiting"
            exit 1
        fi
    fi
    
    # Create tag using git
    if new_tag "$tag"; then
        success "Tag $tag created and pushed"
    else
        error "Failed to create tag"
        exit 1
    fi
    
    # Create release (if token available and not tag-only mode)
    if [ "$TAG_ONLY" = false ]; then
        local notes=$(get_release_notes "$VERSION")
        if [ -n "$GITHUB_TOKEN" ]; then
            if create_release "$tag" "$notes" "$GITHUB_TOKEN"; then
                success "=== Complete ==="
                info "Release URL: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/$tag"
            else
                warning "Tag created but release creation failed"
                info "You can create the release manually at: https://github.com/$REPO_OWNER/$REPO_NAME/releases/new"
            fi
        else
            success "=== Complete ==="
            info "Tag created successfully"
            info "Create release manually at: https://github.com/$REPO_OWNER/$REPO_NAME/releases/new"
        fi
    else
        success "=== Complete ==="
        info "Tag $tag created and pushed successfully"
    fi
}

# Run main function
main
