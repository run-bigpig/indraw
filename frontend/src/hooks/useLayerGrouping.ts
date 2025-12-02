import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LayerData } from '../types';

/**
 * 图层分组 Hook
 * 提供图层的分组和解组功能
 */
export function useLayerGrouping(
  layers: LayerData[],
  selectedIds: string[],
  onLayersUpdate: (layers: LayerData[], description: string) => void,
  onSelectionChange: (ids: string[]) => void,
  getName?: (layerCount: number) => string
) {
  // 分组图层
  const groupLayers = useCallback(() => {
    if (selectedIds.length < 2) return;
    
    const selectedLayers = layers.filter(l => selectedIds.includes(l.id));
    if (selectedLayers.length === 0) return;

    // 计算边界框
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedLayers.forEach(l => {
      minX = Math.min(minX, l.x);
      minY = Math.min(minY, l.y);
      maxX = Math.max(maxX, l.x + (l.width || 0));
      maxY = Math.max(maxY, l.y + (l.height || 0));
    });

    const groupId = uuidv4();
    const groupCount = layers.filter(l => l.type === 'group').length;
    const groupLayer: LayerData = {
      id: groupId,
      type: 'group',
      name: getName ? getName(groupCount) : `Group`,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      visible: true
    };

    // 更新子图层的相对位置
    const updatedLayers = layers.map(l => {
      if (selectedIds.includes(l.id)) {
        return {
          ...l,
          parentId: groupId,
          x: l.x - minX,
          y: l.y - minY
        };
      }
      return l;
    });

    onLayersUpdate([...updatedLayers, groupLayer], 'history.group');
    onSelectionChange([groupId]);
  }, [layers, selectedIds, onLayersUpdate, onSelectionChange, getName]);

  // 解组图层
  const ungroupLayers = useCallback(() => {
    const groupsToUngroup = layers.filter(l => selectedIds.includes(l.id) && l.type === 'group');
    if (groupsToUngroup.length === 0) return;

    let currentLayers = [...layers];

    groupsToUngroup.forEach(group => {
      const children = currentLayers.filter(l => l.parentId === group.id);

      // 计算子图层的绝对位置
      const updatedChildren = children.map(child => {
        const rad = (group.rotation * Math.PI) / 180;
        const relativeX = child.x * group.scaleX;
        const relativeY = child.y * group.scaleY;
        const rotatedX = relativeX * Math.cos(rad) - relativeY * Math.sin(rad);
        const rotatedY = relativeX * Math.sin(rad) + relativeY * Math.cos(rad);

        return {
          ...child,
          parentId: group.parentId,
          x: group.x + rotatedX,
          y: group.y + rotatedY,
          rotation: child.rotation + group.rotation,
          scaleX: child.scaleX * group.scaleX,
          scaleY: child.scaleY * group.scaleY,
          opacity: child.opacity * group.opacity
        };
      });

      currentLayers = currentLayers.map(l => {
        const updatedChild = updatedChildren.find(uc => uc.id === l.id);
        return updatedChild || l;
      }).filter(l => l.id !== group.id);
    });

    onLayersUpdate(currentLayers, 'history.ungroup');

    const originalGroupIds = groupsToUngroup.map(g => g.id);
    const childIds = layers.filter(l => l.parentId && originalGroupIds.includes(l.parentId)).map(l => l.id);
    onSelectionChange(childIds);
  }, [layers, selectedIds, onLayersUpdate, onSelectionChange]);

  return {
    groupLayers,
    ungroupLayers,
  };
}

