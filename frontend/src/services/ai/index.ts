/**
 * AI 服务统一入口
 * 现在使用 Wails 后端代理所有 AI API 调用
 * 保持与原有 API 的兼容性
 */

import {
  GenerateImage,
  EditImage,
  RemoveBackground,
  BlendImages,
  EnhancePrompt
} from '../../../wailsjs/go/core/App';

// 导出类型（保持兼容性）
export * from './types';
export { GeminiService } from './geminiService';
export { OpenAIService } from './openaiService';

// ==================== 服务工厂（保持兼容性）====================

/**
 * 获取 AI 服务实例（工厂方法）
 * 注意：现在所有调用都通过 Wails 后端，这个函数保留仅为兼容性
 */
export function getAIService(provider?: string): any {
  // 返回一个代理对象，所有方法都调用 Wails 后端
  return {
    enhancePrompt: enhancePrompt,
    generateImage: generateImageFromText,
    editImage: editImageWithAI,
    removeBackground: removeBackgroundWithAI,
    blendImages: blendImagesWithAI,
  };
}

/**
 * 清除服务实例缓存（保留兼容性，实际不需要）
 */
export function clearServiceCache(): void {
  // 不需要做任何事，因为没有缓存
}

// ==================== 主要服务函数 ====================
// 所有函数现在都通过 Wails 后端调用

/**
 * 增强提示词
 * @param originalPrompt 原始提示词
 * @returns 增强后的提示词
 */
export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    return await EnhancePrompt(originalPrompt);
  } catch (error) {
    console.error('增强提示词失败:', error);
    throw error;
  }
};

/**
 * 文本生成图像
 * @param prompt 生成提示词
 * @param referenceImage 参考图像（可选）
 * @param imageSize 图像尺寸等级
 * @param aspectRatio 宽高比
 * @returns 生成的图像（base64 格式）
 */
export const generateImageFromText = async (
  prompt: string,
  referenceImage?: string,
  imageSize: '1K' | '2K' | '4K' = '1K',
  aspectRatio: '1:1' | '16:9' | '9:16' | '3:4' | '4:3' = '1:1'
): Promise<string> => {
  const params = {
    prompt,
    referenceImage,
    imageSize,
    aspectRatio,
  };

  try {
    return await GenerateImage(JSON.stringify(params));
  } catch (error) {
    console.error('生成图像失败:', error);
    throw error;
  }
};

/**
 * 编辑图像
 * @param base64Image 原始图像（base64 格式）
 * @param prompt 编辑提示词
 * @returns 编辑后的图像（base64 格式）
 */
export const editImageWithAI = async (base64Image: string, prompt: string): Promise<string> => {
  const params = {
    imageData: base64Image,
    prompt,
  };

  try {
    return await EditImage(JSON.stringify(params));
  } catch (error) {
    console.error('编辑图像失败:', error);
    throw error;
  }
};

/**
 * 融合图像
 * @param base64Bottom 底层图像（base64 格式）
 * @param base64Top 顶层图像（base64 格式）
 * @param userPrompt 用户提示词
 * @param blendStyle 融合风格
 * @returns 融合后的图像（base64 格式）
 */
export const blendImagesWithAI = async (
  base64Bottom: string,
  base64Top: string,
  userPrompt: string = "",
  blendStyle: string = "Seamless"
): Promise<string> => {
  const params = {
    bottomImage: base64Bottom,
    topImage: base64Top,
    prompt: userPrompt,
    style: blendStyle,
  };

  try {
    return await BlendImages(JSON.stringify(params));
  } catch (error) {
    console.error('混合图像失败:', error);
    throw error;
  }
};

/**
 * 移除背景
 * @param base64Image 原始图像（base64 格式）
 * @returns 移除背景后的图像（base64 格式）
 */
export const removeBackgroundWithAI = async (base64Image: string): Promise<string> => {
  try {
    return await RemoveBackground(base64Image);
  } catch (error) {
    console.error('移除背景失败:', error);
    throw error;
  }
};

