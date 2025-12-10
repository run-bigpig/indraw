# 发布脚本 - PowerShell 版本
# 功能：检测 GitHub 上是否存在指定版本，存在则删除，不存在则创建

param(
    [string]$Version = "",
    [string]$RepoOwner = "run-bigpig",
    [string]$RepoName = "indraw",
    [string]$ChangelogPath = "CHANGELOG.md",
    [switch]$DryRun = $false
)

# 颜色输出函数
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Info($message) {
    Write-ColorOutput Cyan "[INFO] $message"
}

function Write-Success($message) {
    Write-ColorOutput Green "[SUCCESS] $message"
}

function Write-Warning($message) {
    Write-ColorOutput Yellow "[WARNING] $message"
}

function Write-Error($message) {
    Write-ColorOutput Red "[ERROR] $message"
}

# 检查 GitHub CLI 是否安装
function Test-GitHubCLI {
    try {
        $null = gh --version
        return $true
    } catch {
        return $false
    }
}

# 从 version.go 读取版本号
function Get-VersionFromFile {
    $versionFile = "core\version.go"
    if (-not (Test-Path $versionFile)) {
        Write-Error "找不到版本文件: $versionFile"
        exit 1
    }
    
    $content = Get-Content $versionFile -Raw
    if ($content -match 'const Version = "([^"]+)"') {
        return $matches[1]
    } else {
        Write-Error "无法从 $versionFile 中解析版本号"
        exit 1
    }
}

# 检查 GitHub 认证
function Test-GitHubAuth {
    try {
        $null = gh auth status 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "GitHub CLI 未认证，请运行: gh auth login"
            exit 1
        }
        return $true
    } catch {
        Write-Error "GitHub CLI 认证失败"
        exit 1
    }
}

# 检查 release 是否存在
function Test-ReleaseExists {
    param([string]$Tag)
    
    try {
        $release = gh release view $Tag --repo "$RepoOwner/$RepoName" 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        return $false
    } catch {
        return $false
    }
}

# 删除 release
function Remove-Release {
    param([string]$Tag)
    
    Write-Info "正在删除 release: $Tag"
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] 将删除 release: $Tag"
        return $true
    }
    
    try {
        # 删除 release
        gh release delete $Tag --repo "$RepoOwner/$RepoName" --yes 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "删除 release 失败，可能不存在"
        } else {
            Write-Success "Release $Tag 已删除"
        }
        
        # 删除 tag
        Write-Info "正在删除 tag: $Tag"
        gh api repos/$RepoOwner/$RepoName/git/refs/tags/$Tag -X DELETE 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Tag $Tag 已删除"
        } else {
            Write-Warning "删除 tag 失败，可能不存在"
        }
        
        return $true
    } catch {
        Write-Error "删除 release/tag 时出错: $_"
        return $false
    }
}

# 创建 release
function New-Release {
    param([string]$Tag, [string]$Notes)
    
    Write-Info "正在创建 release: $Tag"
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] 将创建 release: $Tag"
        Write-Info "Release Notes:"
        Write-Output $Notes
        return $true
    }
    
    try {
        # 创建 release
        $notesFile = [System.IO.Path]::GetTempFileName()
        $Notes | Out-File -FilePath $notesFile -Encoding UTF8
        
        gh release create $Tag --repo "$RepoOwner/$RepoName" --title $Tag --notes-file $notesFile 2>&1 | Out-Null
        
        Remove-Item $notesFile -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Release $Tag 已创建"
            return $true
        } else {
            Write-Error "创建 release 失败"
            return $false
        }
    } catch {
        Write-Error "创建 release 时出错: $_"
        return $false
    }
}

# 从 CHANGELOG 提取版本说明
function Get-ReleaseNotes {
    param([string]$Version)
    
    if (-not (Test-Path $ChangelogPath)) {
        Write-Warning "找不到 CHANGELOG.md，将使用默认说明"
        return "Release v$Version"
    }
    
    $content = Get-Content $ChangelogPath -Raw -Encoding UTF8
    $tag = "v$Version"
    
    # 转义版本号中的特殊字符（如点号）
    $escapedVersion = [regex]::Escape($Version)
    
    # 匹配版本块（格式：## [1.0.0] - 2024-01-01）
    # 匹配到下一个版本或文件结尾
    $pattern = "(?s)##\s*\[$escapedVersion\]\s*-\s*\d{4}-\d{2}-\d{2}\s*\r?\n(.*?)(?=\r?\n##\s*\[|\r?\n---\s*\r?\n##\s*\[|\z)"
    if ($content -match $pattern) {
        $notes = $matches[1].Trim()
        # 移除末尾的分隔线
        $notes = $notes -replace '\r?\n---\s*$', ''
        if ([string]::IsNullOrWhiteSpace($notes)) {
            Write-Warning "版本 $Version 的说明为空"
            return "Release $tag`n`n查看完整更新日志: https://github.com/$RepoOwner/$RepoName/blob/main/CHANGELOG.md"
        }
        return $notes
    } else {
        Write-Warning "在 CHANGELOG.md 中找不到版本 $Version 的说明"
        return "Release $tag`n`n查看完整更新日志: https://github.com/$RepoOwner/$RepoName/blob/main/CHANGELOG.md"
    }
}

# 主函数
function Main {
    Write-Info "=== GitHub Release 管理脚本 ==="
    Write-Info "仓库: $RepoOwner/$RepoName"
    
    # 检查 GitHub CLI
    if (-not (Test-GitHubCLI)) {
        Write-Error "GitHub CLI (gh) 未安装，请先安装: https://cli.github.com/"
        exit 1
    }
    
    # 检查认证
    Test-GitHubAuth
    
    # 获取版本号
    if ([string]::IsNullOrEmpty($Version)) {
        $Version = Get-VersionFromFile
    }
    $tag = "v$Version"
    
    Write-Info "目标版本: $tag"
    
    if ($DryRun) {
        Write-Warning "=== DRY RUN 模式（不会实际执行操作）==="
    }
    
    # 检查 release 是否存在
    $exists = Test-ReleaseExists -Tag $tag
    
    if ($exists) {
        Write-Warning "Release $tag 已存在"
        $confirm = Read-Host "是否删除并重新创建? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Info "操作已取消"
            exit 0
        }
        
        if (Remove-Release -Tag $tag) {
            Write-Info "等待 2 秒后创建新 release..."
            Start-Sleep -Seconds 2
        } else {
            Write-Error "删除失败，退出"
            exit 1
        }
    }
    
    # 创建 release
    $notes = Get-ReleaseNotes -Version $Version
    if (New-Release -Tag $tag -Notes $notes) {
        Write-Success "=== 完成 ==="
        Write-Info "Release URL: https://github.com/$RepoOwner/$RepoName/releases/tag/$tag"
    } else {
        Write-Error "创建 release 失败"
        exit 1
    }
}

# 运行主函数
Main

