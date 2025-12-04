/**
 * 图片切割模态框组件
 * 支持两种切割模式：
 * - 九宫格模式：将图片裁剪为正方形后分割成 3x3 的 9 等份
 * - 智能切割模式：使用 OpenCV 自动检测并提取图像中的独立元素
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Grid3X3, 
  Sparkles, 
  Check, 
  Loader2, 
  Download,
  Save,
  Settings2,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Layers
} from 'lucide-react';
import clsx from 'clsx';
import { checkOpenCVReady, processImage } from '@/services/opencvService';
import { ProcessMode, GridSlice, SmartExtractParams, DEFAULT_SMART_PARAMS } from '@/types';
import { ExportSliceImages } from '../../wailsjs/go/core/App';

interface ImageSliceModalProps {
  /** 要切割的图像源 (base64 或 URL) */
  imageSrc: string;
  /** 切割完成回调，返回选中的切片图像数组 */
  onSliceComplete: (slices: { dataUrl: string; width: number; height: number }[]) => void;
  /** 取消切割回调 */
  onCancel: () => void;
}

const ImageSliceModal: React.FC<ImageSliceModalProps> = ({
  imageSrc,
  onSliceComplete,
  onCancel,
}) => {
  const { t } = useTranslation(['common', 'dialog']);

  // 切割模式
  const [mode, setMode] = useState<ProcessMode>(ProcessMode.GRID_3X3);
  
  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpenCVReady, setIsOpenCVReady] = useState(false);
  const [processingMethod, setProcessingMethod] = useState<'transformers' | 'opencv' | null>(null);
  
  // 切片结果
  const [slices, setSlices] = useState<GridSlice[]>([]);
  
  // 选中的切片 ID
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // 智能切割参数
  const [smartParams, setSmartParams] = useState<SmartExtractParams>(DEFAULT_SMART_PARAMS);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  // 加载 OpenCV
  useEffect(() => {
    const initOpenCV = async () => {
      try {
        if (checkOpenCVReady()) {
          setIsOpenCVReady(true);
          console.log('[ImageSliceModal] setIsOpenCVReady(true) 已调用');
        } else {
          throw new Error('OpenCV 未加载');
        }
      } catch (error) {
        console.error('加载 OpenCV 失败:', error);
      }
    };
    initOpenCV();
  }, []);

  // 当模式或参数变化时自动处理
  useEffect(() => {
    if (isOpenCVReady && imageSrc) {
      handleProcess();
    }
  }, [mode, isOpenCVReady, imageSrc]); // 不包含 smartParams，需要手动触发

  // 处理图片切割
  const handleProcess = useCallback(async () => {
    if (!isOpenCVReady || !imageSrc) return;
    
    setIsProcessing(true);
    setSlices([]);
    setSelectedIds(new Set());
    setProcessingMethod(null);
    
    try {
      // 智能切割模式会优先使用 transformers.js
      if (mode === ProcessMode.SMART_EXTRACT) {
        setProcessingMethod('transformers');
      } else {
        setProcessingMethod('opencv');
      }
      
      const result = await processImage(
        imageSrc, 
        mode, 
        mode === ProcessMode.SMART_EXTRACT ? smartParams : undefined
      );
      setSlices(result);
      // 默认全选
      setSelectedIds(new Set(result.map(s => s.id)));
    } catch (error) {
      console.error('图片切割失败:', error);
      // 如果 transformers.js 失败，可能会回退到 OpenCV
      if (mode === ProcessMode.SMART_EXTRACT) {
        setProcessingMethod('opencv');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isOpenCVReady, imageSrc, mode, smartParams]);

  // 切换选中状态
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === slices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(slices.map(s => s.id)));
    }
  }, [slices, selectedIds]);

  // 确认导入选中的切片
  const handleConfirm = useCallback(() => {
    const selectedSlices = slices
      .filter(s => selectedIds.has(s.id))
      .map(s => ({
        dataUrl: s.dataUrl,
        width: s.width,
        height: s.height,
      }));
    onSliceComplete(selectedSlices);
  }, [slices, selectedIds, onSliceComplete]);

  // 导出选中的切片到本地（使用后端 API）
  const handleExport = useCallback(async () => {
    const selectedSlices = slices.filter(s => selectedIds.has(s.id));
    
    if (selectedSlices.length === 0) {
      return;
    }

    try {
      // 准备切片数据
      const slicesData = selectedSlices.map(s => ({
        dataUrl: s.dataUrl,
        id: s.id,
      }));

      // 调用后端 API 保存切片
      const resultJSON = await ExportSliceImages(JSON.stringify(slicesData));
      
      if (resultJSON) {
        const result = JSON.parse(resultJSON);
        console.log(`成功保存 ${result.count} 个切片到: ${result.directory}`);
        // 可以在这里显示成功提示
      }
    } catch (error) {
      console.error('导出切片失败:', error);
      // 如果后端 API 不可用，回退到浏览器下载方式
      console.warn('回退到浏览器下载方式');
      for (let i = 0; i < selectedSlices.length; i++) {
        const slice = selectedSlices[i];
        const link = document.createElement('a');
        link.href = slice.dataUrl;
        link.download = `slice-${slice.id + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (i < selectedSlices.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
  }, [slices, selectedIds]);

  // 更新智能参数
  const updateSmartParam = useCallback(<K extends keyof SmartExtractParams>(
    key: K, 
    value: SmartExtractParams[K]
  ) => {
    setSmartParams(prev => ({ ...prev, [key]: value }));
  }, []);

  // 计算九宫格布局
  const gridLayout = useMemo(() => {
    if (mode === ProcessMode.GRID_3X3 && slices.length === 9) {
      return {
        cols: 3,
        rows: 3,
      };
    }
    // 智能切割：自适应列数
    const count = slices.length;
    if (count <= 4) return { cols: 2, rows: Math.ceil(count / 2) };
    if (count <= 9) return { cols: 3, rows: Math.ceil(count / 3) };
    return { cols: 4, rows: Math.ceil(count / 4) };
  }, [mode, slices.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl w-[92vw] max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
              <Layers size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-100">
                {t('dialog:slice.title')}
              </h2>
              <p className="text-xs text-gray-500">{t('dialog:slice.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-slate-700/50 text-gray-400 hover:text-gray-200 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* 模式选择 */}
        <div className="px-5 py-4 border-b border-slate-700/30 bg-slate-800/20">
          <div className="flex gap-3">
            {/* 九宫格模式 */}
            <button
              onClick={() => setMode(ProcessMode.GRID_3X3)}
              className={clsx(
                'flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200',
                mode === ProcessMode.GRID_3X3
                  ? 'bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/60'
              )}
            >
              <div className={clsx(
                'p-2.5 rounded-lg transition-colors',
                mode === ProcessMode.GRID_3X3 
                  ? 'bg-cyan-500/20 text-cyan-400' 
                  : 'bg-slate-700/50 text-gray-400'
              )}>
                <Grid3X3 size={22} />
              </div>
              <div className="text-left">
                <h3 className={clsx(
                  'font-medium text-sm',
                  mode === ProcessMode.GRID_3X3 ? 'text-cyan-300' : 'text-gray-300'
                )}>
                  {t('dialog:slice.modeGrid')}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('dialog:slice.modeGridDesc')}</p>
              </div>
            </button>

            {/* 智能切割模式 */}
            <button
              onClick={() => setMode(ProcessMode.SMART_EXTRACT)}
              className={clsx(
                'flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200',
                mode === ProcessMode.SMART_EXTRACT
                  ? 'bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border-violet-500/50 shadow-lg shadow-violet-500/10'
                  : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/60'
              )}
            >
              <div className={clsx(
                'p-2.5 rounded-lg transition-colors',
                mode === ProcessMode.SMART_EXTRACT 
                  ? 'bg-violet-500/20 text-violet-400' 
                  : 'bg-slate-700/50 text-gray-400'
              )}>
                <Sparkles size={22} />
              </div>
              <div className="text-left">
                <h3 className={clsx(
                  'font-medium text-sm',
                  mode === ProcessMode.SMART_EXTRACT ? 'text-violet-300' : 'text-gray-300'
                )}>
                  {t('dialog:slice.modeSmart')}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('dialog:slice.modeSmartDesc')}</p>
              </div>
            </button>
          </div>

          {/* 智能切割高级参数 */}
          {mode === ProcessMode.SMART_EXTRACT && (
            <div className="mt-4">
              <button
                onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                <Settings2 size={14} />
                <span>{t('dialog:slice.params.title')}</span>
                {showAdvancedParams ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {showAdvancedParams && (
                <div className="mt-3 p-4 bg-slate-800/40 rounded-xl border border-slate-700/30 grid grid-cols-2 gap-4">
                  {/* 最小面积比 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      {t('dialog:slice.params.minAreaRatio')}
                      <span className="text-gray-600 ml-1">({(smartParams.minAreaRatio * 100).toFixed(1)}%)</span>
                    </label>
                    <input
                      type="range"
                      min={0.0001}
                      max={0.01}
                      step={0.0001}
                      value={smartParams.minAreaRatio}
                      onChange={(e) => updateSmartParam('minAreaRatio', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">{t('dialog:slice.params.minAreaRatioDesc')}</p>
                  </div>

                  {/* 形态学内核 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      {t('dialog:slice.params.morphKernel')}
                      <span className="text-gray-600 ml-1">({smartParams.morphKernelSize}px)</span>
                    </label>
                    <input
                      type="range"
                      min={3}
                      max={15}
                      step={2}
                      value={smartParams.morphKernelSize}
                      onChange={(e) => updateSmartParam('morphKernelSize', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">{t('dialog:slice.params.morphKernelDesc')}</p>
                  </div>

                  {/* 宽高比范围 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      {t('dialog:slice.params.aspectRatio')}
                      <span className="text-gray-600 ml-1">({smartParams.minAspectRatio} - {smartParams.maxAspectRatio})</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0.01}
                        max={1}
                        step={0.01}
                        value={smartParams.minAspectRatio}
                        onChange={(e) => updateSmartParam('minAspectRatio', Number(e.target.value))}
                        className="flex-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-gray-300"
                      />
                      <span className="text-gray-500">-</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        step={0.5}
                        value={smartParams.maxAspectRatio}
                        onChange={(e) => updateSmartParam('maxAspectRatio', Number(e.target.value))}
                        className="flex-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-gray-300"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">{t('dialog:slice.params.aspectRatioDesc')}</p>
                  </div>

                  {/* 精细轮廓 */}
                  <div>
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smartParams.useDetailedContours}
                        onChange={(e) => updateSmartParam('useDetailedContours', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
                      />
                      <span>{t('dialog:slice.params.detailedContours')}</span>
                    </label>
                    <p className="text-[10px] text-gray-600 mt-1 ml-6">{t('dialog:slice.params.detailedContoursDesc')}</p>
                  </div>

                  {/* 重新处理按钮 */}
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={handleProcess}
                      disabled={isProcessing}
                      className="px-4 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? t('dialog:slice.processing') : t('dialog:slice.preview')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 预览区域 */}
        <div className="flex-1 overflow-auto p-5 bg-slate-950/50">
          {!isOpenCVReady ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 size={40} className="text-violet-400 animate-spin mb-4" />
              <p className="text-gray-400">{t('dialog:slice.loadingOpenCV')}</p>
            </div>
          ) : isProcessing ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 size={40} className="text-violet-400 animate-spin mb-4" />
              <p className="text-gray-400">{t('dialog:slice.processing')}</p>
              {processingMethod === 'transformers' && (
                <p className="text-xs text-gray-500 mt-2">
                  使用 AI 模型进行智能抠图...
                </p>
              )}
            </div>
          ) : slices.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="p-4 rounded-full bg-slate-800/50 mb-4">
                <Layers size={40} className="text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">{t('dialog:slice.noResults')}</p>
            </div>
          ) : (
            <>
              {/* 选择工具栏 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">
                    {t('dialog:slice.sliceCount', { count: slices.length })}
                  </span>
                  <span className="text-xs text-gray-600">•</span>
                  <span className="text-sm text-violet-400">
                    {t('dialog:slice.selectedCount', { count: selectedIds.size })}
                  </span>
                </div>
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg transition-colors"
                >
                  {selectedIds.size === slices.length ? (
                    <>
                      <CheckSquare size={14} />
                      {t('dialog:slice.deselectAll')}
                    </>
                  ) : (
                    <>
                      <Square size={14} />
                      {t('dialog:slice.selectAll')}
                    </>
                  )}
                </button>
              </div>

              {/* 切片网格 */}
              <div 
                className="grid gap-4"
                style={{ 
                  gridTemplateColumns: `repeat(${gridLayout.cols}, minmax(0, 1fr))` 
                }}
              >
                {slices.map((slice) => (
                  <div
                    key={slice.id}
                    onClick={() => toggleSelection(slice.id)}
                    className={clsx(
                      'relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200',
                      selectedIds.has(slice.id)
                        ? 'border-violet-500 shadow-lg shadow-violet-500/20 ring-2 ring-violet-500/30'
                        : 'border-slate-700/50 hover:border-slate-600'
                    )}
                  >
                    {/* 棋盘格背景显示透明区域 */}
                    <div 
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), 
                                         linear-gradient(-45deg, #1e293b 25%, transparent 25%), 
                                         linear-gradient(45deg, transparent 75%, #1e293b 75%), 
                                         linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
                        backgroundSize: '16px 16px',
                        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                        backgroundColor: '#0f172a',
                      }}
                    />
                    
                    {/* 切片图像 */}
                    <img
                      src={slice.dataUrl}
                      alt={`Slice ${slice.id + 1}`}
                      className="relative w-full h-auto object-contain"
                      style={{ minHeight: '100px', maxHeight: '200px' }}
                    />
                    
                    {/* 选中指示器 */}
                    <div className={clsx(
                      'absolute top-2 right-2 p-1.5 rounded-lg transition-all',
                      selectedIds.has(slice.id)
                        ? 'bg-violet-500 text-white'
                        : 'bg-slate-900/80 text-gray-500 opacity-0 group-hover:opacity-100'
                    )}>
                      {selectedIds.has(slice.id) ? (
                        <Check size={14} />
                      ) : (
                        <Square size={14} />
                      )}
                    </div>

                    {/* 尺寸信息 */}
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-slate-900/90 to-transparent">
                      <span className="text-[10px] text-gray-400">
                        {slice.width} × {slice.height}
                      </span>
                    </div>

                    {/* 序号 */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-xs text-gray-400">
                      #{slice.id + 1}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="text-xs text-gray-500">
            {slices.length > 0 && (
              <span>
                {t('dialog:slice.selectSlices')}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm font-medium transition-colors"
            >
              {t('common:cancel')}
            </button>
            <button
              onClick={handleExport}
              disabled={isProcessing || selectedIds.size === 0}
              className={clsx(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all',
                'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500',
                'text-white shadow-lg shadow-cyan-500/25',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
              )}
            >
              <Save size={16} />
              {t('dialog:slice.exportSelected')} ({selectedIds.size})
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing || selectedIds.size === 0}
              className={clsx(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all',
                'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500',
                'text-white shadow-lg shadow-violet-500/25',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t('dialog:slice.processing')}
                </>
              ) : (
                <>
                  <Download size={16} />
                  {t('dialog:slice.importSelected')} ({selectedIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageSliceModal;

