/**
 * 图像裁剪工具函数
 * 使用 Canvas API 进行图像裁剪
 */

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 从图像创建一个已裁剪的图像
 * @param imageSrc 原始图像的 URL 或 base64
 * @param pixelCrop 裁剪区域（像素坐标）
 * @param rotation 旋转角度（度数）
 * @returns Promise<string> 裁剪后的图像 base64
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number = 0
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // 设置临时画布尺寸以容纳旋转
  canvas.width = safeArea;
  canvas.height = safeArea;

  // 将图像绘制到画布中心并应用旋转
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-safeArea / 2, -safeArea / 2);

  // 在安全区域中心绘制旋转后的图像
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );
  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // 设置画布尺寸为最终裁剪尺寸
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // 将旋转后的图像粘贴到正确的偏移位置以获取裁剪图像
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  // 返回 base64 格式的 PNG 图像
  return canvas.toDataURL('image/png');
}

/**
 * 创建图像元素并等待加载完成
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

/**
 * 将角度转换为弧度
 */
function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

/**
 * 获取旋转后图像的新边界框尺寸
 * @param width 原始宽度
 * @param height 原始高度
 * @param rotation 旋转角度（度数）
 */
export function getRotatedSize(
  width: number,
  height: number,
  rotation: number
): { width: number; height: number } {
  const rotRad = getRadianAngle(rotation);

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * 缩放图像以适应画布尺寸
 * @param imageSrc 图像源（base64）
 * @param maxWidth 最大宽度
 * @param maxHeight 最大高度
 * @returns Promise<{image: string, width: number, height: number}> 缩放后的图像 base64 和尺寸
 */
export async function scaleImageToFit(
  imageSrc: string,
  maxWidth: number,
  maxHeight: number
): Promise<{ image: string; width: number; height: number }> {
  const image = await createImage(imageSrc);
  
  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  
  // 如果图像尺寸已经在范围内，直接返回
  if (imageWidth <= maxWidth && imageHeight <= maxHeight) {
    return {
      image: imageSrc,
      width: imageWidth,
      height: imageHeight
    };
  }
  
  // 计算缩放比例，保持宽高比
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  const newWidth = Math.round(imageWidth * scale);
  const newHeight = Math.round(imageHeight * scale);
  
  // 创建画布并绘制缩放后的图像
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not create canvas context');
  }
  
  ctx.drawImage(image, 0, 0, newWidth, newHeight);
  
  return {
    image: canvas.toDataURL('image/png'),
    width: newWidth,
    height: newHeight
  };
}

