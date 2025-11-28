/**
 * OpenAI 兼容 AI 服务实现
 * 封装 OpenAI API 及兼容服务的调用逻辑
 */

import { loadSettings } from '../settingsService';
import {
  AIServiceProvider,
  AIFeature,
  FeatureSupportMatrix,
  ImageGenerationOptions,
  ImageEditOptions,
  ImageBlendOptions,
  toOpenAISize,
  ensureDataUri,
} from './types';

/**
 * OpenAI 服务功能支持矩阵
 * 注意：兼容 /images/edits 端点的服务才支持多图输入
 */
const OPENAI_FEATURE_SUPPORT: FeatureSupportMatrix = {
  enhancePrompt: true,
  generateImage: true,
  editImage: true,        // 需要兼容 /images/edits 端点的服务
  blendImages: true,      // 通过多图输入实现融合
  removeBackground: true, // 通过图像编辑实现
  referenceImage: true,   // 通过多图输入实现参考图像
};

/**
 * OpenAI 配置接口
 */
interface OpenAIConfig {
  apiKey: string;
  imageApiKey?: string;  // 图像 API 独立 API Key（可选）
  baseUrl: string;
  imageBaseUrl?: string;  // 图像 API 独立 Base URL（可选）
  textModel: string;
  imageModel: string;
}

/**
 * OpenAI 兼容 AI 服务类
 */
export class OpenAIService implements AIServiceProvider {
  readonly name = 'OpenAI';

  /**
   * 获取 OpenAI 配置
   */
  private getConfig(): OpenAIConfig {
    const settings = loadSettings();
    return {
      apiKey: settings.ai.openaiApiKey || '',
      imageApiKey: settings.ai.openaiImageApiKey,  // 可选的图像 API Key
      baseUrl: settings.ai.openaiBaseUrl || 'https://api.openai.com/v1',
      imageBaseUrl: settings.ai.openaiImageBaseUrl,  // 可选的图像 API Base URL
      textModel: settings.ai.openaiTextModel || 'gpt-4o',
      imageModel: settings.ai.openaiImageModel || 'dall-e-3',
    };
  }

  /**
   * 验证 API Key
   */
  private validateApiKey(): void {
    const config = this.getConfig();
    if (!config.apiKey) {
      throw new Error("OpenAI API Key is missing. Please configure it in Settings.");
    }
  }

  /**
   * 通用 OpenAI API 调用方法
   * @param endpoint API 端点（相对路径，如 '/chat/completions'）
   * @param body 请求体
   * @param isImageAPI 是否为图像 API（用于选择 Base URL 和 API Key）
   * @returns 解析后的 JSON 响应
   */
  private async callOpenAIAPI<T = any>(endpoint: string, body: any, isImageAPI: boolean = false): Promise<T> {
    const config = this.getConfig();

    // 如果是图像 API 且配置了独立的 imageBaseUrl，则使用 imageBaseUrl，否则使用 baseUrl
    const baseUrl = isImageAPI && config.imageBaseUrl ? config.imageBaseUrl : config.baseUrl;

    // 如果是图像 API 且配置了独立的 imageApiKey，则使用 imageApiKey，否则使用 apiKey
    const apiKey = isImageAPI && config.imageApiKey ? config.imageApiKey : config.apiKey;

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 解析图像 API 响应
   * @param data API 响应数据
   * @param errorMessage 错误消息
   * @returns base64 格式的图像 data URI
   */
  private parseImageResponse(data: any, errorMessage: string): string {
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error(errorMessage);
    }
    return `data:image/png;base64,${b64}`;
  }

  /**
   * 调用图像 API（统一封装）
   * @param endpoint API 端点
   * @param body 请求体
   * @param errorMessage 错误消息
   * @returns base64 格式的图像 data URI
   */
  private async callImageAPI(endpoint: string, body: any, errorMessage: string): Promise<string> {
    const data = await this.callOpenAIAPI(endpoint, body, true);  // isImageAPI = true
    return this.parseImageResponse(data, errorMessage);
  }

  /**
   * 检查功能是否支持
   */
  isFeatureSupported(feature: AIFeature): boolean {
    return OPENAI_FEATURE_SUPPORT[feature] ?? false;
  }

  /**
   * 增强提示词
   */
  async enhancePrompt(prompt: string): Promise<string> {
    this.validateApiKey();
    const config = this.getConfig();

    const systemPrompt = `You are an expert AI art prompt engineer. Rewrite the following user prompt to be more descriptive, artistic, and suitable for high-quality image generation. Keep the original intent but add details about lighting, style, composition, and mood. Output ONLY the enhanced prompt text, no explanations. \n\nOriginal Prompt: "${prompt}"`;

    try {
      const data = await this.callOpenAIAPI('/chat/completions', {
        model: config.textModel,
        messages: [{ role: 'user', content: systemPrompt }],
        max_tokens: 1024,
      });

      return data.choices?.[0]?.message?.content || prompt;
    } catch (error) {
      console.error("OpenAI Prompt Enhancement Error:", error);
      return prompt;
    }
  }

  /**
   * 生成图像
   * 如果有参考图像，使用 /images/edits 端点（需要兼容服务支持）
   */
  async generateImage(options: ImageGenerationOptions): Promise<string> {
    this.validateApiKey();
    const config = this.getConfig();

    const { prompt, referenceImage, imageSize = '1K', aspectRatio = '1:1' } = options;

    try {
      // 如果有参考图像，使用 /images/edits 端点
      if (referenceImage) {
        const imageData = ensureDataUri(referenceImage);
        return await this.callImageAPI('/images/edits', {
          model: config.imageModel,
          image: imageData,
          prompt: prompt,
          n: 1,
          response_format: 'b64_json',
        }, "No image generated from OpenAI.");
      }

      // 无参考图像，使用 /images/generations 端点
      const size = toOpenAISize(imageSize, aspectRatio);
      return await this.callImageAPI('/images/generations', {
        model: config.imageModel,
        prompt: prompt,
        n: 1,
        size: size,
        response_format: 'b64_json',
      }, "No image generated from OpenAI.");
    } catch (error: any) {
      console.error("OpenAI Image Generation Error:", error);
      throw error;
    }
  }

  /**
   * 编辑图像
   * 使用 OpenAI 兼容的 /images/edits API
   * 注意：不指定 size 参数，保持原图尺寸
   */
  async editImage(options: ImageEditOptions): Promise<string> {
    this.validateApiKey();
    const config = this.getConfig();

    const { image, prompt } = options;
    const imageData = ensureDataUri(image);

    try {
      return await this.callImageAPI('/images/edits', {
        model: config.imageModel,
        image: imageData,
        prompt: prompt,
        n: 1,
        response_format: 'b64_json',
        // 注意：不指定 size 参数，让 API 保持原图尺寸
      }, "No edited image returned from OpenAI.");
    } catch (error: any) {
      console.error("OpenAI Image Edit Error:", error);
      throw new Error(error.message || "Unknown error during AI editing");
    }
  }

  /**
   * 融合图像
   * 使用 /images/edits 端点的多图输入功能
   */
  async blendImages(options: ImageBlendOptions): Promise<string> {
    this.validateApiKey();
    const config = this.getConfig();

    const { bottomImage, topImage, prompt = '', blendStyle = 'Seamless' } = options;

    // 确保图像是完整的 data URI 格式
    const image1 = ensureDataUri(bottomImage);
    const image2 = ensureDataUri(topImage);

    const blendPrompt = `
Blend these two images into a single cohesive artwork.
Style Direction: ${blendStyle}
User Instructions: ${prompt}

Guidelines:
- If "Seamless": Focus on photorealism, perfect shadow casting, and edge blending.
- If "Double Exposure": Create an artistic overlay effect.
- If "Glitch/Cyberpunk": Apply digital distortion and neon glows.
- If "Surreal": Blend in a dream-like manner.
- If "Splash Effect": Create a dynamic dispersion effect.

Return ONLY the final blended image.
    `.trim();

    try {
      return await this.callImageAPI('/images/edits', {
        model: config.imageModel,
        image: [image1, image2],  // 多图输入
        prompt: blendPrompt,
        n: 1,
        response_format: 'b64_json',
      }, "No blended image returned from OpenAI.");
    } catch (error: any) {
      console.error("OpenAI Image Blend Error:", error);
      throw new Error(error.message || "AI Blending failed");
    }
  }

  /**
   * 移除背景
   * 使用图像编辑功能实现
   */
  async removeBackground(image: string): Promise<string> {
    return this.editImage({
      image,
      prompt: "Remove the background from this image. Keep the main subject exactly as is, but make the background transparent. Return ONLY the image with transparent background."
    });
  }
}

/**
 * 创建 OpenAI 服务实例
 */
export function createOpenAIService(): OpenAIService {
  return new OpenAIService();
}

