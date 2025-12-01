import { useState, useCallback, useRef } from 'react';
import { LayerData, HistoryEntry } from '../types';

/**
 * 历史记录管理 Hook
 * 提供撤销/重做功能
 *
 * 优化说明：
 * - 使用 useRef 追踪当前状态，避免闭包陷阱
 * - 使用函数式更新确保状态一致性
 * - 回调函数依赖数组为空，避免不必要的重建
 * - 每次保存历史记录时触发自动保存
 * - 记录每个操作的描述信息
 */
export function useHistory(
  initialLayers: LayerData[] = [],
  onHistorySave?: () => void
) {
  const [history, setHistory] = useState<HistoryEntry[]>(() => [
    {
      layers: initialLayers,
      description: 'history.initial',
      timestamp: Date.now(),
    }
  ]);
  const [historyStep, setHistoryStep] = useState(0);

  // 使用 ref 追踪当前状态，避免闭包陷阱
  const historyRef = useRef(history);
  const historyStepRef = useRef(historyStep);
  const onHistorySaveRef = useRef(onHistorySave);

  historyRef.current = history;
  historyStepRef.current = historyStep;
  onHistorySaveRef.current = onHistorySave;

  // 保存到历史记录 - 使用函数式更新避免闭包陷阱
  const saveToHistory = useCallback((newLayers: LayerData[], description: string = 'history.unknown') => {
    setHistory(prevHistory => {
      const currentStep = historyStepRef.current;
      // 截断当前步骤之后的历史，添加新状态
      const newHistory = prevHistory.slice(0, currentStep + 1);
      const timestamp = Date.now();
      newHistory.push({
        layers: newLayers,
        description,
        timestamp,
      });
      console.log('[useHistory] saveToHistory:', { description, timestamp, step: newHistory.length - 1 });
      // 同步更新 historyStep
      setHistoryStep(newHistory.length - 1);

      // 触发自动保存
      if (onHistorySaveRef.current) {
        onHistorySaveRef.current();
      }

      return newHistory;
    });
  }, []); // 空依赖数组，回调永不重建

  // 撤销 - 使用 ref 获取最新状态
  const undo = useCallback(() => {
    const currentStep = historyStepRef.current;
    const currentHistory = historyRef.current;
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setHistoryStep(prevStep);
      return currentHistory[prevStep].layers;
    }
    return null;
  }, []);

  // 重做 - 使用 ref 获取最新状态
  const redo = useCallback(() => {
    const currentStep = historyStepRef.current;
    const currentHistory = historyRef.current;
    if (currentStep < currentHistory.length - 1) {
      const nextStep = currentStep + 1;
      setHistoryStep(nextStep);
      return currentHistory[nextStep].layers;
    }
    return null;
  }, []);

  // 重置历史记录
  const resetHistory = useCallback((newLayers: LayerData[]) => {
    const timestamp = Date.now();
    console.log('[useHistory] resetHistory:', { timestamp, layerCount: newLayers.length });
    setHistory([{
      layers: newLayers,
      description: 'history.initial',
      timestamp,
    }]);
    setHistoryStep(0);
  }, []);

  // 跳转到指定历史记录步骤
  const jumpToStep = useCallback((step: number) => {
    const currentHistory = historyRef.current;
    if (step >= 0 && step < currentHistory.length) {
      setHistoryStep(step);
      return currentHistory[step].layers;
    }
    return null;
  }, []);

  const canUndo = historyStep > 0;
  const canRedo = historyStep < history.length - 1;

  return {
    history,
    historyStep,
    saveToHistory,
    undo,
    redo,
    resetHistory,
    jumpToStep,
    canUndo,
    canRedo,
  };
}

