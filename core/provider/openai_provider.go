package provider

import (
	"context"
	"fmt"
	"indraw/core/types"

	openai "github.com/sashabaranov/go-openai"
)

// ==================== OpenAI 能力声明 ====================

// openaiCapabilities OpenAI 提供商的功能支持矩阵
// 注意：DALL-E 3 不支持图像编辑功能
var openaiCapabilities = ProviderCapabilities{
	GenerateImage:    true,
	EditImage:        false, // DALL-E 3 不支持图像编辑
	EnhancePrompt:    true,
	BlendImages:      false, // 需要图像编辑功能
	RemoveBackground: false, // 需要图像编辑功能
	ReferenceImage:   false, // DALL-E 3 不支持参考图像
}

// ==================== OpenAIProvider 实现 ====================

// OpenAIProvider OpenAI AI 提供商
// 使用 DALL-E 3 进行图像生成，GPT-4 进行文本处理
type OpenAIProvider struct {
	ctx      context.Context
	client   *openai.Client
	settings types.AISettings
}

// NewOpenAIProvider 创建 OpenAI 提供商实例
func NewOpenAIProvider(ctx context.Context, settings types.AISettings) (*OpenAIProvider, error) {
	apiKey := settings.OpenAIAPIKey
	if apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	// 创建 OpenAI 客户端
	config := openai.DefaultConfig(apiKey)

	// 如果配置了自定义 Base URL，则使用
	if settings.OpenAIBaseURL != "" {
		config.BaseURL = settings.OpenAIBaseURL
	}

	client := openai.NewClientWithConfig(config)

	return &OpenAIProvider{
		ctx:      ctx,
		client:   client,
		settings: settings,
	}, nil
}

// Name 返回提供商名称
func (p *OpenAIProvider) Name() string {
	return "openai"
}

// GetCapabilities 返回提供商支持的功能
func (p *OpenAIProvider) GetCapabilities() ProviderCapabilities {
	return openaiCapabilities
}

// Close 清理资源
func (p *OpenAIProvider) Close() error {
	// openai.Client 没有显式的 Close 方法
	p.client = nil
	return nil
}

// GenerateImage 生成图像
func (p *OpenAIProvider) GenerateImage(ctx context.Context, params types.GenerateImageParams) (string, error) {
	// 映射图像尺寸
	size := mapOpenAIImageSize(params.ImageSize, params.AspectRatio)

	// 确定使用的模型
	model := p.settings.OpenAIImageModel
	if model == "" {
		model = openai.CreateImageModelDallE3
	}

	// 构建请求
	req := openai.ImageRequest{
		Prompt:         params.Prompt,
		Model:          model,
		N:              1,
		Size:           size,
		ResponseFormat: openai.CreateImageResponseFormatB64JSON,
		Quality:        openai.CreateImageQualityHD,
		Style:          openai.CreateImageStyleVivid,
	}

	// 调用 API
	resp, err := p.client.CreateImage(ctx, req)
	if err != nil {
		return "", fmt.Errorf("OpenAI image generation error: %w", err)
	}

	if len(resp.Data) == 0 {
		return "", fmt.Errorf("no image data returned from OpenAI")
	}

	// 返回 base64 格式
	return "data:image/png;base64," + resp.Data[0].B64JSON, nil
}

// EditImage 编辑图像
// 注意：DALL-E 3 不支持图像编辑功能
func (p *OpenAIProvider) EditImage(ctx context.Context, params types.EditImageParams) (string, error) {
	// DALL-E 3 不支持图像编辑，返回友好的错误信息
	return "", fmt.Errorf("OpenAI DALL-E 3 does not support image editing. Please use Gemini provider for image editing features")
}

// EnhancePrompt 增强提示词
func (p *OpenAIProvider) EnhancePrompt(ctx context.Context, prompt string) (string, error) {
	// 确定使用的模型
	model := p.settings.OpenAITextModel
	if model == "" {
		model = openai.GPT4
	}

	// 构建聊天请求
	req := openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role: openai.ChatMessageRoleSystem,
				Content: "You are an expert AI art prompt engineer. Enhance prompts to be more detailed and effective for image generation. " +
					"Add details about lighting, style, composition, and mood. Return ONLY the enhanced prompt without any explanation.",
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: "Enhance this prompt: " + prompt,
			},
		},
		Temperature: 0.7,
		MaxTokens:   500,
	}

	// 调用 API
	resp, err := p.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("OpenAI chat API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return prompt, nil
	}

	enhancedPrompt := resp.Choices[0].Message.Content
	if enhancedPrompt == "" {
		return prompt, nil
	}

	return enhancedPrompt, nil
}

// ==================== 辅助函数 ====================

// mapOpenAIImageSize 映射图像尺寸到 OpenAI 格式
func mapOpenAIImageSize(sizeLevel, aspectRatio string) string {
	// DALL-E 3 支持的尺寸: 1024x1024, 1792x1024, 1024x1792
	switch aspectRatio {
	case "1:1":
		return openai.CreateImageSize1024x1024
	case "16:9", "4:3":
		return openai.CreateImageSize1792x1024
	case "9:16", "3:4":
		return openai.CreateImageSize1024x1792
	default:
		return openai.CreateImageSize1024x1024
	}
}
