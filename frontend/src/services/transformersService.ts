/**
 * Transformers.js 图片处理服务
 * 使用 Hugging Face Transformers.js 和 RMBG-1.4 模型进行智能抠图
 * 提供比 OpenCV 更准确的背景移除和对象提取功能
 * 
 * 使用 Web Worker 在后台线程中执行，避免阻塞主线程
 * 
 * 架构说明：
 * - 所有模型文件必须先下载到后端存储
 * - 前端通过 /models/{modelId}/ 路径从后端模型服务器获取模型文件
 * - 消除了 "远程" vs "本地" 模型的区分
 */

import { GridSlice } from '@/types';
import {
  GetModelStatus,
  DownloadModel,
  GetModelConfig,
  GetModelBaseURL,
  GetAvailableModels,
  DownloadModelFromHF,
  GetDownloadConfig,
  SetDownloadConfig
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
      modelBaseUrl: modelBaseUrl, // 模型服务器的完整 URL（由后端动态分配端口）
      useQuantized: config.useQuantized,
      exists: config.exists,
    };
  } catch (error) {
    console.warn('[TransformersService] 无法从后端获取模型配置，使用默认配置:', error);
  }
  
  // 默认配置（注意：modelBaseUrl 为空会导致模型加载失败，需要确保后端正常启动）
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
      // 配置已更改，更新 Worker
      console.log('[TransformersService] 检测到模型配置更改，更新 Worker...');
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

  // 获取模型配置
  const modelConfig = await getModelConfig();
  
  // 检查模型服务器 URL 是否有效
  if (!modelConfig.modelBaseUrl) {
    throw new Error('模型服务器未启动。请重启应用程序。');
  }
  
  // 检查模型是否已下载
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
      // 创建 Worker，使用 Vite 的 ?worker 后缀
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
        console.error('[TransformersService] Worker 错误:', error);
        worker = null;
        workerReady = false;
        workerInitPromise = null;
        reject(error);
      };

      // 发送初始化消息（包含配置）
      worker.postMessage({ 
        type: 'INIT',
        modelConfig: currentModelConfig,
      });
    } catch (error) {
      console.error('[TransformersService] 创建 Worker 失败:', error);
      worker = null;
      workerReady = false;
      workerInitPromise = null;
      reject(error);
    }
  });

  return workerInitPromise;
};

/**
 * 将 Worker 返回的数据转换为 GridSlice
 */
const convertWorkerSliceToGridSlice = async (workerSlice: any): Promise<GridSlice> => {
  // Worker 返回的 blob 是 ArrayBuffer，需要转换为 Blob
  const blob = workerSlice.blob instanceof ArrayBuffer
    ? new Blob([workerSlice.blob], { type: 'image/png' })
    : workerSlice.blob;

  return {
    id: workerSlice.id,
    dataUrl: workerSlice.dataUrl,
    blob,
    width: workerSlice.width,
    height: workerSlice.height,
  };
};

/**
 * 使用 RMBG-1.4 模型进行智能对象提取（使用 Web Worker）
 * @param imageSrc 图片源（base64 或 URL）
 * @param minAreaRatio 最小面积比例（相对于整图面积）
 * @param onProgress 进度回调函数（可选）
 * @returns 提取的对象切片数组
 */
export const processSmartExtractionWithTransformers = async (
  imageSrc: string,
  minAreaRatio: number = 0.001,
  onProgress?: ProgressCallback
): Promise<GridSlice[]> => {
  try {
    console.log('[TransformersService] 开始处理图片（使用 Web Worker）...');

    // 初始化 Worker
    await initWorker();

    if (!worker) {
      throw new Error('Worker 初始化失败');
    }

    // 设置消息处理器
    return new Promise<GridSlice[]>((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const { type, stage, progress, slices, error } = event.data;

        if (type === 'PROGRESS') {
          // 调用进度回调
          if (onProgress && stage && progress !== undefined) {
            onProgress(stage, progress);
          }
        } else if (type === 'SUCCESS') {
          // 清理消息处理器
          worker!.removeEventListener('message', messageHandler);
          worker!.removeEventListener('error', errorHandler);

          // 转换 Worker 返回的切片数据
          Promise.all(
            slices.map((slice: any) => convertWorkerSliceToGridSlice(slice))
          )
            .then((gridSlices) => {
              console.log('[TransformersService] 处理完成，生成', gridSlices.length, '个切片');
              resolve(gridSlices);
            })
            .catch(reject);
        } else if (type === 'ERROR') {
          // 清理消息处理器
          worker!.removeEventListener('message', messageHandler);
          worker!.removeEventListener('error', errorHandler);

          console.error('[TransformersService] Worker 处理失败:', error);
          reject(new Error(error || '处理失败'));
        }
      };

      const errorHandler = (error: ErrorEvent) => {
        worker!.removeEventListener('message', messageHandler);
        worker!.removeEventListener('error', errorHandler);
        console.error('[TransformersService] Worker 错误:', error);
        reject(new Error(error.message || 'Worker 执行错误'));
      };

      worker.addEventListener('message', messageHandler);
      worker.addEventListener('error', errorHandler);

      // 发送处理请求
      worker.postMessage({
        type: 'PROCESS',
        imageSrc,
        minAreaRatio,
      });
    });
  } catch (error) {
    console.error('[TransformersService] 处理失败:', error);
    throw error;
  }
};

/**
 * 检查 transformers.js 是否可用
 * 检查 Web Worker 是否支持
 */
export const checkTransformersReady = (): boolean => {
  return typeof Worker !== 'undefined';
};

/**
 * 清理 Worker 资源
 */
export const cleanupTransformersWorker = (): void => {
  if (worker) {
    worker.postMessage({ type: 'TERMINATE' });
    worker.terminate();
    worker = null;
    workerReady = false;
    workerInitPromise = null;
    currentModelConfig = null;
  }
};

/**
 * 获取当前模型配置
 */
export const getCurrentModelConfig = async () => {
  return await getModelConfig();
};

/**
 * 获取可用的模型列表（带状态）
 */
export const getAvailableModels = async (): Promise<Array<{
  id: string;
  name: string;
  description: string;
  repoId: string;
  size: number;
  downloaded: boolean;
  isDownloading: boolean;
}>> => {
  try {
    const modelsJSON = await GetAvailableModels();
    return JSON.parse(modelsJSON);
  } catch (error) {
    console.error('[TransformersService] 获取可用模型列表失败:', error);
    return [];
  }
};

/**
 * 获取模型状态
 * @param modelId 模型 ID
 */
export const getModelStatus = async (modelId: string): Promise<{
  modelId: string;
  exists: boolean;
  isDownloading: boolean;
  path: string;
}> => {
  try {
    const statusJSON = await GetModelStatus(modelId);
    return JSON.parse(statusJSON);
  } catch (error) {
    console.error('[TransformersService] 获取模型状态失败:', error);
    throw error;
  }
};

/**
 * 下载模型（从 Hugging Face）
 * @param modelId 模型 ID
 */
export const downloadModel = async (modelId: string): Promise<void> => {
  try {
    await DownloadModel(modelId);
  } catch (error) {
    console.error('[TransformersService] 下载模型失败:', error);
    throw error;
  }
};

/**
 * 从 Hugging Face 下载模型（指定仓库）
 * @param modelId 本地模型 ID
 * @param repoId Hugging Face 仓库 ID
 */
export const downloadModelFromHF = async (modelId: string, repoId: string): Promise<void> => {
  try {
    await DownloadModelFromHF(modelId, repoId);
  } catch (error) {
    console.error('[TransformersService] 从 HuggingFace 下载模型失败:', error);
    throw error;
  }
};

/**
 * 切换模型
 * @param modelId 模型 ID
 */
export const switchModel = async (modelId: string): Promise<boolean> => {
  try {
    // 首先检查模型状态
    const status = await getModelStatus(modelId);
    
    // 如果模型未下载，提示下载
    if (!status.exists) {
      throw new Error(`模型 ${modelId} 尚未下载，请先下载模型`);
    }
    
    // 获取当前设置
    const { loadSettings, saveSettings } = await import('./settingsService');
    const settings = await loadSettings();
    
    // 更新设置
    const updatedSettings = {
      ...settings,
      app: {
        ...settings.app,
        transformers: {
          ...settings.app.transformers!,
          currentModelId: modelId,
        },
      },
    };
    
    // 保存设置
    await saveSettings(updatedSettings);
    
    // 更新 Worker 配置
    await updateModelConfig();
    
    console.log('[TransformersService] 已切换到模型:', modelId);
    return true;
  } catch (error) {
    console.error('[TransformersService] 切换模型失败:', error);
    throw error;
  }
};

/**
 * 更新模型配置（切换模型后调用）
 * 调用此函数后，下次处理时将使用新模型
 */
export const updateModelConfig = async (): Promise<void> => {
  const newConfig = await getModelConfig();
  
  const workerConfig = {
    modelId: newConfig.modelId,
    modelBaseUrl: newConfig.modelBaseUrl,
    useQuantized: newConfig.useQuantized,
  };
  
  if (worker && workerReady) {
    // 如果 Worker 已初始化，更新配置
    worker.postMessage({
      type: 'UPDATE_CONFIG',
      modelConfig: workerConfig,
    });
    currentModelConfig = workerConfig;
    console.log('[TransformersService] 模型配置已更新:', workerConfig);
  } else {
    // 如果 Worker 未初始化，更新当前配置（初始化时会使用）
    currentModelConfig = workerConfig;
  }
};

// ==================== 下载配置 ====================

/**
 * 下载配置接口
 */
export interface HFDownloadConfig {
  useMirror: boolean;   // 是否使用国内镜像 (hf-mirror.com)
  proxyUrl: string;     // 代理地址（可选）
  insecureSsl: boolean; // 是否跳过 SSL 验证
}

/**
 * 获取当前下载配置
 */
export const getDownloadConfig = async (): Promise<HFDownloadConfig> => {
  try {
    const configJSON = await GetDownloadConfig();
    return JSON.parse(configJSON);
  } catch (error) {
    console.error('[TransformersService] 获取下载配置失败:', error);
    // 返回默认配置
    return {
      useMirror: true,
      proxyUrl: '',
      insecureSsl: false,
    };
  }
};

/**
 * 设置下载配置
 */
export const setDownloadConfig = async (config: HFDownloadConfig): Promise<void> => {
  try {
    await SetDownloadConfig(JSON.stringify(config));
    console.log('[TransformersService] 下载配置已更新:', config);
  } catch (error) {
    console.error('[TransformersService] 设置下载配置失败:', error);
    throw error;
  }
};

