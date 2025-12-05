/**
 * AI 服务统一入口
 * 所有 AI API 调用都通过 Wails 后端代理
 * 前端不再直接调用 AI API，确保 API Key 安全
 */

import {
  GenerateImage,
  EditImage,
  RemoveBackground,
  BlendImages,
  EnhancePrompt
} from '../../../wailsjs/go/core/App';

// 导出类型定义
export * from './types';

// ==================== 服务工厂 ====================

/**
 * 获取 AI 服务实例（工厂方法）
 * 返回一个代理对象，所有方法都调用 Wails 后端
 */
export function getAIService(): {
  enhancePrompt: typeof enhancePrompt;
  generateImage: typeof generateImageFromText;
  editImage: typeof editImageWithAI;
  removeBackground: typeof removeBackgroundWithAI;
  blendImages: typeof blendImagesWithAI;
} {
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
  // 后端管理客户端生命周期，前端无需缓存
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
 * @param sketchImage 草图图像（可选）
 * @param imageSize 图像尺寸等级
 * @param aspectRatio 宽高比
 * @returns 生成的图像（base64 格式）
 */
export const generateImageFromText = async (
  prompt: string,
  referenceImage?: string,
  sketchImage?: string,
  imageSize: '1K' | '2K' | '4K' = '1K',
  aspectRatio: '1:1' | '16:9' | '9:16' | '3:4' | '4:3' = '1:1'
): Promise<string> => {
  const params = {
    prompt,
    referenceImage,
    sketchImage,
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
 * 多图融合
 * @param images 图像数组（base64 格式），按图层顺序排列（下层到上层）
 * @param userPrompt 用户提示词（可选）
 * @param blendStyle 融合风格
 * @returns 融合后的图像（base64 格式）
 */
export const blendImagesWithAI = async (
  images: string[],
  userPrompt: string = "",
  blendStyle: string = "Seamless"
): Promise<string> => {
  if (images.length < 2) {
    throw new Error('At least 2 images are required for blending');
  }

  const params = {
    images,
    prompt: userPrompt,
    style: blendStyle,
  };

  try {
    return await BlendImages(JSON.stringify(params));
  } catch (error) {
    console.error('多图融合失败:', error);
    throw error;
  }
};

/**
 * 移除背景
 * 优先使用本地 Transformer.js 模型，失败时回退到远程 API 服务
 * @param base64Image 原始图像（base64 格式或 data URL）
 * @returns 移除背景后的图像（base64 格式的 data URL，如 data:image/png;base64,...）
 */
export const removeBackgroundWithAI = async (base64Image: string): Promise<string> => {
  // 优先尝试使用本地 Transformer.js 背景移除
  try {
    const { removeBackground, checkBackgroundRemovalReady } = await import('../backgroundRemovalService');
    
    if (checkBackgroundRemovalReady()) {
      console.log('[AIService] 尝试使用本地 Transformer.js 进行背景移除...');
      try {
        const result = await removeBackground(base64Image);
        console.log('[AIService] 本地 Transformer.js 背景移除成功');
        // 返回 dataUrl（格式：data:image/png;base64,...）
        return result.dataUrl;
      } catch (localProcessError) {
        // 本地处理失败，回退到远程 API
        console.warn('[AIService] 本地 Transformer.js 处理失败，回退到远程 API:', localProcessError);
        throw localProcessError; // 抛出错误以触发回退逻辑
      }
    } else {
      console.log('[AIService] 本地 Transformer.js 不可用，使用远程 API');
    }
  } catch (localError) {
    // 本地服务不可用或初始化失败，回退到远程 API
    console.warn('[AIService] 本地 Transformer.js 服务不可用，回退到远程 API:', localError);
  }

  // 回退到远程 API 服务
  try {
    console.log('[AIService] 使用远程 API 进行背景移除');
    const remoteResult = await RemoveBackground(base64Image);
    
    // 确保返回格式一致：如果远程 API 返回的是纯 base64，转换为 data URL
    if (remoteResult && !remoteResult.startsWith('data:')) {
      // 假设远程 API 返回的是 PNG 格式的 base64
      return `data:image/png;base64,${remoteResult}`;
    }
    
    return remoteResult;
  } catch (error) {
    console.error('[AIService] 远程 API 背景移除失败:', error);
    throw error;
  }
};

