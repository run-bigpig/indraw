package service

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// ModelFileServer HTTP 文件服务器，用于提供模型文件
type ModelFileServer struct {
	modelsDir string
	server    *http.Server
	port      int
	baseURL   string
}

// NewModelFileServer 创建模型文件服务器实例
func NewModelFileServer(modelsDir string) *ModelFileServer {
	return &ModelFileServer{
		modelsDir: modelsDir,
		port:      0, // 将在 Start 时分配
	}
}

// Start 启动独立的 HTTP 服务器
func (s *ModelFileServer) Start() error {
	// 创建监听器，使用 0 端口让系统自动分配
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("failed to create listener: %w", err)
	}

	// 获取分配的端口
	s.port = listener.Addr().(*net.TCPAddr).Port
	s.baseURL = fmt.Sprintf("http://127.0.0.1:%d/models/", s.port)

	fmt.Printf("[ModelFileServer] 启动模型文件服务器: %s\n", s.baseURL)
	fmt.Printf("[ModelFileServer] 模型目录: %s\n", s.modelsDir)

	// 创建 HTTP 服务器
	mux := http.NewServeMux()
	mux.Handle("/models/", http.StripPrefix("/models/", http.HandlerFunc(s.handleModelRequest)))

	s.server = &http.Server{
		Handler: mux,
	}

	// 在后台启动服务器
	go func() {
		if err := s.server.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Printf("[ModelFileServer] 服务器错误: %v\n", err)
		}
	}()

	return nil
}

// Stop 停止 HTTP 服务器
func (s *ModelFileServer) Stop() {
	if s.server != nil {
		s.server.Shutdown(context.Background())
	}
}

// GetBaseURL 获取模型服务器的基础 URL
func (s *ModelFileServer) GetBaseURL() string {
	return s.baseURL
}

// GetPort 获取服务器端口
func (s *ModelFileServer) GetPort() int {
	return s.port
}

// handleModelRequest 处理模型文件请求
func (s *ModelFileServer) handleModelRequest(w http.ResponseWriter, r *http.Request) {
	// 设置 CORS 头，允许跨域访问
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")

	// 处理 OPTIONS 预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	path := r.URL.Path
	if path == "" {
		http.Error(w, "Invalid model path", http.StatusBadRequest)
		return
	}

	// 安全检查：防止路径遍历攻击
	cleanPath := filepath.Clean(path)
	if strings.Contains(cleanPath, "..") {
		http.Error(w, "Invalid path", http.StatusForbidden)
		return
	}

	// 构建完整的文件路径
	fullPath := filepath.Join(s.modelsDir, cleanPath)

	// 检查文件是否存在
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Printf("[ModelFileServer] 文件不存在: %s\n", fullPath)
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to access file", http.StatusInternalServerError)
		}
		return
	}

	// 不允许访问目录
	if info.IsDir() {
		http.Error(w, "Cannot access directory", http.StatusForbidden)
		return
	}

	// 打开文件
	file, err := os.Open(fullPath)
	if err != nil {
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// 设置 Content-Type
	ext := filepath.Ext(fullPath)
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		switch ext {
		case ".safetensors":
			contentType = "application/octet-stream"
		case ".onnx":
			contentType = "application/octet-stream"
		case ".json":
			contentType = "application/json"
		case ".bin":
			contentType = "application/octet-stream"
		default:
			contentType = "application/octet-stream"
		}
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size()))
	w.Header().Set("Cache-Control", "public, max-age=31536000")

	// 支持 HEAD 请求
	if r.Method == http.MethodHead {
		return
	}

	// 支持 Range 请求
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" {
		s.handleRangeRequest(w, r, file, info.Size(), rangeHeader)
		return
	}

	// 写入响应
	_, err = io.Copy(w, file)
	if err != nil {
		return
	}
}

// handleRangeRequest 处理 Range 请求
func (s *ModelFileServer) handleRangeRequest(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, rangeHeader string) {
	// 解析 Range 头
	// 格式: bytes=start-end
	var start, end int64
	_, err := fmt.Sscanf(rangeHeader, "bytes=%d-%d", &start, &end)
	if err != nil {
		// 尝试解析 bytes=start- 格式
		_, err = fmt.Sscanf(rangeHeader, "bytes=%d-", &start)
		if err != nil {
			http.Error(w, "Invalid range", http.StatusBadRequest)
			return
		}
		end = fileSize - 1
	}

	// 验证范围
	if start < 0 || start >= fileSize || end < start || end >= fileSize {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
		http.Error(w, "Range not satisfiable", http.StatusRequestedRangeNotSatisfiable)
		return
	}

	// 设置响应头
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", end-start+1))
	w.Header().Set("Accept-Ranges", "bytes")
	w.WriteHeader(http.StatusPartialContent)

	// 定位到起始位置
	_, err = file.Seek(start, io.SeekStart)
	if err != nil {
		return
	}

	// 复制指定范围的数据
	io.CopyN(w, file, end-start+1)
}

// GetModelsDir 获取模型存储目录
func (s *ModelFileServer) GetModelsDir() string {
	return s.modelsDir
}
