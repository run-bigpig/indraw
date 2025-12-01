package provider

import (
	"context"
	"encoding/base64"
	"fmt"
	"indraw/core/types"
	"strings"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/credentials"
	"google.golang.org/genai"
)

// ==================== Gemini 能力声明 ====================

// geminiCapabilities Gemini 提供商的功能支持矩阵
var geminiCapabilities = ProviderCapabilities{
	GenerateImage:    true,
	EditImage:        true,
	EnhancePrompt:    true,
	BlendImages:      true,
	RemoveBackground: true,
	ReferenceImage:   true,
}

// ==================== GeminiProvider 实现 ====================

// GeminiProvider Gemini AI 提供商
// 支持 Gemini API 和 Vertex AI 双后端
type GeminiProvider struct {
	ctx      context.Context
	client   *genai.Client
	settings types.AISettings
}

// NewGeminiProvider 创建 Gemini 提供商实例
// 支持两种后端模式：
//   - Gemini API：使用 API Key 认证
//   - Vertex AI：使用 GCP 服务账号认证
func NewGeminiProvider(ctx context.Context, settings types.AISettings) (*GeminiProvider, error) {
	client, err := createGeminiClient(ctx, settings)
	if err != nil {
		return nil, err
	}

	return &GeminiProvider{
		ctx:      ctx,
		client:   client,
		settings: settings,
	}, nil
}

// createGeminiClient 创建 Gemini 客户端（内部函数）
func createGeminiClient(ctx context.Context, settings types.AISettings) (*genai.Client, error) {
	var client *genai.Client
	var err error
	fmt.Printf("Creating Gemini client (UseVertexAI: %s)\n", settings.TextModel)

	if settings.UseVertexAI {
		// Vertex AI 模式
		if settings.VertexProject == "" || settings.VertexLocation == "" {
			return nil, fmt.Errorf("Vertex AI requires project and location")
		}

		// 解析 GCP 凭证
		var cre *auth.Credentials
		var credErr error
		if settings.VertexCredentials != "" {
			cre, credErr = credentials.DetectDefault(&credentials.DetectOptions{
				Scopes:          []string{"https://www.googleapis.com/auth/cloud-platform"},
				CredentialsJSON: []byte(settings.VertexCredentials),
			})
			if credErr != nil {
				return nil, fmt.Errorf("failed to parse Vertex AI credentials: %w", credErr)
			}
		} else {
			// 使用默认凭证（从环境变量或元数据服务器）
			cre, credErr = credentials.DetectDefault(&credentials.DetectOptions{
				Scopes: []string{"https://www.googleapis.com/auth/cloud-platform"},
			})
			if credErr != nil {
				return nil, fmt.Errorf("failed to detect default credentials: %w", credErr)
			}
		}

		// 创建 Vertex AI 客户端
		client, err = genai.NewClient(ctx, &genai.ClientConfig{
			Project:     settings.VertexProject,
			Location:    settings.VertexLocation,
			Backend:     genai.BackendVertexAI,
			Credentials: cre,
		})
	} else {
		// Gemini API 模式
		if settings.APIKey == "" {
			return nil, fmt.Errorf("Gemini API key not configured")
		}

		client, err = genai.NewClient(ctx, &genai.ClientConfig{
			APIKey:  settings.APIKey,
			Backend: genai.BackendGeminiAPI,
		})
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create Gemini client: %w", err)
	}

	return client, nil
}

// Name 返回提供商名称
func (p *GeminiProvider) Name() string {
	return "gemini"
}

// GetCapabilities 返回提供商支持的功能
func (p *GeminiProvider) GetCapabilities() ProviderCapabilities {
	return geminiCapabilities
}

// Close 清理资源
func (p *GeminiProvider) Close() error {
	// genai.Client 没有显式的 Close 方法
	p.client = nil
	return nil
}

// GenerateImage 生成图像
func (p *GeminiProvider) GenerateImage(ctx context.Context, params types.GenerateImageParams) (string, error) {
	// 构建内容部分
	parts := []*genai.Part{{Text: params.Prompt}}

	// 如果有参考图像，添加到请求中
	if params.ReferenceImage != "" {
		imageData := extractBase64Data(params.ReferenceImage)
		decodedData, err := base64.StdEncoding.DecodeString(imageData)
		if err != nil {
			return "", fmt.Errorf("failed to decode reference image: %w", err)
		}

		parts = append(parts, &genai.Part{
			InlineData: &genai.Blob{
				MIMEType: "image/png",
				Data:     decodedData,
			},
		})
	}

	content := &genai.Content{
		Parts: parts,
		Role:  genai.RoleUser,
	}

	// 设置生成参数
	temperature := float32(0.9)
	topP := float32(0.95)

	// 调用 Gemini API
	response, err := p.client.Models.GenerateContent(ctx, p.settings.ImageModel,
		[]*genai.Content{content},
		&genai.GenerateContentConfig{
			Temperature:        &temperature,
			TopP:               &topP,
			MaxOutputTokens:    32768,
			ResponseModalities: []string{"text", "image"},
			ImageConfig: &genai.ImageConfig{
				ImageSize:   params.ImageSize,
				AspectRatio: params.AspectRatio,
			},
		})

	if err != nil {
		return "", fmt.Errorf("gemini API error: %w", err)
	}

	return extractImageFromGeminiResponse(response)
}

// EditImage 编辑图像
func (p *GeminiProvider) EditImage(ctx context.Context, params types.EditImageParams) (string, error) {
	// 解码图像数据
	imageData := extractBase64Data(params.ImageData)
	decodedData, err := base64.StdEncoding.DecodeString(imageData)
	if err != nil {
		return "", fmt.Errorf("failed to decode image: %w", err)
	}

	// 构建编辑请求
	parts := []*genai.Part{
		{Text: params.Prompt},
		{InlineData: &genai.Blob{
			MIMEType: "image/png",
			Data:     decodedData,
		}},
	}

	content := &genai.Content{
		Parts: parts,
		Role:  genai.RoleUser,
	}

	// 设置生成参数
	temperature := float32(0.95)
	topP := float32(0.95)

	// 调用 API
	response, err := p.client.Models.GenerateContent(ctx, p.settings.ImageModel,
		[]*genai.Content{content},
		&genai.GenerateContentConfig{
			Temperature:        &temperature,
			TopP:               &topP,
			MaxOutputTokens:    32768,
			ResponseModalities: []string{"text", "image"},
		})

	if err != nil {
		return "", fmt.Errorf("Gemini edit API error: %w", err)
	}

	return extractImageFromGeminiResponse(response)
}

// EditMultiImages 多图编辑/融合
func (p *GeminiProvider) EditMultiImages(ctx context.Context, params types.MultiImageEditParams) (string, error) {
	if len(params.Images) < 2 {
		return "", fmt.Errorf("at least 2 images are required")
	}

	// 构建请求部分：先添加提示词
	parts := []*genai.Part{
		{Text: params.Prompt},
	}

	// 添加所有图片
	for i, img := range params.Images {
		imageData := extractBase64Data(img)
		decodedData, err := base64.StdEncoding.DecodeString(imageData)
		if err != nil {
			return "", fmt.Errorf("failed to decode image %d: %w", i, err)
		}

		parts = append(parts, &genai.Part{
			InlineData: &genai.Blob{
				MIMEType: "image/png",
				Data:     decodedData,
			},
		})
	}

	content := &genai.Content{
		Parts: parts,
		Role:  genai.RoleUser,
	}

	// 设置生成参数
	temperature := float32(0.95)
	topP := float32(0.95)

	// 调用 API
	response, err := p.client.Models.GenerateContent(ctx, p.settings.ImageModel,
		[]*genai.Content{content},
		&genai.GenerateContentConfig{
			Temperature:        &temperature,
			TopP:               &topP,
			MaxOutputTokens:    32768,
			ResponseModalities: []string{"text", "image"},
		})

	if err != nil {
		return "", fmt.Errorf("Gemini multi-image edit API error: %w", err)
	}

	return extractImageFromGeminiResponse(response)
}

// EnhancePrompt 增强提示词
func (p *GeminiProvider) EnhancePrompt(ctx context.Context, prompt string) (string, error) {
	// 构建增强提示词的系统提示
	systemPrompt := fmt.Sprintf(
		"You are an expert AI art prompt engineer. Enhance the following prompt to be more detailed and effective for image generation. "+
			"Add details about lighting, style, composition, and mood. Return ONLY the enhanced prompt without any explanation.\n\n"+
			"Original Prompt: %s", prompt)

	content := &genai.Content{
		Parts: []*genai.Part{{Text: systemPrompt}},
		Role:  genai.RoleUser,
	}

	// 设置生成参数
	temperature := float32(0.75)
	topP := float32(0.95)

	// 调用 API
	response, err := p.client.Models.GenerateContent(ctx, p.settings.TextModel,
		[]*genai.Content{content},
		&genai.GenerateContentConfig{
			Temperature:     &temperature,
			TopP:            &topP,
			MaxOutputTokens: 32768,
		})

	if err != nil {
		return "", fmt.Errorf("gemini prompt enhancement error: %w", err)
	}

	// 提取增强后的文本
	if len(response.Candidates) > 0 && response.Candidates[0].Content != nil && len(response.Candidates[0].Content.Parts) > 0 {
		enhancedText := response.Candidates[0].Content.Parts[0].Text
		if enhancedText != "" {
			return enhancedText, nil
		}
	}

	// 如果没有返回内容，返回原始提示词
	return prompt, nil
}

// ==================== 辅助函数 ====================

// extractBase64Data 从 data URL 中提取 base64 数据
func extractBase64Data(dataURL string) string {
	parts := strings.Split(dataURL, ",")
	if len(parts) == 2 {
		return parts[1]
	}
	return dataURL
}

// extractImageFromGeminiResponse 从 Gemini 响应中提取图像数据
func extractImageFromGeminiResponse(response *genai.GenerateContentResponse) (string, error) {
	if response == nil || len(response.Candidates) == 0 {
		return "", fmt.Errorf("no content generated")
	}

	for _, candidate := range response.Candidates {
		if candidate.Content == nil {
			continue
		}

		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && strings.HasPrefix(part.InlineData.MIMEType, "image/") {
				encoded := base64.StdEncoding.EncodeToString(part.InlineData.Data)
				return fmt.Sprintf("data:%s;base64,%s", part.InlineData.MIMEType, encoded), nil
			}
		}
	}

	return "", fmt.Errorf("no image data found in response")
}
