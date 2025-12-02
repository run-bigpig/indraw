/**
 * 设置服务
 * 处理配置的读取、写入、验证和加密
 * 现在使用 Wails 后端进行安全的配置存储
 */

import {
  Settings,
  AIServiceSettings,
  CanvasDefaultSettings,
  ToolSettings,
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
};

export const DEFAULT_CANVAS_SETTINGS: CanvasDefaultSettings = {
  width: 1080,
  height: 1080,
  background: 'transparent',
  backgroundColor: '#ffffff',
};

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  brush: {
    size: 10,
    color: '#ffffff',
    opacity: 1,
  },
  eraser: {
    size: 20,
  },
  text: {
    fontSize: 32,
    color: '#ffffff',
    defaultText: 'Double click to edit',
    fontFamily: 'Arial',
  },
};

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  ai: DEFAULT_AI_SETTINGS,
  canvas: DEFAULT_CANVAS_SETTINGS,
  tools: DEFAULT_TOOL_SETTINGS,
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
    provider: settings.provider === 'gemini' || settings.provider === 'openai'
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
  };
}

/**
 * 验证画布设置
 */
function validateCanvasSettings(settings: Partial<CanvasDefaultSettings>): CanvasDefaultSettings {
  return {
    width: typeof settings.width === 'number' && settings.width > 0 
      ? settings.width 
      : DEFAULT_CANVAS_SETTINGS.width,
    height: typeof settings.height === 'number' && settings.height > 0 
      ? settings.height 
      : DEFAULT_CANVAS_SETTINGS.height,
    background: settings.background === 'transparent' || settings.background === 'color'
      ? settings.background
      : DEFAULT_CANVAS_SETTINGS.background,
    backgroundColor: typeof settings.backgroundColor === 'string' 
      ? settings.backgroundColor 
      : DEFAULT_CANVAS_SETTINGS.backgroundColor,
  };
}

/**
 * 验证工具设置
 */
function validateToolSettings(settings: Partial<ToolSettings>): ToolSettings {
  return {
    brush: {
      size: typeof settings.brush?.size === 'number' && settings.brush.size > 0 
        ? settings.brush.size 
        : DEFAULT_TOOL_SETTINGS.brush.size,
      color: typeof settings.brush?.color === 'string' 
        ? settings.brush.color 
        : DEFAULT_TOOL_SETTINGS.brush.color,
      opacity: typeof settings.brush?.opacity === 'number' && settings.brush.opacity >= 0 && settings.brush.opacity <= 1
        ? settings.brush.opacity 
        : DEFAULT_TOOL_SETTINGS.brush.opacity,
    },
    eraser: {
      size: typeof settings.eraser?.size === 'number' && settings.eraser.size > 0 
        ? settings.eraser.size 
        : DEFAULT_TOOL_SETTINGS.eraser.size,
    },
    text: {
      fontSize: typeof settings.text?.fontSize === 'number' && settings.text.fontSize > 0 
        ? settings.text.fontSize 
        : DEFAULT_TOOL_SETTINGS.text.fontSize,
      color: typeof settings.text?.color === 'string' 
        ? settings.text.color 
        : DEFAULT_TOOL_SETTINGS.text.color,
      defaultText: typeof settings.text?.defaultText === 'string' 
        ? settings.text.defaultText 
        : DEFAULT_TOOL_SETTINGS.text.defaultText,
      fontFamily: typeof settings.text?.fontFamily === 'string' && settings.text.fontFamily
        ? settings.text.fontFamily 
        : DEFAULT_TOOL_SETTINGS.text.fontFamily,
    },
  };
}

/**
 * 验证完整设置
 */
function validateSettings(settings: Partial<Settings>): Settings {
  return {
    version: SETTINGS_VERSION,
    ai: validateAISettings(settings.ai || {}),
    canvas: validateCanvasSettings(settings.canvas || {}),
    tools: validateToolSettings(settings.tools || {}),
  };
}
/**
 * 从 Wails 后端加载设置
 */
export async function loadSettings(): Promise<Settings> {
  try {
    const settingsJSON = await LoadSettings();

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

