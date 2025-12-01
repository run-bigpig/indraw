/**
 * AI 服务层类型定义
 * 定义统一的接口和类型，支持多服务提供商扩展
 */

// ==================== 图像尺寸类型 ====================

/**
 * 图像尺寸等级
 */
export type ImageSizeLevel = '1K' | '2K' | '4K';

/**
 * 图像宽高比
 */
export type AspectRatio = '1:1' | '16:9' | '9:16' | '3:4' | '4:3';

/**
 * OpenAI 支持的图像尺寸
 */
export type OpenAIImageSize = 
  | '256x256' 
  | '512x512' 
  | '1024x1024' 
  | '1792x1024' 
  | '1024x1792';

// ==================== 图像生成选项 ====================

/**
 * 图像生成选项
 */
export interface ImageGenerationOptions {
  /** 生成提示词 */
  prompt: string;
  /** 参考图像（可选，base64 格式） */
  referenceImage?: string;
  /** 图像尺寸等级 */
  imageSize?: ImageSizeLevel;
  /** 宽高比 */
  aspectRatio?: AspectRatio;
}

/**
 * 图像编辑选项
 */
export interface ImageEditOptions {
  /** 原始图像（base64 格式） */
  image: string;
  /** 编辑提示词 */
  prompt: string;
  /** 遮罩图像（可选，base64 格式） */
  mask?: string;
}

/**
 * 多图融合选项
 */
export interface ImageBlendOptions {
  /** 图像数组（base64 格式），按图层顺序排列（下层到上层） */
  images: string[];
  /** 用户提示词（可选） */
  prompt?: string;
  /** 融合风格: "Seamless" | "Double Exposure" | "Splash Effect" | "Glitch/Cyberpunk" | "Surreal" */
  blendStyle?: string;
}

// ==================== AI 服务提供商接口 ====================

/**
 * AI 服务提供商接口
 * 所有服务提供商（Gemini、OpenAI 等）都需要实现此接口
 */
export interface AIServiceProvider {
  /** 服务提供商名称 */
  readonly name: string;

  /**
   * 增强提示词
   * @param prompt 原始提示词
   * @returns 增强后的提示词
   */
  enhancePrompt(prompt: string): Promise<string>;

  /**
   * 文本生成图像
   * @param options 生成选项
   * @returns 生成的图像（base64 格式）
   */
  generateImage(options: ImageGenerationOptions): Promise<string>;

  /**
   * 编辑图像
   * @param options 编辑选项
   * @returns 编辑后的图像（base64 格式）
   */
  editImage(options: ImageEditOptions): Promise<string>;

  /**
   * 融合图像
   * @param options 融合选项
   * @returns 融合后的图像（base64 格式）
   */
  blendImages(options: ImageBlendOptions): Promise<string>;

  /**
   * 移除背景
   * @param image 原始图像（base64 格式）
   * @returns 移除背景后的图像（base64 格式）
   */
  removeBackground(image: string): Promise<string>;

  /**
   * 检查功能是否支持
   * @param feature 功能名称
   * @returns 是否支持
   */
  isFeatureSupported(feature: AIFeature): boolean;
}

/**
 * AI 功能枚举
 */
export type AIFeature = 
  | 'enhancePrompt'
  | 'generateImage'
  | 'editImage'
  | 'blendImages'
  | 'removeBackground'
  | 'referenceImage';

/**
 * 功能支持矩阵类型
 */
export type FeatureSupportMatrix = Record<AIFeature, boolean>;

// ==================== 工具函数 ====================

/**
 * 将 ImageSizeLevel 和 AspectRatio 转换为 OpenAI 支持的尺寸
 * @param sizeLevel 尺寸等级
 * @param aspectRatio 宽高比
 * @returns OpenAI 图像尺寸
 */
export function toOpenAISize(
  sizeLevel: ImageSizeLevel = '1K',
  aspectRatio: AspectRatio = '1:1'
): OpenAIImageSize {
  // OpenAI DALL-E 3 支持的尺寸：1024x1024, 1792x1024, 1024x1792
  // DALL-E 2 支持：256x256, 512x512, 1024x1024
  
  // 根据宽高比选择尺寸
  switch (aspectRatio) {
    case '16:9':
    case '4:3':
      // 横向图像
      return '1792x1024';
    case '9:16':
    case '3:4':
      // 纵向图像
      return '1024x1792';
    case '1:1':
    default:
      // 正方形，根据尺寸等级选择
      if (sizeLevel === '1K') {
        return '1024x1024';
      }
      // 2K 和 4K 都使用最大尺寸
      return '1024x1024';
  }
}

/**
 * 从 base64 图像中提取 MIME 类型
 * @param base64Image base64 图像数据
 * @returns MIME 类型
 */
export function extractMimeType(base64Image: string): string {
  const match = base64Image.match(/^data:([^;]+);base64,/);
  return match ? match[1] : 'image/png';
}

/**
 * 从 base64 图像中提取纯数据部分
 * @param base64Image base64 图像数据
 * @returns 纯 base64 数据
 */
export function extractBase64Data(base64Image: string): string {
  return base64Image.replace(/^data:[^;]+;base64,/, '');
}

/**
 * 确保图像是完整的 data URI 格式
 * @param base64Image base64 图像数据
 * @param mimeType MIME 类型（默认 image/png）
 * @returns 完整的 data URI
 */
export function ensureDataUri(base64Image: string, mimeType: string = 'image/png'): string {
  if (base64Image.startsWith('data:')) {
    return base64Image;
  }
  return `data:${mimeType};base64,${base64Image}`;
}

