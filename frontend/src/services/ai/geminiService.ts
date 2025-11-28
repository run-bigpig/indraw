/**
 * Gemini AI 服务实现
 * 封装 Google Gemini API 的调用逻辑
 */

import { GoogleGenAI } from "@google/genai";
import { loadSettings } from '../settingsService';
import {
  AIServiceProvider,
  AIFeature,
  FeatureSupportMatrix,
  ImageGenerationOptions,
  ImageEditOptions,
  ImageBlendOptions,
  extractMimeType,
  extractBase64Data,
} from './types';

/**
 * Gemini 服务功能支持矩阵
 */
const GEMINI_FEATURE_SUPPORT: FeatureSupportMatrix = {
  enhancePrompt: true,
  generateImage: true,
  editImage: true,
  blendImages: true,
  removeBackground: true,
  referenceImage: true,
};

/**
 * Gemini AI 服务类
 */
export class GeminiService implements AIServiceProvider {
  readonly name = 'Gemini';

  /**
   * 获取 API Key
   */
  private getApiKey(): string {
    const settings = loadSettings();
    return settings.ai.apiKey || '';
  }

  /**
   * 获取文本模型
   */
  private getTextModel(): string {
    const settings = loadSettings();
    return settings.ai.textModel || 'gemini-2.5-flash';
  }

  /**
   * 获取图像模型
   */
  private getImageModel(): string {
    const settings = loadSettings();
    return settings.ai.imageModel || 'gemini-2.5-flash-preview-05-20';
  }

  /**
   * 创建 Gemini 客户端
   */
  private createClient(): GoogleGenAI {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please configure it in Settings.");
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * 验证 API Key
   */
  private validateApiKey(): void {
    if (!this.getApiKey()) {
      throw new Error("Gemini API Key is missing. Please configure it in Settings.");
    }
  }

  /**
   * 检查功能是否支持
   */
  isFeatureSupported(feature: AIFeature): boolean {
    return GEMINI_FEATURE_SUPPORT[feature] ?? false;
  }

  /**
   * 增强提示词
   */
  async enhancePrompt(prompt: string): Promise<string> {
    this.validateApiKey();

    const systemPrompt = `You are an expert AI art prompt engineer. Rewrite the following user prompt to be more descriptive, artistic, and suitable for high-quality image generation. Keep the original intent but add details about lighting, style, composition, and mood. Output ONLY the enhanced prompt text, no explanations. \n\nOriginal Prompt: "${prompt}"`;

    try {
      const ai = this.createClient();
      const response = await ai.models.generateContent({
        model: this.getTextModel(),
        contents: systemPrompt,
      });
      return response.text || prompt;
    } catch (error) {
      console.error("Gemini Prompt Enhancement Error:", error);
      return prompt;
    }
  }

  /**
   * 生成图像
   */
  async generateImage(options: ImageGenerationOptions): Promise<string> {
    this.validateApiKey();

    const { prompt, referenceImage, aspectRatio = '1:1' } = options;

    try {
      const ai = this.createClient();
      const parts: any[] = [{ text: prompt }];

      // 如果有参考图像，添加到 parts
      if (referenceImage) {
        const mimeType = extractMimeType(referenceImage);
        const base64Data = extractBase64Data(referenceImage);

        parts.unshift({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: this.getImageModel(),
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });

      return this.extractImageFromResponse(response);
    } catch (error: any) {
      console.error("Gemini Image Generation Error:", error);
      throw error;
    }
  }

  /**
   * 编辑图像
   */
  async editImage(options: ImageEditOptions): Promise<string> {
    this.validateApiKey();

    const { image, prompt } = options;

    try {
      const ai = this.createClient();
      const mimeType = extractMimeType(image);
      const base64Data = extractBase64Data(image);

      const response = await ai.models.generateContent({
        model: this.getImageModel(),
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            { text: prompt }
          ]
        }
      });

      return this.extractImageFromResponse(response);
    } catch (error: any) {
      console.error("Gemini Image Edit Error:", error);
      throw new Error(error.message || "Unknown error during AI editing");
    }
  }

  /**
   * 融合图像
   */
  async blendImages(options: ImageBlendOptions): Promise<string> {
    this.validateApiKey();

    const { bottomImage, topImage, prompt = '', blendStyle = 'Seamless' } = options;

    try {
      const ai = this.createClient();

      const img1 = {
        mimeType: extractMimeType(bottomImage),
        data: extractBase64Data(bottomImage)
      };
      const img2 = {
        mimeType: extractMimeType(topImage),
        data: extractBase64Data(topImage)
      };

      const blendPrompt = `
        Act as a world-class digital artist and photo editor.
        Task: Blend two images into a single cohesive artwork.

        Input:
        - Image 1: Background/Base layer.
        - Image 2: Foreground/Overlay layer.

        Style Direction: ${blendStyle}
        User Instructions: ${prompt}

        Guidelines:
        1. Analyze the lighting, perspective, and color grading of the background.
        2. Adapt the foreground subject to match the background environment.
           - Adjust shadows, highlights, and color temperature.
           - If "Seamless": Focus on photorealism, perfect shadow casting, and edge blending.
           - If "Double Exposure": Create an artistic overlay where the foreground texture fills the background silhouette or vice versa.
           - If "Glitch/Cyberpunk": Apply digital distortion, neon glows, and tech overlays merging the two.
           - If "Surreal": Blend them in a dream-like, physics-defying manner.
           - If "Splash Effect": Create a dynamic dispersion or fluid merge effect.
        3. Ensure high resolution and sharp details.

        Return ONLY the final blended image.
      `;

      const response = await ai.models.generateContent({
        model: this.getImageModel(),
        contents: {
          parts: [
            { inlineData: { mimeType: img1.mimeType, data: img1.data } },
            { inlineData: { mimeType: img2.mimeType, data: img2.data } },
            { text: blendPrompt }
          ]
        }
      });

      return this.extractImageFromResponse(response);
    } catch (error: any) {
      console.error("Gemini Image Blend Error:", error);
      throw new Error(error.message || "AI Blending failed");
    }
  }

  /**
   * 移除背景
   */
  async removeBackground(image: string): Promise<string> {
    return this.editImage({
      image,
      prompt: "Remove the background from this image. Keep the main subject exactly as is, but make the background transparent. Return ONLY the image with transparent background."
    });
  }

  /**
   * 从响应中提取图像
   */
  private extractImageFromResponse(response: any): string {
    const candidate = response.candidates?.[0];

    if (!candidate) {
      throw new Error("No candidates returned from the model.");
    }

    if (candidate.finishReason === 'SAFETY') {
      throw new Error("The request was blocked due to safety settings.");
    }

    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      for (const part of candidate.content.parts) {
        if (part.text) {
          throw new Error(`Model Refusal: ${part.text}`);
        }
      }
    }

    throw new Error(`No image returned. Finish Reason: ${candidate.finishReason}`);
  }
}

/**
 * 创建 Gemini 服务实例
 */
export function createGeminiService(): GeminiService {
  return new GeminiService();
}

