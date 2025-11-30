# Vertex AI 配置持久化测试指南

## 🔧 关键问题修复

### 问题 1: Wails 运行时未就绪导致保存失败 ✅ 已修复

**症状**:
```
[settingsService] Wails runtime not ready, cannot save settings
[SettingsContext] Settings save returned false, may not have been saved
```

**根本原因**:
- `loadSettings` 使用 `await waitForWails()` 等待运行时就绪
- `saveSettings` 使用 `isWailsReady()` 同步检查，不等待
- 在设置变更时，Wails 运行时可能还未完全初始化

**修复方案**:
将 `saveSettings` 改为使用 `await waitForWails()`，与 `loadSettings` 保持一致。

**修复位置**: `frontend/src/services/settingsService.ts` 第 292-314 行

---

## 修复内容总结

### 后端修复 (`core/service/config_service.go`)

#### 1. SaveSettings - 添加 Vertex Credentials 加密
**位置**: 第 221-252 行

**修复前**:
```go
// 只加密了 APIKey, OpenAIAPIKey, OpenAIImageAPIKey
// 缺少 VertexCredentials 的加密
```

**修复后**:
```go
// 加密敏感信息
if settings.AI.APIKey != "" {
    encrypted, err := c.encrypt(settings.AI.APIKey)
    if err != nil {
        return fmt.Errorf("failed to encrypt API key: %w", err)
    }
    settings.AI.APIKey = encrypted
}

// ✅ 新增：加密 Vertex Credentials
if settings.AI.VertexCredentials != "" {
    encrypted, err := c.encrypt(settings.AI.VertexCredentials)
    if err != nil {
        return fmt.Errorf("failed to encrypt Vertex credentials: %w", err)
    }
    settings.AI.VertexCredentials = encrypted
}

// ... 其他 API Key 加密
```

#### 2. LoadSettings - 添加 Vertex Credentials 解密
**位置**: 第 296-332 行

**修复前**:
```go
// 只解密了 APIKey, OpenAIAPIKey, OpenAIImageAPIKey
// 缺少 VertexCredentials 的解密
```

**修复后**:
```go
// 解密敏感信息
if settings.AI.APIKey != "" {
    decrypted, err := c.decrypt(settings.AI.APIKey)
    if err != nil {
        settings.AI.APIKey = ""
    } else {
        settings.AI.APIKey = decrypted
    }
}

// ✅ 新增：解密 Vertex Credentials
if settings.AI.VertexCredentials != "" {
    decrypted, err := c.decrypt(settings.AI.VertexCredentials)
    if err != nil {
        settings.AI.VertexCredentials = ""
    } else {
        settings.AI.VertexCredentials = decrypted
    }
}

// ... 其他 API Key 解密
```

#### 3. getDefaultSettings - 添加 Vertex AI 默认值
**位置**: 第 343-391 行

**修复前**:
```go
AI: AISettings{
    Provider:         "gemini",
    TextModel:        "gemini-2.5-flash",
    ImageModel:       "gemini-2.5-flash-preview-05-20",
    OpenAIBaseURL:    "https://api.openai.com/v1",
    OpenAITextModel:  "gpt-4o",
    OpenAIImageModel: "dall-e-3",
    // ❌ 缺少 Vertex AI 字段
}
```

**修复后**:
```go
AI: AISettings{
    Provider:   "gemini",
    TextModel:  "gemini-2.5-flash",
    ImageModel: "gemini-2.5-flash-preview-05-20",

    // ✅ 新增：Vertex AI 默认配置
    UseVertexAI:    false,
    VertexLocation: "us-central1",

    // OpenAI 默认配置
    OpenAIBaseURL:    "https://api.openai.com/v1",
    OpenAITextModel:  "gpt-4o",
    OpenAIImageModel: "dall-e-3",
}
```

---

## 📊 调试日志总结

所有关键路径都已添加详细的调试日志，方便追踪问题：

### 后端日志 (`core/service/config_service.go`)

**Startup 方法**:
- `[ConfigService] Startup called`
- `[ConfigService] User config dir: <path>`
- `[ConfigService] App config dir: <path>`
- `[ConfigService] Config dir created/verified successfully`
- `[ConfigService] Config file path: <path>`
- `[ConfigService] Encryption key generated (machine ID: <id>...)`
- `[ConfigService] Startup completed successfully`

**SaveSettings 方法**:
- `[ConfigService] SaveSettings called`
- `[ConfigService] Config file path: <path>`
- `[ConfigService] Settings parsed successfully, provider: <provider>`
- `[ConfigService] Settings serialized, size: <bytes> bytes`
- `[ConfigService] Writing to file: <path>`
- `[ConfigService] Settings saved successfully!`

**LoadSettings 方法**:
- `[ConfigService] LoadSettings called`
- `[ConfigService] Config file path: <path>`
- `[ConfigService] Config file does not exist, creating default config` (首次启动)
- `[ConfigService] Default config file created successfully` (首次启动)
- `[ConfigService] Config file exists, loading...` (后续启动)
- `[ConfigService] Config file read successfully, size: <bytes> bytes`
- `[ConfigService] Settings parsed successfully, provider: <provider>`
- `[ConfigService] Settings loaded and decrypted successfully`

### 前端日志

**SettingsContext.tsx**:
- `[SettingsContext] Initializing settings...`
- `[SettingsContext] Settings loaded successfully: <settings>`
- `[SettingsContext] Skipping first save (initial load)`
- `[SettingsContext] Settings changed, saving... <settings>`
- `[SettingsContext] Settings saved successfully`

**settingsService.ts**:
- `[settingsService] loadSettings called`
- `[settingsService] Calling Wails LoadSettings...`
- `[settingsService] LoadSettings returned: <json>...`
- `[settingsService] Settings parsed successfully`
- `[settingsService] saveSettings called`
- `[settingsService] Validating settings...`
- `[settingsService] Settings JSON size: <bytes> bytes`
- `[settingsService] Calling Wails SaveSettings...`
- `[settingsService] SaveSettings completed successfully`

---

## 测试步骤

### 步骤 1: 清理旧配置（可选）
```bash
# 删除旧的配置文件（如果存在）
# Windows: %APPDATA%/indraw/config.json
# macOS: ~/Library/Application Support/indraw/config.json
# Linux: ~/.config/indraw/config.json
```

### 步骤 2: 启动应用程序
```bash
./build/indraw.exe
```

### 步骤 3: 配置 Vertex AI
1. 打开设置面板（点击设置图标）
2. 选择 "AI 服务" 标签
3. 确保服务提供商选择为 "Google Gemini"
4. 在 "后端模式" 中选择 "Vertex AI"
5. 填写以下信息：
   - **GCP 项目 ID**: `my-test-project-123`
   - **GCP 区域**: 选择 `asia-northeast1 (Tokyo, Japan)`
   - **服务账号 JSON**: 粘贴以下测试 JSON
     ```json
     {
       "type": "service_account",
       "project_id": "my-test-project-123",
       "private_key_id": "test-key-id-12345",
       "private_key": "-----BEGIN PRIVATE KEY-----\nTEST_KEY_CONTENT\n-----END PRIVATE KEY-----",
       "client_email": "test@my-test-project-123.iam.gserviceaccount.com",
       "client_id": "123456789",
       "auth_uri": "https://accounts.google.com/o/oauth2/auth",
       "token_uri": "https://oauth2.googleapis.com/token"
     }
     ```

### 步骤 4: 验证实时保存
1. 观察控制台输出（如果有）
2. 检查配置文件是否已创建/更新
   - Windows: `%APPDATA%/indraw/config.json`
   - macOS: `~/Library/Application Support/indraw/config.json`
   - Linux: `~/.config/indraw/config.json`

### 步骤 5: 关闭并重新打开应用
1. 完全关闭应用程序
2. 重新启动应用程序
3. 打开设置面板 → AI 服务标签
4. **验证点**：
   - ✅ "后端模式" 应该显示为 "Vertex AI"
   - ✅ "GCP 项目 ID" 应该显示为 `my-test-project-123`
   - ✅ "GCP 区域" 应该显示为 `asia-northeast1 (Tokyo, Japan)`
   - ✅ "服务账号 JSON" 应该显示之前输入的 JSON 内容

### 步骤 6: 检查配置文件内容
打开配置文件，验证以下内容：

**预期结构**:
```json
{
  "version": "1.0.0",
  "ai": {
    "provider": "gemini",
    "apiKey": "",
    "textModel": "gemini-2.5-flash",
    "imageModel": "gemini-2.5-flash-preview-05-20",
    "useVertexAI": true,
    "vertexProject": "my-test-project-123",
    "vertexLocation": "asia-northeast1",
    "vertexCredentials": "ENCRYPTED_BASE64_STRING_HERE",
    "openaiApiKey": "",
    "openaiImageApiKey": "",
    "openaiBaseUrl": "https://api.openai.com/v1",
    "openaiImageBaseUrl": "",
    "openaiTextModel": "gpt-4o",
    "openaiImageModel": "dall-e-3"
  },
  "canvas": { ... },
  "tools": { ... },
  "app": { ... }
}
```

**关键验证点**:
- ✅ `useVertexAI` 应该为 `true`
- ✅ `vertexProject` 应该为 `"my-test-project-123"`
- ✅ `vertexLocation` 应该为 `"asia-northeast1"`
- ✅ `vertexCredentials` 应该是一个加密的字符串（不是明文 JSON）

---

## 预期结果

### ✅ 成功标志
1. 配置文件包含所有 Vertex AI 字段
2. `vertexCredentials` 字段已加密（不是明文）
3. 重启应用后，设置界面正确显示之前的配置
4. 前端 JSON 验证器显示 "✓ 有效"（如果 JSON 格式正确）

### ❌ 失败标志
1. 配置文件缺少 Vertex AI 字段
2. `vertexCredentials` 是明文 JSON（未加密）
3. 重启应用后，设置界面显示默认值（配置丢失）
4. 控制台出现错误信息

---

## 故障排查

### 问题 1: 配置未保存
**症状**: 修改设置后，配置文件没有更新

**排查**:
1. 检查控制台是否有错误信息
2. 检查配置文件路径是否正确
3. 检查文件权限（应该是 0600）

### 问题 2: 配置保存但重启后丢失
**症状**: 配置文件已更新，但重启后显示默认值

**排查**:
1. 检查 `LoadSettings` 是否正确解密
2. 检查前端 `validateAISettings` 是否包含所有字段
3. 检查控制台是否有解密错误

### 问题 3: JSON 验证失败
**症状**: 输入 JSON 后显示 "JSON 格式错误"

**排查**:
1. 确保 JSON 格式正确（使用 JSON 验证器）
2. 确保包含必要字段：`type`, `project_id`, `private_key`
3. 检查是否有多余的逗号或引号

---

## 技术细节

### 加密算法
- **算法**: AES-256-GCM
- **密钥**: 从机器 ID 派生（确保每台机器的加密密钥不同）
- **存储**: 加密后的数据以 Base64 编码存储在 JSON 文件中

### 字段映射
| 前端字段 (camelCase) | 后端字段 (camelCase) | JSON 标签 |
|---------------------|---------------------|-----------|
| `useVertexAI` | `UseVertexAI` | `useVertexAI` |
| `vertexProject` | `VertexProject` | `vertexProject` |
| `vertexLocation` | `VertexLocation` | `vertexLocation` |
| `vertexCredentials` | `VertexCredentials` | `vertexCredentials` |

### 数据流
```
前端设置界面
    ↓ (updateCategory)
前端 SettingsContext
    ↓ (saveSettings)
Wails 后端 SaveSettings
    ↓ (加密敏感字段)
配置文件 (JSON)
    ↓ (重启应用)
Wails 后端 LoadSettings
    ↓ (解密敏感字段)
前端 SettingsContext
    ↓ (validateAISettings)
前端设置界面
```

---

## 总结

修复了以下关键问题：
1. ✅ 后端 `SaveSettings` 现在正确加密 `VertexCredentials`
2. ✅ 后端 `LoadSettings` 现在正确解密 `VertexCredentials`
3. ✅ 后端 `getDefaultSettings` 包含 Vertex AI 默认值
4. ✅ 前端类型定义、默认配置、验证逻辑已完整
5. ✅ 前端 UI 组件支持 Vertex AI 配置

所有 Vertex AI 配置字段现在都能正确持久化！🎉

