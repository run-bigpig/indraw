package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileService 文件管理服务
// 提供项目保存、加载、导出等文件操作功能
type FileService struct {
	ctx context.Context
}

// NewFileService 创建文件服务实例
func NewFileService() *FileService {
	return &FileService{}
}

// Startup 在应用启动时调用
func (f *FileService) Startup(ctx context.Context) {
	f.ctx = ctx
}

// ProjectData 项目数据结构
type ProjectData struct {
	Version      string          `json:"version"`
	Timestamp    int64           `json:"timestamp"`
	Layers       json.RawMessage `json:"layers"`
	CanvasConfig json.RawMessage `json:"canvasConfig"`
}

// SaveProject 保存项目到文件
// 返回保存的文件路径
func (f *FileService) SaveProject(projectDataJSON string, suggestedName string) (string, error) {
	if f.ctx == nil {
		return "", fmt.Errorf("service not initialized")
	}

	// 解析项目数据以验证格式
	var projectData ProjectData
	if err := json.Unmarshal([]byte(projectDataJSON), &projectData); err != nil {
		return "", fmt.Errorf("invalid project data: %w", err)
	}

	// 添加时间戳
	projectData.Timestamp = time.Now().Unix()
	projectData.Version = "1.0"

	// 重新序列化
	data, err := json.MarshalIndent(projectData, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to serialize project data: %w", err)
	}

	// 显示保存对话框
	defaultFilename := suggestedName
	if defaultFilename == "" {
		defaultFilename = fmt.Sprintf("indraw-project-%d.json", time.Now().Unix())
	}

	filePath, err := runtime.SaveFileDialog(f.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultFilename,
		Title:           "Save Project",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Indraw Project Files (*.json)",
				Pattern:     "*.json",
			},
		},
	})

	if err != nil {
		return "", fmt.Errorf("save dialog error: %w", err)
	}

	// 用户取消了保存
	if filePath == "" {
		return "", nil
	}

	// 确保文件扩展名为 .json
	if filepath.Ext(filePath) != ".json" {
		filePath += ".json"
	}

	// 写入文件
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return filePath, nil
}

// LoadProject 从项目目录加载项目
// 用户选择项目目录，返回项目数据的 JSON 字符串和项目路径
func (f *FileService) LoadProject() (string, error) {
	if f.ctx == nil {
		return "", fmt.Errorf("service not initialized")
	}

	// 显示目录选择对话框（选择项目目录）
	projectPath, err := runtime.OpenDirectoryDialog(f.ctx, runtime.OpenDialogOptions{
		Title: "Open Project Directory",
	})

	if err != nil {
		return "", fmt.Errorf("open dialog error: %w", err)
	}

	// 用户取消了打开
	if projectPath == "" {
		return "", nil
	}

	// 检查是否为有效的项目目录（包含 data.json）
	dataFile := filepath.Join(projectPath, "data.json")
	if _, err := os.Stat(dataFile); os.IsNotExist(err) {
		return "", fmt.Errorf("invalid project directory: data.json not found")
	}

	// 读取项目数据文件
	data, err := os.ReadFile(dataFile)
	if err != nil {
		return "", fmt.Errorf("failed to read project data file: %w", err)
	}

	// 验证 JSON 格式
	var projectData ProjectData
	if err := json.Unmarshal(data, &projectData); err != nil {
		return "", fmt.Errorf("invalid project data format: %w", err)
	}

	// 添加到最近项目列表
	metaFile := filepath.Join(projectPath, "project.json")
	if metaData, err := os.ReadFile(metaFile); err == nil {
		var meta ProjectMeta
		if json.Unmarshal(metaData, &meta) == nil {
			_ = f.AddRecentProject(meta.Name, projectPath)
		}
	}

	// 返回包含项目路径的响应
	// 为了让前端知道项目路径，我们需要在返回数据中添加路径信息
	response := struct {
		ProjectData
		ProjectPath string `json:"projectPath"`
		ProjectName string `json:"projectName"`
	}{
		ProjectData: projectData,
		ProjectPath: projectPath,
		ProjectName: filepath.Base(projectPath),
	}

	responseJSON, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to serialize response: %w", err)
	}

	return string(responseJSON), nil
}

// ExportImage 导出图像到文件
// imageDataURL: base64 编码的图像数据 (data:image/png;base64,...)
// suggestedName: 建议的文件名
func (f *FileService) ExportImage(imageDataURL string, suggestedName string) (string, error) {
	if f.ctx == nil {
		return "", fmt.Errorf("service not initialized")
	}

	// 显示保存对话框
	defaultFilename := suggestedName
	if defaultFilename == "" {
		defaultFilename = fmt.Sprintf("indraw-export-%d.png", time.Now().Unix())
	}

	filePath, err := runtime.SaveFileDialog(f.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultFilename,
		Title:           "Export Image",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "PNG Image (*.png)",
				Pattern:     "*.png",
			},
			{
				DisplayName: "JPEG Image (*.jpg)",
				Pattern:     "*.jpg;*.jpeg",
			},
		},
	})

	if err != nil {
		return "", fmt.Errorf("save dialog error: %w", err)
	}

	// 用户取消了保存
	if filePath == "" {
		return "", nil
	}

	// 解析 base64 数据
	// 格式: data:image/png;base64,iVBORw0KGgo...
	const base64Prefix = "data:image/"
	if len(imageDataURL) < len(base64Prefix) {
		return "", fmt.Errorf("invalid image data URL")
	}

	// 找到 base64 数据的起始位置
	base64Start := 0
	for i, c := range imageDataURL {
		if c == ',' {
			base64Start = i + 1
			break
		}
	}

	if base64Start == 0 {
		return "", fmt.Errorf("invalid image data URL format")
	}

	// 解码 base64
	imageData, err := base64.StdEncoding.DecodeString(imageDataURL[base64Start:])
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 image: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(filePath, imageData, 0644); err != nil {
		return "", fmt.Errorf("failed to write image file: %w", err)
	}

	return filePath, nil
}

// SelectDirectory 选择目录
// 返回用户选择的目录路径
func (f *FileService) SelectDirectory(title string) (string, error) {
	if f.ctx == nil {
		return "", fmt.Errorf("service not initialized")
	}

	dialogTitle := title
	if dialogTitle == "" {
		dialogTitle = "Select Directory"
	}

	dirPath, err := runtime.OpenDirectoryDialog(f.ctx, runtime.OpenDialogOptions{
		Title: dialogTitle,
	})

	if err != nil {
		return "", fmt.Errorf("directory dialog error: %w", err)
	}

	return dirPath, nil
}

// AutoSave 自动保存项目数据到临时位置
func (f *FileService) AutoSave(projectDataJSON string) error {
	// 获取用户数据目录
	userDataDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("failed to get user config dir: %w", err)
	}

	// 创建应用数据目录
	appDataDir := filepath.Join(userDataDir, "IndrawEditor")
	if err := os.MkdirAll(appDataDir, 0755); err != nil {
		return fmt.Errorf("failed to create app data dir: %w", err)
	}

	// 自动保存文件路径
	autoSaveFile := filepath.Join(appDataDir, "autosave.json")

	// 解析并添加时间戳
	var projectData ProjectData
	if err := json.Unmarshal([]byte(projectDataJSON), &projectData); err != nil {
		return fmt.Errorf("invalid project data: %w", err)
	}

	projectData.Timestamp = time.Now().Unix()
	projectData.Version = "1.0"

	data, err := json.MarshalIndent(projectData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize project data: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(autoSaveFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write autosave file: %w", err)
	}

	return nil
}

// LoadAutoSave 加载自动保存的数据
func (f *FileService) LoadAutoSave() (string, error) {
	userDataDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user config dir: %w", err)
	}

	autoSaveFile := filepath.Join(userDataDir, "IndrawEditor", "autosave.json")

	// 检查文件是否存在
	if _, err := os.Stat(autoSaveFile); os.IsNotExist(err) {
		return "", nil // 没有自动保存数据
	}

	// 读取文件
	data, err := os.ReadFile(autoSaveFile)
	if err != nil {
		return "", fmt.Errorf("failed to read autosave file: %w", err)
	}

	return string(data), nil
}

// ClearAutoSave 清除自动保存的数据
func (f *FileService) ClearAutoSave() error {
	userDataDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("failed to get user config dir: %w", err)
	}

	autoSaveFile := filepath.Join(userDataDir, "IndrawEditor", "autosave.json")

	// 删除文件（如果存在）
	if err := os.Remove(autoSaveFile); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove autosave file: %w", err)
	}

	return nil
}

// ==================== 项目管理增强 API ====================

// ProjectMeta 项目元数据结构
type ProjectMeta struct {
	Name         string          `json:"name"`
	Path         string          `json:"path"`
	Version      string          `json:"version"`
	CreatedAt    int64           `json:"createdAt"`
	UpdatedAt    int64           `json:"updatedAt"`
	CanvasConfig json.RawMessage `json:"canvasConfig"`
}

// RecentProject 最近项目信息
type RecentProject struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	UpdatedAt int64  `json:"updatedAt"`
}

// RecentProjectsData 最近项目列表数据
type RecentProjectsData struct {
	Projects []RecentProject `json:"projects"`
}

// CreateProject 创建新项目
// 在指定目录下创建项目文件夹和配置文件
func (f *FileService) CreateProject(name string, parentDir string, canvasConfigJSON string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("project name cannot be empty")
	}

	if parentDir == "" {
		return "", fmt.Errorf("parent directory cannot be empty")
	}

	// 创建项目目录
	projectDir := filepath.Join(parentDir, name)
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create project directory: %w", err)
	}

	// 创建项目元数据
	now := time.Now().Unix()
	meta := ProjectMeta{
		Name:         name,
		Path:         projectDir,
		Version:      "1.0",
		CreatedAt:    now,
		UpdatedAt:    now,
		CanvasConfig: json.RawMessage(canvasConfigJSON),
	}

	// 保存项目元数据
	metaData, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to serialize project meta: %w", err)
	}

	metaFile := filepath.Join(projectDir, "project.json")
	if err := os.WriteFile(metaFile, metaData, 0644); err != nil {
		return "", fmt.Errorf("failed to write project meta file: %w", err)
	}

	// 创建空的项目数据文件
	projectData := ProjectData{
		Version:      "1.0",
		Timestamp:    now,
		Layers:       json.RawMessage("[]"),
		CanvasConfig: json.RawMessage(canvasConfigJSON),
	}

	dataBytes, err := json.MarshalIndent(projectData, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to serialize project data: %w", err)
	}

	dataFile := filepath.Join(projectDir, "data.json")
	if err := os.WriteFile(dataFile, dataBytes, 0644); err != nil {
		return "", fmt.Errorf("failed to write project data file: %w", err)
	}

	// 添加到最近项目列表
	_ = f.AddRecentProject(name, projectDir)

	return projectDir, nil
}

// SaveProjectToPath 保存项目到指定路径
// 不弹出对话框，直接保存到指定的项目目录
func (f *FileService) SaveProjectToPath(projectPath string, projectDataJSON string) error {
	if projectPath == "" {
		return fmt.Errorf("project path cannot be empty")
	}

	// 解析项目数据以验证格式
	var projectData ProjectData
	if err := json.Unmarshal([]byte(projectDataJSON), &projectData); err != nil {
		return fmt.Errorf("invalid project data: %w", err)
	}

	// 更新时间戳
	projectData.Timestamp = time.Now().Unix()
	projectData.Version = "1.0"

	// 重新序列化
	data, err := json.MarshalIndent(projectData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize project data: %w", err)
	}

	// 写入数据文件
	dataFile := filepath.Join(projectPath, "data.json")
	if err := os.WriteFile(dataFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write project data file: %w", err)
	}

	// 更新项目元数据的更新时间
	metaFile := filepath.Join(projectPath, "project.json")
	if metaData, err := os.ReadFile(metaFile); err == nil {
		var meta ProjectMeta
		if json.Unmarshal(metaData, &meta) == nil {
			meta.UpdatedAt = time.Now().Unix()
			if newMetaData, err := json.MarshalIndent(meta, "", "  "); err == nil {
				_ = os.WriteFile(metaFile, newMetaData, 0644)
			}
		}
	}

	return nil
}

// LoadProjectFromPath 从指定路径加载项目
// 返回项目数据的 JSON 字符串
func (f *FileService) LoadProjectFromPath(projectPath string) (string, error) {
	if projectPath == "" {
		return "", fmt.Errorf("project path cannot be empty")
	}

	// 读取项目数据文件
	dataFile := filepath.Join(projectPath, "data.json")
	data, err := os.ReadFile(dataFile)
	if err != nil {
		return "", fmt.Errorf("failed to read project data file: %w", err)
	}

	// 验证 JSON 格式
	var projectData ProjectData
	if err := json.Unmarshal(data, &projectData); err != nil {
		return "", fmt.Errorf("invalid project data format: %w", err)
	}

	// 添加到最近项目列表
	metaFile := filepath.Join(projectPath, "project.json")
	if metaData, err := os.ReadFile(metaFile); err == nil {
		var meta ProjectMeta
		if json.Unmarshal(metaData, &meta) == nil {
			_ = f.AddRecentProject(meta.Name, projectPath)
		}
	}

	return string(data), nil
}

// GetProjectMeta 获取项目元数据
func (f *FileService) GetProjectMeta(projectPath string) (string, error) {
	if projectPath == "" {
		return "", fmt.Errorf("project path cannot be empty")
	}

	metaFile := filepath.Join(projectPath, "project.json")
	data, err := os.ReadFile(metaFile)
	if err != nil {
		return "", fmt.Errorf("failed to read project meta file: %w", err)
	}

	return string(data), nil
}

// ==================== 最近项目列表 API ====================

// getRecentProjectsFile 获取最近项目列表文件路径
func (f *FileService) getRecentProjectsFile() (string, error) {
	userDataDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user config dir: %w", err)
	}

	appDataDir := filepath.Join(userDataDir, "IndrawEditor")
	if err := os.MkdirAll(appDataDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create app data dir: %w", err)
	}

	return filepath.Join(appDataDir, "recent_projects.json"), nil
}

// AddRecentProject 添加项目到最近项目列表
func (f *FileService) AddRecentProject(name string, path string) error {
	recentFile, err := f.getRecentProjectsFile()
	if err != nil {
		return err
	}

	// 读取现有列表
	var recentData RecentProjectsData
	if data, err := os.ReadFile(recentFile); err == nil {
		_ = json.Unmarshal(data, &recentData)
	}

	// 移除已存在的相同路径项目
	newProjects := make([]RecentProject, 0, len(recentData.Projects))
	for _, p := range recentData.Projects {
		if p.Path != path {
			newProjects = append(newProjects, p)
		}
	}

	// 添加新项目到列表开头
	newProject := RecentProject{
		Name:      name,
		Path:      path,
		UpdatedAt: time.Now().Unix(),
	}
	recentData.Projects = append([]RecentProject{newProject}, newProjects...)

	// 限制列表长度为 10
	if len(recentData.Projects) > 10 {
		recentData.Projects = recentData.Projects[:10]
	}

	// 保存列表
	data, err := json.MarshalIndent(recentData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize recent projects: %w", err)
	}

	if err := os.WriteFile(recentFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write recent projects file: %w", err)
	}

	return nil
}

// GetRecentProjects 获取最近打开的项目列表
func (f *FileService) GetRecentProjects() (string, error) {
	recentFile, err := f.getRecentProjectsFile()
	if err != nil {
		return "", err
	}

	// 读取列表
	data, err := os.ReadFile(recentFile)
	if err != nil {
		if os.IsNotExist(err) {
			// 返回空列表
			return `{"projects":[]}`, nil
		}
		return "", fmt.Errorf("failed to read recent projects file: %w", err)
	}

	// 验证并过滤不存在的项目
	var recentData RecentProjectsData
	if err := json.Unmarshal(data, &recentData); err != nil {
		return `{"projects":[]}`, nil
	}

	// 过滤掉不存在的项目
	validProjects := make([]RecentProject, 0, len(recentData.Projects))
	for _, p := range recentData.Projects {
		if _, err := os.Stat(p.Path); err == nil {
			validProjects = append(validProjects, p)
		}
	}
	recentData.Projects = validProjects

	// 重新序列化
	result, err := json.Marshal(recentData)
	if err != nil {
		return "", fmt.Errorf("failed to serialize recent projects: %w", err)
	}

	return string(result), nil
}

// ClearRecentProjects 清除最近项目列表
func (f *FileService) ClearRecentProjects() error {
	recentFile, err := f.getRecentProjectsFile()
	if err != nil {
		return err
	}

	if err := os.Remove(recentFile); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove recent projects file: %w", err)
	}

	return nil
}

// RemoveRecentProject 从最近项目列表中移除指定项目
func (f *FileService) RemoveRecentProject(path string) error {
	recentFile, err := f.getRecentProjectsFile()
	if err != nil {
		return err
	}

	// 读取现有列表
	var recentData RecentProjectsData
	data, err := os.ReadFile(recentFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to read recent projects file: %w", err)
	}

	if err := json.Unmarshal(data, &recentData); err != nil {
		return nil
	}

	// 移除指定项目
	newProjects := make([]RecentProject, 0, len(recentData.Projects))
	for _, p := range recentData.Projects {
		if p.Path != path {
			newProjects = append(newProjects, p)
		}
	}
	recentData.Projects = newProjects

	// 保存列表
	newData, err := json.MarshalIndent(recentData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize recent projects: %w", err)
	}

	if err := os.WriteFile(recentFile, newData, 0644); err != nil {
		return fmt.Errorf("failed to write recent projects file: %w", err)
	}

	return nil
}
