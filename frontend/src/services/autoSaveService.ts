/**
 * 自动保存服务
 * 提供项目状态的自动保存和恢复功能
 * 现在使用 Wails 后端进行本地文件系统存储
 * 支持两种模式：
 * 1. 全局自动保存（临时项目）：保存到用户配置目录
 * 2. 项目路径保存（已保存项目）：保存到项目目录
 */

import { LayerData, CanvasConfig } from '../types';
import { AutoSave, LoadAutoSave, ClearAutoSave, SaveProjectToPath } from '../../wailsjs/go/core/App';

/**
 * 自动保存的数据结构
 */
export interface AutoSaveData {
  version: string;
  timestamp: number;
  layers: LayerData[];
  canvasConfig: CanvasConfig;
}

// ==================== Wails 运行时检查 ====================

/**
 * 检查 Wails 运行时是否就绪
 */
function isWailsReady(): boolean {
  return typeof window !== 'undefined' &&
         typeof (window as any).go !== 'undefined' &&
         typeof (window as any).go.main !== 'undefined' &&
         typeof (window as any).go.main.App !== 'undefined';
}

/**
 * 保存项目状态到本地文件系统（通过 Wails 后端）
 * @param layers 图层数据
 * @param canvasConfig 画布配置
 * @param projectPath 可选的项目路径，如果提供则保存到项目目录
 */
export async function saveToLocalStorage(
  layers: LayerData[],
  canvasConfig: CanvasConfig,
  projectPath?: string
): Promise<boolean> {
  try {
    // 检查 Wails 运行时是否就绪
    if (!isWailsReady()) {
      console.warn('Wails runtime not ready, cannot auto-save');
      return false;
    }

    const data: AutoSaveData = {
      version: '1.0',
      timestamp: Date.now(),
      layers,
      canvasConfig,
    };

    if (projectPath) {
      // 保存到项目目录
      await SaveProjectToPath(projectPath, JSON.stringify(data));
    } else {
      // 保存到全局自动保存位置
      await AutoSave(JSON.stringify(data));
    }
    return true;
  } catch (error) {
    console.error('自动保存失败:', error);
    return false;
  }
}

/**
 * 从本地文件系统加载项目状态（通过 Wails 后端）
 */
export async function loadFromLocalStorage(): Promise<AutoSaveData | null> {
  try {
    // 检查 Wails 运行时是否就绪
    if (!isWailsReady()) {
      console.warn('Wails runtime not ready, cannot load auto-save');
      return null;
    }

    const saved = await LoadAutoSave();
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
    // 检查 Wails 运行时是否就绪
    if (!isWailsReady()) {
      console.warn('Wails runtime not ready, cannot clear auto-save');
      return;
    }
    await ClearAutoSave();
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

