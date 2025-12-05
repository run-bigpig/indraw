
export type ToolType = 'select' | 'text' | 'ai-gen' | 'brush' | 'eraser' | 'shape';
export type ShapeType = 'polygon' | 'star' | 'rounded-rect' | 'ellipse' | 'arrow' | 'wedge' | 'ring' | 'arc';

// ==================== Settings Types ====================

/**
 * AI 服务提供商类型
 */
export type AIProvider = 'gemini' | 'openai' | 'cloud';

/**
 * OpenAI 图像模式类型
 * - auto: 自动判断（根据模型名称）
 * - image_api: 使用专用 Image API（/v1/images/*），适用于 DALL-E 等
 * - chat: 使用 Chat Completion API，适用于第三方多模态 API
 */
export type OpenAIImageMode = 'auto' | 'image_api' | 'chat';

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

  // OpenAI 图像模式配置
  // "auto"      - 自动判断（默认，根据模型名判断）
  // "image_api" - 使用专用 Image API（/v1/images/*），适用于 DALL-E 和 GPT Image 1
  // "chat"      - 使用 Chat Completion API，适用于第三方多模态 API（类似 Gemini）
  openaiImageMode?: OpenAIImageMode;

  // OpenAI 流式模式配置
  // 某些第三方 OpenAI 中继服务仅提供流式接口
  openaiTextStream?: boolean;  // 文本/聊天模型是否使用流式请求（默认 false）
  openaiImageStream?: boolean;  // 图像模型是否使用流式请求（默认 false）

  // Cloud 云服务配置
  cloudEndpointUrl?: string;  // 云服务端点 URL（无需 API Key）
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
 * Transformers 模型配置
 * 
 * 架构说明：
 * - 所有模型必须先下载到后端存储
 * - 前端通过 /models/{modelId}/ 路径访问模型
 * - 消除了 "远程" vs "本地" 模型的区分
 */
export interface TransformersModelSettings {
  /** 当前使用的模型ID */
  currentModelId: string;
  /** 是否使用量化模型（q8） */
  useQuantized: boolean;
  /** 可用的模型列表（用于切换） */
  availableModels: Array<{
    id: string;
    name: string;
    repoId: string; // Hugging Face 仓库 ID（用于下载）
    description?: string;
    size?: number; // 模型大小（字节）
  }>;
}

/**
 * 模型信息（带运行时状态）
 */
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  repoId: string;
  size: number;
  downloaded: boolean;
  isDownloading: boolean;
}

/**
 * 应用设置
 * 注意：language 由 i18n 库管理，存储在 localStorage
 */
export interface AppSettings {
  transformers?: TransformersModelSettings; // Transformers 模型配置
}

/**
 * 完整设置配置
 */
export interface Settings {
  version: string;
  ai: AIServiceSettings;
  canvas: CanvasDefaultSettings;
  tools: ToolSettings;
  app: AppSettings; // 应用设置
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

// ==================== OpenCV / Image Slicing Types ====================

/**
 * 图片处理模式
 */
export enum ProcessMode {
  /** 九宫格切割：将图片裁剪为正方形后分割成3x3的9等份 */
  GRID_3X3 = 'grid_3x3',
  /** 智能提取：使用计算机视觉算法检测并提取图片中的独立元素 */
  SMART_EXTRACT = 'smart_extract',
}

/**
 * 智能提取参数配置
 */
export interface SmartExtractParams {
  /** 最小面积比例（相对于整图面积），小于此比例的区域会被过滤，默认 0.001 */
  minAreaRatio: number;
  /** 形态学内核大小，用于噪点去除和轮廓连接，默认 5 */
  morphKernelSize: number;
  /** 最小宽高比，过滤过于细长的区域，默认 0.1 */
  minAspectRatio: number;
  /** 最大宽高比，过滤过于扁平的区域，默认 10 */
  maxAspectRatio: number;
  /** 是否使用详细轮廓（更精确但更慢），默认 false */
  useDetailedContours: boolean;
  /** 处理时缩放后的最长边像素（用于性能优化），默认 1200。设为 0 则不缩放 */
  maxSize: number;
  /** 形态学膨胀迭代次数（0-5），用于边缘连接，默认 1 */
  dilateIter: number;
  /** 是否使用 Canny 边缘检测（更精确但更慢），默认 false */
  useCannyEdge: boolean;
  /** Canny 边缘检测低阈值，默认 50 */
  cannyLowThreshold: number;
  /** Canny 边缘检测高阈值，默认 150 */
  cannyHighThreshold: number;
}

/**
 * 默认的智能提取参数
 */
export const DEFAULT_SMART_PARAMS: SmartExtractParams = {
  minAreaRatio: 0.001,
  morphKernelSize: 5,
  minAspectRatio: 0.1,
  maxAspectRatio: 10,
  useDetailedContours: false,
  maxSize: 1200,
  dilateIter: 1,
  useCannyEdge: false,
  cannyLowThreshold: 50,
  cannyHighThreshold: 150,
};

/**
 * 切片结果数据
 */
export interface GridSlice {
  /** 切片序号 */
  id: number;
  /** Base64 数据 URL */
  dataUrl: string;
  /** Blob 对象，用于下载或进一步处理 */
  blob: Blob;
  /** 切片宽度 */
  width: number;
  /** 切片高度 */
  height: number;
}