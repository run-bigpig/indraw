/**
 * 图像裁剪模态框组件
 * 使用 react-easy-crop 实现交互式图像裁剪
 */
import React, { useState, useCallback, useEffect } from 'react';
import Cropper, { Area, Point, Size, MediaSize } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { X, Crop, RotateCcw, ZoomIn, ZoomOut, Check, RefreshCw, Lock, Unlock, Move } from 'lucide-react';
import { getCroppedImg } from '../utils/cropImage';
import clsx from 'clsx';

interface ImageCropModalProps {
  /** 要裁剪的图像源 (base64 或 URL) */
  imageSrc: string;
  /** 裁剪完成回调，返回裁剪后的 base64 图像 */
  onCropComplete: (croppedImage: string) => void;
  /** 取消裁剪回调 */
  onCancel: () => void;
  /** 初始宽高比（可选），默认自由裁剪 */
  initialAspect?: number;
}

// 预设宽高比选项 - 使用 0 表示自由模式（因为 undefined 会使用默认值）
const ASPECT_RATIOS = [
  { label: 'free', value: 0, icon: Unlock },
  { label: '1:1', value: 1, icon: Lock },
  { label: '4:3', value: 4 / 3, icon: Lock },
  { label: '16:9', value: 16 / 9, icon: Lock },
  { label: '3:4', value: 3 / 4, icon: Lock },
  { label: '9:16', value: 9 / 16, icon: Lock },
];

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  onCropComplete,
  onCancel,
  initialAspect,
}) => {
  const { t } = useTranslation(['common', 'dialog']);

  // 裁剪状态
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  // 0 表示自由模式，其他数值表示固定宽高比
  const [aspectMode, setAspectMode] = useState<number>(initialAspect || 0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 自由模式下的裁剪框尺寸
  const [cropSize, setCropSize] = useState<Size>({ width: 300, height: 300 });
  // 媒体尺寸（用于计算裁剪框的最大尺寸）
  const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
  
  // 判断是否为自由模式
  const isFreeMode = aspectMode === 0;

  // 裁剪区域变化回调
  const onCropAreaChange = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  // 媒体加载回调
  const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
    setMediaSize(mediaSize);
    // 初始化裁剪框为图片尺寸的 80%
    const initialWidth = Math.min(300, mediaSize.width * 0.8);
    const initialHeight = Math.min(300, mediaSize.height * 0.8);
    setCropSize({ width: initialWidth, height: initialHeight });
  }, []);

  // 确认裁剪
  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      );
      onCropComplete(croppedImage);
    } catch (error) {
      console.error('裁剪图像失败:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imageSrc, rotation, onCropComplete]);

  // 重置裁剪状态
  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    if (mediaSize) {
      setCropSize({ 
        width: Math.min(300, mediaSize.width * 0.8), 
        height: Math.min(300, mediaSize.height * 0.8) 
      });
    }
  }, [mediaSize]);

  // 旋转图像
  const handleRotate = useCallback((direction: 'cw' | 'ccw') => {
    setRotation((prev) => (direction === 'cw' ? prev + 90 : prev - 90));
  }, []);

  // 切换宽高比模式
  const handleAspectChange = useCallback((newAspect: number) => {
    setAspectMode(newAspect);
    // 切换到固定比例时，重置 crop 位置
    setCrop({ x: 0, y: 0 });
  }, []);

  // 计算最大裁剪尺寸
  const maxCropWidth = mediaSize ? Math.min(500, mediaSize.width) : 500;
  const maxCropHeight = mediaSize ? Math.min(500, mediaSize.height) : 500;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-tech-900 rounded-xl border border-tech-700 shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tech-700 bg-tech-800/50">
          <div className="flex items-center gap-2">
            <Crop size={20} className="text-cyan-400" />
            <h2 className="text-sm font-medium text-gray-100">
              {t('dialog:crop.title')}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-tech-700 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 裁剪区域 */}
        <div className="flex-1 relative bg-tech-950 overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={isFreeMode ? undefined : aspectMode}
            cropSize={isFreeMode ? cropSize : undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropAreaChange}
            onMediaLoaded={onMediaLoaded}
            showGrid={true}
            cropShape="rect"
            objectFit="contain"
            restrictPosition={false}
            style={{
              containerStyle: {
                background: '#0a0c10',
              },
              cropAreaStyle: {
                border: '2px solid #06B6D4',
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
              },
            }}
            classes={{
              containerClassName: 'crop-container',
              cropAreaClassName: 'crop-area',
            }}
          />
        </div>

        {/* 控制面板 */}
        <div className="px-4 py-3 border-t border-tech-700 bg-tech-800/50 space-y-3">
          {/* 宽高比选择 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 shrink-0">
              {t('dialog:crop.aspectRatio')}
            </span>
            <div className="flex gap-1 flex-wrap">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.label}
                  onClick={() => handleAspectChange(ratio.value)}
                  className={clsx(
                    'px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1',
                    aspectMode === ratio.value
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                      : 'bg-tech-700 text-gray-400 border border-transparent hover:bg-tech-600 hover:text-gray-300'
                  )}
                >
                  {ratio.label === 'free' ? (
                    <>
                      <Unlock size={12} />
                      {t('dialog:crop.free')}
                    </>
                  ) : (
                    ratio.label
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 自由模式下的裁剪框尺寸控制 */}
          {isFreeMode && (
            <div className="bg-tech-800/50 rounded-lg p-3 space-y-2 border border-tech-700">
              <div className="flex items-center gap-2 mb-2">
                <Move size={14} className="text-cyan-400" />
                <span className="text-xs text-cyan-300 font-medium">
                  {t('dialog:crop.cropSize', '裁剪框尺寸')}
                </span>
              </div>
              {/* 宽度控制 */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-8 shrink-0">
                  {t('dialog:crop.width', 'W')}
                </span>
                <input
                  type="range"
                  min={50}
                  max={maxCropWidth}
                  step={1}
                  value={cropSize.width}
                  onChange={(e) => setCropSize(prev => ({ ...prev, width: Number(e.target.value) }))}
                  className="flex-1 h-1.5 bg-tech-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:bg-cyan-400"
                />
                <span className="text-xs text-cyan-400 w-14 text-right">
                  {Math.round(cropSize.width)}px
                </span>
              </div>
              {/* 高度控制 */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-8 shrink-0">
                  {t('dialog:crop.height', 'H')}
                </span>
                <input
                  type="range"
                  min={50}
                  max={maxCropHeight}
                  step={1}
                  value={cropSize.height}
                  onChange={(e) => setCropSize(prev => ({ ...prev, height: Number(e.target.value) }))}
                  className="flex-1 h-1.5 bg-tech-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:bg-cyan-400"
                />
                <span className="text-xs text-cyan-400 w-14 text-right">
                  {Math.round(cropSize.height)}px
                </span>
              </div>
            </div>
          )}

          {/* 缩放控制 */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-16 shrink-0">
              {t('dialog:crop.zoom')}
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              className="p-1.5 rounded-md bg-tech-700 hover:bg-tech-600 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-tech-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:bg-cyan-400"
            />
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="p-1.5 rounded-md bg-tech-700 hover:bg-tech-600 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ZoomIn size={16} />
            </button>
            <span className="text-xs text-cyan-400 w-12 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* 旋转控制 */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-16 shrink-0">
              {t('dialog:crop.rotation')}
            </span>
            <button
              onClick={() => handleRotate('ccw')}
              className="p-1.5 rounded-md bg-tech-700 hover:bg-tech-600 text-gray-400 hover:text-gray-200 transition-colors"
              title={t('dialog:crop.rotateLeft')}
            >
              <RotateCcw size={16} />
            </button>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1 h-1.5 bg-tech-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:bg-cyan-400"
            />
            <button
              onClick={() => handleRotate('cw')}
              className="p-1.5 rounded-md bg-tech-700 hover:bg-tech-600 text-gray-400 hover:text-gray-200 transition-colors"
              title={t('dialog:crop.rotateRight')}
            >
              <RotateCcw size={16} className="scale-x-[-1]" />
            </button>
            <span className="text-xs text-cyan-400 w-12 text-right">
              {rotation}°
            </span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-tech-700 bg-tech-800/30">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-tech-700 hover:bg-tech-600 text-gray-300 text-sm transition-colors"
          >
            <RefreshCw size={14} />
            {t('dialog:crop.reset')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-1.5 rounded-md bg-tech-700 hover:bg-tech-600 text-gray-300 text-sm transition-colors"
            >
              {t('common:cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing || !croppedAreaPixels}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('dialog:crop.processing')}
                </>
              ) : (
                <>
                  <Check size={14} />
                  {t('dialog:crop.confirm')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;

