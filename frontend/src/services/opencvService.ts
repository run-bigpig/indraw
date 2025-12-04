/**
 * OpenCV 图片处理服务
 * 提供基于 OpenCV.js 的图像处理功能
 * - 九宫格切割（3x3 Grid）
 * - 智能元素提取（Smart Extraction）- 优先使用 Transformers.js + RMBG-1.4，失败时回退到 OpenCV
 */

import { GridSlice, ProcessMode, SmartExtractParams, DEFAULT_SMART_PARAMS } from '@/types';
import { processSmartExtractionWithTransformers, checkTransformersReady } from './transformersService';

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
 * 模式 2：智能元素提取（优化版）
 * 使用自适应阈值 + 形态学操作检测独立对象
 * 应用遮罩使背景透明
 */
const processSmartExtraction = async (src: any, params: SmartExtractParams = DEFAULT_SMART_PARAMS): Promise<GridSlice[]> => {
  const cv = window.cv;
  const slices: GridSlice[] = [];
  
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const binary = new cv.Mat();
  
  // 确保内核大小为奇数且有效
  const kSize = Math.max(3, (Math.floor(params.morphKernelSize) % 2 === 0) ? params.morphKernelSize + 1 : params.morphKernelSize);
  const kernel = cv.Mat.ones(kSize, kSize, cv.CV_8U); 
  
  const morph = new cv.Mat();
  const hierarchy = new cv.Mat();
  const contours = new cv.MatVector();

  // 创建全尺寸遮罩，初始化为零（透明）
  const fullMask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);

  try {
    // 1. 预处理：灰度化 + 高斯模糊
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    // 使用小内核（3x3）保留小细节
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);

    // 2. 自适应阈值
    // 比 Canny 边缘检测更适合处理光照变化的图像
    cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

    // 3. 形态学操作
    // 开运算：去除小噪点
    cv.morphologyEx(binary, morph, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 1);
    
    // 闭运算：连接对象内部的空隙
    cv.morphologyEx(morph, morph, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 2);

    // 4. 查找轮廓
    const approxMethod = params.useDetailedContours ? cv.CHAIN_APPROX_NONE : cv.CHAIN_APPROX_SIMPLE;
    cv.findContours(morph, contours, hierarchy, cv.RETR_EXTERNAL, approxMethod);

    // 5. 过滤和裁剪
    const totalArea = src.rows * src.cols;
    const minArea = totalArea * params.minAreaRatio;
    
    // 收集有效的边界矩形用于排序
    const validRects: any[] = [];

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
      contour.delete(); // 释放 get() 返回的 Mat 避免内存泄漏
    }

    // 按面积降序排序（最大的对象优先）
    validRects.sort((a, b) => b.area - a.area);
    
    // 限制最多 20 个结果，避免处理过于复杂的图像时浏览器卡死
    const topRects = validRects.slice(0, 20);
    const white = new cv.Scalar(255);
    const zero = new cv.Scalar(0);

    for (let i = 0; i < topRects.length; i++) {
        const { rect, index } = topRects[i];
        
        // 添加边距
        const padding = 5;
        const xPos = Math.max(0, rect.x - padding);
        const yPos = Math.max(0, rect.y - padding);
        const w = Math.min(src.cols - xPos, rect.width + (padding * 2));
        const h = Math.min(src.rows - yPos, rect.height + (padding * 2));

        const roiRect = new cv.Rect(xPos, yPos, w, h);
        
        // --- 透明遮罩逻辑 ---
        
        // a. 清空遮罩
        fullMask.setTo(zero);

        // b. 在全尺寸遮罩上绘制特定轮廓
        const contour = contours.get(index);
        const contourVec = new cv.MatVector();
        contourVec.push_back(contour);
        cv.drawContours(fullMask, contourVec, 0, white, -1, cv.LINE_8); // 填充绘制

        // c. 裁剪图像和遮罩
        const cellMat = src.roi(roiRect); // RGBA 图像裁剪
        const maskRoi = fullMask.roi(roiRect); // 遮罩裁剪

        // d. 将遮罩合并到 Alpha 通道
        const channels = new cv.MatVector();
        cv.split(cellMat, channels); // 分离 RGBA

        // 如果源是 RGBA（4 通道），替换 alpha；如果是 RGB（3 通道），添加 alpha
        if (channels.size() === 4) {
            const alpha = channels.get(3);
            alpha.delete(); // 释放旧的 alpha
            channels.set(3, maskRoi); // 设置新的 alpha
        } else if (channels.size() === 3) {
            channels.push_back(maskRoi);
        }

        const resultMat = new cv.Mat();
        cv.merge(channels, resultMat); // 合并创建 RGBA Mat

        const slice = await matToSlice(resultMat, i);
        slices.push(slice);
        
        // 清理
        contour.delete();
        contourVec.delete();
        cellMat.delete();
        maskRoi.delete();
        resultMat.delete();
        channels.delete();
    }

    if (slices.length === 0) {
      // 如果没有找到轮廓，返回整张图片作为单个切片
      const fullSlice = await matToSlice(src, 0);
      slices.push(fullSlice);
    }

  } finally {
    // 清理
    gray.delete(); blurred.delete(); binary.delete();
    kernel.delete(); morph.delete(); hierarchy.delete(); contours.delete();
    fullMask.delete();
  }

  return slices;
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
  
  // 智能切割模式：优先使用 Transformers.js + RMBG-1.4
  if (mode === ProcessMode.SMART_EXTRACT) {
    // 检查 transformers.js 是否可用
    if (checkTransformersReady()) {
      try {
        console.log('[OpenCVService] 使用 Transformers.js + RMBG-1.4 进行智能切割');
        const minAreaRatio = smartParams?.minAreaRatio ?? DEFAULT_SMART_PARAMS.minAreaRatio;
        return await processSmartExtractionWithTransformers(imageSrc, minAreaRatio);
      } catch (error) {
        console.warn('[OpenCVService] Transformers.js 处理失败，回退到 OpenCV:', error);
        // 回退到 OpenCV 方法
      }
    } else {
      console.log('[OpenCVService] Transformers.js 不可用，使用 OpenCV 方法');
    }
    
    // 使用 OpenCV 方法（回退或默认）
    const imgElement = await loadImage(imageSrc);
    const src = cv.imread(imgElement);
    try {
      return await processSmartExtraction(src, smartParams);
    } catch (err) {
      console.error("OpenCV 处理错误:", err);
      throw err;
    } finally {
      src.delete();
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
