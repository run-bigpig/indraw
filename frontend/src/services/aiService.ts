/**
 * AI 服务入口文件
 * 所有 AI 功能通过 Wails 后端代理
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
