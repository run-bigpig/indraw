/**
 * 背景移除服务
 * 提供可重用的 Transformer 背景移除（matting）功能
 * 使用 RMBG-1.4 模型进行智能背景移除，输出 RGBA 格式的透明背景图像
 */

import {
  GetModelStatus,
  GetModelConfig,
  GetModelBaseURL,
} from '../../wailsjs/go/core/App';

// 进度回调类型
export type ProgressCallback = (stage: string, progress: number) => void;

// Worker 实例管理
let worker: Worker | null = null;
let workerReady = false;
let workerInitPromise: Promise<void> | null = null;
let currentModelConfig: { modelId: string; modelBaseUrl: string; useQuantized: boolean } | null = null;

/**
 * 获取模型配置（从后端）
 */
const getModelConfig = async (): Promise<{ modelId: string; modelBaseUrl: string; useQuantized: boolean; exists: boolean }> => {
  try {
    const [configJSON, modelBaseUrl] = await Promise.all([
      GetModelConfig(),
      GetModelBaseURL(),
    ]);
    const config = JSON.parse(configJSON);
    
    return {
      modelId: config.modelId,
      modelBaseUrl: modelBaseUrl,
      useQuantized: config.useQuantized,
      exists: config.exists,
    };
  } catch (error) {
    console.warn('[BackgroundRemovalService] 无法从后端获取模型配置，使用默认配置:', error);
  }
  
  return {
    modelId: 'rmbg-1.4',
    modelBaseUrl: '',
    useQuantized: true,
    exists: false,
  };
};

/**
 * 初始化 Worker
 */
const initWorker = async (): Promise<void> => {
  if (workerReady && worker) {
    // 检查配置是否已更改
    const newConfig = await getModelConfig();
    if (currentModelConfig && 
        (currentModelConfig.modelId !== newConfig.modelId ||
         currentModelConfig.modelBaseUrl !== newConfig.modelBaseUrl ||
         currentModelConfig.useQuantized !== newConfig.useQuantized)) {
      console.log('[BackgroundRemovalService] 检测到模型配置更改，更新 Worker...');
      worker.postMessage({
        type: 'UPDATE_CONFIG',
        modelConfig: {
          modelId: newConfig.modelId,
          modelBaseUrl: newConfig.modelBaseUrl,
          useQuantized: newConfig.useQuantized,
        },
      });
      currentModelConfig = {
        modelId: newConfig.modelId,
        modelBaseUrl: newConfig.modelBaseUrl,
        useQuantized: newConfig.useQuantized,
      };
    }
    return Promise.resolve();
  }

  if (workerInitPromise) {
    return workerInitPromise;
  }

  const modelConfig = await getModelConfig();
  
  if (!modelConfig.modelBaseUrl) {
    throw new Error('模型服务器未启动。请重启应用程序。');
  }
  
  if (!modelConfig.exists) {
    throw new Error(`模型 ${modelConfig.modelId} 尚未下载。请先在设置中下载模型。`);
  }
  
  currentModelConfig = {
    modelId: modelConfig.modelId,
    modelBaseUrl: modelConfig.modelBaseUrl,
    useQuantized: modelConfig.useQuantized,
  };

  workerInitPromise = new Promise((resolve, reject) => {
    try {
      worker = new Worker(
        new URL('../workers/transformersWorker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event) => {
        const { type } = event.data;
        if (type === 'SUCCESS' && !workerReady) {
          workerReady = true;
          resolve();
        }
      };

      worker.onerror = (error) => {
        console.error('[BackgroundRemovalService] Worker 错误:', error);
        worker = null;
        workerReady = false;
        workerInitPromise = null;
        reject(error);
      };

      worker.postMessage({ 
        type: 'INIT',
        modelConfig: currentModelConfig,
      });
    } catch (error) {
      console.error('[BackgroundRemovalService] 创建 Worker 失败:', error);
      worker = null;
      workerReady = false;
      workerInitPromise = null;
      reject(error);
    }
  });

  return workerInitPromise;
};

/**
 * 背景移除结果
 */
export interface BackgroundRemovalResult {
  /** RGBA 格式的图像数据 URL */
  dataUrl: string;
  /** RGBA 格式的图像 Blob */
  blob: Blob;
  /** 图像宽度 */
  width: number;
  /** 图像高度 */
  height: number;
}

/**
 * 使用 RMBG 模型进行背景移除
 * @param imageSrc 图片源（base64 或 URL）
 * @param onProgress 进度回调函数（可选）
 * @returns RGBA 格式的透明背景图像
 */
export const removeBackground = async (
  imageSrc: string,
  onProgress?: ProgressCallback
): Promise<BackgroundRemovalResult> => {
  try {
    console.log('[BackgroundRemovalService] 开始背景移除...');

    await initWorker();

    if (!worker) {
      throw new Error('Worker 初始化失败');
    }

    return new Promise<BackgroundRemovalResult>((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const { type, stage, progress, result, error } = event.data;

        if (type === 'PROGRESS') {
          if (onProgress && stage && progress !== undefined) {
            onProgress(stage, progress);
          }
        } else if (type === 'REMOVE_BACKGROUND_SUCCESS') {
          worker!.removeEventListener('message', messageHandler);
          worker!.removeEventListener('error', errorHandler);

          // 转换 Worker 返回的结果
          const blob = result.blob instanceof ArrayBuffer
            ? new Blob([result.blob], { type: 'image/png' })
            : result.blob;

          console.log('[BackgroundRemovalService] 背景移除完成');
          resolve({
            dataUrl: result.dataUrl,
            blob,
            width: result.width,
            height: result.height,
          });
        } else if (type === 'ERROR') {
          worker!.removeEventListener('message', messageHandler);
          worker!.removeEventListener('error', errorHandler);

          console.error('[BackgroundRemovalService] Worker 处理失败:', error);
          reject(new Error(error || '处理失败'));
        }
      };

      const errorHandler = (error: ErrorEvent) => {
        worker!.removeEventListener('message', messageHandler);
        worker!.removeEventListener('error', errorHandler);
        console.error('[BackgroundRemovalService] Worker 错误:', error);
        reject(new Error(error.message || 'Worker 执行错误'));
      };

      worker.addEventListener('message', messageHandler);
      worker.addEventListener('error', errorHandler);

      // 发送背景移除请求
      worker.postMessage({
        type: 'REMOVE_BACKGROUND',
        imageSrc,
      });
    });
  } catch (error) {
    console.error('[BackgroundRemovalService] 处理失败:', error);
    throw error;
  }
};

/**
 * 检查背景移除服务是否可用
 */
export const checkBackgroundRemovalReady = (): boolean => {
  return typeof Worker !== 'undefined';
};

/**
 * 清理 Worker 资源
 */
export const cleanupBackgroundRemovalWorker = (): void => {
  if (worker) {
    worker.postMessage({ type: 'TERMINATE' });
    worker.terminate();
    worker = null;
    workerReady = false;
    workerInitPromise = null;
    currentModelConfig = null;
  }
};

