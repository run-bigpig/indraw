# Release Script Usage Guide

This directory contains release management scripts for managing GitHub Releases.

## Features

- ✅ Automatically reads version number from `core/version.go`
- ✅ Checks if a release with that version exists on GitHub
- ✅ If exists, optionally deletes and recreates it
- ✅ If not exists, creates a new release
- ✅ Automatically extracts release notes from `CHANGELOG.md`
- ✅ Supports dry-run mode (preview operations without executing)

## Prerequisites

1. **Install Git**
   - Windows: Download from [Git for Windows](https://git-scm.com/download/win)
   - macOS: `brew install git` or download from [Git website](https://git-scm.com/)
   - Linux: `sudo apt install git` (Ubuntu/Debian) or use your package manager

2. **Create GitHub Personal Access Token**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" -> "Generate new token (classic)"
   - Select scopes:
     - `repo` (for private repositories) OR
     - `public_repo` (for public repositories only)
   - Copy the token (you won't be able to see it again!)

3. **Set GitHub Token** (choose one method):
   - **Method 1**: Set environment variable
     ```powershell
     # PowerShell
     $env:GITHUB_TOKEN = "your_token_here"
     
     # Bash
     export GITHUB_TOKEN="your_token_here"
     ```
   - **Method 2**: Use git config
     ```bash
     git config --global github.token "your_token_here"
     ```
   - **Method 3**: Pass as parameter (less secure)
     ```powershell
     .\scripts\release.ps1 -GitHubToken "your_token_here"
     ```

## Usage

### PowerShell (Windows)

```powershell
# Use default version (read from core/version.go)
.\scripts\release.ps1

# Specify version number
.\scripts\release.ps1 -Version "1.1.0"

# Dry-run mode (preview operations)
.\scripts\release.ps1 -DryRun

# With GitHub token parameter
.\scripts\release.ps1 -GitHubToken "your_token_here"

# Custom repository
.\scripts\release.ps1 -RepoOwner "your-username" -RepoName "your-repo"
```

### Bash (Linux/macOS/Git Bash)

```bash
# Use default version (read from core/version.go)
./scripts/release.sh

# Specify version number
./scripts/release.sh --version 1.1.0

# Dry-run mode (preview operations)
./scripts/release.sh --dry-run

# View help
./scripts/release.sh --help
```

## How It Works

1. **Read Version Number**
   - If version not specified, reads from `Version` constant in `core/version.go`
   - Tag format is `v{version}` (e.g., `v1.1.0`)

2. **Check Release Exists**
   - Uses `git ls-remote` to check if tag exists remotely
   - Uses GitHub API to check if release exists

3. **If Exists**
   - Prompts user to delete and recreate
   - After confirmation, deletes release via GitHub API
   - Deletes tag using `git tag -d` and `git push origin :refs/tags/{tag}`

4. **If Not Exists**
   - Creates tag locally using `git tag`
   - Pushes tag to remote using `git push origin {tag}`
   - Creates release via GitHub API

5. **Extract Release Notes**
   - Extracts release notes from `CHANGELOG.md` for the corresponding version
   - If not found, uses default message

## Examples

### Scenario 1: First Release of Version 1.1.0

```powershell
# PowerShell
.\scripts\release.ps1 -Version "1.1.0"
```

Output:
```
[INFO] === GitHub Release Management Script ===
[INFO] Repository: run-bigpig/indraw
[INFO] Target version: v1.1.0
[INFO] Creating release: v1.1.0
[INFO] Creating tag locally: v1.1.0
[INFO] Pushing tag to remote: v1.1.0
[SUCCESS] Release v1.1.0 created
[SUCCESS] === Complete ===
[INFO] Release URL: https://github.com/run-bigpig/indraw/releases/tag/v1.1.0
```

### Scenario 2: Re-release Existing Version

```powershell
# PowerShell
.\scripts\release.ps1 -Version "1.1.0"
```

Output:
```
[INFO] === GitHub Release Management Script ===
[INFO] Repository: run-bigpig/indraw
[INFO] Target version: v1.1.0
[WARNING] Release or tag v1.1.0 already exists
Delete and recreate? (y/N): y
[INFO] Deleting release: v1.1.0
[SUCCESS] Release v1.1.0 deleted
[INFO] Deleting tag: v1.1.0
[SUCCESS] Tag v1.1.0 deleted
[INFO] Waiting 2 seconds before creating new release...
[INFO] Creating release: v1.1.0
[SUCCESS] Release v1.1.0 created
[SUCCESS] === Complete ===
[INFO] Release URL: https://github.com/run-bigpig/indraw/releases/tag/v1.1.0
```

### Scenario 3: Dry-run Mode

```powershell
# PowerShell
.\scripts\release.ps1 -Version "1.1.0" -DryRun
```

Output:
```
[INFO] === GitHub Release Management Script ===
[INFO] Repository: run-bigpig/indraw
[INFO] Target version: v1.1.0
[WARNING] === DRY RUN MODE (no actual operations will be performed) ===
[WARNING] Release or tag v1.1.0 already exists
Delete and recreate? (y/N): y
[WARNING] [DRY RUN] Would delete release: v1.1.0
[WARNING] [DRY RUN] Would create release: v1.1.0
[INFO] Release Notes:
### Bug Fixes
...
```

## CHANGELOG Format Requirements

The script extracts release notes from `CHANGELOG.md`. Supported format:

```markdown
## [1.1.0] - 2024-01-01

### ✨ New Features
- New feature 1
- New feature 2

### 🐛 Bug Fixes
- Fixed issue 1

---

## [1.0.0] - 2023-12-01
...
```

The script extracts all content between `## [version]` and the next version as release notes.

## Notes

1. **Permissions**: You need write access to the GitHub repository
2. **Network Connection**: Requires access to GitHub API
3. **Version Format**: Version numbers should follow Semantic Versioning (SemVer)
4. **CHANGELOG**: Keep `CHANGELOG.md` format consistent for proper extraction
5. **Git Repository**: Script works best when run from within the git repository
6. **Token Security**: Never commit your GitHub token to version control!

## Troubleshooting

### Error: Git is not installed
Install Git from https://git-scm.com/

### Error: GitHub token not found
Set the token using one of the methods described in Prerequisites section.

### Error: Version file not found
Ensure `core/version.go` file exists and contains `const Version = "x.x.x"` format.

### Error: Permission denied
- Ensure your GitHub token has the correct scopes (`repo` or `public_repo`)
- Verify you have write access to the repository
- Check token hasn't expired

### Error: Release creation failed
- Check network connection
- Verify GitHub API availability
- Check version number format is correct
- Verify repository name and owner are correct
- Check API response for detailed error message

### Error: Tag push failed
- Ensure you have push access to the repository
- Check if tag already exists remotely
- Verify git remote is configured correctly (`git remote -v`)

## Security Best Practices

1. **Never commit tokens**: Add `.env` or token files to `.gitignore`
2. **Use environment variables**: Prefer `GITHUB_TOKEN` environment variable over parameters
3. **Use minimal scopes**: Only grant necessary permissions to your token
4. **Rotate tokens regularly**: Regenerate tokens periodically for security
5. **Use git config**: Store token in git config only if you trust your system
