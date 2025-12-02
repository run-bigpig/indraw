/**
 * layerName - 图层名称工具模块
 * 提供图层名称的多语言支持
 */

import { LayerData } from '../types';
import type { TFunction } from 'i18next';

/**
 * 根据图层类型获取基础名称键（带命名空间）
 */
function getLayerTypeKey(layer: LayerData): string {
  switch (layer.type) {
    case 'image':
      // 检查是否是 AI 生成的图片
      if (layer.name.includes('AI Gen')) {
        return 'common:layerTypes.aiGen';
      }
      // 检查是否是融合图层
      if (layer.name.includes('Blend')) {
        return 'common:layerTypes.blend';
      }
      return 'common:layerTypes.image';
    case 'text':
      return 'common:layerTypes.text';
    case 'group':
      return 'common:layerTypes.group';
    case 'line':
      // 检查是否是擦除蒙版
      if (layer.blendMode === 'destination-out' || layer.name.includes('Erase')) {
        return 'common:layerTypes.eraseMask';
      }
      // 检查是否是画笔描边
      if (layer.name.includes('Brush')) {
        return 'common:layerTypes.brushStroke';
      }
      return 'common:layerTypes.brushStroke'; // 默认作为画笔描边
    case 'polygon':
      return 'common:layerTypes.polygon';
    case 'star':
      return 'common:layerTypes.star';
    case 'rounded-rect':
      return 'common:layerTypes.roundedRect';
    case 'ellipse':
      return 'common:layerTypes.ellipse';
    case 'arrow':
      return 'common:layerTypes.arrow';
    case 'wedge':
      return 'common:layerTypes.wedge';
    case 'ring':
      return 'common:layerTypes.ring';
    case 'arc':
      return 'common:layerTypes.arc';
    default:
      return 'common:layerTypes.image'; // 默认
  }
}

/**
 * 生成图层名称（带编号）
 * @param layer 图层数据
 * @param t 翻译函数
 * @param index 图层索引（可选，用于生成编号）
 */
export function generateLayerName(
  layer: LayerData,
  t: TFunction,
  index?: number
): string {
  const typeKey = getLayerTypeKey(layer);
  const baseName = t(typeKey);
  
  // 如果提供了索引，添加编号
  if (index !== undefined) {
    return `${baseName} ${index + 1}`;
  }
  
  // 尝试从现有名称中提取编号
  const match = layer.name.match(/\d+$/);
  if (match) {
    return `${baseName} ${match[0]}`;
  }
  
  return baseName;
}

/**
 * 获取图层的显示名称（多语言）
 * 如果图层名称已经是翻译后的格式，直接返回翻译
 * 否则尝试解析并翻译
 */
export function getLayerDisplayName(layer: LayerData, t: TFunction): string {
  // 如果名称已经是翻译键格式，直接翻译
  if (layer.name.startsWith('layerTypes.') || layer.name.startsWith('common:layerTypes.')) {
    const key = layer.name.startsWith('common:') ? layer.name : `common:${layer.name}`;
    return t(key);
  }
  
  // 检查是否是融合图层（包含特殊格式）
  // 匹配格式："{style} Blend ({count} layers)" 或 "{style} 融合 ({count} 图层)"
  if (layer.name.includes('Blend') || layer.name.includes('融合')) {
    const match = layer.name.match(/(.+?)\s+(?:Blend|融合)\s+\((\d+)\s+(?:layers|图层)\)/);
    if (match) {
      const style = match[1];
      const count = match[2];
      const layersText = t('properties:layers', '图层');
      return `${style} ${t('common:layerTypes.blend')} (${count} ${layersText})`;
    }
  }
  
  // 检查是否包含 "Copy" 或 "副本"
  if (layer.name.includes('Copy') || layer.name.includes('副本')) {
    const baseName = layer.name.replace(/\s*(Copy|副本).*$/, '').trim();
    // 尝试翻译基础名称
    const typeKey = getLayerTypeKey(layer);
    const translatedBase = t(typeKey);
    // 提取编号
    const match = baseName.match(/\d+$/);
    const number = match ? ` ${match[0]}` : '';
    return `${translatedBase}${number} ${t('common:layerName.copy')}`;
  }
  
  // 对于多边形和星形，提取点数
  if (layer.type === 'polygon' && layer.numPoints) {
    return `${t('common:layerTypes.polygon')} ${layer.numPoints}`;
  }
  
  if (layer.type === 'star' && layer.numPoints) {
    return `${t('common:layerTypes.star')} ${layer.numPoints}`;
  }
  
  // 尝试解析标准格式：类型 + 编号
  const match = layer.name.match(/^(.+?)\s+(\d+)$/);
  if (match) {
    const [, typePart, number] = match;
    const typeKey = getLayerTypeKey(layer);
    const translatedType = t(typeKey);
    return `${translatedType} ${number}`;
  }
  
  // 如果无法解析，尝试直接翻译类型
  const typeKey = getLayerTypeKey(layer);
  return t(typeKey);
}

/**
 * 创建新图层时生成名称
 * @param type 图层类型
 * @param t 翻译函数
 * @param layerCount 当前图层数量（用于生成编号）
 * @param options 额外选项
 */
export function createLayerName(
  type: LayerData['type'],
  t: TFunction,
  layerCount: number,
  options?: {
    numPoints?: number; // 用于多边形和星形
    blendStyle?: string; // 用于融合图层
    blendCount?: number; // 用于融合图层
    aiGen?: boolean; // 是否是 AI 生成的图片
    eraseMask?: boolean; // 是否是擦除蒙版
  }
): string {
  let typeKey: string;
  
  // 特殊处理：擦除蒙版
  if (options?.eraseMask || (type === 'line' && options?.eraseMask !== false)) {
    // 这里需要根据上下文判断，如果是擦除蒙版，会在调用时明确指定
  }
  
  switch (type) {
    case 'image':
      // AI 生成的图片
      if (options?.aiGen) {
        typeKey = 'common:layerTypes.aiGen';
      } else {
        typeKey = 'common:layerTypes.image';
      }
      break;
    case 'text':
      typeKey = 'common:layerTypes.text';
      break;
    case 'group':
      typeKey = 'common:layerTypes.group';
      break;
    case 'line':
      // 擦除蒙版
      if (options?.eraseMask) {
        typeKey = 'common:layerTypes.eraseMask';
      } else {
        typeKey = 'common:layerTypes.brushStroke';
      }
      break;
    case 'polygon':
      typeKey = 'common:layerTypes.polygon';
      break;
    case 'star':
      typeKey = 'common:layerTypes.star';
      break;
    case 'rounded-rect':
      typeKey = 'common:layerTypes.roundedRect';
      break;
    case 'ellipse':
      typeKey = 'common:layerTypes.ellipse';
      break;
    case 'arrow':
      typeKey = 'common:layerTypes.arrow';
      break;
    case 'wedge':
      typeKey = 'common:layerTypes.wedge';
      break;
    case 'ring':
      typeKey = 'common:layerTypes.ring';
      break;
    case 'arc':
      typeKey = 'common:layerTypes.arc';
      break;
    default:
      typeKey = 'common:layerTypes.image';
  }
  
  const baseName = t(typeKey);
  
  // 特殊处理：多边形和星形带点数
  if ((type === 'polygon' || type === 'star') && options?.numPoints) {
    return `${baseName} ${options.numPoints}`;
  }
  
  // 特殊处理：融合图层
  if (options?.blendStyle && options?.blendCount) {
    // 使用 properties 命名空间中的 layers 键
    const layersText = t('properties:layers', '图层');
    return `${options.blendStyle} ${t('common:layerTypes.blend')} (${options.blendCount} ${layersText})`;
  }
  
  // 默认添加编号
  return `${baseName} ${layerCount + 1}`;
}

