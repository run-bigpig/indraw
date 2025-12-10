# Release Script - PowerShell Version
# Function: Check if a version exists on GitHub, delete if exists, create if not exists
# Uses only git commands for tag management, GitHub API for release management

param(
    [string]$Version = "",
    [string]$RepoOwner = "run-bigpig",
    [string]$RepoName = "indraw",
    [string]$ChangelogPath = "CHANGELOG.md",
    [string]$GitHubToken = "",
    [switch]$DryRun = $false,
    [switch]$TagOnly = $false
)

# Color output functions
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

function Write-ErrorMsg($message) {
    Write-ColorOutput Red "[ERROR] $message"
}

# Check if git is installed
function Test-Git {
    try {
        $null = git --version
        return $true
    } catch {
        return $false
    }
}

# Get GitHub token from environment or parameter (only needed for release management)
function Get-GitHubToken {
    if ($TagOnly) {
        return $null
    }
    
    if (-not [string]::IsNullOrEmpty($GitHubToken)) {
        return $GitHubToken
    }
    
    # Try environment variable
    $envToken = $env:GITHUB_TOKEN
    if (-not [string]::IsNullOrEmpty($envToken)) {
        return $envToken
    }
    
    # Try git config
    try {
        $gitToken = git config --global github.token 2>&1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrEmpty($gitToken)) {
            return $gitToken
        }
    } catch {
        # Ignore
    }
    
    return $null
}

# Read version from version.go
function Get-VersionFromFile {
    $versionFile = "core\version.go"
    if (-not (Test-Path $versionFile)) {
        Write-ErrorMsg "Version file not found: $versionFile"
        exit 1
    }
    
    $content = Get-Content $versionFile -Raw
    if ($content -match 'const Version = "([^"]+)"') {
        return $matches[1]
    } else {
        Write-ErrorMsg "Failed to parse version from $versionFile"
        exit 1
    }
}

# Check if tag exists locally using git
function Test-TagExistsLocal {
    param([string]$Tag)
    
    try {
        $result = git rev-parse --verify "refs/tags/$Tag" 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# Check if tag exists remotely using git
function Test-TagExistsRemote {
    param([string]$Tag)
    
    try {
        $result = git ls-remote --tags origin "refs/tags/$Tag" 2>&1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($result)) {
            return $true
        }
        return $false
    } catch {
        return $false
    }
}

# Check if release exists using GitHub API (optional)
function Test-ReleaseExists {
    param([string]$Tag, [string]$Token)
    
    if ([string]::IsNullOrEmpty($Token)) {
        return $false
    }
    
    try {
        $headers = @{
            "Accept" = "application/vnd.github.v3+json"
            "Authorization" = "token $Token"
        }
        
        $url = "https://api.github.com/repos/$RepoOwner/$RepoName/releases/tags/$Tag"
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction SilentlyContinue
        
        if ($response -and $response.id) {
            return $true
        }
        return $false
    } catch {
        # 404 means release doesn't exist
        if ($_.Exception.Response.StatusCode -eq 404) {
            return $false
        }
        return $false
    }
}

# Get release ID by tag (for deletion)
function Get-ReleaseId {
    param([string]$Tag, [string]$Token)
    
    if ([string]::IsNullOrEmpty($Token)) {
        return $null
    }
    
    try {
        $headers = @{
            "Accept" = "application/vnd.github.v3+json"
            "Authorization" = "token $Token"
        }
        
        $url = "https://api.github.com/repos/$RepoOwner/$RepoName/releases/tags/$Tag"
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction SilentlyContinue
        
        if ($response -and $response.id) {
            return $response.id
        }
        return $null
    } catch {
        return $null
    }
}

# Delete tag using git commands
function Remove-Tag {
    param([string]$Tag)
    
    Write-Info "Deleting tag: $Tag"
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Would delete tag: $Tag"
        return $true
    }
    
    try {
        # Delete local tag
        $localExists = Test-TagExistsLocal -Tag $Tag
        if ($localExists) {
            git tag -d $Tag 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Local tag $Tag deleted"
            } else {
                Write-Warning "Failed to delete local tag"
            }
        } else {
            Write-Info "Local tag $Tag does not exist"
        }
        
        # Delete remote tag
        $remoteExists = Test-TagExistsRemote -Tag $Tag
        if ($remoteExists) {
            git push origin :refs/tags/$Tag 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Remote tag $Tag deleted"
            } else {
                Write-Warning "Failed to delete remote tag"
                return $false
            }
        } else {
            Write-Info "Remote tag $Tag does not exist"
        }
        
        return $true
    } catch {
        Write-ErrorMsg "Error deleting tag: $_"
        return $false
    }
}

# Delete release using GitHub API (optional)
function Remove-Release {
    param([string]$Tag, [string]$Token)
    
    if ([string]::IsNullOrEmpty($Token)) {
        Write-Warning "No GitHub token provided, skipping release deletion"
        return $true
    }
    
    Write-Info "Deleting release: $Tag"
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Would delete release: $Tag"
        return $true
    }
    
    try {
        $releaseId = Get-ReleaseId -Tag $Tag -Token $Token
        if ($releaseId) {
            $headers = @{
                "Accept" = "application/vnd.github.v3+json"
                "Authorization" = "token $Token"
            }
            
            $url = "https://api.github.com/repos/$RepoOwner/$RepoName/releases/$releaseId"
            Invoke-RestMethod -Uri $url -Headers $headers -Method Delete | Out-Null
            Write-Success "Release $Tag deleted"
        } else {
            Write-Warning "Release $Tag not found, may already be deleted"
        }
        return $true
    } catch {
        Write-Warning "Error deleting release: $_"
        return $false
    }
}

# Create tag using git commands
function New-Tag {
    param([string]$Tag)
    
    Write-Info "Creating tag: $Tag"
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Would create tag: $Tag"
        return $true
    }
    
    try {
        # Check if tag already exists locally
        $localExists = Test-TagExistsLocal -Tag $Tag
        if ($localExists) {
            Write-Warning "Local tag $Tag already exists, skipping creation"
        } else {
            # Create tag pointing to current HEAD
            git tag $Tag 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Local tag $Tag created"
            } else {
                Write-ErrorMsg "Failed to create local tag"
                return $false
            }
        }
        
        # Push tag to remote
        Write-Info "Pushing tag to remote: $Tag"
        git push origin $Tag 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Tag $Tag pushed to remote"
        } else {
            Write-Warning "Failed to push tag, may already exist remotely"
            # Try to force push if needed (commented out for safety)
            # git push origin $Tag --force 2>&1 | Out-Null
        }
        
        return $true
    } catch {
        Write-ErrorMsg "Error creating tag: $_"
        return $false
    }
}

# Create release using GitHub API (optional)
function New-Release {
    param([string]$Tag, [string]$Notes, [string]$Token)
    
    if ([string]::IsNullOrEmpty($Token)) {
        Write-Warning "No GitHub token provided, skipping release creation"
        Write-Info "You can create the release manually at: https://github.com/$RepoOwner/$RepoName/releases/new"
        return $true
    }
    
    Write-Info "Creating release: $Tag"
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Would create release: $Tag"
        Write-Info "Release Notes:"
        Write-Output $Notes
        return $true
    }
    
    try {
        $headers = @{
            "Accept" = "application/vnd.github.v3+json"
            "Authorization" = "token $Token"
            "Content-Type" = "application/json"
        }
        
        $body = @{
            tag_name = $Tag
            name = $Tag
            body = $Notes
            draft = $false
            prerelease = $false
        } | ConvertTo-Json
        
        $url = "https://api.github.com/repos/$RepoOwner/$RepoName/releases"
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
        
        if ($response -and $response.id) {
            Write-Success "Release $Tag created"
            return $true
        } else {
            Write-ErrorMsg "Failed to create release"
            return $false
        }
    } catch {
        Write-ErrorMsg "Error creating release: $_"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Warning "API Response: $responseBody"
        }
        return $false
    }
}

# Extract release notes from CHANGELOG
function Get-ReleaseNotes {
    param([string]$Version)
    
    if (-not (Test-Path $ChangelogPath)) {
        Write-Warning "CHANGELOG.md not found, using default notes"
        return "Release v$Version"
    }
    
    $content = Get-Content $ChangelogPath -Raw -Encoding UTF8
    $tag = "v$Version"
    
    # Escape special characters in version (like dots)
    $escapedVersion = [regex]::Escape($Version)
    
    # Match version block (format: ## [1.0.0] - 2024-01-01)
    # Match until next version or end of file
    $pattern = "(?s)##\s*\[$escapedVersion\]\s*-\s*\d{4}-\d{2}-\d{2}\s*\r?\n(.*?)(?=\r?\n##\s*\[|\r?\n---\s*\r?\n##\s*\[|\z)"
    if ($content -match $pattern) {
        $notes = $matches[1].Trim()
        # Remove trailing separator
        $notes = $notes -replace '\r?\n---\s*$', ''
        if ([string]::IsNullOrWhiteSpace($notes)) {
            Write-Warning "Release notes for version $Version are empty"
            return "Release $tag`n`nView full changelog: https://github.com/$RepoOwner/$RepoName/blob/main/CHANGELOG.md"
        }
        return $notes
    } else {
        Write-Warning "Release notes for version $Version not found in CHANGELOG.md"
        return "Release $tag`n`nView full changelog: https://github.com/$RepoOwner/$RepoName/blob/main/CHANGELOG.md"
    }
}

# Main function
function Main {
    Write-Info "=== GitHub Release Management Script ==="
    Write-Info "Repository: $RepoOwner/$RepoName"
    
    # Check git
    if (-not (Test-Git)) {
        Write-ErrorMsg "Git is not installed. Please install Git from: https://git-scm.com/"
        exit 1
    }
    
    # Check if we're in a git repository
    try {
        $gitDir = git rev-parse --git-dir 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "Not in a git repository. Please run this script from within your git repository."
            exit 1
        }
    } catch {
        Write-ErrorMsg "Failed to detect git repository"
        exit 1
    }
    
    # Check remote origin
    try {
        $remoteUrl = git remote get-url origin 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "No 'origin' remote found. Tag operations may fail."
        } else {
            Write-Info "Remote origin: $remoteUrl"
        }
    } catch {
        Write-Warning "Could not get remote URL"
    }
    
    # Get GitHub token (only if not tag-only mode)
    $token = $null
    if (-not $TagOnly) {
        $token = Get-GitHubToken
        if ([string]::IsNullOrEmpty($token)) {
            Write-Warning "GitHub token not found. Release management will be skipped."
            Write-Warning "Tag operations will still work. To enable release management:"
            Write-Warning "  1. Use -GitHubToken parameter"
            Write-Warning "  2. Set GITHUB_TOKEN environment variable"
            Write-Warning "  3. Set git config --global github.token"
            Write-Warning ""
            Write-Warning "You can create a token at: https://github.com/settings/tokens"
        }
    }
    
    # Get version number
    if ([string]::IsNullOrEmpty($Version)) {
        $Version = Get-VersionFromFile
    }
    $tag = "v$Version"
    
    Write-Info "Target version: $tag"
    
    if ($DryRun) {
        Write-Warning "=== DRY RUN MODE (no actual operations will be performed) ==="
    }
    
    if ($TagOnly) {
        Write-Info "Tag-only mode: Only managing git tags, skipping release management"
    }
    
    # Check if tag exists
    $tagExistsLocal = Test-TagExistsLocal -Tag $tag
    $tagExistsRemote = Test-TagExistsRemote -Tag $tag
    $releaseExists = $false
    
    if (-not $TagOnly -and -not [string]::IsNullOrEmpty($token)) {
        $releaseExists = Test-ReleaseExists -Tag $tag -Token $token
    }
    
    if ($tagExistsLocal -or $tagExistsRemote -or $releaseExists) {
        Write-Warning "Tag or release $tag already exists"
        Write-Info "  Local tag exists: $tagExistsLocal"
        Write-Info "  Remote tag exists: $tagExistsRemote"
        if (-not $TagOnly) {
            Write-Info "  Release exists: $releaseExists"
        }
        
        $confirm = Read-Host "Delete and recreate? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Info "Operation cancelled"
            exit 0
        }
        
        # Delete release first (if token available)
        if (-not $TagOnly -and -not [string]::IsNullOrEmpty($token)) {
            Remove-Release -Tag $tag -Token $token | Out-Null
        }
        
        # Delete tag
        if (Remove-Tag -Tag $tag) {
            Write-Info "Waiting 2 seconds before creating new tag..."
            Start-Sleep -Seconds 2
        } else {
            Write-ErrorMsg "Failed to delete tag, exiting"
            exit 1
        }
    }
    
    # Create tag using git
    if (New-Tag -Tag $tag) {
        Write-Success "Tag $tag created and pushed"
    } else {
        Write-ErrorMsg "Failed to create tag"
        exit 1
    }
    
    # Create release (if token available and not tag-only mode)
    if (-not $TagOnly) {
        $notes = Get-ReleaseNotes -Version $Version
        if (-not [string]::IsNullOrEmpty($token)) {
            if (New-Release -Tag $tag -Notes $notes -Token $token) {
                Write-Success "=== Complete ==="
                Write-Info "Release URL: https://github.com/$RepoOwner/$RepoName/releases/tag/$tag"
            } else {
                Write-Warning "Tag created but release creation failed"
                Write-Info "You can create the release manually at: https://github.com/$RepoOwner/$RepoName/releases/new"
            }
        } else {
            Write-Success "=== Complete ==="
            Write-Info "Tag created successfully"
            Write-Info "Create release manually at: https://github.com/$RepoOwner/$RepoName/releases/new"
        }
    } else {
        Write-Success "=== Complete ==="
        Write-Info "Tag $tag created and pushed successfully"
    }
}

# Run main function
Main
