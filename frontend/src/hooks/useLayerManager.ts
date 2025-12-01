import { useState, useCallback, useRef } from 'react';
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

  // 更新图层并保存历史 - 使用函数式更新
  const updateLayersWithHistory = useCallback((newLayers: LayerData[], description: string = 'history.update') => {
    setLayers(newLayers);
    onHistorySaveRef.current?.(newLayers, description);
  }, []); // 空依赖数组

  // 添加图层 - 使用函数式更新
  const addLayer = useCallback((layer: LayerData) => {
    setLayers(prevLayers => {
      const newLayers = [...prevLayers, layer];
      const description = layer.type === 'image' ? 'history.addImage' :
                         layer.type === 'text' ? 'history.addText' :
                         layer.type === 'rect' ? 'history.addRect' :
                         layer.type === 'circle' ? 'history.addCircle' :
                         layer.type === 'line' ? 'history.addLine' :
                         'history.addLayer';
      onHistorySaveRef.current?.(newLayers, description);
      return newLayers;
    });
    setSelectedIds([layer.id]);
  }, []); // 空依赖数组

  // 更新单个图层 - 使用函数式更新避免闭包陷阱
  const updateLayer = useCallback((id: string, attrs: Partial<LayerData>, saveHistory: boolean = true) => {
    setLayers(prevLayers => {
      const newLayers = prevLayers.map(l => l.id === id ? { ...l, ...attrs } : l);
      if (saveHistory) {
        // 根据修改的属性生成描述
        const description = attrs.visible !== undefined ? 'history.toggleVisibility' :
                           attrs.locked !== undefined ? 'history.toggleLock' :
                           attrs.name !== undefined ? 'history.rename' :
                           attrs.x !== undefined || attrs.y !== undefined ? 'history.move' :
                           attrs.width !== undefined || attrs.height !== undefined ? 'history.resize' :
                           attrs.rotation !== undefined ? 'history.rotate' :
                           'history.updateLayer';
        onHistorySaveRef.current?.(newLayers, description);
      }
      return newLayers;
    });
  }, []); // 空依赖数组，回调永不重建

  // 删除图层（包括子图层）- 使用函数式更新
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
      onHistorySaveRef.current?.(newLayers, description);
      return newLayers;
    });
    setSelectedIds([]);
  }, []); // 空依赖数组

  // 切换可见性 - 使用 ref 获取最新 layers
  const toggleVisibility = useCallback((id: string) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (layer) {
      updateLayer(id, { visible: !layer.visible });
    }
  }, [updateLayer]);

  // 复制图层 - 使用 ref 获取最新 layers
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
      onHistorySaveRef.current?.(newLayers, 'history.duplicate');
      return newLayers;
    });
    setSelectedIds([newLayer.id]);
  }, []);

  // 图层排序 - 使用函数式更新
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
      onHistorySaveRef.current?.(newLayers, description);
      return newLayers;
    });
  }, []); // 空依赖数组

  // 复制到剪贴板 - 使用 ref 获取最新 layers
  const copyToClipboard = useCallback(() => {
    if (selectedIds.length > 0) {
      const selected = layersRef.current.filter(l => selectedIds.includes(l.id));
      setClipboard(selected);
    }
  }, [selectedIds]);

  // 从剪贴板粘贴 - 使用函数式更新
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
        onHistorySaveRef.current?.(updatedLayers, 'history.paste');
        return updatedLayers;
      });
      setSelectedIds(newLayersToAdd.map(l => l.id));
    }
  }, [clipboard]);

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
