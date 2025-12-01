package service

import (
	"context"
	"encoding/json"
	"fmt"
	"indraw/core/provider"
	"indraw/core/types"
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
	providers map[string]provider.AIProvider
	mu        sync.RWMutex
}

// NewAIService 创建 AI 服务实例
func NewAIService(configService *ConfigService) *AIService {
	return &AIService{
		configService: configService,
		providers:     make(map[string]provider.AIProvider),
	}
}

// Startup 在应用启动时调用
func (a *AIService) Startup(ctx context.Context) {
	a.ctx = ctx
}

// ==================== 提供商管理方法 ====================

// RegisterProvider 注册提供商
func (a *AIService) RegisterProvider(name string, provider provider.AIProvider) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.providers[name] = provider
}

// GetProvider 获取提供商
// 如果提供商不存在，会尝试根据配置创建
func (a *AIService) GetProvider(name string) (provider.AIProvider, error) {
	a.mu.RLock()
	aiProvider, ok := a.providers[name]
	a.mu.RUnlock()

	if ok {
		return aiProvider, nil
	}

	// 提供商不存在，尝试创建
	return a.createProvider(name)
}

// GetProviderCapabilities 获取提供商能力
func (a *AIService) GetProviderCapabilities(providerName string) (*provider.ProviderCapabilities, error) {
	aiProvider, err := a.GetProvider(providerName)
	if err != nil {
		return nil, err
	}
	caps := aiProvider.GetCapabilities()
	return &caps, nil
}

// createProvider 创建提供商（内部方法）
func (a *AIService) createProvider(name string) (provider.AIProvider, error) {
	// 加载配置
	aiSettings, err := a.loadAISettings()
	if err != nil {
		return nil, err
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	// 双重检查，避免并发创建
	if aiProvider, ok := a.providers[name]; ok {
		return aiProvider, nil
	}

	var aiProvider provider.AIProvider

	switch name {
	case "gemini":
		aiProvider, err = provider.NewGeminiProvider(a.ctx, aiSettings)
	case "openai":
		aiProvider, err = provider.NewOpenAIProvider(a.ctx, aiSettings)
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s", name)
	}

	if err != nil {
		return nil, err
	}

	a.providers[name] = aiProvider
	return aiProvider, nil
}

// loadAISettings 加载 AI 配置（内部方法）
func (a *AIService) loadAISettings() (types.AISettings, error) {
	settingsJSON, err := a.configService.LoadSettings()
	if err != nil {
		return types.AISettings{}, fmt.Errorf("failed to load settings: %w", err)
	}

	var settings types.Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return types.AISettings{}, fmt.Errorf("failed to parse settings: %w", err)
	}

	return settings.AI, nil
}

// getCurrentProvider 获取当前配置的提供商（内部方法）
func (a *AIService) getCurrentProvider() (provider.AIProvider, error) {
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
	for name, aiProvider := range a.providers {
		if err := aiProvider.Close(); err != nil {
			lastErr = fmt.Errorf("failed to close provider %s: %w", name, err)
			fmt.Printf("[AIService] Error closing provider %s: %v\n", name, err)
		}
	}

	// 清除缓存
	a.providers = make(map[string]provider.AIProvider)

	return lastErr
}

// Close 关闭所有提供商，释放资源
func (a *AIService) Close() error {
	return a.ReloadProviders()
}

// ==================== 公共 API 方法 ====================

// GenerateImage 生成图像
// 返回 base64 编码的图像数据
func (a *AIService) GenerateImage(paramsJSON string) (string, error) {
	var params types.GenerateImageParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	// 获取当前提供商
	aiProvider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := aiProvider.GetCapabilities()
	if !caps.GenerateImage {
		return "", fmt.Errorf("aiProvider %s does not support image generation", aiProvider.Name())
	}

	// 如果有参考图像，检查是否支持
	if params.ReferenceImage != "" && !caps.ReferenceImage {
		return "", fmt.Errorf("aiProvider %s does not support reference image", aiProvider.Name())
	}

	// 委托给提供商
	return aiProvider.GenerateImage(a.ctx, params)
}

// EditImage 编辑图像
func (a *AIService) EditImage(paramsJSON string) (string, error) {
	var params types.EditImageParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	// 获取当前提供商
	aiProvider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := aiProvider.GetCapabilities()
	if !caps.EditImage {
		return "", fmt.Errorf("aiProvider %s does not support image editing", aiProvider.Name())
	}

	// 委托给提供商
	return aiProvider.EditImage(a.ctx, params)
}

// RemoveBackground 移除背景
func (a *AIService) RemoveBackground(imageData string) (string, error) {
	// 获取当前提供商
	aiProvider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := aiProvider.GetCapabilities()
	if !caps.RemoveBackground {
		return "", fmt.Errorf("aiProvider %s does not support background removal", aiProvider.Name())
	}

	// 使用图像编辑功能实现背景移除
	params := types.EditImageParams{
		ImageData: imageData,
		Prompt:    "Remove the background from this image. Keep the main subject intact with high quality. Return the image with transparent background.",
	}

	return aiProvider.EditImage(a.ctx, params)
}

// BlendImages 多图融合
// 按图层顺序（下层到上层）逐步融合多张图片
func (a *AIService) BlendImages(paramsJSON string) (string, error) {
	var params types.BlendImagesParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	// 验证图片数量
	if len(params.Images) < 2 {
		return "", fmt.Errorf("at least 2 images are required for blending")
	}

	// 获取当前提供商
	aiProvider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := aiProvider.GetCapabilities()
	if !caps.BlendImages {
		return "", fmt.Errorf("aiProvider %s does not support image blending", aiProvider.Name())
	}

	// 构建融合风格描述
	styleDesc := getBlendStyleDescription(params.Style)

	// 从第一张图片开始，逐步与后续图片融合
	currentResult := params.Images[0]

	for i := 1; i < len(params.Images); i++ {
		// 构建融合提示词
		var fullPrompt string
		if i == len(params.Images)-1 && params.Prompt != "" {
			// 最后一次融合时加入用户提示词
			fullPrompt = fmt.Sprintf(
				"Blend these two images together seamlessly. %s User instruction: %s. "+
					"Create a cohesive result that combines elements from both images naturally. "+
					"Maintain high quality and visual consistency.",
				styleDesc, params.Prompt)
		} else {
			fullPrompt = fmt.Sprintf(
				"Blend these two images together seamlessly. %s "+
					"Create a cohesive result that combines elements from both images naturally. "+
					"Maintain high quality and visual consistency.",
				styleDesc)
		}

		// 调用多图编辑功能
		editParams := types.MultiImageEditParams{
			Images: []string{currentResult, params.Images[i]},
			Prompt: fullPrompt,
		}

		result, err := aiProvider.EditMultiImages(a.ctx, editParams)
		if err != nil {
			return "", fmt.Errorf("blend step %d failed: %w", i, err)
		}

		currentResult = result
	}

	return currentResult, nil
}

// getBlendStyleDescription 获取融合风格描述
func getBlendStyleDescription(style string) string {
	switch style {
	case "Seamless":
		return "Use seamless blending with natural transitions between elements."
	case "Double Exposure":
		return "Create a double exposure effect, overlaying the images artistically like film photography."
	case "Splash Effect":
		return "Create a dynamic splash effect with elements flowing and merging energetically."
	case "Glitch/Cyberpunk":
		return "Apply a glitch/cyberpunk aesthetic with digital distortion, neon colors, and futuristic elements."
	case "Surreal":
		return "Create a surreal, dreamlike composition that defies reality and combines elements in unexpected ways."
	default:
		return "Blend naturally and harmoniously."
	}
}

// EnhancePrompt 增强提示词
func (a *AIService) EnhancePrompt(prompt string) (string, error) {
	// 获取当前提供商
	aiProvider, err := a.getCurrentProvider()
	if err != nil {
		return "", err
	}

	// 检查功能支持
	caps := aiProvider.GetCapabilities()
	if !caps.EnhancePrompt {
		return "", fmt.Errorf("aiProvider %s does not support prompt enhancement", aiProvider.Name())
	}

	// 委托给提供商
	return aiProvider.EnhancePrompt(a.ctx, prompt)
}
