
export type ToolType = 'select' | 'text' | 'ai-gen' | 'brush' | 'eraser' | 'shape';
export type ShapeType = 'polygon' | 'star' | 'rounded-rect' | 'ellipse' | 'arrow' | 'wedge' | 'ring' | 'arc';

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

  // Vertex AI 配置
  useVertexAI: boolean;
  vertexProject: string;
  vertexLocation: string;
  vertexCredentials: string;

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
  fontFamily: string;
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
 * 完整设置配置
 */
export interface Settings {
  version: string;
  ai: AIServiceSettings;
  canvas: CanvasDefaultSettings;
  tools: ToolSettings;
}

/**
 * 设置分类键
 */
export type SettingsCategory = 'ai' | 'canvas' | 'tools';

export interface CanvasConfig {
  width: number;
  height: number;
  background: 'transparent' | 'color';
  backgroundColor?: string;
}

export interface HistoryEntry {
  layers: LayerData[];
  description: string;
  timestamp: number;
}

export interface LayerData {
  id: string;
  type: 'image' | 'rect' | 'circle' | 'text' | 'line' | 'group' | 'polygon' | 'star' | 'rounded-rect' | 'ellipse' | 'arrow' | 'wedge' | 'ring' | 'arc';
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[]; // For lines and polygons
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
  // Eraser mask: store parent layer dimensions at creation time for proper scaling
  originalParentWidth?: number;
  originalParentHeight?: number;
  // New shape properties
  cornerRadius?: number; // For rounded-rect
  numPoints?: number; // For polygon and star
  innerRadius?: number; // For star and ring
  outerRadius?: number; // For star and ring
  radiusX?: number; // For ellipse
  radiusY?: number; // For ellipse
  angle?: number; // For arc and wedge
  pointerLength?: number; // For arrow
  pointerWidth?: number; // For arrow
  clockwise?: boolean; // For arc
  // Gradient fill
  fillGradient?: {
    type: 'linear' | 'radial';
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    colorStops: Array<{ offset: number; color: string }>;
  };
  // Shadow
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  // Stroke dash
  dash?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}



export interface AppState {
  layers: LayerData[];
  selectedIds: string[];
  activeTool: ToolType;
  isProcessing: boolean;
  prompt: string;
  canvasConfig: CanvasConfig;
}
