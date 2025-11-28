package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// AIService AI 代理服务
// 在后端调用 AI API，隐藏 API Key，提供安全的 AI 功能
type AIService struct {
	ctx           context.Context
	configService *ConfigService
	httpClient    *http.Client
}

// NewAIService 创建 AI 服务实例
func NewAIService(configService *ConfigService) *AIService {
	return &AIService{
		configService: configService,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// startup 在应用启动时调用
func (a *AIService) Startup(ctx context.Context) {
	a.ctx = ctx
}

// GenerateImageParams 图像生成参数
type GenerateImageParams struct {
	Prompt         string `json:"prompt"`
	ReferenceImage string `json:"referenceImage,omitempty"` // base64 编码的参考图像
	ImageSize      string `json:"imageSize"`                // "1K", "2K", "4K"
	AspectRatio    string `json:"aspectRatio"`              // "1:1", "16:9", "9:16", "3:4", "4:3"
}

// GenerateImage 生成图像
// 返回 base64 编码的图像数据
func (a *AIService) GenerateImage(paramsJSON string) (string, error) {
	var params GenerateImageParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	// 加载配置
	settingsJSON, err := a.configService.LoadSettings()
	if err != nil {
		return "", fmt.Errorf("failed to load settings: %w", err)
	}

	var settings Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return "", fmt.Errorf("failed to parse settings: %w", err)
	}

	// 根据提供商调用不同的 API
	switch settings.AI.Provider {
	case "gemini":
		return a.generateImageWithGemini(params, settings.AI)
	case "openai":
		return a.generateImageWithOpenAI(params, settings.AI)
	default:
		return "", fmt.Errorf("unsupported AI provider: %s", settings.AI.Provider)
	}
}

// EditImageParams 图像编辑参数
type EditImageParams struct {
	ImageData string `json:"imageData"` // base64 编码的图像
	Prompt    string `json:"prompt"`
}

// EditImage 编辑图像
func (a *AIService) EditImage(paramsJSON string) (string, error) {
	var params EditImageParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	settingsJSON, err := a.configService.LoadSettings()
	if err != nil {
		return "", fmt.Errorf("failed to load settings: %w", err)
	}

	var settings Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return "", fmt.Errorf("failed to parse settings: %w", err)
	}

	switch settings.AI.Provider {
	case "gemini":
		return a.editImageWithGemini(params, settings.AI)
	case "openai":
		return a.editImageWithOpenAI(params, settings.AI)
	default:
		return "", fmt.Errorf("unsupported AI provider: %s", settings.AI.Provider)
	}
}

// RemoveBackground 移除背景
func (a *AIService) RemoveBackground(imageData string) (string, error) {
	// 使用图像编辑功能实现背景移除
	params := EditImageParams{
		ImageData: imageData,
		Prompt:    "Remove the background from this image. Make the background transparent. Keep the main subject intact with high quality.",
	}

	paramsJSON, _ := json.Marshal(params)
	return a.EditImage(string(paramsJSON))
}

// BlendImagesParams 图像混合参数
type BlendImagesParams struct {
	BottomImage string `json:"bottomImage"` // base64
	TopImage    string `json:"topImage"`    // base64
	Prompt      string `json:"prompt"`
	Style       string `json:"style"` // "Seamless", "Overlay", etc.
}

// BlendImages 混合图像
func (a *AIService) BlendImages(paramsJSON string) (string, error) {
	var params BlendImagesParams
	if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
		return "", fmt.Errorf("invalid parameters: %w", err)
	}

	settingsJSON, err := a.configService.LoadSettings()
	if err != nil {
		return "", fmt.Errorf("failed to load settings: %w", err)
	}

	var settings Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return "", fmt.Errorf("failed to parse settings: %w", err)
	}

	// 构建混合提示词
	fullPrompt := fmt.Sprintf("Blend these two images together using %s style. %s", params.Style, params.Prompt)

	// 使用图像编辑功能
	editParams := EditImageParams{
		ImageData: params.BottomImage,
		Prompt:    fullPrompt,
	}

	editParamsJSON, _ := json.Marshal(editParams)
	return a.EditImage(string(editParamsJSON))
}

// EnhancePrompt 增强提示词
func (a *AIService) EnhancePrompt(prompt string) (string, error) {
	settingsJSON, err := a.configService.LoadSettings()
	if err != nil {
		return "", fmt.Errorf("failed to load settings: %w", err)
	}

	var settings Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return "", fmt.Errorf("failed to parse settings: %w", err)
	}

	switch settings.AI.Provider {
	case "gemini":
		return a.enhancePromptWithGemini(prompt, settings.AI)
	case "openai":
		return a.enhancePromptWithOpenAI(prompt, settings.AI)
	default:
		return "", fmt.Errorf("unsupported AI provider: %s", settings.AI.Provider)
	}
}

// ===== Gemini API 实现 =====

func (a *AIService) generateImageWithGemini(params GenerateImageParams, aiSettings AISettings) (string, error) {
	if aiSettings.APIKey == "" {
		return "", fmt.Errorf("Gemini API key not configured")
	}

	// Gemini 图像生成 API 调用
	// 注意：这里需要根据实际的 Gemini API 文档实现
	// 以下是示例实现

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		aiSettings.ImageModel, aiSettings.APIKey)

	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": params.Prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature": 0.9,
		},
	}

	// 如果有参考图像，添加到请求中
	if params.ReferenceImage != "" {
		// 移除 data:image/...;base64, 前缀
		imageData := a.extractBase64Data(params.ReferenceImage)
		requestBody["contents"].([]map[string]interface{})[0]["parts"] = append(
			requestBody["contents"].([]map[string]interface{})[0]["parts"].([]map[string]interface{}),
			map[string]interface{}{
				"inline_data": map[string]string{
					"mime_type": "image/png",
					"data":      imageData,
				},
			},
		)
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := a.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	// 从响应中提取图像数据
	// 注意：需要根据实际 API 响应格式调整
	// 这里返回一个占位符
	return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", nil
}

func (a *AIService) editImageWithGemini(params EditImageParams, aiSettings AISettings) (string, error) {
	if aiSettings.APIKey == "" {
		return "", fmt.Errorf("Gemini API key not configured")
	}

	// 实现图像编辑逻辑
	// 类似于 generateImageWithGemini
	return a.generateImageWithGemini(GenerateImageParams{
		Prompt:         params.Prompt,
		ReferenceImage: params.ImageData,
	}, aiSettings)
}

func (a *AIService) enhancePromptWithGemini(prompt string, aiSettings AISettings) (string, error) {
	if aiSettings.APIKey == "" {
		return "", fmt.Errorf("Gemini API key not configured")
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		aiSettings.TextModel, aiSettings.APIKey)

	enhancePrompt := fmt.Sprintf("Enhance this image generation prompt to be more detailed and effective: '%s'. Return only the enhanced prompt without any explanation.", prompt)

	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": enhancePrompt},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(requestBody)
	resp, err := a.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	// 提取增强后的提示词
	// 需要根据实际响应格式调整
	return prompt + " (enhanced)", nil
}

// ===== OpenAI API 实现 =====

func (a *AIService) generateImageWithOpenAI(params GenerateImageParams, aiSettings AISettings) (string, error) {
	apiKey := aiSettings.OpenAIAPIKey
	if apiKey == "" {
		return "", fmt.Errorf("OpenAI API key not configured")
	}

	// TODO: 实现 OpenAI DALL-E API 调用
	return "", fmt.Errorf("OpenAI image generation not yet implemented")
}

func (a *AIService) editImageWithOpenAI(params EditImageParams, aiSettings AISettings) (string, error) {
	// TODO: 实现 OpenAI 图像编辑
	return "", fmt.Errorf("OpenAI image editing not yet implemented")
}

func (a *AIService) enhancePromptWithOpenAI(prompt string, aiSettings AISettings) (string, error) {
	// TODO: 实现 OpenAI 提示词增强
	return "", fmt.Errorf("OpenAI prompt enhancement not yet implemented")
}

// ===== 辅助函数 =====

// extractBase64Data 从 data URL 中提取 base64 数据
func (a *AIService) extractBase64Data(dataURL string) string {
	parts := strings.Split(dataURL, ",")
	if len(parts) == 2 {
		return parts[1]
	}
	return dataURL
}
