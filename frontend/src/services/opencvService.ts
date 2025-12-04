/**
 * OpenCV 图片处理服务
 * 提供基于 OpenCV.js 的图像处理功能
 * - 九宫格切割（3x3 Grid）
 * - 智能元素提取（Smart Extraction）- 使用 Transformer 背景移除 + OpenCV 处理
 */

import { GridSlice, ProcessMode, SmartExtractParams, DEFAULT_SMART_PARAMS } from '@/types';
import { removeBackground, checkBackgroundRemovalReady } from './backgroundRemovalService';

// Declare cv on window interface as it is loaded via script tag
declare global {
  interface Window {
    cv: any;
  }
}

/**
 * Checks if OpenCV is ready
 */
export const checkOpenCVReady = (): boolean => {
  return typeof window.cv !== 'undefined' && window.cv.Mat;
};

/**
 * 从 URL 加载图片到 HTMLImageElement
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

/**
 * 将 OpenCV Mat 转换为 GridSlice 数据
 */
const matToSlice = async (mat: any, id: number): Promise<GridSlice> => {
  const cv = window.cv;
  const canvas = document.createElement('canvas');
  cv.imshow(canvas, mat);
  const dataUrl = canvas.toDataURL('image/png'); // PNG 支持透明通道
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return {
    id,
    dataUrl,
    blob,
    width: mat.cols,
    height: mat.rows
  };
};

/**
 * 模式 1：九宫格切割
 * 将图片中心裁剪为正方形后分割成 3x3 的 9 等份
 */
const processGridSplit = async (src: any): Promise<GridSlice[]> => {
  const cv = window.cv;
  // 计算中心正方形裁剪区域
  const rows = src.rows;
  const cols = src.cols;
  const size = Math.min(rows, cols);
  const x = Math.floor((cols - size) / 2);
  const y = Math.floor((rows - size) / 2);

  // 裁剪图片为正方形
  const rect = new cv.Rect(x, y, size, size);
  const cropped = src.roi(rect);
  
  const stepX = Math.floor(size / 3);
  const stepY = Math.floor(size / 3);
  const slices: GridSlice[] = [];

  try {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const currentX = col * stepX;
        const currentY = row * stepY;
        // 最后一行/列处理边缘像素
        const currentWidth = (col === 2) ? (size - currentX) : stepX;
        const currentHeight = (row === 2) ? (size - currentY) : stepY;

        const cellRect = new cv.Rect(currentX, currentY, currentWidth, currentHeight);
        const cellMat = cropped.roi(cellRect);

        const slice = await matToSlice(cellMat, row * 3 + col);
        slices.push(slice);

        cellMat.delete();
      }
    }
  } finally {
    cropped.delete();
  }

  return slices;
};

/**
 * 模式 2：智能元素提取（重构版）
 * 结合 Transformer 背景移除和 OpenCV 处理
 * 工作流程：
 * 1. 使用 RMBG 模型进行背景移除，输出 RGBA 图像
 * 2. 从 RGBA 图像中提取 Alpha 通道
 * 3. 对 Alpha 通道应用形态学操作（膨胀或腐蚀）
 * 4. 使用 OpenCV findContours 检测所有独立的白色区域
 * 5. 为每个检测到的轮廓计算边界矩形，并裁剪原图
 */
const processSmartExtraction = async (
  imageSrc: string,
  params: SmartExtractParams = DEFAULT_SMART_PARAMS
): Promise<GridSlice[]> => {
  const cv = window.cv;
  const slices: GridSlice[] = [];

  try {
    // Step 1: 使用 Transformer 背景移除获取 RGBA 图像
    if (!checkBackgroundRemovalReady()) {
      throw new Error('背景移除服务不可用');
    }

    const bgRemovalResult = await removeBackground(imageSrc);

    // Step 2: 加载 RGBA 图像到 OpenCV Mat
    const rgbaImage = await loadImage(bgRemovalResult.dataUrl);
    const rgbaMat = cv.imread(rgbaImage);

    try {
      // Step 3: 提取 Alpha 通道
      const channels = new cv.MatVector();
      cv.split(rgbaMat, channels);
      
      // Alpha 通道通常是第 4 个通道（索引 3）
      let alphaChannel: any;
      if (channels.size() >= 4) {
        alphaChannel = channels.get(3);
      } else {
        // 如果没有 Alpha 通道，创建一个全白的通道（表示所有像素都是前景）
        alphaChannel = new cv.Mat.zeros(rgbaMat.rows, rgbaMat.cols, cv.CV_8UC1);
        alphaChannel.setTo(new cv.Scalar(255));
      }

      // Step 4: 形态学操作
      // 确保内核大小为奇数
      const kSize = Math.max(3, (Math.floor(params.morphKernelSize) % 2 === 0) 
        ? params.morphKernelSize + 1 
        : params.morphKernelSize);
      const kernel = cv.Mat.ones(kSize, kSize, cv.CV_8U);
      
      const morphResult = new cv.Mat();
      
      // 膨胀操作：分离连接的阴影或合并碎片对象
      cv.dilate(alphaChannel, morphResult, kernel, new cv.Point(-1, -1), 1);
      
      // 闭运算连接对象内部的空隙
      cv.morphologyEx(morphResult, morphResult, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1);

      // Step 5: 轮廓检测
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      
      // 二值化 Alpha 通道（确保是二值图像）
      const binary = new cv.Mat();
      cv.threshold(morphResult, binary, 127, 255, cv.THRESH_BINARY);
      
      // 查找轮廓（只查找外部轮廓）
      const approxMethod = params.useDetailedContours 
        ? cv.CHAIN_APPROX_NONE 
        : cv.CHAIN_APPROX_SIMPLE;
      cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, approxMethod);

      // Step 6: 过滤和裁剪
      const totalArea = rgbaMat.rows * rgbaMat.cols;
      const minArea = totalArea * params.minAreaRatio;
      
      // 收集有效的边界矩形
      const validRects: Array<{ rect: any; area: number; index: number }> = [];

      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area > minArea) {
          const rect = cv.boundingRect(contour);
          
          // 宽高比过滤
          const aspect = rect.width / rect.height;
          if (aspect >= params.minAspectRatio && aspect <= params.maxAspectRatio) {
            validRects.push({ rect, area, index: i });
          }
        }
        contour.delete();
      }

      // 按面积降序排序
      validRects.sort((a, b) => b.area - a.area);
      
      // 限制最多 20 个结果
      const topRects = validRects.slice(0, 20);

      // Step 7: 裁剪原图
      // 注意：这里我们需要从原始图像（imageSrc）裁剪，而不是从 RGBA 图像裁剪
      // 因为用户可能想要保留原始图像质量
      const originalImage = await loadImage(imageSrc);
      const originalMat = cv.imread(originalImage);

      try {
        for (let i = 0; i < topRects.length; i++) {
          const { rect } = topRects[i];
          
          // 添加边距
          const padding = 5;
          const xPos = Math.max(0, rect.x - padding);
          const yPos = Math.max(0, rect.y - padding);
          const w = Math.min(originalMat.cols - xPos, rect.width + (padding * 2));
          const h = Math.min(originalMat.rows - yPos, rect.height + (padding * 2));

          const roiRect = new cv.Rect(xPos, yPos, w, h);
          
          // 裁剪原图
          const croppedMat = originalMat.roi(roiRect);
          
          // 裁剪对应的处理后的 Alpha 通道（使用形态学操作后的结果）
          const croppedAlphaRect = new cv.Rect(xPos, yPos, w, h);
          const croppedAlpha = morphResult.roi(croppedAlphaRect);
          
          // 将 Alpha 通道合并到裁剪后的图像
          const croppedChannels = new cv.MatVector();
          cv.split(croppedMat, croppedChannels);
          
          // 如果原图是 RGB（3 通道），添加 Alpha；如果是 RGBA（4 通道），替换 Alpha
          if (croppedChannels.size() === 3) {
            croppedChannels.push_back(croppedAlpha);
          } else if (croppedChannels.size() === 4) {
            const oldAlpha = croppedChannels.get(3);
            oldAlpha.delete();
            croppedChannels.set(3, croppedAlpha);
          }
          
          const resultMat = new cv.Mat();
          cv.merge(croppedChannels, resultMat);
          
          const slice = await matToSlice(resultMat, i);
          slices.push(slice);
          
          // 清理
          croppedMat.delete();
          croppedAlpha.delete();
          croppedChannels.delete();
          resultMat.delete();
        }
      } finally {
        originalMat.delete();
      }

      if (slices.length === 0) {
        // 如果没有找到轮廓，返回整张图片作为单个切片
        const fullSlice = await matToSlice(rgbaMat, 0);
        slices.push(fullSlice);
      }

      // 清理
      channels.delete();
      alphaChannel.delete();
      kernel.delete();
      morphResult.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();
    } finally {
      rgbaMat.delete();
    }

    return slices;
  } catch (error) {
    console.error('[OpenCVService] 智能元素提取失败:', error);
    throw error;
  }
};


/**
 * 主处理路由
 * @param imageSrc 图片源（base64 或 URL）
 * @param mode 处理模式
 * @param smartParams 智能提取参数（仅在 SMART_EXTRACT 模式下使用）
 */
export const processImage = async (
  imageSrc: string, 
  mode: ProcessMode, 
  smartParams?: SmartExtractParams
): Promise<GridSlice[]> => {
  const cv = window.cv;
  
  // 智能切割模式：使用 Transformer 背景移除 + OpenCV 处理
  if (mode === ProcessMode.SMART_EXTRACT) {
    // processSmartExtraction 已经集成了 Transformer 背景移除和 OpenCV 处理
    try {
      return await processSmartExtraction(imageSrc, smartParams);
    } catch (err) {
      console.error("[OpenCVService] 智能元素提取错误:", err);
      throw err;
    }
  }
  
  // 九宫格模式：使用 OpenCV
  const imgElement = await loadImage(imageSrc);
  const src = cv.imread(imgElement);
  try {
    return await processGridSplit(src);
  } catch (err) {
    console.error("OpenCV 处理错误:", err);
    throw err;
  } finally {
    src.delete();
  }
};
