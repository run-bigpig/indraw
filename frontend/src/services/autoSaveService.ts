/**
 * 自动保存服务
 * 提供项目状态的自动保存和恢复功能
 * 现在使用 Wails 后端进行本地文件系统存储
 * 支持两种模式：
 * 1. 全局自动保存（临时项目）：保存到用户配置目录
 * 2. 项目路径保存（已保存项目）：保存到项目目录
 */

import { LayerData, CanvasConfig } from '@/types';
import { LoadAutoSave, ClearAutoSave } from '../../wailsjs/go/core/App';
import { serializationService } from './serializationService';
import { safeCallWailsBinding } from '../utils/wailsRuntime';
// ✅ 导入 wailsRuntime 以获取 window.runtime 类型定义
import '../utils/wailsRuntime';

/**
 * 自动保存的数据结构
 */
export interface AutoSaveData {
  version: string;
  timestamp: number;
  layers: LayerData[];
  canvasConfig: CanvasConfig;
}
/**
 * ✅ 事件驱动：异步保存项目状态到本地文件系统（通过 Wails 事件系统）
 * 使用事件系统实现完全异步的保存，不阻塞前端主线程
 * 保存请求会被加入后端队列，确保保存的顺序性
 * 
 * @param layers 图层数据
 * @param canvasConfig 画布配置
 * @param projectPath 可选的项目路径，如果提供则保存到项目目录
 * @returns Promise<void> 立即返回，不等待保存完成
 */
export async function saveToLocalStorage(
  layers: LayerData[],
  canvasConfig: CanvasConfig,
  projectPath?: string
): Promise<void> {
  try {
    // ✅ 检查 runtime 是否可用
    if (typeof window === 'undefined' || !window.runtime || !window.runtime.EventsEmit) {
      console.warn('[AutoSave] Wails runtime 不可用，无法保存');
      return;
    }

    const data: AutoSaveData = {
      version: '1.0',
      timestamp: Date.now(),
      layers,
      canvasConfig,
    };

    // 使用 Web Worker 进行序列化，避免阻塞主线程
    const jsonString = await serializationService.serialize(data);

    // ✅ 发送事件，不等待结果，立即返回
    // 根据 Wails 官方文档：使用 window.runtime.EventsEmit 直接访问
    // 后端会将请求加入队列，确保保存的顺序性
    if (projectPath) {
      // 保存到项目目录
      window.runtime.EventsEmit('project-save-request', projectPath, jsonString);
    } else {
      // 保存到全局自动保存位置
      window.runtime.EventsEmit('autosave-request', jsonString);
    }
    
    // 立即返回，不阻塞
  } catch (error) {
    console.error('自动保存序列化失败:', error);
    // 如果 runtime 可用，发送错误事件通知
    if (typeof window !== 'undefined' && window.runtime && window.runtime.EventsEmit) {
      if (projectPath) {
        window.runtime.EventsEmit('project-save-error', projectPath, error instanceof Error ? error.message : String(error));
      } else {
        window.runtime.EventsEmit('autosave-error', error instanceof Error ? error.message : String(error));
      }
    }
  }
}

/**
 * 从本地文件系统加载项目状态（通过 Wails 后端）
 */
export async function loadFromLocalStorage(): Promise<AutoSaveData | null> {
  try {
    // ✅ 使用安全调用，等待 Wails 绑定初始化
    const saved = await safeCallWailsBinding(() => LoadAutoSave());
    if (!saved) return null;

    const data: AutoSaveData = JSON.parse(saved);

    // 验证数据结构
    if (!data.layers || !Array.isArray(data.layers) || !data.canvasConfig) {
      console.warn('自动保存数据格式无效');
      return null;
    }

    return data;
  } catch (error) {
    console.error('加载自动保存数据失败:', error);
    return null;
  }
}

/**
 * 检查是否有自动保存的数据
 */
export async function hasAutoSaveData(): Promise<boolean> {
  try {
    const data = await loadFromLocalStorage();
    return data !== null;
  } catch {
    return false;
  }
}

/**
 * 获取自动保存的时间戳
 */
export async function getAutoSaveTimestamp(): Promise<number | null> {
  try {
    const data = await loadFromLocalStorage();
    return data?.timestamp || null;
  } catch {
    return null;
  }
}

/**
 * 格式化时间戳为可读字符串
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * 清除自动保存的数据
 */
export async function clearAutoSaveData(): Promise<void> {
  try {
    // ✅ 使用安全调用，等待 Wails 绑定初始化
    await safeCallWailsBinding(() => ClearAutoSave());
  } catch (error) {
    console.error('清除自动保存数据失败:', error);
  }
}

/**
 * 自动保存管理器类
 * 提供定时自动保存功能
 */
export class AutoSaveManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isEnabled: boolean = false;
  private intervalMinutes: number = 5;
  private onSave: (() => void) | null = null;
  
  /**
   * 启动自动保存
   * @param intervalMinutes 保存间隔（分钟）
   * @param onSave 保存回调函数
   */
  start(intervalMinutes: number, onSave: () => void): void {
    this.stop(); // 先停止之前的定时器
    
    this.isEnabled = true;
    this.intervalMinutes = intervalMinutes;
    this.onSave = onSave;
    
    // 转换为毫秒
    const intervalMs = intervalMinutes * 60 * 1000;
    
    this.intervalId = setInterval(() => {
      if (this.isEnabled && this.onSave) {
        this.onSave();
      }
    }, intervalMs);
    
    console.log(`自动保存已启动，间隔: ${intervalMinutes} 分钟`);
  }
  
  /**
   * 停止自动保存
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isEnabled = false;
    console.log('自动保存已停止');
  }
  
  /**
   * 更新保存间隔
   * @param intervalMinutes 新的保存间隔（分钟）
   */
  updateInterval(intervalMinutes: number): void {
    if (this.isEnabled && this.onSave) {
      this.start(intervalMinutes, this.onSave);
    } else {
      this.intervalMinutes = intervalMinutes;
    }
  }
  
  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.isEnabled && this.intervalId !== null;
  }
  
  /**
   * 获取当前间隔
   */
  getInterval(): number {
    return this.intervalMinutes;
  }
}

// 导出单例实例
export const autoSaveManager = new AutoSaveManager();

