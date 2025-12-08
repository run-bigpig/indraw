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

  // ✅ 性能优化：防抖定时器 ref
  const saveTimeoutRef = useRef<number | null>(null);
  // 是否有待保存的数据
  const pendingSaveRef = useRef(false);
  // ✅ 性能优化：上次保存的数据指纹，用于变更检测
  const lastSavedFingerprintRef = useRef<string>('');

  layersRef.current = layers;
  canvasConfigRef.current = canvasConfig;
  isProjectCreatedRef.current = isProjectCreated;
  projectPathRef.current = projectPath;

  // ✅ 性能优化：生成数据指纹，用于快速变更检测
  // ✅ 修复：增加更多属性的检测，包括 name、src、fill、stroke、text 等
  const generateFingerprint = useCallback((layersData: LayerData[], config: CanvasConfig): string => {
    // 简单的字符串哈希函数（快速计算）
    const quickHash = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash;
    };
    
    // 包含所有可能变化的关键属性
    const layerFingerprints = layersData.map(l => {
      // 基础属性
      const baseProps = `${l.id}:${l.name}:${l.type}:${l.x}:${l.y}:${l.width}:${l.height}:${l.rotation}:${l.visible}:${l.opacity}:${l.scaleX}:${l.scaleY}`;
      // 样式属性
      const styleProps = `${l.fill || ''}:${l.stroke || ''}:${l.strokeWidth || 0}:${l.blendMode || ''}`;
      // 文本属性
      const textProps = l.type === 'text' ? `${l.text || ''}:${l.fontSize || 0}:${l.fontFamily || ''}` : '';
      // 图片数据：使用长度 + 采样哈希作为指纹（修补操作会改变图片数据）
      let srcFingerprint = '';
      if (l.src) {
        // 采样计算哈希：长度 + 首尾 + 中间部分
        const len = l.src.length;
        const sample = l.src.slice(0, 100) + l.src.slice(-100) + (len > 1000 ? l.src.slice(len / 2, len / 2 + 100) : '');
        srcFingerprint = `src:${len}:${quickHash(sample)}`;
      }
      // 特效属性
      const effectProps = `${l.brightness || 0}:${l.contrast || 0}:${l.blurRadius || 0}:${l.saturation || 0}`;
      // 形状属性
      const shapeProps = `${l.cornerRadius || 0}:${l.numPoints || 0}:${l.innerRadius || 0}:${l.outerRadius || 0}`;
      // 分组属性
      const groupProps = l.parentId || '';
      // 阴影属性
      const shadowProps = `${l.shadowColor || ''}:${l.shadowBlur || 0}:${l.shadowOffsetX || 0}:${l.shadowOffsetY || 0}`;
      
      return `[${baseProps}|${styleProps}|${textProps}|${srcFingerprint}|${effectProps}|${shapeProps}|${groupProps}|${shadowProps}]`;
    }).join('');
    
    const configFingerprint = `${config.width}x${config.height}:${config.background}:${config.backgroundColor}`;
    return `${layersData.length}-${configFingerprint}-${layerFingerprints}`;
  }, []);

  // 执行保存（异步）
  const performSave = useCallback(async () => {
    if (!isProjectCreatedRef.current) {
      console.log('[AutoSave] 跳过保存：项目未创建');
      return;
    }

    // ✅ 性能优化：变更检测，避免重复保存相同数据
    const currentFingerprint = generateFingerprint(layersRef.current, canvasConfigRef.current);
    if (currentFingerprint === lastSavedFingerprintRef.current) {
      console.log('[AutoSave] 跳过保存：数据未变更');
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
        // ✅ 保存成功后更新指纹
        lastSavedFingerprintRef.current = currentFingerprint;
        const now = new Date().toLocaleTimeString();
        setLastSaveTime(now);
        console.log('[AutoSave] 自动保存成功:', now);
      } else {
        console.warn('[AutoSave] 自动保存失败：saveToLocalStorage 返回 false');
      }
    } catch (error) {
      console.error('[AutoSave] 自动保存执行失败:', error);
    }
  }, [generateFingerprint]);

  // ✅ 性能优化：防抖保存，避免频繁保存
  // 延迟时间从 500ms 提升到 1000ms，减少保存频率
  const debouncedSave = useCallback(() => {
    pendingSaveRef.current = true;

    // 清除之前的定时器
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 设置新的定时器，延迟 1000ms 执行保存
    // ✅ 性能优化：提升防抖时间，减少保存频率，配合后端队列合并策略
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        performSave();
      }
    }, 1000);
  }, [performSave]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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

  // 手动触发保存（使用防抖）
  // ✅ 性能优化：使用防抖保存，避免频繁保存导致的卡顿
  const triggerSave = useCallback(() => {
    debouncedSave();
  }, [debouncedSave]);

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

