package provider

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"indraw/core/types"
	"strings"

	openai "github.com/sashabaranov/go-openai"
)

// ==================== OpenAI 能力声明 ====================

// openaiImageAPICapabilities 使用专用 Image API 时的功能支持矩阵
var openaiImageAPICapabilities = ProviderCapabilities{
	GenerateImage:    true,
	EditImage:        false, // DALL-E 3 不支持，GPT Image 1 需要单独配置
	EnhancePrompt:    true,
	BlendImages:      false,
	RemoveBackground: false,
	ReferenceImage:   false,
}

// openaiChatCapabilities 使用 Chat API 时的功能支持矩阵（类似 Gemini）
var openaiChatCapabilities = ProviderCapabilities{
	GenerateImage:    true,
	EditImage:        true,
	EnhancePrompt:    true,
	BlendImages:      true,
	RemoveBackground: true,
	ReferenceImage:   true,
}

// ==================== OpenAIProvider 实现 ====================

// OpenAIProvider OpenAI AI 提供商
// 支持两种模式：
//   - Image API 模式：使用专用的 /v1/images/* 端点（DALL-E、GPT Image 1）
//   - Chat 模式：使用 /v1/chat/completions 端点（多模态模型）
type OpenAIProvider struct {
	ctx         context.Context
	chatClient  *openai.Client // 用于 Chat/文本相关的 API
	imageClient *openai.Client // 用于图像相关的 API
	settings    types.AISettings
	imageMode   string // 实际使用的图像模式
}

// NewOpenAIProvider 创建 OpenAI 提供商实例
func NewOpenAIProvider(ctx context.Context, settings types.AISettings) (*OpenAIProvider, error) {
	apiKey := settings.OpenAIAPIKey
	if apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	// 创建 Chat 客户端（用于文本/聊天相关 API）
	chatConfig := openai.DefaultConfig(apiKey)
	if settings.OpenAIBaseURL != "" {
		chatConfig.BaseURL = settings.OpenAIBaseURL
	}
	chatClient := openai.NewClientWithConfig(chatConfig)

	// 创建 Image 客户端（用于图像相关 API）
	// 如果配置了独立的图像 API Key 或 Base URL，则使用独立配置
	imageAPIKey := settings.OpenAIImageAPIKey
	if imageAPIKey == "" {
		imageAPIKey = apiKey // 未配置独立 Key 时使用通用 Key
	}

	imageConfig := openai.DefaultConfig(imageAPIKey)
	if settings.OpenAIImageBaseURL != "" {
		// 使用独立的图像 API Base URL
		imageConfig.BaseURL = settings.OpenAIImageBaseURL
	} else if settings.OpenAIBaseURL != "" {
		// 未配置独立 URL 时使用通用 Base URL
		imageConfig.BaseURL = settings.OpenAIBaseURL
	}
	imageClient := openai.NewClientWithConfig(imageConfig)

	// 确定图像模式
	imageMode := determineImageMode(settings)

	return &OpenAIProvider{
		ctx:         ctx,
		chatClient:  chatClient,
		imageClient: imageClient,
		settings:    settings,
		imageMode:   imageMode,
	}, nil
}

// determineImageMode 根据配置和模型名称确定图像模式
func determineImageMode(settings types.AISettings) string {
	mode := settings.OpenAIImageMode

	// 如果明确指定了模式，直接使用
	if mode == types.OpenAIImageModeImageAPI || mode == types.OpenAIImageModeChat {
		return mode
	}

	// 自动判断模式（默认）
	model := strings.ToLower(settings.OpenAIImageModel)

	// 如果模型名包含这些关键字，使用专用 Image API
	imageAPIModels := []string{"dall-e", "dalle", "gpt-image"}
	for _, keyword := range imageAPIModels {
		if strings.Contains(model, keyword) {
			return types.OpenAIImageModeImageAPI
		}
	}

	// 默认使用 Chat 模式（更通用，支持第三方多模态 API）
	return types.OpenAIImageModeChat
}

// Name 返回提供商名称
func (p *OpenAIProvider) Name() string {
	return "openai"
}

// GetCapabilities 返回提供商支持的功能
// 根据当前配置的模式返回不同的能力
func (p *OpenAIProvider) GetCapabilities() ProviderCapabilities {
	if p.imageMode == types.OpenAIImageModeChat {
		return openaiChatCapabilities
	}
	return openaiImageAPICapabilities
}

// Close 清理资源
func (p *OpenAIProvider) Close() error {
	p.chatClient = nil
	p.imageClient = nil
	return nil
}

// ==================== 图像生成 ====================

// GenerateImage 生成图像
func (p *OpenAIProvider) GenerateImage(ctx context.Context, params types.GenerateImageParams) (string, error) {
	if p.imageMode == types.OpenAIImageModeChat {
		return p.generateImageViaChat(ctx, params)
	}
	return p.generateImageViaImageAPI(ctx, params)
}

// generateImageViaImageAPI 通过专用 Image API 生成图像
func (p *OpenAIProvider) generateImageViaImageAPI(ctx context.Context, params types.GenerateImageParams) (string, error) {
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

	// 调用 Image API（使用 imageClient）
	resp, err := p.imageClient.CreateImage(ctx, req)
	if err != nil {
		return "", fmt.Errorf("OpenAI image generation error: %w", err)
	}

	if len(resp.Data) == 0 {
		return "", fmt.Errorf("no image data returned from OpenAI")
	}

	return "data:image/png;base64," + resp.Data[0].B64JSON, nil
}

// generateImageViaChat 通过 Chat Completion API 生成图像
func (p *OpenAIProvider) generateImageViaChat(ctx context.Context, params types.GenerateImageParams) (string, error) {
	// 构建消息内容
	var multiContent []openai.ChatMessagePart

	// 添加文本提示
	multiContent = append(multiContent, openai.ChatMessagePart{
		Type: openai.ChatMessagePartTypeText,
		Text: buildImageGenerationPrompt(params.Prompt, params.AspectRatio),
	})

	// 如果有草图图像，添加到请求中
	if params.SketchImage != "" {
		imageURL, err := buildImageURL(params.SketchImage)
		if err != nil {
			return "", fmt.Errorf("failed to process sketch image: %w", err)
		}
		multiContent = append(multiContent, openai.ChatMessagePart{
			Type: openai.ChatMessagePartTypeImageURL,
			ImageURL: &openai.ChatMessageImageURL{
				URL:    imageURL,
				Detail: openai.ImageURLDetailHigh,
			},
		})
	}

	// 如果有参考图像，添加到请求中
	if params.ReferenceImage != "" {
		imageURL, err := buildImageURL(params.ReferenceImage)
		if err != nil {
			return "", fmt.Errorf("failed to process reference image: %w", err)
		}
		multiContent = append(multiContent, openai.ChatMessagePart{
			Type: openai.ChatMessagePartTypeImageURL,
			ImageURL: &openai.ChatMessageImageURL{
				URL:    imageURL,
				Detail: openai.ImageURLDetailHigh,
			},
		})
	}

	// 确定使用的模型
	model := p.settings.OpenAIImageModel
	if model == "" {
		model = "gpt-4o" // 默认使用 GPT-4o
	}

	// 构建聊天请求
	req := openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:         openai.ChatMessageRoleUser,
				MultiContent: multiContent,
			},
		},
		MaxTokens: 4096,
	}

	// 调用图像 API（使用 imageClient，因为这是图像生成操作）
	resp, err := p.imageClient.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("OpenAI chat completion error: %w", err)
	}

	// 从响应中提取图像
	return extractImageFromChatResponse(resp)
}

// ==================== 图像编辑 ====================

// EditImage 编辑图像
func (p *OpenAIProvider) EditImage(ctx context.Context, params types.EditImageParams) (string, error) {
	if p.imageMode == types.OpenAIImageModeChat {
		return p.editImageViaChat(ctx, params)
	}
	return p.editImageViaImageAPI(ctx, params)
}

// editImageViaImageAPI 通过专用 Image Edit API 编辑图像
func (p *OpenAIProvider) editImageViaImageAPI(ctx context.Context, params types.EditImageParams) (string, error) {
	// 检查模型是否支持编辑
	model := strings.ToLower(p.settings.OpenAIImageModel)
	if strings.Contains(model, "dall-e-3") || strings.Contains(model, "dalle-3") {
		return "", fmt.Errorf("DALL-E 3 does not support image editing. Use 'chat' mode or switch to a different model")
	}

	// 解码图像数据
	imageData := extractBase64Data(params.ImageData)
	decodedData, err := base64.StdEncoding.DecodeString(imageData)
	if err != nil {
		return "", fmt.Errorf("failed to decode image: %w", err)
	}

	// 创建图像编辑请求
	req := openai.ImageEditRequest{
		Prompt:         params.Prompt,
		Image:          bytes.NewReader(decodedData),
		N:              1,
		Size:           openai.CreateImageSize1024x1024,
		ResponseFormat: openai.CreateImageResponseFormatB64JSON,
	}

	// 调用 Image API（使用 imageClient）
	resp, err := p.imageClient.CreateEditImage(ctx, req)
	if err != nil {
		return "", fmt.Errorf("OpenAI image edit error: %w", err)
	}

	if len(resp.Data) == 0 {
		return "", fmt.Errorf("no image data returned from OpenAI")
	}

	return "data:image/png;base64," + resp.Data[0].B64JSON, nil
}

// editImageViaChat 通过 Chat Completion API 编辑图像
func (p *OpenAIProvider) editImageViaChat(ctx context.Context, params types.EditImageParams) (string, error) {
	// 构建消息内容
	var multiContent []openai.ChatMessagePart

	// 添加编辑提示
	multiContent = append(multiContent, openai.ChatMessagePart{
		Type: openai.ChatMessagePartTypeText,
		Text: params.Prompt,
	})

	// 添加要编辑的图像
	imageURL, err := buildImageURL(params.ImageData)
	if err != nil {
		return "", fmt.Errorf("failed to process image: %w", err)
	}
	multiContent = append(multiContent, openai.ChatMessagePart{
		Type: openai.ChatMessagePartTypeImageURL,
		ImageURL: &openai.ChatMessageImageURL{
			URL:    imageURL,
			Detail: openai.ImageURLDetailHigh,
		},
	})

	// 确定使用的模型
	model := p.settings.OpenAIImageModel
	if model == "" {
		model = "gpt-4o"
	}

	// 构建聊天请求
	req := openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:         openai.ChatMessageRoleUser,
				MultiContent: multiContent,
			},
		},
		MaxTokens: 4096,
	}

	// 调用图像 API（使用 imageClient，因为这是图像编辑操作）
	resp, err := p.imageClient.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("OpenAI chat completion error: %w", err)
	}

	return extractImageFromChatResponse(resp)
}

// ==================== 多图编辑 ====================

// EditMultiImages 多图编辑/融合
func (p *OpenAIProvider) EditMultiImages(ctx context.Context, params types.MultiImageEditParams) (string, error) {
	if p.imageMode == types.OpenAIImageModeChat {
		return p.editMultiImagesViaChat(ctx, params)
	}
	return "", fmt.Errorf("multi-image editing is only supported in 'chat' mode. Please set openaiImageMode to 'chat'")
}

// editMultiImagesViaChat 通过 Chat Completion API 进行多图编辑
func (p *OpenAIProvider) editMultiImagesViaChat(ctx context.Context, params types.MultiImageEditParams) (string, error) {
	if len(params.Images) < 2 {
		return "", fmt.Errorf("at least 2 images are required")
	}

	// 构建消息内容
	var multiContent []openai.ChatMessagePart

	// 添加提示词
	multiContent = append(multiContent, openai.ChatMessagePart{
		Type: openai.ChatMessagePartTypeText,
		Text: params.Prompt,
	})

	// 添加所有图片
	for i, img := range params.Images {
		imageURL, err := buildImageURL(img)
		if err != nil {
			return "", fmt.Errorf("failed to process image %d: %w", i, err)
		}
		multiContent = append(multiContent, openai.ChatMessagePart{
			Type: openai.ChatMessagePartTypeImageURL,
			ImageURL: &openai.ChatMessageImageURL{
				URL:    imageURL,
				Detail: openai.ImageURLDetailHigh,
			},
		})
	}

	// 确定使用的模型
	model := p.settings.OpenAIImageModel
	if model == "" {
		model = "gpt-4o"
	}

	// 构建聊天请求
	req := openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:         openai.ChatMessageRoleUser,
				MultiContent: multiContent,
			},
		},
		MaxTokens: 4096,
	}

	// 调用图像 API（使用 imageClient，因为这是多图编辑操作）
	resp, err := p.imageClient.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("OpenAI chat completion error: %w", err)
	}

	return extractImageFromChatResponse(resp)
}

// ==================== 提示词增强 ====================

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

	// 调用 Chat API（使用 chatClient，因为这是文本处理操作）
	resp, err := p.chatClient.CreateChatCompletion(ctx, req)
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

// buildImageURL 构建图像 URL（支持 base64 和 http URL）
func buildImageURL(imageData string) (string, error) {
	// 如果已经是 data URL，直接返回
	if strings.HasPrefix(imageData, "data:") {
		return imageData, nil
	}

	// 如果是 http/https URL，直接返回
	if strings.HasPrefix(imageData, "http://") || strings.HasPrefix(imageData, "https://") {
		return imageData, nil
	}

	// 否则假设是纯 base64 数据，添加前缀
	return "data:image/png;base64," + imageData, nil
}

// buildImageGenerationPrompt 构建图像生成提示
func buildImageGenerationPrompt(prompt, aspectRatio string) string {
	// 添加比例信息到提示中
	if aspectRatio != "" && aspectRatio != "1:1" {
		return fmt.Sprintf("%s (aspect ratio: %s)", prompt, aspectRatio)
	}
	return prompt
}

// extractImageFromChatResponse 从 Chat Completion 响应中提取图像
// 注意：标准 OpenAI Chat API 不会返回图像，这个函数主要用于
// 第三方多模态 API 的兼容处理
func extractImageFromChatResponse(resp openai.ChatCompletionResponse) (string, error) {
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no response from chat completion")
	}

	content := resp.Choices[0].Message.Content

	// 尝试从响应中提取 base64 图像数据
	// 一些第三方 API 可能在内容中返回 base64 编码的图像

	// 检查是否是 base64 图像
	if strings.HasPrefix(content, "data:image/") {
		return content, nil
	}

	// 检查内容是否看起来像 base64（无前缀）
	if looksLikeBase64Image(content) {
		return "data:image/png;base64," + content, nil
	}

	// 尝试从 markdown 图片标记中提取
	if imageURL := extractImageFromMarkdown(content); imageURL != "" {
		return imageURL, nil
	}

	// 如果响应只是文本，返回错误
	return "", fmt.Errorf("chat response does not contain image data. Response: %s", truncateString(content, 200))
}

// looksLikeBase64Image 检查字符串是否看起来像 base64 编码的图像
func looksLikeBase64Image(s string) bool {
	// base64 编码的 PNG 通常以 iVBORw0KGgo 开头
	// base64 编码的 JPEG 通常以 /9j/ 开头
	s = strings.TrimSpace(s)
	return strings.HasPrefix(s, "iVBORw0KGgo") || strings.HasPrefix(s, "/9j/")
}

// extractImageFromMarkdown 从 markdown 内容中提取图片 URL
func extractImageFromMarkdown(content string) string {
	// 匹配 ![alt](url) 格式
	start := strings.Index(content, "![")
	if start == -1 {
		return ""
	}

	// 找到 ](
	bracketClose := strings.Index(content[start:], "](")
	if bracketClose == -1 {
		return ""
	}

	// 找到 URL 的结束位置
	urlStart := start + bracketClose + 2
	urlEnd := strings.Index(content[urlStart:], ")")
	if urlEnd == -1 {
		return ""
	}

	return content[urlStart : urlStart+urlEnd]
}

// truncateString 截断字符串
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
