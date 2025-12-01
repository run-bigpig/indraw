/**
 * 图片布局工具函数
 * 用于计算图片在画布上的适配尺寸和居中位置
 */

/**
 * 加载图片并获取其原始尺寸
 * @param src 图片的 base64 或 URL
 * @returns Promise<{width: number, height: number}>
 */
export const loadImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = src;
  });
};

/**
 * 计算图片适配画布的尺寸和位置
 * @param imageWidth 图片原始宽度
 * @param imageHeight 图片原始高度
 * @param canvasWidth 画布宽度
 * @param canvasHeight 画布高度
 * @param maxScale 最大缩放比例（默认 1.0，即不放大）
 * @returns {width, height, x, y} 适配后的尺寸和居中位置
 */
export const fitImageToCanvas = (
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  maxScale: number = 1.0
): { width: number; height: number; x: number; y: number } => {
  // 计算宽高比
  const imageAspectRatio = imageWidth / imageHeight;
  const canvasAspectRatio = canvasWidth / canvasHeight;

  let finalWidth = imageWidth;
  let finalHeight = imageHeight;

  // 如果图片超出画布，需要缩小
  if (imageWidth > canvasWidth || imageHeight > canvasHeight) {
    // 根据宽高比决定按哪个维度缩放
    if (imageAspectRatio > canvasAspectRatio) {
      // 图片更宽，按宽度缩放
      finalWidth = canvasWidth;
      finalHeight = canvasWidth / imageAspectRatio;
    } else {
      // 图片更高，按高度缩放
      finalHeight = canvasHeight;
      finalWidth = canvasHeight * imageAspectRatio;
    }
  } else if (maxScale > 1.0) {
    // 如果图片小于画布且允许放大
    const scale = Math.min(
      maxScale,
      Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight)
    );
    finalWidth = imageWidth * scale;
    finalHeight = imageHeight * scale;
  }

  // 计算居中位置
  const x = (canvasWidth - finalWidth) / 2;
  const y = (canvasHeight - finalHeight) / 2;

  return {
    width: Math.round(finalWidth),
    height: Math.round(finalHeight),
    x: Math.round(x),
    y: Math.round(y),
  };
};

/**
 * 加载图片并计算其在画布上的适配布局
 * @param src 图片的 base64 或 URL
 * @param canvasWidth 画布宽度
 * @param canvasHeight 画布高度
 * @param maxScale 最大缩放比例（默认 1.0）
 * @returns Promise<{width, height, x, y}>
 */
export const loadAndFitImage = async (
  src: string,
  canvasWidth: number,
  canvasHeight: number,
  maxScale: number = 1.0
): Promise<{ width: number; height: number; x: number; y: number }> => {
  const { width: imageWidth, height: imageHeight } = await loadImageDimensions(src);
  return fitImageToCanvas(imageWidth, imageHeight, canvasWidth, canvasHeight, maxScale);
};

