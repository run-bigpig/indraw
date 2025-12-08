/**
 * OpenCV 图片处理服务
 * 提供基于 OpenCV.js 的图像处理功能
 * - 九宫格切割（3x3 Grid）
 * - 智能元素提取（Smart Extraction）- 使用 Transformer 背景移除 + OpenCV 处理
 * - 智能修补（Heal）- 使用 OpenCV Heal 功能修复图像
 */

import { GridSlice, ProcessMode, SmartExtractParams, DEFAULT_SMART_PARAMS } from '@/types';
import { removeBackground, checkBackgroundRemovalReady, BackgroundRemovalResult } from './backgroundRemovalService';

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
 * 背景移除结果缓存
 * key: imageSrc, value: BackgroundRemovalResult
 */
const backgroundRemovalCache = new Map<string, BackgroundRemovalResult>();

/**
 * 清除背景移除缓存
 * @param imageSrc 可选，指定要清除的图片源。如果不提供，清除所有缓存
 */
export const clearBackgroundRemovalCache = (imageSrc?: string): void => {
  if (imageSrc) {
    backgroundRemovalCache.delete(imageSrc);
  } else {
    backgroundRemovalCache.clear();
  }
};

/**
 * 获取缓存的背景移除结果
 */
const getCachedBackgroundRemoval = (imageSrc: string): BackgroundRemovalResult | null => {
  return backgroundRemovalCache.get(imageSrc) || null;
};

/**
 * 缓存背景移除结果
 */
const cacheBackgroundRemoval = (imageSrc: string, result: BackgroundRemovalResult): void => {
  backgroundRemovalCache.set(imageSrc, result);
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
 * 结合 Transformer 背景移除和 OpenCV 处理
 * 工作流程：
 * 1. 使用 RMBG 模型进行背景移除，输出 RGBA 图像（带缓存）
 * 2. 等比例缩放优化（所有运算在缩放图上进行，提高性能）
 * 3. 从 RGBA 图像中提取 Alpha 通道
 * 4. 预处理流程（两种模式）：
 *    - 传统模式：形态学操作（膨胀+闭运算）→ 二值化
 *    - Canny 模式：灰度化 → 高斯模糊 → Canny边缘检测 → 形态学膨胀 → Otsu二值化
 * 5. 使用 OpenCV findContours 检测所有独立的区域
 * 6. 过滤轮廓（面积、宽高比）并将坐标映射回原图
 * 7. 从原图提取高分辨率 ROI 区域
 * @param imageSrc 图片源
 * @param params 智能提取参数
 * @param cachedBgRemoval 可选的已缓存的背景移除结果，如果提供则跳过背景移除步骤
 */
const processSmartExtraction = async (
  imageSrc: string,
  params: SmartExtractParams = DEFAULT_SMART_PARAMS,
  cachedBgRemoval?: BackgroundRemovalResult | null
): Promise<GridSlice[]> => {
  const cv = window.cv;
  const slices: GridSlice[] = [];

  try {
    // Step 1: 使用 Transformer 背景移除获取 RGBA 图像（带缓存）
    let bgRemovalResult: BackgroundRemovalResult;
    
    if (cachedBgRemoval) {
      // 使用提供的缓存结果
      bgRemovalResult = cachedBgRemoval;
    } else {
      // 检查缓存
      const cached = getCachedBackgroundRemoval(imageSrc);
      if (cached) {
        bgRemovalResult = cached;
      } else {
        // 执行背景移除并缓存结果
        if (!checkBackgroundRemovalReady()) {
          throw new Error('背景移除服务不可用');
        }
        bgRemovalResult = await removeBackground(imageSrc);
        cacheBackgroundRemoval(imageSrc, bgRemovalResult);
      }
    }

    // Step 2: 加载 RGBA 图像到 OpenCV Mat（原图分辨率）
    const rgbaImage = await loadImage(bgRemovalResult.dataUrl);
    const rgbaMatOriginal = cv.imread(rgbaImage);

    try {
      // Step 3: 等比例缩放优化（所有运算在缩放图上进行，提高性能）
      let scale = 1.0;
      let rgbaMat = rgbaMatOriginal;
      let shouldDeleteScaled = false;

      if (params.maxSize > 0) {
        const maxDim = Math.max(rgbaMatOriginal.cols, rgbaMatOriginal.rows);
        if (maxDim > params.maxSize) {
          scale = params.maxSize / maxDim;
          const dsize = new cv.Size(
            Math.round(rgbaMatOriginal.cols * scale),
            Math.round(rgbaMatOriginal.rows * scale)
          );
          rgbaMat = new cv.Mat();
          cv.resize(rgbaMatOriginal, rgbaMat, dsize, 0, 0, cv.INTER_AREA);
          shouldDeleteScaled = true;
        }
      }

      try {
        // Step 4: 提取 Alpha 通道
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

        // Step 5: 预处理流程
        let processed: any;
        let gray: any = null;
        let blurred: any = null;
        let edges: any = null;
        let binary: any;

        if (params.useCannyEdge) {
          // 改进的预处理流程：灰度化 → 高斯模糊 → Canny边缘 → 形态学操作 → 二值化
          gray = new cv.Mat();
          blurred = new cv.Mat();
          edges = new cv.Mat();
          
          // 灰度化
          cv.cvtColor(rgbaMat, gray, cv.COLOR_RGBA2GRAY, 0);
          
          // 高斯模糊（降噪）
          cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
          
          // Canny 边缘检测
          cv.Canny(blurred, edges, params.cannyLowThreshold, params.cannyHighThreshold);
          
          // 形态学膨胀（连接边缘）
          const dilateIter = Math.max(0, Math.min(5, Math.floor(params.dilateIter) || 0));
          if (dilateIter > 0) {
            const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
            cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), dilateIter);
            kernel.delete();
          }
          
          // Otsu 二值化
          binary = new cv.Mat();
          cv.threshold(edges, binary, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
          
          processed = binary;
        } else {
          // 传统流程：直接使用 Alpha 通道进行形态学操作
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
          
          // 二值化 Alpha 通道（确保是二值图像）
          binary = new cv.Mat();
          cv.threshold(morphResult, binary, 127, 255, cv.THRESH_BINARY);
          
          processed = binary;
          morphResult.delete();
          kernel.delete();
        }

        // Step 6: 轮廓检测
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        
        // 查找轮廓（只查找外部轮廓）
        const approxMethod = params.useDetailedContours 
          ? cv.CHAIN_APPROX_NONE 
          : cv.CHAIN_APPROX_SIMPLE;
        cv.findContours(processed, contours, hierarchy, cv.RETR_EXTERNAL, approxMethod);

        // Step 7: 过滤和坐标映射
        const imgArea = rgbaMat.rows * rgbaMat.cols;
        const minArea = imgArea * params.minAreaRatio;
        
        // 收集有效的边界矩形（缩放图坐标）
        const validRects: Array<{ 
          rectScaled: any; 
          rectOriginal: any; 
          area: number; 
          index: number 
        }> = [];

        for (let i = 0; i < contours.size(); ++i) {
          const contour = contours.get(i);
          const area = cv.contourArea(contour);

          if (area > minArea) {
            const rectScaled = cv.boundingRect(contour);
            
            // 宽高比过滤
            const aspect = rectScaled.width / rectScaled.height;
            if (aspect >= params.minAspectRatio && aspect <= params.maxAspectRatio) {
              // 映射回原图坐标
              let origX = Math.round(rectScaled.x / scale);
              let origY = Math.round(rectScaled.y / scale);
              let origW = Math.round(rectScaled.width / scale);
              let origH = Math.round(rectScaled.height / scale);
              
              // 边界裁剪，防止溢出
              origX = Math.max(0, Math.min(origX, rgbaMatOriginal.cols - 1));
              origY = Math.max(0, Math.min(origY, rgbaMatOriginal.rows - 1));
              if (origX + origW > rgbaMatOriginal.cols) origW = rgbaMatOriginal.cols - origX;
              if (origY + origH > rgbaMatOriginal.rows) origH = rgbaMatOriginal.rows - origY;
              
              if (origW > 0 && origH > 0) {
                const rectOriginal = { x: origX, y: origY, width: origW, height: origH };
                validRects.push({ 
                  rectScaled, 
                  rectOriginal, 
                  area, 
                  index: i 
                });
              }
            }
          }
          contour.delete();
        }

        // 按面积降序排序
        validRects.sort((a, b) => b.area - a.area);
        
        // 限制最多 20 个结果
        const topRects = validRects.slice(0, 20);

        // Step 8: 从原图提取高分辨率 ROI
        // 注意：这里我们从背景移除后的原图（rgbaMatOriginal）裁剪，保留完整质量
        for (let i = 0; i < topRects.length; i++) {
          const { rectOriginal } = topRects[i];
          
          // 添加边距
          const padding = 5;
          const xPos = Math.max(0, rectOriginal.x - padding);
          const yPos = Math.max(0, rectOriginal.y - padding);
          const w = Math.min(rgbaMatOriginal.cols - xPos, rectOriginal.width + (padding * 2));
          const h = Math.min(rgbaMatOriginal.rows - yPos, rectOriginal.height + (padding * 2));

          const roiRect = new cv.Rect(xPos, yPos, w, h);
          
          // 从原图裁剪 ROI（高分辨率）
          const roiOrig = rgbaMatOriginal.roi(roiRect);
          const roiClone = roiOrig.clone(); // 深拷贝，避免后续删除原图后失效
          roiOrig.delete();
          
          const slice = await matToSlice(roiClone, i);
          slices.push(slice);
          
          // 清理
          roiClone.delete();
        }

        // 清理预处理相关资源
        // 注意：需要先删除 channels 中的其他通道，再删除 alphaChannel
        if (channels.size() >= 4) {
          // 删除除了 alphaChannel 之外的其他通道
          for (let i = 0; i < channels.size(); i++) {
            if (i !== 3) {
              channels.get(i).delete();
            }
          }
        } else {
          // 如果没有 4 个通道，删除所有通道
          for (let i = 0; i < channels.size(); i++) {
            channels.get(i).delete();
          }
        }
        channels.delete();
        alphaChannel.delete();
        binary.delete();
        if (gray) gray.delete();
        if (blurred) blurred.delete();
        if (edges) edges.delete();
        contours.delete();
        hierarchy.delete();
      } finally {
        // 清理缩放图（如果创建了）
        if (shouldDeleteScaled) {
          rgbaMat.delete();
        }
      }

      if (slices.length === 0) {
        // 如果没有找到轮廓，返回整张图片作为单个切片
        const fullSlice = await matToSlice(rgbaMatOriginal, 0);
        slices.push(fullSlice);
      }
    } finally {
      rgbaMatOriginal.delete();
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

/**
 * Heal 参数配置
 */
export interface HealParams {
  /** Heal 算法类型：'NS' (Navier-Stokes) 或 'TELEA' (Fast Marching Method)，默认 'TELEA' */
  method?: 'NS' | 'TELEA';
  /** Heal 半径（像素），控制修复区域的影响范围。如果为 0 或未设置，将根据遮罩大小自动计算 */
  HealRadius?: number;
  /** 是否使用自适应半径（根据遮罩大小自动计算），默认 true */
  adaptiveRadius?: boolean;
  /** 遮罩预处理强度（0-3），控制形态学操作的强度，默认 2 */
  maskPreprocessing?: number;
}

/**
 * 默认的 Heal 参数
 */
export const DEFAULT_Heal_PARAMS: HealParams = {
  method: 'TELEA',
  HealRadius: 0, // 0 表示自动计算
  adaptiveRadius: true,
  maskPreprocessing: 1, // 减少预处理强度，避免模糊
};

/**
 * 智能修补（Heal）
 * 使用 OpenCV 的 Heal 功能修复图像中的指定区域
 * 功能对标 Photoshop 的"污点修复画笔工具"或"内容识别填充"
 * 
 * @param imageSrc 原始图像（base64 或 URL）
 * @param maskPoints 遮罩点数组，格式为 [x1, y1, x2, y2, ...]，表示需要修复的区域
 * @param brushSize 画笔大小（像素），用于生成遮罩
 * @param params Heal 参数配置
 * @returns 修复后的图像 dataUrl
 */
export const HealImage = async (
  imageSrc: string,
  maskPoints: number[],
  brushSize: number,
  params: HealParams = DEFAULT_Heal_PARAMS
): Promise<string> => {
  const cv = window.cv;
  
  if (!checkOpenCVReady()) {
    throw new Error('OpenCV 未加载');
  }

  // 加载原始图像
  const imgElement = await loadImage(imageSrc);
  const srcRGBA = cv.imread(imgElement);
  
  // 将 RGBA 转换为 RGB（inpaint 需要 3 通道图像，参考 opencv-spot-healer 使用 RGB）
  const src = new cv.Mat();
  cv.cvtColor(srcRGBA, src, cv.COLOR_RGBA2RGB, 0);
  
  try {
    // 创建遮罩图像（与源图像相同大小，单通道）
    const mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    
    // 在遮罩上绘制画笔路径
    if (maskPoints.length >= 2) {
      const color = new cv.Scalar(255); // 白色表示需要修复的区域
      const thickness = Math.max(1, Math.round(brushSize));
      
      // 绘制连续的线条
      for (let i = 0; i < maskPoints.length - 2; i += 2) {
        const x1 = Math.round(maskPoints[i]);
        const y1 = Math.round(maskPoints[i + 1]);
        const x2 = Math.round(maskPoints[i + 2]);
        const y2 = Math.round(maskPoints[i + 3]);
        
        // 确保坐标在图像范围内
        const clampedX1 = Math.max(0, Math.min(x1, src.cols - 1));
        const clampedY1 = Math.max(0, Math.min(y1, src.rows - 1));
        const clampedX2 = Math.max(0, Math.min(x2, src.cols - 1));
        const clampedY2 = Math.max(0, Math.min(y2, src.rows - 1));
        
        // 只有当两个点不同时才绘制线条
        if (clampedX1 !== clampedX2 || clampedY1 !== clampedY2) {
          cv.line(mask, new cv.Point(clampedX1, clampedY1), new cv.Point(clampedX2, clampedY2), color, thickness, cv.LINE_8, 0);
        }
      }
      
      // 如果只有一个点，绘制一个圆形
      if (maskPoints.length === 2) {
        const x = Math.round(maskPoints[0]);
        const y = Math.round(maskPoints[1]);
        const clampedX = Math.max(0, Math.min(x, src.cols - 1));
        const clampedY = Math.max(0, Math.min(y, src.rows - 1));
        const radius = Math.max(1, Math.round(brushSize / 2));
        cv.circle(mask, new cv.Point(clampedX, clampedY), radius, color, -1, cv.LINE_8, 0);
      }
      
      // 遮罩预处理：二值化（参考 opencv-spot-healer 的实现）
      // mask 已经是单通道，直接使用 threshold
      const maskBinary = new cv.Mat();
      cv.threshold(mask, maskBinary, 10, 255, cv.THRESH_BINARY); // 使用阈值 10（参考 opencv-spot-healer）
      // 将二值化结果复制回 mask
      maskBinary.copyTo(mask);
      maskBinary.delete();
    } else {
      // 如果没有有效的点，抛出错误
      mask.delete();
      throw new Error('遮罩点数组无效：至少需要 2 个点');
    }
    
    // 验证遮罩是否有非零像素
    const nonZeroCount = cv.countNonZero(mask);
    
    if (nonZeroCount === 0) {
      mask.delete();
      throw new Error('遮罩为空：没有需要修复的区域');
    }
    
    // 计算遮罩的边界框，用于估算修复区域大小
    const maskBoundingRect = cv.boundingRect(mask);
    const maskArea = maskBoundingRect.width * maskBoundingRect.height;
    const maskMaxDim = Math.max(maskBoundingRect.width, maskBoundingRect.height);
    
    // 使用固定半径 3（参考 opencv-spot-healer 的实现）
    const inpaintRadius = params.HealRadius || 3;
    
    // 执行 Inpaint
    const dst = new cv.Mat();
    const inpaintMethod = params.method === 'NS' ? cv.INPAINT_NS : cv.INPAINT_TELEA;
    
    try {
      cv.inpaint(src, mask, dst, inpaintRadius, inpaintMethod);
    } catch (error) {
      mask.delete();
      dst.delete();
      console.error('[HealImage] Inpaint 执行失败', error);
      throw new Error(`Inpaint 执行失败: ${error}`);
    }
    
    // 将 RGB 结果转换回 RGBA（用于显示）
    // 注意：OpenCV.js 可能没有 COLOR_RGB2RGBA，需要通过 BGR 转换
    const dstBGR = new cv.Mat();
    cv.cvtColor(dst, dstBGR, cv.COLOR_RGB2BGR, 0);
    const dstRGBA = new cv.Mat();
    cv.cvtColor(dstBGR, dstRGBA, cv.COLOR_BGR2RGBA, 0);
    dstBGR.delete();
    
    // 将结果转换为 dataUrl
    const canvas = document.createElement('canvas');
    canvas.width = dstRGBA.cols;
    canvas.height = dstRGBA.rows;
    cv.imshow(canvas, dstRGBA);
    const dataUrl = canvas.toDataURL('image/png');
    
    // 清理资源
    mask.delete();
    dst.delete();
    dstRGBA.delete();
    
    return dataUrl;
  } finally {
    // 清理所有资源
    if (src && !src.isDeleted()) src.delete();
    if (srcRGBA && !srcRGBA.isDeleted()) srcRGBA.delete();
  }
};
