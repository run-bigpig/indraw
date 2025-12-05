package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"indraw/core/types"
	"io"
	"net/http"
	"strings"
	"time"
)

// ==================== Cloud 能力声明 ====================

// cloudCapabilities Cloud 提供商的功能支持矩阵
var cloudCapabilities = ProviderCapabilities{
	GenerateImage:    true,
	EditImage:        true,
	EnhancePrompt:    true,
	BlendImages:      true,
	RemoveBackground: true,
	ReferenceImage:   true,
}

// ==================== CloudProvider 实现 ====================

// CloudProvider 云 AI 提供商
// 通过 HTTP 调用配置的云服务端点，直接转发参数
type CloudProvider struct {
	ctx         context.Context
	endpointURL string
	httpClient  *http.Client
	settings    types.AISettings
}

// NewCloudProvider 创建云提供商实例
func NewCloudProvider(ctx context.Context, settings types.AISettings) (*CloudProvider, error) {
	if settings.CloudEndpointURL == "" {
		return nil, fmt.Errorf("cloud endpoint URL not configured")
	}

	// 创建 HTTP 客户端，设置合理的超时时间
	httpClient := &http.Client{
		Timeout: 5 * time.Minute, // 图像生成可能需要较长时间
	}

	return &CloudProvider{
		ctx:         ctx,
		endpointURL: settings.CloudEndpointURL,
		httpClient:  httpClient,
		settings:    settings,
	}, nil
}

// Name 返回提供商名称
func (p *CloudProvider) Name() string {
	return "cloud"
}

// GetCapabilities 返回提供商支持的功能
func (p *CloudProvider) GetCapabilities() ProviderCapabilities {
	return cloudCapabilities
}

// Close 清理资源
func (p *CloudProvider) Close() error {
	if p.httpClient != nil {
		p.httpClient.CloseIdleConnections()
	}
	return nil
}

// ==================== API 方法实现 ====================

// GenerateImage 生成图像
func (p *CloudProvider) GenerateImage(ctx context.Context, params types.GenerateImageParams) (string, error) {
	return p.callCloudAPI(ctx, "generateImage", params)
}

// EditImage 编辑图像
func (p *CloudProvider) EditImage(ctx context.Context, params types.EditImageParams) (string, error) {
	return p.callCloudAPI(ctx, "editImage", params)
}

// EditMultiImages 多图编辑/融合
func (p *CloudProvider) EditMultiImages(ctx context.Context, params types.MultiImageEditParams) (string, error) {
	if len(params.Images) < 2 {
		return "", fmt.Errorf("at least 2 images are required")
	}
	return p.callCloudAPI(ctx, "editMultiImages", params)
}

// EnhancePrompt 增强提示词
func (p *CloudProvider) EnhancePrompt(ctx context.Context, prompt string) (string, error) {
	// 将 prompt 包装成简单的 JSON 结构
	request := map[string]string{
		"prompt": prompt,
	}
	return p.callCloudAPI(ctx, "enhancePrompt", request)
}

// ==================== 辅助函数 ====================

// callCloudAPI 调用云服务 API，直接转发参数
func (p *CloudProvider) callCloudAPI(ctx context.Context, endpoint string, requestData interface{}) (string, error) {
	// 构建完整的 URL
	baseURL := strings.TrimSuffix(p.endpointURL, "/")
	var url string
	if strings.Contains(baseURL, "/generateImage") || strings.Contains(baseURL, "/editImage") ||
		strings.Contains(baseURL, "/enhancePrompt") || strings.Contains(baseURL, "/editMultiImages") {
		// 端点URL已经包含操作路径，直接使用
		url = baseURL
	} else {
		// 附加操作路径
		url = fmt.Sprintf("%s/%s", baseURL, endpoint)
	}

	// 序列化请求数据
	requestBody, err := json.Marshal(requestData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建 HTTP 请求
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// 检查 HTTP 状态码
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("cloud API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// 读取响应
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// 解析响应
	var response map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &response); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	// 根据端点类型提取结果
	switch endpoint {
	case "enhancePrompt":
		// 增强提示词返回文本
		if text, ok := response["text"].(string); ok {
			return text, nil
		}
		if prompt, ok := response["prompt"].(string); ok {
			return prompt, nil
		}
		return "", fmt.Errorf("invalid response format: expected 'text' or 'prompt' field")
	default:
		// 图像操作返回图像数据（data URI 格式）
		if imageData, ok := response["image"].(string); ok {
			return imageData, nil
		}
		if imageData, ok := response["imageData"].(string); ok {
			return imageData, nil
		}
		return "", fmt.Errorf("invalid response format: expected 'image' or 'imageData' field")
	}
}
