package core

import (
	"context"
	"encoding/json"
	"fmt"
	"indraw/core/service"
	"indraw/core/types"
	"os"
	"path/filepath"
	"runtime"
)

// App struct - 主应用结构
type App struct {
	ctx             context.Context
	fileService     *service.FileService
	configService   *service.ConfigService
	aiService       *service.AIService
	promptService   *service.PromptService
	modelService    *service.ModelService
	modelFileServer *service.ModelFileServer
}

// NewApp creates a new App application struct
func NewApp() *App {
	// 创建服务实例
	configService := service.NewConfigService()
	fileService := service.NewFileService()
	aiService := service.NewAIService(configService)
	promptService := service.NewPromptService(configService)
	modelService := service.NewModelService(configService)

	// 初始化模型存储目录
	modelsDir := getModelsDir()

	// 创建模型文件服务器
	modelFileServer := service.NewModelFileServer(modelsDir)

	return &App{
		fileService:     fileService,
		configService:   configService,
		aiService:       aiService,
		promptService:   promptService,
		modelService:    modelService,
		modelFileServer: modelFileServer,
	}
}

// getModelsDir 获取模型存储目录
func getModelsDir() string {
	var baseDir string
	if runtime.GOOS == "windows" {
		baseDir = os.Getenv("APPDATA")
	} else if runtime.GOOS == "darwin" {
		baseDir = filepath.Join(os.Getenv("HOME"), "Library", "Application Support")
	} else {
		baseDir = filepath.Join(os.Getenv("HOME"), ".local", "share")
	}

	modelsDir := filepath.Join(baseDir, "IndrawEditor", "models")
	// 确保目录存在
	os.MkdirAll(modelsDir, 0755)
	return modelsDir
}

// GetModelFileServer 获取模型文件服务器（供 main.go 使用）
func (a *App) GetModelFileServer() *service.ModelFileServer {
	return a.modelFileServer
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// 启动模型文件服务器
	if err := a.modelFileServer.Start(); err != nil {
		fmt.Printf("Failed to start model file server: %v\n", err)
	}

	// 初始化各个服务
	a.fileService.Startup(ctx)
	if err := a.configService.Startup(ctx); err != nil {
		fmt.Printf("Failed to initialize config service: %v\n", err)
	}
	a.aiService.Startup(ctx)
	if err := a.modelService.Startup(ctx); err != nil {
		fmt.Printf("Failed to initialize model service: %v\n", err)
	}
}

// ===== 文件管理服务方法 =====

// SaveProject 保存项目
func (a *App) SaveProject(projectDataJSON string, suggestedName string) (string, error) {
	return a.fileService.SaveProject(projectDataJSON, suggestedName)
}

// LoadProject 加载项目
func (a *App) LoadProject() (string, error) {
	return a.fileService.LoadProject()
}

// ExportImage 导出图像
// imageDataURL: base64 编码的图像数据
// suggestedName: 建议的文件名
// format: 导出格式 ("png", "jpeg", "webp")，如果为空则从文件名推断
// exportDir: 导出目录（可选），如果为空则显示文件保存对话框
func (a *App) ExportImage(imageDataURL string, suggestedName string, format string, exportDir string) (string, error) {
	return a.fileService.ExportImage(imageDataURL, suggestedName, format, exportDir)
}

// ExportSliceImages 批量导出切片图像
func (a *App) ExportSliceImages(slicesJSON string) (string, error) {
	return a.fileService.ExportSliceImages(slicesJSON)
}

// AutoSave 自动保存
func (a *App) AutoSave(projectDataJSON string) error {
	return a.fileService.AutoSave(projectDataJSON)
}

// LoadAutoSave 加载自动保存
func (a *App) LoadAutoSave() (string, error) {
	return a.fileService.LoadAutoSave()
}

// ClearAutoSave 清除自动保存
func (a *App) ClearAutoSave() error {
	return a.fileService.ClearAutoSave()
}

// SelectDirectory 选择目录
func (a *App) SelectDirectory(title string) (string, error) {
	return a.fileService.SelectDirectory(title)
}

// CreateProject 创建新项目
func (a *App) CreateProject(name string, parentDir string, canvasConfigJSON string) (string, error) {
	return a.fileService.CreateProject(name, parentDir, canvasConfigJSON)
}

// SaveProjectToPath 保存项目到指定路径
func (a *App) SaveProjectToPath(projectPath string, projectDataJSON string) error {
	return a.fileService.SaveProjectToPath(projectPath, projectDataJSON)
}

// LoadProjectFromPath 从指定路径加载项目
func (a *App) LoadProjectFromPath(projectPath string) (string, error) {
	return a.fileService.LoadProjectFromPath(projectPath)
}

// GetProjectMeta 获取项目元数据
func (a *App) GetProjectMeta(projectPath string) (string, error) {
	return a.fileService.GetProjectMeta(projectPath)
}

// GetRecentProjects 获取最近项目列表
func (a *App) GetRecentProjects() (string, error) {
	return a.fileService.GetRecentProjects()
}

// AddRecentProject 添加项目到最近列表
func (a *App) AddRecentProject(name string, path string) error {
	return a.fileService.AddRecentProject(name, path)
}

// ClearRecentProjects 清除最近项目列表
func (a *App) ClearRecentProjects() error {
	return a.fileService.ClearRecentProjects()
}

// RemoveRecentProject 从最近项目列表中移除
func (a *App) RemoveRecentProject(path string) error {
	return a.fileService.RemoveRecentProject(path)
}

// ===== 配置管理服务方法 =====

// SaveSettings 保存设置
func (a *App) SaveSettings(settingsJSON string) error {
	if err := a.configService.SaveSettings(settingsJSON); err != nil {
		return err
	}

	// 配置变更后，重新加载 AI 提供商以应用新配置
	if err := a.aiService.ReloadProviders(); err != nil {
		fmt.Printf("[App] Warning: failed to reload AI providers: %v\n", err)
		// 不返回错误，因为配置已成功保存
	}

	return nil
}

// LoadSettings 加载设置
func (a *App) LoadSettings() (string, error) {
	return a.configService.LoadSettings()
}

// ===== AI 服务方法 =====

// GenerateImage 生成图像
func (a *App) GenerateImage(paramsJSON string) (string, error) {
	return a.aiService.GenerateImage(paramsJSON)
}

// EditImage 编辑图像
func (a *App) EditImage(paramsJSON string) (string, error) {
	return a.aiService.EditImage(paramsJSON)
}

// RemoveBackground 移除背景
func (a *App) RemoveBackground(imageData string) (string, error) {
	return a.aiService.RemoveBackground(imageData)
}

// BlendImages 混合图像
func (a *App) BlendImages(paramsJSON string) (string, error) {
	return a.aiService.BlendImages(paramsJSON)
}

// EnhancePrompt 增强提示词
func (a *App) EnhancePrompt(prompt string) (string, error) {
	return a.aiService.EnhancePrompt(prompt)
}

// CheckAIProviderAvailability 检测 AI 提供商可用性
// 返回 JSON 格式：{"available": bool, "message": string}
func (a *App) CheckAIProviderAvailability(providerName string) (string, error) {
	available, message, err := a.aiService.CheckProviderAvailability(providerName)
	if err != nil {
		return "", err
	}

	result := map[string]interface{}{
		"available": available,
		"message":   message,
	}

	data, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to serialize result: %w", err)
	}

	return string(data), nil
}

// ===== 提示词服务方法 =====

// FetchPrompts 获取提示词列表
func (a *App) FetchPrompts(forceRefresh bool) (string, error) {
	prompts, err := a.promptService.FetchPrompts(forceRefresh)
	if err != nil {
		return "", err
	}

	// 序列化为 JSON
	data, err := json.Marshal(prompts)
	if err != nil {
		return "", fmt.Errorf("failed to serialize prompts: %w", err)
	}

	return string(data), nil
}

// ===== 模型管理服务方法 =====

// CheckModelExists 检查模型是否存在
func (a *App) CheckModelExists(modelPath string) (bool, error) {
	return a.modelService.CheckModelExists(modelPath)
}

// GetModelStatus 获取模型状态
func (a *App) GetModelStatus(modelID string) (string, error) {
	status, err := a.modelService.GetModelStatus(modelID)
	if err != nil {
		return "", err
	}

	data, err := json.Marshal(status)
	if err != nil {
		return "", fmt.Errorf("failed to serialize model status: %w", err)
	}

	return string(data), nil
}

// DownloadModel 下载模型
func (a *App) DownloadModel(modelID string) error {
	return a.modelService.DownloadModel(modelID, nil)
}

// GetModelConfig 获取当前模型配置（用于传递给 transformers.js）
func (a *App) GetModelConfig() (string, error) {
	config, err := a.modelService.GetModelConfig()
	if err != nil {
		return "", err
	}

	data, err := json.Marshal(config)
	if err != nil {
		return "", fmt.Errorf("failed to serialize model config: %w", err)
	}

	return string(data), nil
}

// GetModelBaseURL 获取模型文件服务的基础 URL
// 前端使用此 URL 来加载模型文件
func (a *App) GetModelBaseURL() string {
	// 返回模型服务器的完整 URL
	return a.modelFileServer.GetBaseURL()
}

// GetModelsDir 获取模型存储目录路径
func (a *App) GetModelsDir() string {
	return a.modelFileServer.GetModelsDir()
}

// ListModelFiles 列出指定模型目录下的所有文件
func (a *App) ListModelFiles(modelID string) (string, error) {
	files, err := a.modelService.ListModelFiles(modelID)
	if err != nil {
		return "", err
	}

	data, err := json.Marshal(files)
	if err != nil {
		return "", fmt.Errorf("failed to serialize file list: %w", err)
	}

	return string(data), nil
}

// DownloadModelFromHF 从 Hugging Face 下载模型
func (a *App) DownloadModelFromHF(modelID string, repoID string) error {
	return a.modelService.DownloadModelFromHuggingFace(modelID, repoID)
}

// GetAvailableModels 获取所有可用模型及其状态
func (a *App) GetAvailableModels() (string, error) {
	models, err := a.modelService.GetAvailableModels()
	if err != nil {
		return "", err
	}

	data, err := json.Marshal(models)
	if err != nil {
		return "", fmt.Errorf("failed to serialize models: %w", err)
	}

	return string(data), nil
}

// GetDownloadConfig 获取当前下载配置
func (a *App) GetDownloadConfig() (string, error) {
	config := a.modelService.GetDownloadConfig()

	data, err := json.Marshal(config)
	if err != nil {
		return "", fmt.Errorf("failed to serialize download config: %w", err)
	}

	return string(data), nil
}

// SetDownloadConfig 设置下载配置
func (a *App) SetDownloadConfig(configJSON string) error {
	var config types.HFDownloadConfig
	if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
		return fmt.Errorf("invalid config format: %w", err)
	}

	a.modelService.SetDownloadConfig(config)
	return nil
}
