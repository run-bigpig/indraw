
export type ToolType = 'select' | 'text' | 'ai-gen' | 'brush' | 'eraser';

// ==================== Settings Types ====================

/**
 * AI 服务提供商类型
 */
export type AIProvider = 'gemini' | 'openai';

/**
 * AI 服务配置
 */
export interface AIServiceSettings {
  // 服务提供商选择
  provider: AIProvider;

  // Gemini API 配置
  apiKey: string;
  textModel: string;
  imageModel: string;

  // OpenAI 兼容 API 配置
  openaiApiKey: string;
  openaiImageApiKey?: string;  // 图像 API 独立 API Key（可选）
  openaiBaseUrl: string;
  openaiImageBaseUrl?: string;  // 图像 API 独立 Base URL（可选）
  openaiTextModel: string;
  openaiImageModel: string;
}

/**
 * 画布默认配置
 */
export interface CanvasDefaultSettings {
  width: number;
  height: number;
  background: 'transparent' | 'color';
  backgroundColor: string;
}

/**
 * 画笔配置
 */
export interface BrushSettings {
  size: number;
  color: string;
  opacity: number;
}

/**
 * 橡皮擦配置
 */
export interface EraserSettings {
  size: number;
}

/**
 * 文本默认配置
 */
export interface TextSettings {
  fontSize: number;
  color: string;
  defaultText: string;
}

/**
 * 工具配置
 */
export interface ToolSettings {
  brush: BrushSettings;
  eraser: EraserSettings;
  text: TextSettings;
}

/**
 * 应用配置
 */
export interface AppSettings {
  language: 'zh-CN' | 'en-US';
  autoSave: boolean;
  autoSaveInterval: number; // 秒
}

/**
 * 完整设置配置
 */
export interface Settings {
  version: string;
  ai: AIServiceSettings;
  canvas: CanvasDefaultSettings;
  tools: ToolSettings;
  app: AppSettings;
}

/**
 * 设置分类键
 */
export type SettingsCategory = 'ai' | 'canvas' | 'tools' | 'app';

export interface CanvasConfig {
  width: number;
  height: number;
  background: 'transparent' | 'color';
  backgroundColor?: string;
}

export interface LayerData {
  id: string;
  type: 'image' | 'rect' | 'circle' | 'text' | 'line' | 'group';
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[]; // For lines
  rotation: number;
  scaleX: number;
  scaleY: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  src?: string; // For images (base64 or url)
  opacity: number;
  visible: boolean;
  parentId?: string; // For grouping
  // New Photoshop-like properties
  blendMode?: string;
  brightness?: number; // -1 to 1
  contrast?: number;   // -100 to 100
  blurRadius?: number; // 0 to 40
  noise?: number;      // 0 to 1
  pixelSize?: number;  // 1 to 20
  saturation?: number; // -2 to 2
  isGrayscale?: boolean;
  // Background Pattern Support
  fillPatternUrl?: string;
  isTransparentBackground?: boolean;
}



export interface AppState {
  layers: LayerData[];
  selectedIds: string[];
  activeTool: ToolType;
  isProcessing: boolean;
  prompt: string;
  canvasConfig: CanvasConfig;
}
