/**
 * 图像合成工具函数
 * 用于 AI Inpaint 的像素级精确合成
 */

/**
 * 使用蒙版合成图像
 * @param cleanBase64 原始干净图像
 * @param aiBase64 AI 生成的图像
 * @param maskBase64 蒙版图像
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 合成后的图像 base64
 */
export const compositeInpaint = (
  cleanBase64: string,
  aiBase64: string,
  maskBase64: string,
  width: number,
  height: number
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve(cleanBase64);
      return;
    }

    const imgClean = new Image();
    const imgAI = new Image();
    const imgMask = new Image();
    
    let loaded = 0;
    const check = () => {
      loaded++;
      if (loaded === 3) {
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
        resolve(canvas.toDataURL());
      }
    };

    imgClean.onerror = check;
    imgAI.onerror = check;
    imgMask.onerror = check;
    imgClean.onload = check;
    imgAI.onload = check;
    imgMask.onload = check;
    
    imgClean.src = cleanBase64;
    imgAI.src = aiBase64;
    imgMask.src = maskBase64;
  });
};

