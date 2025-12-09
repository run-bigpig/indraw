/**
 * Wails Runtime 工具函数
 * 提供等待 runtime 初始化的功能
 * 
 * ⚠️ 重要：这是 window.runtime 类型定义的唯一位置
 * 其他文件如需使用 window.runtime，只需导入此文件即可：
 *   import '../utils/wailsRuntime';
 * 或
 *   import { isRuntimeAvailable } from '../utils/wailsRuntime';
 */

declare global {
  interface Window {
    runtime?: {
      EventsOn: (eventName: string, callback: (...data: any) => void) => () => void;
      EventsEmit: (eventName: string, ...data: any) => void;
      EventsOnMultiple: (eventName: string, callback: (...data: any) => void, maxCallbacks: number) => () => void;
      EventsOnce: (eventName: string, callback: (...data: any) => void) => () => void;
      EventsOff: (eventName: string, ...additionalEventNames: string[]) => void;
      EventsOffAll: () => void;
    };
    // Wails 生成的绑定函数（通过 wailsjs/go/core/App 导入）
    wails?: {
      [key: string]: any;
    };
  }
}

/**
 * 检查 Wails runtime 是否可用
 */
export function isRuntimeAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.runtime && !!window.runtime.EventsOn;
}

/**
 * 等待 Wails runtime 初始化完成
 * @param timeout 超时时间（毫秒），默认 5000ms
 * @param interval 检查间隔（毫秒），默认 100ms
 * @returns Promise<boolean> 如果 runtime 可用返回 true，超时返回 false
 */
export function waitForRuntime(timeout = 5000, interval = 100): Promise<boolean> {
  return new Promise((resolve) => {
    if (isRuntimeAvailable()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isRuntimeAvailable()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime >= timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, interval);
  });
}

/**
 * 安全调用 Wails 绑定函数
 * 如果 runtime 不可用，会等待一段时间后重试
 * @param fn 要调用的函数
 * @param maxRetries 最大重试次数，默认 3
 * @returns Promise<T> 函数返回值
 */
export async function safeCallWailsBinding<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 如果是第一次调用且 runtime 不可用，等待一下
      if (i === 0 && !isRuntimeAvailable()) {
        const available = await waitForRuntime(2000, 100);
        if (!available) {
          console.warn('[WailsRuntime] Runtime 在超时时间内不可用');
        }
      }
      
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // 如果是 "Cannot read properties of undefined" 错误，可能是绑定未初始化
      if (error?.message?.includes('Cannot read properties of undefined') || 
          error?.message?.includes('reading')) {
        if (i < maxRetries - 1) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
          continue;
        }
      }
      
      // 其他错误直接抛出
      throw error;
    }
  }
  
  throw lastError || new Error('调用 Wails 绑定函数失败');
}

