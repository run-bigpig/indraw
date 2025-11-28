package core

import (
	"context"
	"fmt"
	"indraw/core/service"
)

// App struct - 主应用结构
type App struct {
	ctx           context.Context
	fileService   *service.FileService
	configService *service.ConfigService
	aiService     *service.AIService
}

// NewApp creates a new App application struct
func NewApp() *App {
	// 创建服务实例
	configService := service.NewConfigService()
	fileService := service.NewFileService()
	aiService := service.NewAIService(configService)

	return &App{
		fileService:   fileService,
		configService: configService,
		aiService:     aiService,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// 初始化各个服务
	a.fileService.Startup(ctx)
	if err := a.configService.Startup(ctx); err != nil {
		fmt.Printf("Failed to initialize config service: %v\n", err)
	}
	a.aiService.Startup(ctx)
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
func (a *App) ExportImage(imageDataURL string, suggestedName string) (string, error) {
	return a.fileService.ExportImage(imageDataURL, suggestedName)
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
	return a.configService.SaveSettings(settingsJSON)
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
