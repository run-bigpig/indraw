package types

// ==================== 应用设置结构 ====================

// Settings 应用设置结构
type Settings struct {
	Version string         `json:"version"`
	AI      AISettings     `json:"ai"`
	Canvas  CanvasSettings `json:"canvas"`
	Tools   ToolsSettings  `json:"tools"`
	App     AppSettings    `json:"app"`
}

// AISettings AI 服务设置
type AISettings struct {
	Provider   string `json:"provider"`
	APIKey     string `json:"apiKey"` // 加密存储
	TextModel  string `json:"textModel"`
	ImageModel string `json:"imageModel"`

	// Vertex AI 配置
	UseVertexAI       bool   `json:"useVertexAI"`       // 是否使用 Vertex AI
	VertexProject     string `json:"vertexProject"`     // GCP 项目 ID
	VertexLocation    string `json:"vertexLocation"`    // GCP 区域（如 us-central1）
	VertexCredentials string `json:"vertexCredentials"` // GCP 服务账号 JSON（加密存储）

	// OpenAI 配置
	OpenAIAPIKey       string `json:"openaiApiKey"`      // 加密存储
	OpenAIImageAPIKey  string `json:"openaiImageApiKey"` // 加密存储
	OpenAIBaseURL      string `json:"openaiBaseUrl"`
	OpenAIImageBaseURL string `json:"openaiImageBaseUrl"`
	OpenAITextModel    string `json:"openaiTextModel"`
	OpenAIImageModel   string `json:"openaiImageModel"`
}

// CanvasSettings 画布默认设置
type CanvasSettings struct {
	Width           int    `json:"width"`
	Height          int    `json:"height"`
	Background      string `json:"background"`
	BackgroundColor string `json:"backgroundColor"`
}

// ToolsSettings 工具设置
type ToolsSettings struct {
	Brush  BrushSettings  `json:"brush"`
	Eraser EraserSettings `json:"eraser"`
	Text   TextSettings   `json:"text"`
}

// BrushSettings 画笔设置
type BrushSettings struct {
	Size    int     `json:"size"`
	Color   string  `json:"color"`
	Opacity float64 `json:"opacity"`
}

// EraserSettings 橡皮擦设置
type EraserSettings struct {
	Size int `json:"size"`
}

// TextSettings 文本设置
type TextSettings struct {
	FontSize    int    `json:"fontSize"`
	Color       string `json:"color"`
	DefaultText string `json:"defaultText"`
}

// AppSettings 应用设置
type AppSettings struct {
	Language         string `json:"language"`
	AutoSave         bool   `json:"autoSave"`
	AutoSaveInterval int    `json:"autoSaveInterval"` // 秒
}

// ==================== AI 服务参数结构体 ====================

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
