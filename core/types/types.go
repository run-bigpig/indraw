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

	// OpenAI 图像模式配置
	// "image_api" - 使用专用的 Image API（/v1/images/*），适用于 DALL-E 和 GPT Image 1
	// "chat"      - 使用 Chat Completion API，适用于第三方多模态 API（类似 Gemini）
	// "auto"      - 根据模型名称自动判断（默认）
	OpenAIImageMode string `json:"openaiImageMode"`

	// OpenAI 流式模式配置
	// 某些第三方 OpenAI 中继服务仅提供流式接口
	OpenAITextStream  bool `json:"openaiTextStream"`  // 文本/聊天模型是否使用流式请求（默认 false）
	OpenAIImageStream bool `json:"openaiImageStream"` // 图像模型是否使用流式请求（默认 false）

	// Cloud 云服务配置
	CloudEndpointURL string `json:"cloudEndpointUrl"` // 云服务端点 URL（无需 API Key）
}

// OpenAI 图像模式常量
const (
	OpenAIImageModeAuto     = "auto"      // 自动判断（默认）
	OpenAIImageModeImageAPI = "image_api" // 使用专用 Image API
	OpenAIImageModeChat     = "chat"      // 使用 Chat Completion API
)

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
	FontFamily  string `json:"fontFamily"`
}

// TransformersModelInfo 模型信息（配置文件中的模型定义）
type TransformersModelInfo struct {
	ID          string `json:"id"`          // 模型唯一标识（目录名）
	Name        string `json:"name"`        // 模型显示名称
	RepoID      string `json:"repoId"`      // Hugging Face 仓库 ID（用于下载）
	Description string `json:"description"` // 模型描述
	Size        int64  `json:"size"`        // 模型大小（字节），-1 表示未知
}

// ModelInfo 模型信息（带运行时状态，用于前端显示）
type ModelInfo struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	RepoID        string `json:"repoId"`
	Size          int64  `json:"size"`
	Downloaded    bool   `json:"downloaded"`    // 模型是否已下载
	IsDownloading bool   `json:"isDownloading"` // 是否正在下载
}

// ModelFile 模型文件信息
type ModelFile struct {
	Name string `json:"name"` // 文件名
	Path string `json:"path"` // 相对路径
	Size int64  `json:"size"` // 文件大小
}

// TransformersModelSettings Transformers 模型配置
type TransformersModelSettings struct {
	CurrentModelID  string                  `json:"currentModelId"`  // 当前使用的模型ID
	UseQuantized    bool                    `json:"useQuantized"`    // 是否使用量化模型
	AvailableModels []TransformersModelInfo `json:"availableModels"` // 可用的模型列表
}

// ModelStatus 模型状态
type ModelStatus struct {
	ModelID       string `json:"modelId"`
	Exists        bool   `json:"exists"`        // 模型是否已下载到本地
	IsDownloading bool   `json:"isDownloading"` // 是否正在下载
	Path          string `json:"path"`          // 模型文件服务路径（如 /models/rmbg-1.4）
}

// TransformersModelConfig 传递给 transformers.js 的模型配置
type TransformersModelConfig struct {
	ModelID      string `json:"modelId"`      // 模型 ID
	ModelPath    string `json:"modelPath"`    // 模型文件服务路径（如 /models/rmbg-1.4）
	UseQuantized bool   `json:"useQuantized"` // 是否使用量化模型
	Exists       bool   `json:"exists"`       // 模型是否已下载
}

// HFDownloadConfig Hugging Face 下载配置
type HFDownloadConfig struct {
	UseMirror   bool   `json:"useMirror"`   // 是否使用国内镜像 (hf-mirror.com)
	ProxyURL    string `json:"proxyUrl"`    // 代理地址（可选，如 "http://127.0.0.1:7890"）
	InsecureSSL bool   `json:"insecureSsl"` // 是否跳过 SSL 验证（解决某些网络环境的 SSL 问题）
}

// DownloadProgress 下载进度信息
type DownloadProgress struct {
	ModelID     string  `json:"modelId"`
	FileName    string  `json:"fileName"`
	TotalFiles  int     `json:"totalFiles"`
	CurrentFile int     `json:"currentFile"`
	FileSize    int64   `json:"fileSize"`
	Downloaded  int64   `json:"downloaded"`
	Progress    float64 `json:"progress"` // 0-1
	Status      string  `json:"status"`   // "downloading", "completed", "failed", "skipped"
}

// AppSettings 应用设置
// 注意：language 由前端 i18n 库管理，存储在 localStorage
type AppSettings struct {
	Transformers *TransformersModelSettings `json:"transformers,omitempty"` // Transformers 模型配置
}

// ==================== AI 服务参数结构体 ====================

// GenerateImageParams 图像生成参数
type GenerateImageParams struct {
	Prompt         string `json:"prompt"`
	ReferenceImage string `json:"referenceImage,omitempty"` // base64 编码的参考图像
	SketchImage    string `json:"sketchImage,omitempty"`    // base64 编码的草图图像
	ImageSize      string `json:"imageSize"`                // "1K", "2K", "4K"
	AspectRatio    string `json:"aspectRatio"`              // "1:1", "16:9", "9:16", "3:4", "4:3"
}

// EditImageParams 图像编辑参数
type EditImageParams struct {
	ImageData string `json:"imageData"` // base64 编码的图像
	Prompt    string `json:"prompt"`
}

// MultiImageEditParams 多图编辑参数
type MultiImageEditParams struct {
	Images []string `json:"images"` // base64 编码的图像数组
	Prompt string   `json:"prompt"`
}

// BlendImagesParams 多图融合参数
// Images 数组按图层顺序排列（索引小的在下层，索引大的在上层）
type BlendImagesParams struct {
	Images []string `json:"images"` // base64 数组，按图层顺序（下层到上层）
	Prompt string   `json:"prompt"` // 用户提示词（可选）
	Style  string   `json:"style"`  // 融合风格: "Seamless", "Double Exposure", "Splash Effect", "Glitch/Cyberpunk", "Surreal"
}
