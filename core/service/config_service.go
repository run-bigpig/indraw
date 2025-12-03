package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"indraw/core/types"
	"io"
	"os"
	"path/filepath"

	"golang.org/x/crypto/pbkdf2"
)

// ConfigService 配置管理服务
// 提供安全的配置存储和 API Key 加密功能
type ConfigService struct {
	ctx        context.Context
	configDir  string
	configFile string
	// 使用设备唯一标识作为加密密钥的一部分
	encryptionKey []byte
}

// NewConfigService 创建配置服务实例
func NewConfigService() *ConfigService {
	return &ConfigService{}
}

// startup 在应用启动时调用
func (c *ConfigService) Startup(ctx context.Context) error {
	c.ctx = ctx

	// 获取用户配置目录
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("failed to get user config dir: %w", err)
	}

	// 创建应用配置目录
	c.configDir = filepath.Join(userConfigDir, "IndrawEditor")

	if err := os.MkdirAll(c.configDir, 0700); err != nil {
		return fmt.Errorf("failed to create config dir: %w", err)
	}

	c.configFile = filepath.Join(c.configDir, "config.json")

	// 生成加密密钥
	// 使用机器标识 + 固定盐值生成密钥
	machineID := c.getMachineID()
	c.encryptionKey = pbkdf2.Key([]byte(machineID), []byte("indraw-ai-editor-salt"), 10000, 32, sha256.New)

	return nil
}

// getMachineID 获取机器唯一标识
func (c *ConfigService) getMachineID() string {
	// 尝试获取机器 ID
	// Windows: 可以使用 COMPUTERNAME 环境变量
	// macOS/Linux: 可以使用 /etc/machine-id

	// 简化实现：使用用户名 + 主机名
	hostname, _ := os.Hostname()
	username := os.Getenv("USERNAME")
	if username == "" {
		username = os.Getenv("USER")
	}

	return fmt.Sprintf("%s-%s", username, hostname)
}

// encrypt 加密字符串
func (c *ConfigService) encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(c.encryptionKey)
	if err != nil {
		return "", err
	}

	// 创建 GCM 模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 生成随机 nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// 加密
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

	// Base64 编码
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decrypt 解密字符串
func (c *ConfigService) decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	// Base64 解码
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(c.encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// SaveSettings 保存设置
func (c *ConfigService) SaveSettings(settingsJSON string) error {
	var settings types.Settings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return fmt.Errorf("invalid settings format: %w", err)
	}

	// 加密敏感信息
	if settings.AI.APIKey != "" {
		encrypted, err := c.encrypt(settings.AI.APIKey)
		if err != nil {
			return fmt.Errorf("failed to encrypt API key: %w", err)
		}
		settings.AI.APIKey = encrypted
	}

	if settings.AI.VertexCredentials != "" {
		encrypted, err := c.encrypt(settings.AI.VertexCredentials)
		if err != nil {
			return fmt.Errorf("failed to encrypt Vertex credentials: %w", err)
		}
		settings.AI.VertexCredentials = encrypted
	}

	if settings.AI.OpenAIAPIKey != "" {
		encrypted, err := c.encrypt(settings.AI.OpenAIAPIKey)
		if err != nil {
			return fmt.Errorf("failed to encrypt OpenAI API key: %w", err)
		}
		settings.AI.OpenAIAPIKey = encrypted
	}

	if settings.AI.OpenAIImageAPIKey != "" {
		encrypted, err := c.encrypt(settings.AI.OpenAIImageAPIKey)
		if err != nil {
			return fmt.Errorf("failed to encrypt OpenAI Image API key: %w", err)
		}
		settings.AI.OpenAIImageAPIKey = encrypted
	}

	// 序列化
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize settings: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(c.configFile, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// LoadSettings 加载设置
func (c *ConfigService) LoadSettings() (string, error) {
	// 检查文件是否存在
	if _, err := os.Stat(c.configFile); os.IsNotExist(err) {
		// 首次启动：创建默认配置文件
		defaultSettings := c.getDefaultSettings()
		if saveErr := c.SaveSettings(defaultSettings); saveErr != nil {
			// 保存失败不阻塞，仍然返回默认设置
			fmt.Printf("[ConfigService] Warning: failed to create default config file: %v\n", saveErr)
		}
		return defaultSettings, nil
	}

	// 读取文件
	data, err := os.ReadFile(c.configFile)
	if err != nil {
		// 读取失败，返回默认设置
		fmt.Printf("[ConfigService] Warning: failed to read config file: %v\n", err)
		return c.getDefaultSettings(), nil
	}

	var settings types.Settings
	if err := json.Unmarshal(data, &settings); err != nil {
		// 解析失败，返回默认设置
		fmt.Printf("[ConfigService] Warning: invalid config file format: %v\n", err)
		return c.getDefaultSettings(), nil
	}

	// 解密敏感信息
	if settings.AI.APIKey != "" {
		decrypted, err := c.decrypt(settings.AI.APIKey)
		if err != nil {
			// 解密失败，可能是密钥改变了，清空该字段
			settings.AI.APIKey = ""
		} else {
			settings.AI.APIKey = decrypted
		}
	}

	if settings.AI.VertexCredentials != "" {
		decrypted, err := c.decrypt(settings.AI.VertexCredentials)
		if err != nil {
			settings.AI.VertexCredentials = ""
		} else {
			settings.AI.VertexCredentials = decrypted
		}
	}

	if settings.AI.OpenAIAPIKey != "" {
		decrypted, err := c.decrypt(settings.AI.OpenAIAPIKey)
		if err != nil {
			settings.AI.OpenAIAPIKey = ""
		} else {
			settings.AI.OpenAIAPIKey = decrypted
		}
	}

	if settings.AI.OpenAIImageAPIKey != "" {
		decrypted, err := c.decrypt(settings.AI.OpenAIImageAPIKey)
		if err != nil {
			settings.AI.OpenAIImageAPIKey = ""
		} else {
			settings.AI.OpenAIImageAPIKey = decrypted
		}
	}

	// 重新序列化（包含解密后的数据）
	result, err := json.Marshal(settings)
	if err != nil {
		return "", fmt.Errorf("failed to serialize settings: %w", err)
	}

	return string(result), nil
}

// getDefaultSettings 获取默认设置
func (c *ConfigService) getDefaultSettings() string {
	defaults := types.Settings{
		Version: "1.0.0",
		AI: types.AISettings{
			Provider:   "gemini",
			TextModel:  "gemini-2.5-flash",
			ImageModel: "gemini-2.5-flash-preview-05-20",

			// Vertex AI 默认配置
			UseVertexAI:    false,
			VertexLocation: "us-central1",

			// OpenAI 默认配置
			OpenAIBaseURL:    "https://api.openai.com/v1",
			OpenAITextModel:  "gpt-4o",
			OpenAIImageModel: "dall-e-3",
		},
		Canvas: types.CanvasSettings{
			Width:           1080,
			Height:          1080,
			Background:      "transparent",
			BackgroundColor: "#ffffff",
		},
		Tools: types.ToolsSettings{
			Brush: types.BrushSettings{
				Size:    10,
				Color:   "#ffffff",
				Opacity: 1.0,
			},
			Eraser: types.EraserSettings{
				Size: 20,
			},
			Text: types.TextSettings{
				FontSize:    32,
				Color:       "#ffffff",
				DefaultText: "Double click to edit",
				FontFamily:  "Arial",
			},
		},
		App: types.AppSettings{
			Language:         "zh-CN",
			AutoSave:         false,
			AutoSaveInterval: 60,
			PromptLibraryURL: "https://raw.githubusercontent.com/run-bigpig/indraw/refs/heads/main/prompts.json",
		},
	}

	data, _ := json.Marshal(defaults)
	return string(data)
}
