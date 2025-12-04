import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LayerData } from '../types';

/**
 * 图层管理 Hook
 * 提供图层的增删改查、分组、排序等功能
 *
 * 优化说明：
 * - 使用 useRef 追踪当前 layers，避免闭包陷阱
 * - 使用函数式更新确保状态一致性
 * - 减少回调函数的依赖，避免不必要的重建
 * - ✅ 性能优化：使用防抖和 requestIdleCallback 延迟历史保存
 */
export function useLayerManager(
  initialLayers: LayerData[] = [],
  onHistorySave?: (layers: LayerData[], description: string) => void
) {
  const [layers, setLayers] = useState<LayerData[]>(initialLayers);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<LayerData[] | null>(null);

  // 使用 ref 追踪当前 layers，避免闭包陷阱
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // 使用 ref 追踪 onHistorySave，避免依赖变化导致回调重建
  const onHistorySaveRef = useRef(onHistorySave);
  onHistorySaveRef.current = onHistorySave;

  // ✅ 性能优化：防抖保存历史记录
  const pendingHistorySaveRef = useRef<{
    layers: LayerData[];
    description: string;
  } | null>(null);
  const historyDebounceTimerRef = useRef<number | null>(null);
  const idleCallbackIdRef = useRef<number | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (historyDebounceTimerRef.current !== null) {
        clearTimeout(historyDebounceTimerRef.current);
      }
      if (idleCallbackIdRef.current !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackIdRef.current);
      }
    };
  }, []);

  // ✅ 性能优化：使用简化的防抖保存历史
  // 移除双重延迟机制，只使用单一的防抖
  const debouncedHistorySave = useCallback((newLayers: LayerData[], description: string) => {
    // 更新待保存的数据（合并连续操作）
    pendingHistorySaveRef.current = { layers: newLayers, description };

    // 清除之前的防抖定时器
    if (historyDebounceTimerRef.current !== null) {
      clearTimeout(historyDebounceTimerRef.current);
    }

    // 清除之前的 idleCallback
    if (idleCallbackIdRef.current !== null && 'cancelIdleCallback' in window) {
      (window as any).cancelIdleCallback(idleCallbackIdRef.current);
      idleCallbackIdRef.current = null;
    }

    // 设置防抖：16ms (约一帧) 内的连续操作会被合并
    // 减少延迟时间，让状态更新更快完成
    historyDebounceTimerRef.current = window.setTimeout(() => {
      historyDebounceTimerRef.current = null;

      const pendingData = pendingHistorySaveRef.current;
      if (!pendingData) return;

      // 直接执行保存，不再使用 requestIdleCallback 二次延迟
      // 这样可以更快地完成状态更新，减少卡顿
      pendingHistorySaveRef.current = null;
      onHistorySaveRef.current?.(pendingData.layers, pendingData.description);
    }, 16);
  }, []);

  // 更新图层并保存历史 - 使用函数式更新
  // ✅ 性能优化：使用防抖历史保存
  const updateLayersWithHistory = useCallback((newLayers: LayerData[], description: string = 'history.update') => {
    setLayers(newLayers);
    debouncedHistorySave(newLayers, description);
  }, [debouncedHistorySave]); // 依赖 debouncedHistorySave

  // 添加图层 - 使用函数式更新
  // ✅ 性能优化：使用防抖保存历史，避免重复保存
  const addLayer = useCallback((layer: LayerData) => {
    setLayers(prevLayers => {
      const newLayers = [...prevLayers, layer];
      const description = layer.type === 'image' ? 'history.addImage' :
                         layer.type === 'text' ? 'history.addText' :
                         layer.type === 'rect' ? 'history.addRect' :
                         layer.type === 'circle' ? 'history.addCircle' :
                         layer.type === 'line' ? 'history.addLine' :
                         'history.addLayer';
      // ✅ 使用防抖保存历史，避免重复保存
      setTimeout(() => {
        debouncedHistorySave(newLayers, description);
      }, 0);
      return newLayers;
    });
    setSelectedIds([layer.id]);
  }, [debouncedHistorySave]); // 依赖 debouncedHistorySave

  // ✅ 性能优化：更新单个图层 - 使用防抖异步保存历史记录
  // 对于拖拽、缩放等连续操作，使用防抖机制避免频繁保存
  const updateLayer = useCallback((id: string, attrs: Partial<LayerData>, saveHistory: boolean = true) => {
    // 先同步更新 layers 状态
    setLayers(prevLayers => {
      return prevLayers.map(l => l.id === id ? { ...l, ...attrs } : l);
    });

    // 异步保存历史（使用防抖）- 直接调用，不再使用额外的 requestAnimationFrame
    // 防抖机制已经在 debouncedHistorySave 内部处理，不需要额外延迟
    if (saveHistory) {
      // 根据修改的属性生成描述
      const description = attrs.visible !== undefined ? 'history.toggleVisibility' :
                         (attrs as any).locked !== undefined ? 'history.toggleLock' :
                         attrs.name !== undefined ? 'history.rename' :
                         attrs.x !== undefined || attrs.y !== undefined ? 'history.move' :
                         attrs.width !== undefined || attrs.height !== undefined ? 'history.resize' :
                         attrs.rotation !== undefined ? 'history.rotate' :
                         'history.updateLayer';
      // 使用 setTimeout 确保在状态更新后触发防抖保存（而不是 queueMicrotask，避免同一微任务队列中重复调用）
      setTimeout(() => {
        debouncedHistorySave(layersRef.current, description);
      }, 0);
    }
  }, [debouncedHistorySave]); // 依赖 debouncedHistorySave

  // 删除图层（包括子图层）- 使用函数式更新
  // ✅ 性能优化：使用防抖保存历史，避免重复保存
  const deleteLayers = useCallback((ids: string[]) => {
    setLayers(prevLayers => {
      const idsToDelete = new Set(ids);
      let changed = true;

      // 递归查找所有子图层
      while (changed) {
        changed = false;
        prevLayers.forEach(l => {
          if (l.parentId && idsToDelete.has(l.parentId) && !idsToDelete.has(l.id)) {
            idsToDelete.add(l.id);
            changed = true;
          }
        });
      }

      // 过滤掉要删除的图层
      const newLayers = prevLayers.filter(l => !idsToDelete.has(l.id));
      const description = ids.length > 1 ? 'history.deleteLayers' : 'history.deleteLayer';
      
      // ✅ 性能优化：使用防抖保存历史，避免重复保存
      // 使用 setTimeout 确保在状态更新后触发防抖保存（而不是 queueMicrotask，避免同一微任务队列中重复调用）
      setTimeout(() => {
        debouncedHistorySave(newLayers, description);
      }, 0);
      
      return newLayers;
    });
    setSelectedIds([]);
  }, [debouncedHistorySave]); // 依赖 debouncedHistorySave

  // 切换可见性 - 使用 ref 获取最新 layers
  const toggleVisibility = useCallback((id: string) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (layer) {
      updateLayer(id, { visible: !layer.visible });
    }
  }, [updateLayer]);

  // 复制图层 - 使用 ref 获取最新 layers
  // ✅ 性能优化：使用防抖保存历史，避免重复保存
  const duplicateLayer = useCallback((id: string) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (!layer) return;

    const newLayer = {
      ...layer,
      id: uuidv4(),
      name: `${layer.name} Copy`,
      x: layer.x + 20,
      y: layer.y + 20,
      parentId: layer.parentId
    };
    // addLayer 内部会自动添加描述，但这里是复制操作，需要特殊处理
    setLayers(prevLayers => {
      const newLayers = [...prevLayers, newLayer];
      
      // ✅ 使用防抖保存历史，避免重复保存
      setTimeout(() => {
        debouncedHistorySave(newLayers, 'history.duplicate');
      }, 0);
      return newLayers;
    });
    setSelectedIds([newLayer.id]);
  }, [debouncedHistorySave]); // 依赖 debouncedHistorySave

  // 图层排序 - 使用函数式更新
  // ✅ 性能优化：使用防抖保存历史，避免重复保存
  const reorderLayer = useCallback((id: string, direction: 'up' | 'down') => {
    setLayers(prevLayers => {
      const subject = prevLayers.find(l => l.id === id);
      if (!subject) return prevLayers;

      const siblings = prevLayers.filter(l => l.parentId === subject.parentId);
      const siblingIndex = siblings.findIndex(l => l.id === id);

      if (siblingIndex === -1) return prevLayers;
      if (direction === 'up' && siblingIndex === siblings.length - 1) return prevLayers;
      if (direction === 'down' && siblingIndex === 0) return prevLayers;

      const swapTarget = direction === 'up' ? siblings[siblingIndex + 1] : siblings[siblingIndex - 1];
      const indexA = prevLayers.findIndex(l => l.id === subject.id);
      const indexB = prevLayers.findIndex(l => l.id === swapTarget.id);

      const newLayers = [...prevLayers];
      [newLayers[indexA], newLayers[indexB]] = [newLayers[indexB], newLayers[indexA]];

      const description = direction === 'up' ? 'history.moveUp' : 'history.moveDown';
      
      // ✅ 使用防抖保存历史，避免重复保存
      setTimeout(() => {
        debouncedHistorySave(newLayers, description);
      }, 0);
      return newLayers;
    });
  }, [debouncedHistorySave]); // 依赖 debouncedHistorySave

  // 复制到剪贴板 - 使用 ref 获取最新 layers
  const copyToClipboard = useCallback(() => {
    if (selectedIds.length > 0) {
      const selected = layersRef.current.filter(l => selectedIds.includes(l.id));
      setClipboard(selected);
    }
  }, [selectedIds]);

  // 从剪贴板粘贴 - 使用函数式更新
  // ✅ 性能优化：使用防抖保存历史，避免重复保存
  const pasteFromClipboard = useCallback(() => {
    if (clipboard && clipboard.length > 0) {
      const newLayersToAdd = clipboard.map(l => ({
        ...l,
        id: uuidv4(),
        name: `${l.name} Copy`,
        x: l.x + 20,
        y: l.y + 20,
        parentId: undefined
      }));
      setLayers(prevLayers => {
        const updatedLayers = [...prevLayers, ...newLayersToAdd];
        
        // ✅ 使用防抖保存历史，避免重复保存
        setTimeout(() => {
          debouncedHistorySave(updatedLayers, 'history.paste');
        }, 0);
        return updatedLayers;
      });
      setSelectedIds(newLayersToAdd.map(l => l.id));
    }
  }, [clipboard, debouncedHistorySave]); // 依赖 debouncedHistorySave

  return {
    layers,
    setLayers,
    selectedIds,
    setSelectedIds,
    clipboard,
    addLayer,
    updateLayer,
    updateLayersWithHistory,
    deleteLayers,
    toggleVisibility,
    duplicateLayer,
    reorderLayer,
    copyToClipboard,
    pasteFromClipboard,
  };
}
