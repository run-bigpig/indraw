package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// PromptItem 提示词项
type PromptItem struct {
	Title       string `json:"title"`
	Preview     string `json:"preview,omitempty"`
	Prompt      string `json:"prompt"`
	Author      string `json:"author,omitempty"`
	Link        string `json:"link,omitempty"`
	Mode        string `json:"mode,omitempty"`
	Category    string `json:"category,omitempty"`
	SubCategory string `json:"sub_category,omitempty"`
}

// PromptService 提示词服务
type PromptService struct {
	configService *ConfigService
	cache         []PromptItem
	cacheTime     time.Time
	cacheMutex    sync.RWMutex
	cacheTTL      time.Duration // 缓存有效期，默认 5 分钟
}

// NewPromptService 创建提示词服务实例
func NewPromptService(configService *ConfigService) *PromptService {
	return &PromptService{
		configService: configService,
		cacheTTL:      5 * time.Minute,
	}
}

// getLocalPromptsPath 获取本地 prompts.json 文件路径
func (p *PromptService) getLocalPromptsPath() (string, error) {
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user config dir: %w", err)
	}

	appDataDir := filepath.Join(userConfigDir, "IndrawEditor")
	if err := os.MkdirAll(appDataDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create app data dir: %w", err)
	}

	return filepath.Join(appDataDir, "prompts.json"), nil
}

// loadPromptsFromLocal 从本地文件加载提示词
func (p *PromptService) loadPromptsFromLocal(filePath string) ([]PromptItem, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read local prompts file: %w", err)
	}

	var prompts []PromptItem
	if err := json.Unmarshal(data, &prompts); err != nil {
		return nil, fmt.Errorf("failed to parse local prompts JSON: %w", err)
	}

	return prompts, nil
}

// downloadPromptsFromRemote 从远程 URL 下载提示词并保存到本地
func (p *PromptService) downloadPromptsFromRemote(url string, localPath string) ([]PromptItem, error) {
	// 发起 HTTP 请求
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch prompts from remote: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch prompts from remote: HTTP %d", resp.StatusCode)
	}

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// 解析 JSON
	var prompts []PromptItem
	if err := json.Unmarshal(body, &prompts); err != nil {
		return nil, fmt.Errorf("failed to parse prompts JSON: %w", err)
	}

	// 保存到本地文件
	if err := os.WriteFile(localPath, body, 0644); err != nil {
		// 保存失败不影响返回结果，只记录警告
		fmt.Printf("[PromptService] Warning: failed to save prompts to local file: %v\n", err)
	} else {
		fmt.Printf("[PromptService] Successfully saved prompts to local file: %s\n", localPath)
	}

	return prompts, nil
}

// FetchPrompts 获取提示词列表
// forceRefresh 是否强制刷新缓存
func (p *PromptService) FetchPrompts(forceRefresh bool) ([]PromptItem, error) {
	// 检查缓存
	if !forceRefresh {
		p.cacheMutex.RLock()
		if p.cache != nil && time.Since(p.cacheTime) < p.cacheTTL {
			cached := make([]PromptItem, len(p.cache))
			copy(cached, p.cache)
			p.cacheMutex.RUnlock()
			return cached, nil
		}
		p.cacheMutex.RUnlock()
	}

	// 获取本地文件路径
	localPath, err := p.getLocalPromptsPath()
	if err != nil {
		return nil, fmt.Errorf("failed to get local prompts path: %w", err)
	}

	var prompts []PromptItem

	// 优先读取本地文件
	if _, err := os.Stat(localPath); err == nil {
		// 本地文件存在，读取本地文件
		prompts, err = p.loadPromptsFromLocal(localPath)
		if err != nil {
			// 本地文件读取失败，尝试从线上下载
			fmt.Printf("[PromptService] Failed to load local prompts file: %v, trying to download from remote\n", err)
		} else {
			// 成功读取本地文件
			p.cacheMutex.Lock()
			p.cache = prompts
			p.cacheTime = time.Now()
			p.cacheMutex.Unlock()
			return prompts, nil
		}
	}

	// 本地文件不存在或读取失败，从线上下载
	// 使用固定的 URL
	url := "https://raw.githubusercontent.com/run-bigpig/indraw/refs/heads/main/prompts.json"

	// 从线上下载并保存到本地
	prompts, err = p.downloadPromptsFromRemote(url, localPath)
	if err != nil {
		return nil, fmt.Errorf("failed to download prompts from remote: %w", err)
	}

	// 更新缓存
	p.cacheMutex.Lock()
	p.cache = prompts
	p.cacheTime = time.Now()
	p.cacheMutex.Unlock()

	return prompts, nil
}
