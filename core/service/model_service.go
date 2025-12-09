package service

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"indraw/core/types"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Hugging Face 镜像地址
const (
	HFBaseURL   = "https://huggingface.co"
	HFMirrorURL = "https://hf-mirror.com"
)

// ModelService 模型管理服务
// 处理模型的检测、下载、加载等操作
type ModelService struct {
	ctx           context.Context
	configService *ConfigService
	modelsDir     string // 模型存储目录
	mu            sync.RWMutex
	downloading   map[string]bool // 正在下载的模型
	downloadCfg   types.HFDownloadConfig
	httpClient    *http.Client
}

// NewModelService 创建模型服务实例
func NewModelService(configService *ConfigService) *ModelService {
	return &ModelService{
		configService: configService,
		downloading:   make(map[string]bool),
		downloadCfg: types.HFDownloadConfig{
			UseMirror:   true,  // 默认使用国内镜像
			InsecureSSL: false, // 默认不跳过 SSL 验证
		},
	}
}

// Startup 在应用启动时调用
func (m *ModelService) Startup(ctx context.Context) error {
	m.ctx = ctx

	// 获取应用数据目录
	var baseDir string
	switch goruntime.GOOS {
	case "windows":
		wail
		baseDir = os.Getenv("APPDATA")
	case "darwin":
		baseDir = filepath.Join(os.Getenv("HOME"), "Library", "Application Support")
	default:
		baseDir = filepath.Join(os.Getenv("HOME"), ".local", "share")
	}

	// 创建模型目录
	m.modelsDir = filepath.Join(baseDir, "IndrawEditor", "models")
	if err := os.MkdirAll(m.modelsDir, 0755); err != nil {
		return fmt.Errorf("failed to create models directory: %w", err)
	}

	// 初始化 HTTP 客户端
	m.initHTTPClient()

	return nil
}

// initHTTPClient 初始化 HTTP 客户端（支持代理和 SSL 配置）
func (m *ModelService) initHTTPClient() {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: m.downloadCfg.InsecureSSL,
		},
		// 优化连接设置
		MaxIdleConns:        10,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	// 配置代理
	if m.downloadCfg.ProxyURL != "" {
		proxyURL, err := url.Parse(m.downloadCfg.ProxyURL)
		if err == nil {
			transport.Proxy = http.ProxyURL(proxyURL)
			fmt.Printf("[ModelService] Using proxy: %s\n", m.downloadCfg.ProxyURL)
		}
	}

	m.httpClient = &http.Client{
		Transport: transport,
		Timeout:   0, // 大文件下载不设置全局超时
	}
}

// SetDownloadConfig 设置下载配置
func (m *ModelService) SetDownloadConfig(cfg types.HFDownloadConfig) {
	m.downloadCfg = cfg
	m.initHTTPClient() // 重新初始化客户端
}

// GetDownloadConfig 获取下载配置
func (m *ModelService) GetDownloadConfig() types.HFDownloadConfig {
	return m.downloadCfg
}

// getBaseURL 获取下载基础 URL
func (m *ModelService) getBaseURL() string {
	if m.downloadCfg.UseMirror {
		return HFMirrorURL
	}
	return HFBaseURL
}

// CheckModelExists 检查模型是否已下载到本地
// modelID 是模型的唯一标识符（目录名）
func (m *ModelService) CheckModelExists(modelID string) (bool, error) {
	modelDir := filepath.Join(m.modelsDir, modelID)

	// 检查模型目录是否存在
	if _, err := os.Stat(modelDir); os.IsNotExist(err) {
		return false, nil
	}

	// 检查关键模型文件是否存在
	// Transformers.js 需要 config.json 和模型文件（ONNX 格式）
	configFile := filepath.Join(modelDir, "config.json")
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		return false, nil
	}

	// 检查 ONNX 模型文件（优先检查量化模型）
	onnxQuantized := filepath.Join(modelDir, "onnx", "model_quantized.onnx")
	onnxFull := filepath.Join(modelDir, "onnx", "model.onnx")

	quantizedExists := false
	fullExists := false

	if _, err := os.Stat(onnxQuantized); err == nil {
		quantizedExists = true
	}
	if _, err := os.Stat(onnxFull); err == nil {
		fullExists = true
	}

	// 只要有一个 ONNX 模型存在就认为模型可用
	return quantizedExists || fullExists, nil
}

// GetModelStatus 获取模型状态信息
func (m *ModelService) GetModelStatus(modelID string) (*types.ModelStatus, error) {
	// 从配置中获取模型信息
	settingsJSON, err := m.configService.LoadSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to load settings: %w", err)
	}

	var settings types.Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return nil, fmt.Errorf("failed to parse settings: %w", err)
	}

	if settings.App.Transformers == nil {
		return nil, fmt.Errorf("transformers settings not found")
	}

	// 查找模型
	var modelInfo *types.TransformersModelInfo
	for i := range settings.App.Transformers.AvailableModels {
		if settings.App.Transformers.AvailableModels[i].ID == modelID {
			modelInfo = &settings.App.Transformers.AvailableModels[i]
			break
		}
	}

	if modelInfo == nil {
		return nil, fmt.Errorf("model not found: %s", modelID)
	}

	// 检查模型是否已下载到本地
	exists, err := m.CheckModelExists(modelID)
	if err != nil {
		return nil, fmt.Errorf("failed to check model existence: %w", err)
	}

	m.mu.RLock()
	isDownloading := m.downloading[modelID]
	m.mu.RUnlock()

	// 模型路径现在统一使用 /models/{modelID} 格式
	modelPath := fmt.Sprintf("/models/%s", modelID)

	return &types.ModelStatus{
		ModelID:       modelID,
		Exists:        exists,
		IsDownloading: isDownloading,
		Path:          modelPath,
	}, nil
}

// DownloadModel 下载模型（从 Hugging Face）
func (m *ModelService) DownloadModel(modelID string, progressCallback func(progress float64)) error {
	// 从配置中获取模型信息
	settingsJSON, err := m.configService.LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	var settings types.Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return fmt.Errorf("failed to parse settings: %w", err)
	}

	if settings.App.Transformers == nil {
		return fmt.Errorf("transformers settings not found")
	}

	// 查找模型
	var modelInfo *types.TransformersModelInfo
	for i := range settings.App.Transformers.AvailableModels {
		if settings.App.Transformers.AvailableModels[i].ID == modelID {
			modelInfo = &settings.App.Transformers.AvailableModels[i]
			break
		}
	}

	if modelInfo == nil {
		return fmt.Errorf("model not found: %s", modelID)
	}

	// 检查是否已存在
	exists, err := m.CheckModelExists(modelID)
	if err != nil {
		return fmt.Errorf("failed to check model existence: %w", err)
	}
	if exists {
		return nil // 模型已存在
	}

	// 需要 RepoID 来从 Hugging Face 下载
	if modelInfo.RepoID == "" {
		return fmt.Errorf("no Hugging Face repo ID specified for model: %s", modelID)
	}

	// 使用 DownloadModelFromHuggingFace 方法下载
	return m.DownloadModelFromHuggingFace(modelID, modelInfo.RepoID)
}

// downloadFile 下载单个文件（支持断点续传检查）
// modelID: 模型ID，用于发送进度事件
// fileName: 文件名，用于进度显示
func (m *ModelService) downloadFile(fileURL, destPath string, modelID, fileName string) error {
	// 确保 HTTP 客户端已初始化
	if m.httpClient == nil {
		m.initHTTPClient()
	}

	// 检查文件是否已存在（简单的断点续传：跳过已存在的文件）
	if info, err := os.Stat(destPath); err == nil && info.Size() > 0 {
		// 文件已存在，发送完成事件
		if m.ctx != nil {
			runtime.EventsEmit(m.ctx, "model-download-file-complete", modelID, fileName)
		}
		return nil
	}

	// 创建请求
	req, err := http.NewRequest("GET", fileURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// 设置 User-Agent（某些服务器需要）
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// 发起请求
	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to start download: %w", err)
	}
	defer resp.Body.Close()

	// 检查状态码
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %s (%d)", resp.Status, resp.StatusCode)
	}

	// 获取文件大小
	totalSize := resp.ContentLength

	// 确保目标目录存在
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 创建临时文件（下载完成后重命名，避免下载中断导致文件损坏）
	tmpPath := destPath + ".tmp"
	out, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}

	// 复制数据并报告进度
	var written int64
	buf := make([]byte, 64*1024) // 64KB buffer
	lastPercent := -1

	for {
		nr, readErr := resp.Body.Read(buf)
		if nr > 0 {
			nw, writeErr := out.Write(buf[0:nr])
			if writeErr != nil {
				out.Close()
				os.Remove(tmpPath)
				return fmt.Errorf("failed to write file: %w", writeErr)
			}
			if nw != nr {
				out.Close()
				os.Remove(tmpPath)
				return fmt.Errorf("short write")
			}
			written += int64(nw)

			// ✅ 使用事件系统发送进度更新（每 1% 发送一次，避免过于频繁）
			if m.ctx != nil && totalSize > 0 {
				percent := int(float64(written) / float64(totalSize) * 100)
				if percent != lastPercent {
					lastPercent = percent
					runtime.EventsEmit(m.ctx, "model-download-progress", modelID, fileName, percent, written, totalSize)
				}
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			out.Close()
			os.Remove(tmpPath)
			return fmt.Errorf("failed to read response: %w", readErr)
		}
	}

	out.Close()

	// 下载完成，重命名临时文件
	if err := os.Rename(tmpPath, destPath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	// ✅ 发送文件下载完成事件
	if m.ctx != nil {
		runtime.EventsEmit(m.ctx, "model-download-file-complete", modelID, fileName)
	}

	return nil
}

// GetModelConfig 获取当前模型配置（用于传递给 transformers.js）
func (m *ModelService) GetModelConfig() (*types.TransformersModelConfig, error) {
	settingsJSON, err := m.configService.LoadSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to load settings: %w", err)
	}

	var settings types.Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return nil, fmt.Errorf("failed to parse settings: %w", err)
	}

	if settings.App.Transformers == nil {
		return nil, fmt.Errorf("transformers settings not found")
	}

	// 获取当前选择的模型 ID
	currentModelID := settings.App.Transformers.CurrentModelID
	if currentModelID == "" {
		currentModelID = "rmbg-1.4" // 默认模型
	}

	// 检查模型是否已下载到本地
	exists, err := m.CheckModelExists(currentModelID)
	if err != nil {
		return nil, fmt.Errorf("failed to check model existence: %w", err)
	}

	// 返回配置 - 使用 /models/{modelID} 作为路径
	// 前端将使用这个路径从后端的模型服务器获取文件
	modelPath := fmt.Sprintf("/models/%s", currentModelID)

	return &types.TransformersModelConfig{
		ModelID:      currentModelID,
		ModelPath:    modelPath,
		UseQuantized: settings.App.Transformers.UseQuantized,
		Exists:       exists,
	}, nil
}

// ListModelFiles 列出指定模型目录下的所有文件
func (m *ModelService) ListModelFiles(modelID string) ([]types.ModelFile, error) {
	modelDir := filepath.Join(m.modelsDir, modelID)

	var files []types.ModelFile
	err := filepath.Walk(modelDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(modelDir, path)
		if err != nil {
			return err
		}

		// 转换为 URL 路径格式
		urlPath := strings.ReplaceAll(relPath, "\\", "/")

		files = append(files, types.ModelFile{
			Name: info.Name(),
			Path: urlPath,
			Size: info.Size(),
		})
		return nil
	})

	if err != nil {
		if os.IsNotExist(err) {
			return []types.ModelFile{}, nil
		}
		return nil, fmt.Errorf("failed to list model files: %w", err)
	}

	return files, nil
}

// DownloadModelFromHuggingFace 从 Hugging Face 下载模型到本地
func (m *ModelService) DownloadModelFromHuggingFace(modelID string, repoID string) error {
	// 检查是否正在下载
	m.mu.Lock()
	if m.downloading[modelID] {
		m.mu.Unlock()
		return fmt.Errorf("model is already being downloaded")
	}
	m.downloading[modelID] = true
	m.mu.Unlock()

	defer func() {
		m.mu.Lock()
		delete(m.downloading, modelID)
		m.mu.Unlock()
	}()

	// 创建模型目录
	modelDir := filepath.Join(m.modelsDir, modelID)
	if err := os.MkdirAll(modelDir, 0755); err != nil {
		return fmt.Errorf("failed to create model directory: %w", err)
	}

	// 需要下载的文件列表（Transformers.js 必需的文件）
	// 分为必需文件和可选文件
	requiredFiles := []string{
		"config.json",
	}

	optionalFiles := []string{
		"preprocessor_config.json",
		"tokenizer.json",
		"tokenizer_config.json",
	}

	// ONNX 模型文件（至少需要一个）
	onnxFiles := []string{
		"onnx/model_quantized.onnx", // 优先下载量化模型（更小）
		"onnx/model.onnx",           // 完整模型
	}

	// 获取基础 URL（支持镜像）
	baseURL := fmt.Sprintf("%s/%s/resolve/main", m.getBaseURL(), repoID)

	// ✅ 发送下载开始事件
	if m.ctx != nil {
		runtime.EventsEmit(m.ctx, "model-download-started", modelID, repoID)
	}

	// 1. 下载必需文件
	for _, file := range requiredFiles {
		fileURL := fmt.Sprintf("%s/%s", baseURL, file)
		destPath := filepath.Join(modelDir, file)

		// ✅ 发送文件开始下载事件
		if m.ctx != nil {
			runtime.EventsEmit(m.ctx, "model-download-file-started", modelID, file, "required")
		}

		if err := m.downloadFile(fileURL, destPath, modelID, file); err != nil {
			// ✅ 发送下载错误事件
			if m.ctx != nil {
				runtime.EventsEmit(m.ctx, "model-download-error", modelID, fmt.Sprintf("failed to download required file %s: %v", file, err))
			}
			return fmt.Errorf("failed to download required file %s: %w", file, err)
		}
	}

	// 2. 下载可选文件（失败不中断）
	for _, file := range optionalFiles {
		fileURL := fmt.Sprintf("%s/%s", baseURL, file)
		destPath := filepath.Join(modelDir, file)

		// ✅ 发送文件开始下载事件
		if m.ctx != nil {
			runtime.EventsEmit(m.ctx, "model-download-file-started", modelID, file, "optional")
		}

		if err := m.downloadFile(fileURL, destPath, modelID, file); err != nil {
			// 可选文件失败不中断，只发送警告事件
			if m.ctx != nil {
				runtime.EventsEmit(m.ctx, "model-download-file-skipped", modelID, file, "optional file not available")
			}
		}
	}

	// 3. 下载 ONNX 模型文件（至少需要成功下载一个）
	onnxDownloaded := false
	for _, file := range onnxFiles {
		fileURL := fmt.Sprintf("%s/%s", baseURL, file)
		destPath := filepath.Join(modelDir, file)

		// ✅ 发送文件开始下载事件
		if m.ctx != nil {
			runtime.EventsEmit(m.ctx, "model-download-file-started", modelID, file, "model")
		}

		if err := m.downloadFile(fileURL, destPath, modelID, file); err != nil {
			// ✅ 发送文件跳过事件
			if m.ctx != nil {
				runtime.EventsEmit(m.ctx, "model-download-file-skipped", modelID, file, fmt.Sprintf("model file not available: %v", err))
			}
			continue
		}
		onnxDownloaded = true
		break // 成功下载一个 ONNX 文件即可
	}

	if !onnxDownloaded {
		// ✅ 发送下载错误事件
		if m.ctx != nil {
			runtime.EventsEmit(m.ctx, "model-download-error", modelID, fmt.Sprintf("failed to download any ONNX model file, model %s may not support ONNX format", repoID))
		}
		return fmt.Errorf("failed to download any ONNX model file, model %s may not support ONNX format", repoID)
	}

	// ✅ 发送下载完成事件
	if m.ctx != nil {
		runtime.EventsEmit(m.ctx, "model-download-completed", modelID)
	}

	return nil
}

// createProgressLogger 已移除，现在使用事件系统发送进度

// DownloadModelWithConfig 使用自定义配置下载模型
func (m *ModelService) DownloadModelWithConfig(modelID string, repoID string, cfg types.HFDownloadConfig) error {
	// 临时使用指定配置
	oldCfg := m.downloadCfg
	m.SetDownloadConfig(cfg)
	defer m.SetDownloadConfig(oldCfg)

	return m.DownloadModelFromHuggingFace(modelID, repoID)
}

// GetAvailableModels 获取所有可用模型及其状态
func (m *ModelService) GetAvailableModels() ([]types.ModelInfo, error) {
	settingsJSON, err := m.configService.LoadSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to load settings: %w", err)
	}

	var settings types.Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return nil, fmt.Errorf("failed to parse settings: %w", err)
	}

	if settings.App.Transformers == nil {
		return nil, fmt.Errorf("transformers settings not found")
	}

	var models []types.ModelInfo
	for _, model := range settings.App.Transformers.AvailableModels {
		// 检查模型是否已下载
		exists, _ := m.CheckModelExists(model.ID)

		m.mu.RLock()
		isDownloading := m.downloading[model.ID]
		m.mu.RUnlock()

		models = append(models, types.ModelInfo{
			ID:            model.ID,
			Name:          model.Name,
			Description:   model.Description,
			RepoID:        model.RepoID,
			Size:          model.Size,
			Downloaded:    exists,
			IsDownloading: isDownloading,
		})
	}

	return models, nil
}
