/**
 * 自动保存 Hook
 * 提供自动保存功能的 React 集成
 * 适配 Wails 桌面端异步 API
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { LayerData, CanvasConfig } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  hasAutoSaveData,
  getAutoSaveTimestamp,
  formatTimestamp,
  clearAutoSaveData,
  AutoSaveData,
} from '../services/autoSaveService';

interface UseAutoSaveOptions {
  layers: LayerData[];
  canvasConfig: CanvasConfig;
  isProjectCreated: boolean;
  /** 项目路径，如果提供则自动保存到项目目录 */
  projectPath?: string;
}

interface UseAutoSaveReturn {
  /** 是否有可恢复的数据 */
  hasRecoverableData: boolean;
  /** 可恢复数据的时间戳 */
  recoverableTimestamp: string | null;
  /** 恢复数据（异步） */
  recoverData: () => Promise<AutoSaveData | null>;
  /** 忽略恢复（清除自动保存数据，异步） */
  dismissRecovery: () => Promise<void>;
  /** 手动触发保存 */
  triggerSave: () => void;
  /** 上次保存时间 */
  lastSaveTime: string | null;
  /** 是否正在检查恢复数据 */
  isCheckingRecovery: boolean;
}

/**
 * 自动保存 Hook
 */
export function useAutoSave({
  layers,
  canvasConfig,
  isProjectCreated,
  projectPath,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const { isLoaded: settingsLoaded } = useSettings();
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [hasRecoverableData, setHasRecoverableData] = useState(false);
  const [recoverableTimestamp, setRecoverableTimestamp] = useState<string | null>(null);
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(true);

  // 使用 ref 追踪最新的 layers、canvasConfig 和 projectPath，避免闭包陷阱
  const layersRef = useRef(layers);
  const canvasConfigRef = useRef(canvasConfig);
  const isProjectCreatedRef = useRef(isProjectCreated);
  const projectPathRef = useRef(projectPath);

  layersRef.current = layers;
  canvasConfigRef.current = canvasConfig;
  isProjectCreatedRef.current = isProjectCreated;
  projectPathRef.current = projectPath;

  // 执行保存（异步）
  const performSave = useCallback(async () => {
    if (!isProjectCreatedRef.current) {
      console.log('[AutoSave] 跳过保存：项目未创建');
      return;
    }

    console.log('[AutoSave] 开始执行自动保存...', {
      layersCount: layersRef.current.length,
      projectPath: projectPathRef.current,
    });

    try {
      // 如果有项目路径，保存到项目目录；否则保存到全局自动保存位置
      const success = await saveToLocalStorage(
        layersRef.current,
        canvasConfigRef.current,
        projectPathRef.current
      );
      if (success) {
        const now = new Date().toLocaleTimeString();
        setLastSaveTime(now);
        console.log('[AutoSave] 自动保存成功:', now);
      } else {
        console.warn('[AutoSave] 自动保存失败：saveToLocalStorage 返回 false');
      }
    } catch (error) {
      console.error('[AutoSave] 自动保存执行失败:', error);
    }
  }, []);

  // 检查是否有可恢复的数据（仅在初始化时，等待设置加载完成）
  useEffect(() => {
    if (!settingsLoaded) return;

    const checkRecoveryData = async () => {
      setIsCheckingRecovery(true);
      try {
        const hasData = await hasAutoSaveData();
        if (hasData) {
          const timestamp = await getAutoSaveTimestamp();
          if (timestamp) {
            setHasRecoverableData(true);
            setRecoverableTimestamp(formatTimestamp(timestamp));
          }
        }
      } catch (error) {
        console.error('检查恢复数据失败:', error);
      } finally {
        setIsCheckingRecovery(false);
      }
    };

    checkRecoveryData();
  }, [settingsLoaded]);

  // 恢复数据（异步）
  const recoverData = useCallback(async (): Promise<AutoSaveData | null> => {
    try {
      const data = await loadFromLocalStorage();
      if (data) {
        setHasRecoverableData(false);
        setRecoverableTimestamp(null);
      }
      return data;
    } catch (error) {
      console.error('恢复数据失败:', error);
      return null;
    }
  }, []);

  // 忽略恢复（异步）
  const dismissRecovery = useCallback(async (): Promise<void> => {
    try {
      await clearAutoSaveData();
      setHasRecoverableData(false);
      setRecoverableTimestamp(null);
    } catch (error) {
      console.error('清除自动保存数据失败:', error);
    }
  }, []);

  // 手动触发保存
  const triggerSave = useCallback(() => {
    performSave();
  }, [performSave]);

  return {
    hasRecoverableData,
    recoverableTimestamp,
    recoverData,
    dismissRecovery,
    triggerSave,
    lastSaveTime,
    isCheckingRecovery,
  };
}

