/**
 * 图像合成工具函数
 * 用于 AI Local Redraw 的像素级精确合成
 *
 * ✅ 性能优化：使用 Promise.all 并行加载图片
 */

/**
 * 加载单张图片
 * @param src 图片源
 * @returns Promise<HTMLImageElement>
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
};

/**
 * 使用蒙版合成图像
 * @param cleanBase64 原始干净图像
 * @param aiBase64 AI 生成的图像
 * @param maskBase64 蒙版图像
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 合成后的图像 base64
 */
export const compositeLocalRedraw = async (
  cleanBase64: string,
  aiBase64: string,
  maskBase64: string,
  width: number,
  height: number
): Promise<string> => {
  try {
    // ✅ 性能优化：并行加载所有图片
    const [imgClean, imgAI, imgMask] = await Promise.all([
      loadImage(cleanBase64),
      loadImage(aiBase64),
      loadImage(maskBase64),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return cleanBase64;
    }

    // 绘制原始图像
    ctx.drawImage(imgClean, 0, 0, width, height);

    // 创建临时画布用于蒙版处理
    const pCanvas = document.createElement('canvas');
    pCanvas.width = width;
    pCanvas.height = height;
    const pCtx = pCanvas.getContext('2d');

    if (pCtx) {
      // 绘制 AI 图像
      pCtx.drawImage(imgAI, 0, 0, width, height);
      // 应用蒙版
      pCtx.globalCompositeOperation = 'destination-in';
      pCtx.drawImage(imgMask, 0, 0, width, height);
    }

    // 将蒙版后的 AI 图像合成到原图上
    ctx.drawImage(pCanvas, 0, 0);
    return canvas.toDataURL();
  } catch (error) {
    console.error('Image composite failed:', error);
    return cleanBase64;
  }
};

