package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// ==================== AIService 提供商管理器 ====================

// AIService AI 服务管理器
// 管理多个 AI 提供商，根据配置动态选择提供商
// 保持现有的公共接口签名不变，内部委托给具体提供商
type AIService struct {
	ctx           context.Context
	configService *ConfigService

	// 提供商管理
	providers map[string]AIProvider
	mu        sync.RWMutex
}

// NewAIService 创建 AI 服务实例
func NewAIService(configService *ConfigService) *AIService {
	return &AIService{
		configService: configService,
		providers:     make(map[string]AIProvider),
	}
}

// Startup 在应用启动时调用
func (a *AIService) Startup(ctx context.Context) {
	a.ctx = ctx
}

// ==================== 提供商管理方法 ====================

// RegisterProvider 注册提供商
func (a *AIService) RegisterProvider(name string, provider AIProvider) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.providers[name] = provider
}

// GetProvider 获取提供商
// 如果提供商不存在，会尝试根据配置创建
func (a *AIService) GetProvider(name string) (AIProvider, error) {
	a.mu.RLock()
	provider, ok := a.providers[name]
	a.mu.RUnlock()

	if ok {
		return provider, nil
	}

	// 提供商不存在，尝试创建
	return a.createProvider(name)
}

// GetProviderCapabilities 获取提供商能力
func (a *AIService) GetProviderCapabilities(providerName string) (*ProviderCapabilities, error) {
	provider, err := a.GetProvider(providerName)
	if err != nil {
		return nil, err
	}
	caps := provider.GetCapabilities()
	return &caps, nil
}

// createProvider 创建提供商（内部方法）
func (a *AIService) createProvider(name string) (AIProvider, error) {
	// 加载配置
	aiSettings, err := a.loadAISettings()
	if err != nil {
		return nil, err
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	// 双重检查，避免并发创建
	if provider, ok := a.providers[name]; ok {
		return provider, nil
	}

	var provider AIProvider

	switch name {
	case "gemini":
		provider, err = NewGeminiProvider(a.ctx, aiSettings)
	case "openai":
		provider, err = NewOpenAIProvider(a.ctx, aiSettings)
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s", name)
	}

	if err != nil {
		return nil, err
	}

	a.providers[name] = provider
	return provider, nil
}

// loadAISettings 加载 AI 配置（内部方法）
func (a *AIService) loadAISettings() (AISettings, error) {
	settingsJSON, err := a.configService.LoadSettings()
	if err != nil {
		return AISettings{}, fmt.Errorf("failed to load settings: %w", err)
	}

	var settings Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return AISettings{}, fmt.Errorf("failed to parse settings: %w", err)
	}

	return settings.AI, nil
}

// getCurrentProvider 获取当前配置的提供商（内部方法）
func (a *AIService) getCurrentProvider() (AIProvider, error) {
	aiSettings, err := a.loadAISettings()
	if err != nil {
		return nil, err
	}
	return a.GetProvider(aiSettings.Provider)
}

// ReloadProviders 重新加载所有提供商（配置变更时调用）
// 关闭现有提供商并清除缓存，下次调用时会使用新配置重新创建
func (a *AIService) ReloadProviders() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	fmt.Printf("[AIService] Reloading providers due to configuration change\n")

	var lastErr error
	for name, provider := range a.providers {
		fmt.Printf("[AIService] Closing provider: %s\n", name)
		if err := provider.Close(); err != nil {
			lastErr = fmt.Errorf("failed to close provider %s: %w", name, err)
			fmt.Printf("[AIService] Error closing provider %s: %v\n", name, err)
		}
	}

	// 清除缓存
	a.providers = make(map[string]AIProvider)
	fmt.Printf("[AIService] All providers cleared, will be recreated on next use\n")

	return lastErr
}

// Close 关闭所有提供商，释放资源
func (a *AIService) Close() error {
	return a.ReloadProviders()
}

// ==================== 参数结构体 ====================

// GenerateImageParams 图像生成参数
type GenerateImageParams struct {
	Prompt         string `json:"prompt"`
	ReferenceImage string `json:"referenceImage,omitempty"` // base64 编码的参考图像
	ImageSize      string `json:"imageSize"`                // "1K", "2K", "4K"
	AspectRatio    string `json:"aspectRatio"`              // "1:1", "16:9", "9:16", "3:4", "4:3"
}

// EditImageParams 图像编辑参数
type EditImageParams struct {
	ImageData string `json:"imageData"` // base64 编码的图像
	Prompt    string `json:"prompt"`
}

// BlendImagesParams 图像混合参数
type BlendImagesParams struct {
	BottomImage string `json:"bottomImage"` // base64
	TopImage    string `json:"topImage"`    // base64
	Prompt      string `json:"prompt"`
	Style       string `json:"style"` // "Seamless", "Overlay", etc.
}

// ==================== 公共 API 方法 ====================

// GenerateImage 生成图像
// 返回 base64 编码的图像数据
func (a *AIService) GenerateImage(paramsJSON string) (string, error) {
	var params GenerateImageParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	// 获取当前提供商
	provider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := provider.GetCapabilities()
	if !caps.GenerateImage {
		return "", fmt.Errorf("provider %s does not support image generation", provider.Name())
	}

	// 如果有参考图像，检查是否支持
	if params.ReferenceImage != "" && !caps.ReferenceImage {
		return "", fmt.Errorf("provider %s does not support reference image", provider.Name())
	}

	// 委托给提供商
	return provider.GenerateImage(a.ctx, params)
}

// EditImage 编辑图像
func (a *AIService) EditImage(paramsJSON string) (string, error) {
	var params EditImageParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	// 获取当前提供商
	provider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := provider.GetCapabilities()
	if !caps.EditImage {
		return "", fmt.Errorf("provider %s does not support image editing", provider.Name())
	}

	// 委托给提供商
	return provider.EditImage(a.ctx, params)
}

// RemoveBackground 移除背景
func (a *AIService) RemoveBackground(imageData string) (string, error) {
	// 获取当前提供商
	provider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := provider.GetCapabilities()
	if !caps.RemoveBackground {
		return "", fmt.Errorf("provider %s does not support background removal", provider.Name())
	}

	// 使用图像编辑功能实现背景移除
	params := EditImageParams{
		ImageData: imageData,
		Prompt:    "Remove the background from this image. Make the background transparent. Keep the main subject intact with high quality.",
	}

	return provider.EditImage(a.ctx, params)
}

// BlendImages 混合图像
func (a *AIService) BlendImages(paramsJSON string) (string, error) {
	var params BlendImagesParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	// 获取当前提供商
	provider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := provider.GetCapabilities()
	if !caps.BlendImages {
		return "", fmt.Errorf("provider %s does not support image blending", provider.Name())
	}

	// 构建混合提示词
	fullPrompt := fmt.Sprintf("Blend these two images together using %s style. %s", params.Style, params.Prompt)

	// 使用图像编辑功能
	editParams := EditImageParams{
		ImageData: params.BottomImage,
		Prompt:    fullPrompt,
	}

	return provider.EditImage(a.ctx, editParams)
}

// EnhancePrompt 增强提示词
func (a *AIService) EnhancePrompt(prompt string) (string, error) {
	// 获取当前提供商
	provider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := provider.GetCapabilities()
	if !caps.EnhancePrompt {
		return "", fmt.Errorf("provider %s does not support prompt enhancement", provider.Name())
	}

	// 委托给提供商
	return provider.EnhancePrompt(a.ctx, prompt)
}
