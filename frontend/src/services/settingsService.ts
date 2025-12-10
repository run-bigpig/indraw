/**
 * 设置服务
 * 处理配置的读取、写入、验证和加密
 * 现在使用 Wails 后端进行安全的配置存储
 */

import {
  Settings,
  AIServiceSettings,
  AppSettings,
  TransformersModelSettings,
} from '@/types';
import { LoadSettings, SaveSettings } from '../../wailsjs/go/core/App';

// ==================== 常量定义 ====================

const SETTINGS_VERSION = '1.0.0';

// ==================== 默认配置 ====================

export const DEFAULT_AI_SETTINGS: AIServiceSettings = {
  // 默认使用 Gemini
  provider: 'gemini',

  // Gemini API 配置
  apiKey: '',
  textModel: 'gemini-2.5-flash',
  imageModel: 'gemini-2.5-flash-preview-05-20',

  // Vertex AI 配置
  useVertexAI: false,
  vertexProject: '',
  vertexLocation: 'us-central1',
  vertexCredentials: '',

  // OpenAI 兼容 API 配置
  openaiApiKey: '',
  openaiImageApiKey: '',  // 图像 API 独立 API Key（可选）
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiImageBaseUrl: '',  // 图像 API 独立 Base URL（可选）
  openaiTextModel: 'gpt-4o',
  openaiImageModel: 'dall-e-3',

  // OpenAI 图像模式
  // "auto"      - 自动判断（默认，根据模型名判断：dall-e/gpt-image 用 Image API，其他用 Chat）
  // "image_api" - 使用专用 Image API（/v1/images/*）
  // "chat"      - 使用 Chat Completion API（适用于第三方多模态 API）
  openaiImageMode: 'auto',

  // OpenAI 流式模式配置
  // 某些第三方 OpenAI 中继服务仅提供流式接口
  openaiTextStream: false,  // 文本/聊天模型是否使用流式请求（默认 false）
  openaiImageStream: false, // 图像模型是否使用流式请求（默认 false）

  // Cloud 云服务配置
  cloudEndpointUrl: '',  // 云服务端点 URL
  cloudToken: '',        // 云服务认证 Token
};

export const DEFAULT_TRANSFORMERS_MODEL_SETTINGS: TransformersModelSettings = {
  currentModelId: 'rmbg-1.4',
  useQuantized: true,
  availableModels: [
    {
      id: 'rmbg-1.4',
      name: 'RMBG-1.4',
      repoId: 'briaai/RMBG-1.4',
      description: 'BRIA 背景移除模型 v1.4 - 高质量背景移除',
      size: 176000000, // ~176MB
    },
  ],
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  transformers: DEFAULT_TRANSFORMERS_MODEL_SETTINGS,
  // exportDirectory 将在后端加载设置时自动设置为用户图片目录
  exportDirectory: '',
};

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  ai: DEFAULT_AI_SETTINGS,
  app: DEFAULT_APP_SETTINGS,
};

// ==================== 加密/解密工具 ====================
// 注意：加密现在由 Go 后端处理，使用 AES-GCM 加密
// 前端不再需要处理加密逻辑

// ==================== 验证工具 ====================

/**
 * 验证 AI 设置
 */
function validateAISettings(settings: Partial<AIServiceSettings>): AIServiceSettings {
  return {
    // 服务提供商
    provider: settings.provider === 'gemini' || settings.provider === 'openai' || settings.provider === 'cloud'
      ? settings.provider
      : DEFAULT_AI_SETTINGS.provider,

    // Gemini 配置
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : DEFAULT_AI_SETTINGS.apiKey,
    textModel: typeof settings.textModel === 'string' && settings.textModel
      ? settings.textModel
      : DEFAULT_AI_SETTINGS.textModel,
    imageModel: typeof settings.imageModel === 'string' && settings.imageModel
      ? settings.imageModel
      : DEFAULT_AI_SETTINGS.imageModel,

    // Vertex AI 配置
    useVertexAI: typeof settings.useVertexAI === 'boolean'
      ? settings.useVertexAI
      : DEFAULT_AI_SETTINGS.useVertexAI,
    vertexProject: typeof settings.vertexProject === 'string'
      ? settings.vertexProject
      : DEFAULT_AI_SETTINGS.vertexProject,
    vertexLocation: typeof settings.vertexLocation === 'string' && settings.vertexLocation
      ? settings.vertexLocation
      : DEFAULT_AI_SETTINGS.vertexLocation,
    vertexCredentials: typeof settings.vertexCredentials === 'string'
      ? settings.vertexCredentials
      : DEFAULT_AI_SETTINGS.vertexCredentials,

    // OpenAI 配置
    openaiApiKey: typeof settings.openaiApiKey === 'string'
      ? settings.openaiApiKey
      : DEFAULT_AI_SETTINGS.openaiApiKey,
    openaiImageApiKey: typeof settings.openaiImageApiKey === 'string'
      ? settings.openaiImageApiKey
      : DEFAULT_AI_SETTINGS.openaiImageApiKey,
    openaiBaseUrl: typeof settings.openaiBaseUrl === 'string' && settings.openaiBaseUrl
      ? settings.openaiBaseUrl
      : DEFAULT_AI_SETTINGS.openaiBaseUrl,
    openaiImageBaseUrl: typeof settings.openaiImageBaseUrl === 'string'
      ? settings.openaiImageBaseUrl
      : DEFAULT_AI_SETTINGS.openaiImageBaseUrl,
    openaiTextModel: typeof settings.openaiTextModel === 'string' && settings.openaiTextModel
      ? settings.openaiTextModel
      : DEFAULT_AI_SETTINGS.openaiTextModel,
    openaiImageModel: typeof settings.openaiImageModel === 'string' && settings.openaiImageModel
      ? settings.openaiImageModel
      : DEFAULT_AI_SETTINGS.openaiImageModel,

    // OpenAI 图像模式
    openaiImageMode: settings.openaiImageMode === 'auto' || 
                     settings.openaiImageMode === 'image_api' || 
                     settings.openaiImageMode === 'chat'
      ? settings.openaiImageMode
      : DEFAULT_AI_SETTINGS.openaiImageMode,

    // OpenAI 流式模式配置
    openaiTextStream: typeof settings.openaiTextStream === 'boolean'
      ? settings.openaiTextStream
      : DEFAULT_AI_SETTINGS.openaiTextStream,
    openaiImageStream: typeof settings.openaiImageStream === 'boolean'
      ? settings.openaiImageStream
      : DEFAULT_AI_SETTINGS.openaiImageStream,

    // Cloud 云服务配置
    cloudEndpointUrl: typeof settings.cloudEndpointUrl === 'string'
      ? settings.cloudEndpointUrl
      : DEFAULT_AI_SETTINGS.cloudEndpointUrl,
    cloudToken: typeof settings.cloudToken === 'string'
      ? settings.cloudToken
      : DEFAULT_AI_SETTINGS.cloudToken,
  };
}

/**
 * 验证 Transformers 模型设置
 */
function validateTransformersModelSettings(settings: Partial<TransformersModelSettings>): TransformersModelSettings {
  const defaultSettings = DEFAULT_TRANSFORMERS_MODEL_SETTINGS;
  
  // 验证并处理 availableModels（使用新的字段结构）
  const availableModels = Array.isArray(settings.availableModels) && settings.availableModels.length > 0
    ? settings.availableModels.map(model => ({
        id: typeof model.id === 'string' ? model.id : '',
        name: typeof model.name === 'string' ? model.name : '',
        repoId: typeof model.repoId === 'string' ? model.repoId : '',
        description: typeof model.description === 'string' ? model.description : undefined,
        size: typeof model.size === 'number' ? model.size : undefined,
      })).filter(model => model.id && model.name)
    : defaultSettings.availableModels;
  
  // 确定 currentModelId
  let currentModelId = typeof settings.currentModelId === 'string' && settings.currentModelId
    ? settings.currentModelId
    : defaultSettings.currentModelId;
  
  // 验证 currentModelId 是否在 availableModels 中存在
  const modelExists = availableModels.some(m => m.id === currentModelId);
  if (!modelExists && availableModels.length > 0) {
    currentModelId = availableModels[0].id;
  }
  
  return {
    currentModelId,
    useQuantized: typeof settings.useQuantized === 'boolean'
      ? settings.useQuantized
      : defaultSettings.useQuantized,
    availableModels,
  };
}

/**
 * 验证应用设置
 */
function validateAppSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    transformers: settings.transformers
      ? validateTransformersModelSettings(settings.transformers)
      : DEFAULT_TRANSFORMERS_MODEL_SETTINGS,
    exportDirectory: typeof settings.exportDirectory === 'string'
      ? settings.exportDirectory
      : DEFAULT_APP_SETTINGS.exportDirectory,
  };
}

/**
 * 验证完整设置
 */
function validateSettings(settings: Partial<Settings>): Settings {
  return {
    version: SETTINGS_VERSION,
    ai: validateAISettings(settings.ai || {}),
    app: validateAppSettings(settings.app || {}),
  };
}
/**
 * 从 Wails 后端加载设置
 */
export async function loadSettings(): Promise<Settings> {
  try {
    // ✅ 使用安全调用，等待 Wails 绑定初始化
    const { safeCallWailsBinding } = await import('../utils/wailsRuntime');
    const settingsJSON = await safeCallWailsBinding(() => LoadSettings());

    // 检查返回值是否有效
    if (!settingsJSON || settingsJSON === '') {
      console.warn('[settingsService] Empty settings returned, using defaults');
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(settingsJSON);
    return validateSettings(parsed);
  } catch (error) {
    console.error('[settingsService] Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 保存设置到 Wails 后端（自动加密）
 */
export async function saveSettings(settings: Settings): Promise<boolean> {
  try {
    const validated = validateSettings(settings);
    const settingsJSON = JSON.stringify(validated);
    await SaveSettings(settingsJSON);
    return true;
  } catch (error) {
    console.error('[settingsService] Failed to save settings:', error);
    return false;
  }
}

/**
 * 重置为默认设置
 */
export async function resetSettings(): Promise<Settings> {
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

/**
 * 导出设置（不包含敏感信息）
 */
export function exportSettings(settings: Settings, includeSensitive: boolean = false): string {
  const exportData = {
    ...settings,
    ai: {
      ...settings.ai,
      apiKey: includeSensitive ? settings.ai.apiKey : '',
      openaiApiKey: includeSensitive ? settings.ai.openaiApiKey : '',
      cloudToken: includeSensitive ? settings.ai.cloudToken : '',
    },
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * 导入设置
 */
export function importSettings(jsonString: string): Settings | null {
  try {
    const parsed = JSON.parse(jsonString);
    return validateSettings(parsed);
  } catch (error) {
    console.error('Failed to import settings:', error);
    return null;
  }
}

/**
 * 获取 API Key（用于服务调用）
 * 注意：现在是异步函数
 */
export async function getApiKey(): Promise<string> {
  const settings = await loadSettings();
  return settings.ai.apiKey || '';
}

/**
 * 检查 API Key 是否已配置
 */
export async function hasApiKey(): Promise<boolean> {
  const apiKey = await getApiKey();
  return apiKey.length > 0;
}

