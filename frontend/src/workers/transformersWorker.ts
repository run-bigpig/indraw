/**
 * Transformers.js Web Worker
 * 在后台线程中执行图片处理，避免阻塞主线程
 * 
 * 模型文件从后端的模型服务器加载（/models/{modelId}/）
 */

import { pipeline, env } from '@huggingface/transformers';

// 模型配置（默认值，可通过消息更新）
let MODEL_ID = 'rmbg-1.4';
let MODEL_BASE_URL = ''; // 模型服务器 URL，由主线程通过 INIT/UPDATE_CONFIG 消息设置
let USE_QUANTIZED = true;
const TASK = 'image-segmentation';

// Worker 消息类型
type WorkerMessage = 
  | { type: 'INIT'; modelConfig?: { modelId: string; modelBaseUrl: string; useQuantized: boolean } }
  | { type: 'PROCESS'; imageSrc: string; minAreaRatio: number }
  | { type: 'UPDATE_CONFIG'; modelConfig: { modelId: string; modelBaseUrl: string; useQuantized: boolean } }
  | { type: 'TERMINATE' };

type WorkerResponse =
  | { type: 'PROGRESS'; stage: string; progress: number }
  | { type: 'SUCCESS'; slices: any[] }
  | { type: 'ERROR'; error: string };

// 配置 transformers.js 环境
// 注意：localModelPath 会在 INIT 消息中动态设置为后端模型服务器的 URL
// 禁用从 Hugging Face Hub 加载，只使用我们的模型服务器
env.allowRemoteModels = false;
env.allowLocalModels = true;

if (typeof env !== 'undefined' && env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = true;
}

/**
 * 更新 env.localModelPath 为模型服务器 URL
 */
const updateLocalModelPath = () => {
  if (MODEL_BASE_URL) {
    env.localModelPath = MODEL_BASE_URL;
  }
};

// 全局 pipeline 实例
let segmentationPipeline: any = null;
let isLoadingModel = false;

/**
 * 发送进度更新
 */
const sendProgress = (stage: string, progress: number) => {
  self.postMessage({
    type: 'PROGRESS',
    stage,
    progress,
  } as WorkerResponse);
};

/**
 * 检查模型是否可用（从后端模型服务器）
 */
const checkModelAvailable = async (): Promise<boolean> => {
  // 检查 MODEL_BASE_URL 是否已设置
  if (!MODEL_BASE_URL) {
    console.error('[TransformersWorker] MODEL_BASE_URL 未设置');
    return false;
  }
  
  try {
    // 检查 config.json 是否可访问（表示模型已下载）
    const modelUrl = `${MODEL_BASE_URL}${MODEL_ID}/config.json`;
    const response = await fetch(modelUrl, {
      method: 'HEAD',
      cache: 'no-cache',
    });
    return response.ok;
  } catch (error) {
    console.error('[TransformersWorker] 检查模型可用性失败:', error);
    return false;
  }
};

/**
 * 初始化并获取 segmentation pipeline
 * 模型从后端服务器加载（所有模型必须先下载到后端）
 */
const getPipeline = async (): Promise<any> => {
  if (segmentationPipeline) {
    return segmentationPipeline;
  }

  if (isLoadingModel) {
    while (isLoadingModel) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (segmentationPipeline) {
      return segmentationPipeline;
    }
  }

  isLoadingModel = true;
  sendProgress('正在加载模型...', 0.1);

  // 配置选项：根据配置决定是否使用量化模型
  const pipelineOptions = USE_QUANTIZED
    ? { dtype: 'q8' as const }
    : {};

  try {
    // 检查模型是否可用
    const modelAvailable = await checkModelAvailable();
    
    if (!modelAvailable) {
      throw new Error(`模型未下载或不可用: ${MODEL_ID}。请先在设置中下载模型。`);
    }
    
    sendProgress('正在加载模型...', 0.3);

    // 设置 localModelPath 为我们的模型服务器 URL
    updateLocalModelPath();

    // 从后端模型服务器加载模型
    // Transformers.js 会在 env.localModelPath 下查找模型 ID 对应的目录
    // 使用模型 ID 加载，Transformers.js 会使用 env.localModelPath + MODEL_ID
    segmentationPipeline = await pipeline(TASK, MODEL_ID, pipelineOptions);
    sendProgress('模型加载完成', 0.5);
    return segmentationPipeline;
  } catch (error: any) {
    console.error('[TransformersWorker] 模型加载失败:', error);
    
    // 如果量化模型加载失败，尝试回退到非量化模型
    if (USE_QUANTIZED && error?.message?.includes('quantized')) {
      console.warn('[TransformersWorker] 量化模型不可用，尝试非量化模型...');
      try {
        segmentationPipeline = await pipeline(TASK, MODEL_ID);
        sendProgress('模型加载完成', 0.5);
        return segmentationPipeline;
      } catch (fallbackError) {
        isLoadingModel = false;
        throw fallbackError;
      }
    }
    
    isLoadingModel = false;
    throw error;
  } finally {
    isLoadingModel = false;
  }
};

/**
 * 将 ImageData 转换为 GridSlice
 */
const imageDataToSlice = async (
  imageData: ImageData,
  id: number
): Promise<any> => {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法获取 canvas 上下文');
  }
  ctx.putImageData(imageData, 0, 0);
  
  // 使用 convertToBlob 获取 Blob
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const arrayBuffer = await blob.arrayBuffer();
  
  // 将 ArrayBuffer 转换为 base64
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  const dataUrl = `data:image/png;base64,${base64}`;

  return {
    id,
    dataUrl,
    blob: arrayBuffer, // 在 Worker 中传递 ArrayBuffer
    width: imageData.width,
    height: imageData.height,
  };
};

/**
 * 将各种格式的 mask 转换为 ImageData
 */
const convertMaskToImageData = async (
  maskData: any,
  width: number,
  height: number
): Promise<ImageData> => {
  if (maskData instanceof ImageData) {
    return maskData;
  }

  if (maskData && maskData.data && maskData.dims) {
    const [h, w] = maskData.dims;
    const actualWidth = w || width;
    const actualHeight = h || height;
    const imageData = new ImageData(actualWidth, actualHeight);
    const maskArray = maskData.data;

    for (let i = 0; i < maskArray.length; i++) {
      // 对于 Float32Array，值通常在 0-1 之间；对于 Uint8Array，值在 0-255 之间
      let value: number;
      if (maskArray[i] > 1) {
        // Uint8Array 格式，值在 0-255 之间
        value = maskArray[i] > 127 ? 255 : 0;
      } else {
        // Float32Array 格式，值在 0-1 之间
        value = maskArray[i] > 0.5 ? 255 : 0;
      }
      imageData.data[i * 4] = value;
      imageData.data[i * 4 + 1] = value;
      imageData.data[i * 4 + 2] = value;
      imageData.data[i * 4 + 3] = 255;
    }
    return imageData;
  }

  if (maskData instanceof Float32Array || maskData instanceof Uint8Array) {
    const imageData = new ImageData(width, height);
    
    // 检查长度是否匹配
    const expectedLength = width * height;
    if (maskData.length !== expectedLength) {
      console.warn(`[TransformersWorker] 遮罩数组长度不匹配: 期望 ${expectedLength}, 实际 ${maskData.length}`);
    }

    for (let i = 0; i < Math.min(maskData.length, expectedLength); i++) {
      let value: number;
      if (maskData instanceof Float32Array) {
        // Float32Array，值在 0-1 之间
        value = maskData[i] > 0.5 ? 255 : 0;
      } else {
        // Uint8Array，值在 0-255 之间
        value = maskData[i] > 127 ? 255 : 0;
      }
      const pixelIndex = i * 4;
      imageData.data[pixelIndex] = value;
      imageData.data[pixelIndex + 1] = value;
      imageData.data[pixelIndex + 2] = value;
      imageData.data[pixelIndex + 3] = 255;
    }
    return imageData;
  }

  if (maskData && maskData.data && maskData.width && maskData.height) {
    const w = maskData.width;
    const h = maskData.height;
    const imageData = new ImageData(w, h);
    const data = maskData.data;

    // 检查原始数据的实际值范围
    let rawMin = Infinity;
    let rawMax = -Infinity;
    const sampleCount = Math.min(data.length, 1000);
    for (let i = 0; i < sampleCount; i++) {
      const val = data[i];
      rawMin = Math.min(rawMin, val);
      rawMax = Math.max(rawMax, val);
    }

    if (data.length === w * h * 4) {
      // 对于 RGBA 格式，通常 alpha 通道或某个通道包含遮罩信息
      // 检查是否所有通道值都相同（可能是灰度图）
      const isGrayscale = data[0] === data[1] && data[1] === data[2];
      
      if (isGrayscale) {
        // 如果是灰度图，使用 R 通道，并可能需要反转
        // 通常分割模型的遮罩：0=背景（透明），255=前景（保留）
        // 但如果全是 255，可能需要反转
        const needsInvert = rawMin > 200; // 如果最小值都很大，可能需要反转
        
        for (let i = 0; i < w * h; i++) {
          let value = data[i * 4]; // 使用 R 通道
          if (needsInvert) {
            value = 255 - value; // 反转遮罩
          }
          imageData.data[i * 4] = value;
          imageData.data[i * 4 + 1] = value;
          imageData.data[i * 4 + 2] = value;
          imageData.data[i * 4 + 3] = 255;
        }
      } else {
        // 使用 alpha 通道或 R 通道
        const useAlpha = true; // 尝试使用 alpha 通道
        for (let i = 0; i < w * h; i++) {
          const value = useAlpha ? data[i * 4 + 3] : data[i * 4];
          imageData.data[i * 4] = value;
          imageData.data[i * 4 + 1] = value;
          imageData.data[i * 4 + 2] = value;
          imageData.data[i * 4 + 3] = 255;
        }
      }
    } else if (data.length === w * h) {
      // 检查是否需要反转遮罩
      // 如果最小值都很大（接近255），说明遮罩可能是反的（255=背景，0=前景）
      const needsInvert = rawMin > 200 && rawMax > 200; // 如果值都很大，可能需要反转
      
      for (let i = 0; i < data.length; i++) {
        let value = data[i];
        let binaryValue: number;
        
        // 检查值是否在 0-1 范围内（可能是归一化的浮点数）
        if (value <= 1.0 && value >= 0.0 && value !== Math.floor(value)) {
          // 0-1 范围的浮点数：直接二值化，阈值 0.5
          // 如果值 > 0.5，表示前景（255），否则背景（0）
          binaryValue = value > 0.5 ? 255 : 0;
        } else {
          // 0-255 范围的整数：先处理反转，再二值化
          if (needsInvert) {
            value = 255 - value;
          }
          // 二值化：大于 127 的为 255（前景），否则为 0（背景）
          binaryValue = value > 127 ? 255 : 0;
        }
        
        imageData.data[i * 4] = binaryValue;
        imageData.data[i * 4 + 1] = binaryValue;
        imageData.data[i * 4 + 2] = binaryValue;
        imageData.data[i * 4 + 3] = 255;
      }
    } else {
      console.warn(`[TransformersWorker] 遮罩数据长度不匹配: 期望 ${w * h} 或 ${w * h * 4}, 实际 ${data.length}`);
    }
    return imageData;
  }

  console.error('[TransformersWorker] 无法转换 mask 格式:', maskData);
  throw new Error(`无法转换 mask 格式: ${typeof maskData}`);
};

/**
 * 使用遮罩提取对象并创建透明背景的图片
 */
const applyMaskToImage = (
  imageData: ImageData,
  mask: ImageData | Float32Array | Uint8Array,
  threshold: number = 0.5
): ImageData => {
  const { width, height } = imageData;
  const result = new ImageData(width, height);
  const resultData = result.data;
  const imageDataArray = imageData.data;

  let maskData: Uint8Array;
  if (mask instanceof ImageData) {
    // 从 ImageData 中提取遮罩值
    // 对于灰度遮罩，RGB 通道值相同，直接使用第一个通道（R通道）
    // 注意：alpha 通道在 convertMaskToImageData 中总是设置为 255，所以不能使用 alpha
    maskData = new Uint8Array(mask.data.length / 4);
    for (let i = 0; i < mask.data.length; i += 4) {
      // 直接使用 R 通道（第一个通道），因为遮罩值存储在 RGB 通道中
      const r = mask.data[i];
      maskData[i / 4] = r;
    }
  } else if (mask instanceof Float32Array) {
    maskData = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) {
      maskData[i] = mask[i] > threshold ? 255 : 0;
    }
  } else {
    maskData = mask;
  }

  // 检查遮罩数据长度是否匹配
  const expectedLength = width * height;
  if (maskData.length !== expectedLength) {
    console.warn(`[TransformersWorker] 遮罩尺寸不匹配: 期望 ${expectedLength}, 实际 ${maskData.length}`);
    // 如果尺寸不匹配，尝试缩放或填充
    if (maskData.length < expectedLength) {
      // 遮罩太小，填充为 0
      const paddedMask = new Uint8Array(expectedLength);
      paddedMask.set(maskData);
      maskData = paddedMask;
    } else {
      // 遮罩太大，截取
      maskData = maskData.slice(0, expectedLength);
    }
  }

  // 应用遮罩
  const thresholdValue = threshold * 255;
  for (let i = 0; i < imageDataArray.length; i += 4) {
    const pixelIndex = i / 4;
    const maskValue = maskData[pixelIndex] ?? 0;
    // 如果遮罩值大于阈值，保留像素（alpha = 255），否则透明（alpha = 0）
    const alpha = maskValue > thresholdValue ? 255 : 0;

    resultData[i] = imageDataArray[i];
    resultData[i + 1] = imageDataArray[i + 1];
    resultData[i + 2] = imageDataArray[i + 2];
    resultData[i + 3] = alpha;
  }

  return result;
};

/**
 * 从分割结果中提取对象边界框
 */
const extractBoundingBoxes = (
  mask: ImageData | Float32Array | Uint8Array,
  width: number,
  height: number,
  minAreaRatio: number = 0.001
): Array<{ x: number; y: number; width: number; height: number; area: number }> => {
  const boxes: Array<{ x: number; y: number; width: number; height: number; area: number }> = [];

  let maskData: Uint8Array;
  let maskWidth = width;
  let maskHeight = height;

  if (mask instanceof ImageData) {
    maskWidth = mask.width;
    maskHeight = mask.height;
    maskData = new Uint8Array(maskWidth * maskHeight);
    for (let i = 0; i < mask.data.length; i += 4) {
      const pixelIndex = i / 4;
      maskData[pixelIndex] = mask.data[i + 3] || mask.data[i];
    }
  } else if (mask instanceof Float32Array) {
    maskData = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) {
      maskData[i] = mask[i] > 0.5 ? 255 : 0;
    }
  } else {
    maskData = mask;
  }

  const actualWidth = maskWidth;
  const actualHeight = maskHeight;
  const visited = new Set<number>();
  const minArea = actualWidth * actualHeight * minAreaRatio;

  for (let y = 0; y < actualHeight; y++) {
    for (let x = 0; x < actualWidth; x++) {
      const index = y * actualWidth + x;
      if (visited.has(index) || maskData[index] < 128) {
        continue;
      }

      const queue: number[] = [index];
      visited.add(index);
      let minX = x, maxX = x, minY = y, maxY = y;

      while (queue.length > 0) {
        const currentIndex = queue.shift()!;
        const currentX = currentIndex % actualWidth;
        const currentY = Math.floor(currentIndex / actualWidth);

        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        const neighbors = [
          currentIndex - actualWidth,
          currentIndex + actualWidth,
          currentIndex - 1,
          currentIndex + 1,
        ];

        for (const neighborIndex of neighbors) {
          const neighborX = neighborIndex % actualWidth;
          const neighborY = Math.floor(neighborIndex / actualWidth);

          if (
            neighborX >= 0 && neighborX < actualWidth &&
            neighborY >= 0 && neighborY < actualHeight &&
            neighborIndex >= 0 && neighborIndex < maskData.length &&
            !visited.has(neighborIndex) &&
            maskData[neighborIndex] >= 128
          ) {
            visited.add(neighborIndex);
            queue.push(neighborIndex);
          }
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const area = boxWidth * boxHeight;

      if (area >= minArea) {
        boxes.push({
          x: minX,
          y: minY,
          width: boxWidth,
          height: boxHeight,
          area,
        });
      }
    }
  }

  boxes.sort((a, b) => b.area - a.area);
  return boxes;
};

/**
 * 裁剪 ImageData 到指定区域
 */
const cropImageData = (
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): ImageData => {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法获取 canvas 上下文');
  }

  const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    throw new Error('无法获取源 canvas 上下文');
  }
  sourceCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(
    sourceCanvas,
    x, y, width, height,
    0, 0, width, height
  );

  return ctx.getImageData(0, 0, width, height);
};

/**
 * 缩放图片到最大尺寸（用于缩略图推理策略）
 * @param imageBitmap 原始图片
 * @param maxDimension 最大尺寸（宽或高），默认 1024px
 * @returns 缩放后的 ImageBitmap 和原始尺寸信息
 */
const resizeImageForInference = async (
  imageBitmap: ImageBitmap,
  maxDimension: number = 1024
): Promise<{ resizedBitmap: ImageBitmap; originalWidth: number; originalHeight: number; scale: number }> => {
  const originalWidth = imageBitmap.width;
  const originalHeight = imageBitmap.height;

  // 如果图片已经小于最大尺寸，直接返回
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return {
      resizedBitmap: imageBitmap,
      originalWidth,
      originalHeight,
      scale: 1.0,
    };
  }

  // 计算缩放比例
  const scale = Math.min(maxDimension / originalWidth, maxDimension / originalHeight);
  const newWidth = Math.round(originalWidth * scale);
  const newHeight = Math.round(originalHeight * scale);

  // 使用 OffscreenCanvas 缩放图片
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法获取 canvas 上下文');
  }

  ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
  const resizedBitmap = await createImageBitmap(canvas);

  return {
    resizedBitmap,
    originalWidth,
    originalHeight,
    scale,
  };
};

/**
 * 处理图片提取
 */
const processImage = async (imageSrc: string, minAreaRatio: number) => {
  sendProgress('正在加载图片...', 0.6);

  // 在 Worker 中加载图片为 ImageBitmap
  let imageBitmap: ImageBitmap;
  let imageWidth: number;
  let imageHeight: number;
  let originalWidth: number;
  let originalHeight: number;
  let scale: number = 1.0;

  try {
    // 如果是 base64，先转换为 Blob
    let blob: Blob;
    if (imageSrc.startsWith('data:')) {
      const response = await fetch(imageSrc);
      blob = await response.blob();
    } else {
      const response = await fetch(imageSrc);
      blob = await response.blob();
    }
    
    imageBitmap = await createImageBitmap(blob);
    originalWidth = imageBitmap.width;
    originalHeight = imageBitmap.height;

    // Step 3: 缩略图推理策略 - 将图片缩放到最大 1024px
    sendProgress('正在缩放图片以优化性能...', 0.62);
    const resizeResult = await resizeImageForInference(imageBitmap, 1024);
    imageBitmap = resizeResult.resizedBitmap;
    imageWidth = imageBitmap.width;
    imageHeight = imageBitmap.height;
    scale = resizeResult.scale;
  } catch (error) {
    console.error('[TransformersWorker] 图片加载失败:', error);
    throw new Error(`无法加载图片: ${error}`);
  }

  sendProgress('正在初始化模型...', 0.65);
  const pipe = await getPipeline();

  sendProgress('正在执行背景移除...', 0.7);
  // 使用缩放后的图片进行推理（缩略图推理策略）
  // 将 ImageBitmap 转换为可以传递给 pipeline 的格式
  let output: any;
  try {
    // 将 ImageBitmap 转换为 data URL 以便传递给 pipeline
    const canvas = new OffscreenCanvas(imageWidth, imageHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取 canvas 上下文');
    }
    ctx.drawImage(imageBitmap, 0, 0);
    
    // 转换为 Blob 然后转换为 data URL
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const resizedImageSrc = `data:image/png;base64,${base64}`;
    
    // 使用缩放后的图片进行推理
    output = await pipe(resizedImageSrc) as any;
  } catch (error: any) {
    console.error('[TransformersWorker] 推理失败:', error);
    throw error;
  }

  sendProgress('正在处理分割结果...', 0.8);

  // 获取缩放后图片的 ImageData（用于推理）
  const canvas = new OffscreenCanvas(imageWidth, imageHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法获取 canvas 上下文');
  }
  ctx.drawImage(imageBitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 如果需要，加载原始尺寸的图片用于最终输出
  // 注意：这里我们使用缩放后的图片进行推理，但最终输出会基于原始尺寸
  // 为了性能，我们使用缩放后的图片进行对象提取，然后在最终输出时可能需要放大

  // 处理分割结果
  let mask: ImageData | Float32Array | Uint8Array;

  if (Array.isArray(output)) {
    const firstMask = output[0];
    if (firstMask && (firstMask as any).mask) {
      const maskData = (firstMask as any).mask;
      mask = await convertMaskToImageData(maskData, imageWidth, imageHeight);
    } else if (firstMask instanceof ImageData) {
      mask = firstMask;
    } else if ((firstMask as any)?.data) {
      // 如果第一个元素本身就有 data 属性，可能它就是遮罩数据
      mask = await convertMaskToImageData(firstMask, imageWidth, imageHeight);
    } else {
      // 尝试直接使用第一个元素作为遮罩
      mask = await convertMaskToImageData(firstMask, imageWidth, imageHeight);
    }
  } else if (output && (output as any).mask) {
    const maskData = (output as any).mask;
    mask = await convertMaskToImageData(maskData, imageWidth, imageHeight);
  } else if (output instanceof ImageData) {
    mask = output;
  } else if ((output as any)?.data) {
    mask = await convertMaskToImageData(output, imageWidth, imageHeight);
  } else {
    const maskData = (output as any).data || output;
    if (maskData instanceof ImageData || maskData instanceof Float32Array || maskData instanceof Uint8Array) {
      mask = maskData;
    } else {
      console.error('[TransformersWorker] 无法解析分割结果格式，输出:', output);
      throw new Error(`无法解析分割结果格式`);
    }
  }

  sendProgress('正在提取对象...', 0.85);
  const boxes = extractBoundingBoxes(mask, imageData.width, imageData.height, minAreaRatio);

  if (boxes.length === 0) {
    const maskedImage = applyMaskToImage(imageData, mask);
    const slice = await imageDataToSlice(maskedImage, 0);
    return [slice];
  }

  sendProgress('正在生成切片...', 0.9);
  const slices: any[] = [];
  const padding = 5;

  for (let i = 0; i < Math.min(boxes.length, 20); i++) {
    const box = boxes[i];

    const x = Math.max(0, box.x - padding);
    const y = Math.max(0, box.y - padding);
    const w = Math.min(imageData.width - x, box.width + padding * 2);
    const h = Math.min(imageData.height - y, box.height + padding * 2);

    const croppedImage = cropImageData(imageData, x, y, w, h);
    const croppedMask = cropImageData(
      mask instanceof ImageData ? mask : new ImageData(
        new Uint8ClampedArray(mask as any),
        imageData.width,
        imageData.height
      ),
      x, y, w, h
    );

    const maskedImage = applyMaskToImage(croppedImage, croppedMask);
    const slice = await imageDataToSlice(maskedImage, i);
    slices.push(slice);
  }

  sendProgress('处理完成', 1.0);
  return slices;
};

// Worker 消息处理
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    if (message.type === 'INIT') {
      // 初始化时更新配置（如果提供）
      if (message.modelConfig) {
        MODEL_ID = message.modelConfig.modelId || MODEL_ID;
        MODEL_BASE_URL = message.modelConfig.modelBaseUrl || MODEL_BASE_URL;
        USE_QUANTIZED = message.modelConfig.useQuantized ?? USE_QUANTIZED;
        // 更新 env.localModelPath
        updateLocalModelPath();
      }
      sendProgress('初始化 Worker...', 0.0);
      self.postMessage({ type: 'SUCCESS', slices: [] } as WorkerResponse);
    } else if (message.type === 'UPDATE_CONFIG') {
      // 更新配置并重置 pipeline（下次使用时重新加载）
      const configChanged = 
        MODEL_ID !== message.modelConfig.modelId ||
        MODEL_BASE_URL !== message.modelConfig.modelBaseUrl ||
        USE_QUANTIZED !== message.modelConfig.useQuantized;
      
      MODEL_ID = message.modelConfig.modelId;
      MODEL_BASE_URL = message.modelConfig.modelBaseUrl;
      USE_QUANTIZED = message.modelConfig.useQuantized;
      // 更新 env.localModelPath
      updateLocalModelPath();
      
      // 只有配置变更时才重置 pipeline
      if (configChanged) {
        segmentationPipeline = null;
      }
      self.postMessage({ type: 'SUCCESS', slices: [] } as WorkerResponse);
    } else if (message.type === 'PROCESS') {
      const slices = await processImage(message.imageSrc, message.minAreaRatio);
      self.postMessage({ type: 'SUCCESS', slices } as WorkerResponse);
    } else if (message.type === 'TERMINATE') {
      self.close();
    }
  } catch (error: any) {
    self.postMessage({
      type: 'ERROR',
      error: error?.message || String(error),
    } as WorkerResponse);
  }
};

