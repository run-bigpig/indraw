/**
 * 画布相关常量
 */

// 默认画布配置
export const DEFAULT_CANVAS_CONFIG = {
  width: 1080,
  height: 1080,
  background: 'transparent' as const,
};

// 画布预设尺寸
export const CANVAS_PRESETS = {
  SQUARE: { width: 1080, height: 1080, name: 'Square (1:1)' },
  FHD: { width: 1920, height: 1080, name: 'FHD (16:9)' },
  MOBILE: { width: 1080, height: 1920, name: 'Mobile (9:16)' },
  PORTRAIT: { width: 1080, height: 1440, name: 'Portrait (3:4)' },
  LANDSCAPE: { width: 1440, height: 1080, name: 'Landscape (4:3)' },
} as const;

// 默认画笔配置
export const DEFAULT_BRUSH_CONFIG = {
  size: 10,
  color: '#ffffff',
  opacity: 1,
};

// 默认橡皮擦配置
export const DEFAULT_ERASER_CONFIG = {
  size: 20,
};

// 默认图层属性
export const DEFAULT_LAYER_PROPS = {
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  blendMode: 'source-over',
};

// 默认文本属性
export const DEFAULT_TEXT_PROPS = {
  text: 'Double click to edit',
  fill: '#ffffff',
  fontSize: 32,
};

// 默认形状颜色
export const DEFAULT_SHAPE_COLOR = '#06B6D4';

