/**
 * AI 服务入口文件
 * 新代码应直接从 '@/services/ai' 导入
 */

export {
  // 核心导出函数
  enhancePrompt,
  generateImageFromText,
  editImageWithAI,
  blendImagesWithAI,
  removeBackgroundWithAI,

  // 服务工厂
  getAIService,
  clearServiceCache,

  // 服务类
  GeminiService,
  OpenAIService,

  // 类型
  type AIServiceProvider,
  type AIFeature,
  type FeatureSupportMatrix,
  type ImageGenerationOptions,
  type ImageEditOptions,
  type ImageBlendOptions,
  type ImageSizeLevel,
  type AspectRatio,
  type OpenAIImageSize,
} from './ai';
