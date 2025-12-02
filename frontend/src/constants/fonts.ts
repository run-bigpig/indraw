/**
 * 可用字体列表
 * 包含常见的系统字体和Web安全字体
 */
export const AVAILABLE_FONTS = [
  'Arial',
  'Arial Black',
  'Comic Sans MS',
  'Courier New',
  'Georgia',
  'Impact',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Helvetica',
  'Tahoma',
  'Lucida Console',
  'Palatino',
  'Garamond',
  'Bookman',
  'Avant Garde',
  'Century Gothic',
  'Monaco',
  'Consolas',
  'Courier',
  'Lucida Sans Unicode',
  'MS Sans Serif',
  'MS Serif',
  'Symbol',
  'Webdings',
  'Wingdings',
  'Zapf Dingbats',
  'Inter',
  'JetBrains Mono',
] as const;

export type FontName = typeof AVAILABLE_FONTS[number];

export const DEFAULT_FONT = 'Arial';

/**
 * 符号字体列表
 * 这些字体是符号字体，不适合用于显示字体名称
 * 在字体选择器中显示这些字体名称时，应使用默认字体
 */
export const SYMBOL_FONTS = new Set(['Symbol', 'Webdings', 'Wingdings', 'Zapf Dingbats']);

/**
 * 检查字体是否为符号字体
 */
export function isSymbolFont(fontName: string): boolean {
  return SYMBOL_FONTS.has(fontName);
}

