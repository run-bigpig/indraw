/**
 * 导出选项对话框组件
 * 提供格式选择、质量设置、分辨率设置等导出选项
 */

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export type ExportFormat = 'png' | 'jpeg' | 'webp';
export type ExportScale = 0.5 | 1 | 1.5 | 2 | 3 | 4;

export interface ExportOptions {
  format: ExportFormat;
  quality: number; // 0-100, 仅用于 JPEG 和 WebP
  scale: ExportScale;
  trimTransparent: boolean; // 去除透明边框
}

interface ExportOptionsModalProps {
  isOpen: boolean;
  canvasWidth: number;
  canvasHeight: number;
  previewImage?: string; // 预览图片的 data URL
  defaultOptions?: Partial<ExportOptions>;
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
}

const FORMATS: { value: ExportFormat; label: string; mimeType: string }[] = [
  { value: 'png', label: 'PNG', mimeType: 'image/png' },
  { value: 'jpeg', label: 'JPEG', mimeType: 'image/jpeg' },
  { value: 'webp', label: 'WebP', mimeType: 'image/webp' },
];

const SCALES: ExportScale[] = [0.5, 1, 1.5, 2, 3, 4];

export default function ExportOptionsModal({
  isOpen,
  canvasWidth,
  canvasHeight,
  previewImage,
  defaultOptions,
  onExport,
  onCancel,
}: ExportOptionsModalProps) {
  const { t } = useTranslation(['common', 'export']);
  
  const [format, setFormat] = useState<ExportFormat>(defaultOptions?.format || 'png');
  const [quality, setQuality] = useState<number>(defaultOptions?.quality ?? 90);
  const [scale, setScale] = useState<ExportScale>(defaultOptions?.scale ?? 1);
  const [trimTransparent, setTrimTransparent] = useState<boolean>(defaultOptions?.trimTransparent ?? false);

  const handleExport = useCallback(() => {
    onExport({ format, quality, scale, trimTransparent });
  }, [format, quality, scale, trimTransparent, onExport]);

  const exportWidth = Math.round(canvasWidth * scale);
  const exportHeight = Math.round(canvasHeight * scale);
  const fileSizeEstimate = format === 'png' 
    ? `${Math.round((exportWidth * exportHeight * 4) / 1024 / 1024 * 100) / 100} MB`
    : format === 'jpeg'
    ? `${Math.round((exportWidth * exportHeight * 3 * (quality / 100)) / 1024 / 1024 * 100) / 100} MB`
    : `${Math.round((exportWidth * exportHeight * 3 * (quality / 100) * 0.7) / 1024 / 1024 * 100) / 100} MB`;

  if (!isOpen) return null;

  const dialogContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div 
        className="bg-tech-900 border border-cyan-500/30 rounded-xl w-full max-w-md max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tech-700 bg-tech-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-400/10">
              <Download size={20} className="text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-cyan-100">
              {t('export:title', '导出选项')}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-tech-700 text-gray-400 hover:text-gray-200 transition-colors"
            style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 格式选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              {t('export:format', '格式')}
            </label>
            <div className="flex gap-2">
              {FORMATS.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => setFormat(fmt.value)}
                  className={clsx(
                    "flex-1 px-4 py-2.5 rounded-lg border transition-all font-medium text-sm",
                    format === fmt.value
                      ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/20"
                      : "bg-tech-800 border-tech-600 text-gray-400 hover:bg-tech-700 hover:text-gray-300"
                  )}
                  style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率/缩放 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              {t('export:scale', '分辨率')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SCALES.map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={clsx(
                    "px-4 py-2.5 rounded-lg border transition-all font-medium text-sm",
                    scale === s
                      ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/20"
                      : "bg-tech-800 border-tech-600 text-gray-400 hover:bg-tech-700 hover:text-gray-300"
                  )}
                  style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {t('export:outputSize', '输出尺寸')}: {exportWidth} × {exportHeight} px
            </div>
          </div>

          {/* 质量设置（仅 JPEG 和 WebP） */}
          {(format === 'jpeg' || format === 'webp') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  {t('export:quality', '质量')}
                </label>
                <span className="text-sm text-gray-400">{quality}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-2 bg-tech-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{t('export:lowQuality', '低')}</span>
                <span>{t('export:highQuality', '高')}</span>
              </div>
            </div>
          )}

          {/* 去除透明边框选项 */}
          <div className="flex items-center justify-between p-3 bg-tech-800/30 rounded-lg border border-tech-700">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="trimTransparent"
                checked={trimTransparent}
                onChange={(e) => setTrimTransparent(e.target.checked)}
                className="w-4 h-4 rounded border-tech-600 bg-tech-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-tech-900"
                style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
              />
              <label htmlFor="trimTransparent" className="text-sm text-gray-300 cursor-pointer">
                {t('export:trimTransparent', '去除透明边框')}
              </label>
            </div>
            <span className="text-xs text-gray-500">
              {t('export:trimTransparentDesc', '自动裁剪到内容边界')}
            </span>
          </div>

          {/* 预览图片 */}
          {previewImage && (
            <div className="bg-tech-800/50 rounded-lg p-4 border border-tech-700">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon size={16} className="text-cyan-400" />
                <span className="text-sm font-medium text-gray-300">
                  {t('export:preview', '预览')}
                </span>
              </div>
              <div className="relative w-full bg-tech-950 rounded-lg overflow-hidden border border-tech-700 flex items-center justify-center" style={{ 
                minHeight: '100px',
                maxHeight: '200px'
              }}>
                <img
                  src={previewImage}
                  alt="Export preview"
                  className="max-w-full max-h-[200px] w-auto h-auto object-contain"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px'
                  }}
                />
              </div>
            </div>
          )}

          {/* 预览信息 */}
          <div className="bg-tech-800/50 rounded-lg p-4 border border-tech-700">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon size={16} className="text-cyan-400" />
              <span className="text-sm font-medium text-gray-300">
                {t('export:info', '导出信息')}
              </span>
            </div>
            <div className="space-y-1 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>{t('export:originalSize', '原始尺寸')}:</span>
                <span className="text-gray-300">{canvasWidth} × {canvasHeight} px</span>
              </div>
              <div className="flex justify-between">
                <span>{t('export:exportSize', '导出尺寸')}:</span>
                <span className="text-gray-300">
                  {trimTransparent ? t('export:autoSize', '自动') : `${exportWidth} × ${exportHeight} px`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('export:estimatedSize', '预估大小')}:</span>
                <span className="text-gray-300">{fileSizeEstimate}</span>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm bg-tech-700 hover:bg-tech-600 text-gray-300 rounded-lg transition-colors font-medium"
              style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
            >
              {t('common:cancel', '取消')}
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all font-medium shadow-lg shadow-cyan-900/20"
              style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
            >
              {t('export:export', '导出')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body，确保显示在最上层
  return typeof document !== 'undefined' 
    ? createPortal(dialogContent, document.body)
    : null;
}

