package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"runtime"

	"github.com/blang/semver"
	"github.com/rhysd/go-github-selfupdate/selfupdate"
)

// UpdateService 更新检测服务
// 负责从 GitHub Releases 检测和下载更新
type UpdateService struct {
	ctx           context.Context
	repoOwner     string // GitHub 仓库所有者
	repoName      string // GitHub 仓库名称
	currentVersion string // 当前版本号
}

// UpdateInfo 更新信息
type UpdateInfo struct {
	HasUpdate    bool   `json:"hasUpdate"`
	LatestVersion string `json:"latestVersion"`
	CurrentVersion string `json:"currentVersion"`
	ReleaseURL   string `json:"releaseUrl"`
	ReleaseNotes string `json:"releaseNotes"`
	Error        string `json:"error,omitempty"`
}

// NewUpdateService 创建更新服务实例
func NewUpdateService(repoOwner, repoName, currentVersion string) *UpdateService {
	return &UpdateService{
		repoOwner:      repoOwner,
		repoName:       repoName,
		currentVersion: currentVersion,
	}
}

// Startup 在应用启动时调用
func (u *UpdateService) Startup(ctx context.Context) {
	u.ctx = ctx
}

// CheckForUpdate 检查是否有可用更新
func (u *UpdateService) CheckForUpdate() (UpdateInfo, error) {
	// 重定向标准输出和错误输出，避免弹出终端窗口（Windows 平台）
	// 保存原始的 stdout 和 stderr
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	
	// 打开空设备文件用于重定向输出
	devNull, err := os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	if err == nil {
		os.Stdout = devNull
		os.Stderr = devNull
		defer func() {
			devNull.Close()
			os.Stdout = oldStdout
			os.Stderr = oldStderr
		}()
	} else {
		// 如果无法打开 DevNull，至少尝试恢复
		defer func() {
			os.Stdout = oldStdout
			os.Stderr = oldStderr
		}()
	}

	repo := fmt.Sprintf("%s/%s", u.repoOwner, u.repoName)
	
	latest, found, err := selfupdate.DetectLatest(repo)
	if err != nil {
		return UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: u.currentVersion,
			Error:          fmt.Sprintf("检测更新失败: %v", err),
		}, nil // 返回错误信息但不返回 error，让前端可以显示
	}

	if !found {
		return UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: u.currentVersion,
			LatestVersion:  u.currentVersion,
		}, nil
	}

	// 解析当前版本并比较
	currentVer, err := semver.ParseTolerant(u.currentVersion)
	if err != nil {
		// 如果解析失败，使用字符串比较
		hasUpdate := latest.Version.String() != u.currentVersion
		return UpdateInfo{
			HasUpdate:      hasUpdate,
			CurrentVersion: u.currentVersion,
			LatestVersion:  latest.Version.String(),
			ReleaseURL:     latest.URL,
			Error:          fmt.Sprintf("版本格式解析失败: %v", err),
		}, nil
	}

	// 使用 semver 比较版本
	hasUpdate := latest.Version.GT(currentVer)
	
	info := UpdateInfo{
		HasUpdate:      hasUpdate,
		CurrentVersion: u.currentVersion,
		LatestVersion:  latest.Version.String(),
		ReleaseURL:     latest.URL,
	}

	// 始终返回发布说明（如果存在），无论是否有更新
	if latest.ReleaseNotes != "" {
		info.ReleaseNotes = latest.ReleaseNotes
	}

	return info, nil
}

// CheckForUpdateJSON 检查更新并返回 JSON 格式
func (u *UpdateService) CheckForUpdateJSON() (string, error) {
	info, err := u.CheckForUpdate()
	if err != nil {
		return "", err
	}

	data, err := json.Marshal(info)
	if err != nil {
		return "", fmt.Errorf("failed to serialize update info: %w", err)
	}

	return string(data), nil
}

// GetCurrentVersion 获取当前版本
func (u *UpdateService) GetCurrentVersion() string {
	return u.currentVersion
}

// Update 执行更新（下载并替换当前可执行文件）
// 注意：在 Wails 应用中，更新可能需要特殊处理
func (u *UpdateService) Update() error {
	repo := fmt.Sprintf("%s/%s", u.repoOwner, u.repoName)
	
	latest, found, err := selfupdate.DetectLatest(repo)
	if err != nil {
		return fmt.Errorf("检测更新失败: %w", err)
	}

	if !found {
		return fmt.Errorf("未找到更新")
	}

	// 解析当前版本并检查是否需要更新
	currentVer, err := semver.ParseTolerant(u.currentVersion)
	if err != nil {
		return fmt.Errorf("版本格式解析失败: %w", err)
	}

	if !latest.Version.GT(currentVer) {
		return fmt.Errorf("已是最新版本")
	}

	// 获取当前可执行文件路径
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("获取可执行文件路径失败: %w", err)
	}

	// 执行更新
	if err := selfupdate.UpdateTo(latest.AssetURL, exe); err != nil {
		return fmt.Errorf("更新失败: %w", err)
	}

	return nil
}

// GetExecutableName 获取当前平台的可执行文件名
func GetExecutableName() string {
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}
	return fmt.Sprintf("indraw-%s-%s%s", runtime.GOOS, runtime.GOARCH, ext)
}

