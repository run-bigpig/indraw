import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LayerData, ToolType, ShapeType } from '@/types';
import { Layers, Eye, EyeOff, Trash2, Sliders, Sparkles, Copy, ChevronUp, ChevronDown, Palette, Wand, Merge, Group, Folder, FolderOpen, ImageIcon, Maximize, Crop, Grid3X3 } from 'lucide-react';
import clsx from 'clsx';
import { ProcessingState } from '../../App.tsx';
import ContextMenu from './ContextMenu';
import { AVAILABLE_FONTS, DEFAULT_FONT, isSymbolFont } from '@/constants/fonts';
import { getLayerDisplayName } from '@/utils/layerName';

interface PropertiesPanelProps {
  layers: LayerData[];
  selectedIds: string[];
  activeTool: ToolType;
  shapeType?: ShapeType;
  onSetShapeType?: (type: ShapeType) => void;
  brushMode: 'normal' | 'ai';
  processingState: ProcessingState;
  brushConfig: { size: number, color: string, opacity: number };
  inpaintPrompt: string;
  onSetBrushConfig: (config: { size: number, color: string, opacity: number }) => void;
  onSetBrushMode: (mode: 'normal' | 'ai') => void;
  onSetInpaintPrompt: (prompt: string) => void;
  onSelectLayer: (id: string | null, multi?: boolean) => void;
  onDeleteLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onLayerReorder: (id: string, direction: 'up' | 'down') => void;
  onDuplicateLayer: (id: string) => void;
  onUpdateLayer: (id: string, attrs: Partial<LayerData>, saveHistory?: boolean) => void;
  onRemoveBackground: () => void;
  onCropImage: () => void;
  onSliceImage: () => void;
  onAIBlend: (prompt: string, style: string) => void;
  onAITransform: (prompt: string) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onContextMenuAction: (action: string) => void; // Reuse App's handler
  onInpaintSubmit?: () => void;
}

const InputGroup = ({ label, children }: { label: string, children?: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider flex items-center justify-between">
        {label}
    </label>
    {children}
  </div>
);

const NumberInput = ({ value, onChange, onCommit, label }: { value: number, onChange: (val: number) => void, onCommit?: (val: number) => void, label?: string }) => (
    <div className="relative group">
        <input 
            type="number" 
            value={Math.round(value)} 
            onChange={(e) => onChange(Number(e.target.value))}
            onBlur={(e) => onCommit && onCommit(Number(e.target.value))}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onCommit && onCommit(Number((e.target as HTMLInputElement).value));
                    (e.target as HTMLInputElement).blur();
                }
            }}
            className="w-full bg-tech-900 border border-tech-700 rounded px-2 py-1 text-xs text-gray-300 focus:border-cyan-500 focus:outline-none transition-colors"
        />
        {label && <span className="absolute right-2 top-1.5 text-[10px] text-gray-600 pointer-events-none">{label}</span>}
    </div>
);

// ✅ 性能优化：使用防抖的滑块组件
const Slider = ({ value, min, max, step = 1, onChange, onCommit, label }: { value: number, min: number, max: number, step?: number, onChange: (val: number) => void, onCommit?: (val: number) => void, label: string }) => {
    // 使用 ref 存储防抖定时器
    const commitTimeoutRef = useRef<number | null>(null);
    // 本地状态用于即时显示
    const [localValue, setLocalValue] = useState(value);

    // 同步外部值变化
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (commitTimeoutRef.current !== null) {
                clearTimeout(commitTimeoutRef.current);
            }
        };
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        setLocalValue(newValue);
        onChange(newValue);

        // ✅ 防抖提交：延迟 300ms 后自动提交
        if (onCommit) {
            if (commitTimeoutRef.current !== null) {
                clearTimeout(commitTimeoutRef.current);
            }
            commitTimeoutRef.current = window.setTimeout(() => {
                commitTimeoutRef.current = null;
                onCommit(newValue);
            }, 300);
        }
    }, [onChange, onCommit]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
        // 立即提交
        if (onCommit) {
            if (commitTimeoutRef.current !== null) {
                clearTimeout(commitTimeoutRef.current);
                commitTimeoutRef.current = null;
            }
            onCommit(parseFloat((e.target as HTMLInputElement).value));
        }
    }, [onCommit]);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between">
                <span className="text-[10px] text-gray-400">{label}</span>
                <span className="text-[10px] text-cyan-400">{localValue}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step}
                value={localValue}
                onChange={handleChange}
                onMouseUp={handleMouseUp}
                onTouchEnd={handleMouseUp as any}
                className="w-full h-1 bg-tech-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 hover:[&::-webkit-slider-thumb]:bg-cyan-400"
            />
        </div>
    );
};

// Helper to render tree
const LayerItem = ({ 
    layer, 
    level, 
    isSelected, 
    allLayers,
    onSelect, 
    onToggle, 
    onReorder, 
    onContextMenu,
}: any) => {
    const { t } = useTranslation('common');
    const isGroup = layer.type === 'group';
    const children = allLayers.filter((l: LayerData) => l.parentId === layer.id);
    const sortedChildren = [...children].reverse();

    return (
        <>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(layer.id, e.shiftKey || e.ctrlKey || e.metaKey);
                }}
                onContextMenu={(e) => onContextMenu(e, layer.id)}
                className={clsx(
                    "group flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all mb-1 select-none",
                    isSelected
                    ? "bg-cyan-950/30 border-cyan-500/50 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]"
                    : "bg-tech-800/20 border-transparent hover:bg-tech-800"
                )}
                style={{ marginLeft: `${level * 12}px` }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(layer.id); }}
                    className={clsx(
                        "p-1 rounded hover:bg-tech-700 transition-colors",
                        layer.visible ? "text-cyan-400" : "text-gray-600"
                    )}
                >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                
                <div className="w-8 h-8 rounded bg-tech-900 border border-tech-700 overflow-hidden flex items-center justify-center shrink-0 relative">
                     {layer.blendMode && layer.blendMode !== 'source-over' && (
                        <div className="absolute top-0 right-0 w-2 h-2 bg-cyan-500 rounded-bl shadow-sm" />
                    )}
                    {layer.type === 'image' && layer.src ? (
                        <img src={layer.src} alt="" className="w-full h-full object-cover" />
                    ) : layer.type === 'text' ? (
                        <span className="text-xs font-serif text-gray-500">T</span>
                    ) : layer.type === 'line' ? (
                        <div className="w-4 h-0.5 bg-gray-400 rotate-45" />
                    ) : layer.type === 'group' ? (
                        <FolderOpen size={16} className="text-cyan-500" />
                    ) : (
                        <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: layer.fill, border: '1px solid #444' }} />
                    )}
                </div>

                <span className={clsx("text-xs truncate flex-1 font-medium select-none", isSelected ? "text-cyan-100" : "text-gray-400")}>
                    {getLayerDisplayName(layer, t)}
                </span>

                <div className={clsx("flex items-center gap-1", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                    <div className="flex flex-col">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onReorder(layer.id, 'up'); }}
                            className="text-gray-500 hover:text-cyan-400 p-0.5"
                        >
                            <ChevronUp size={12} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onReorder(layer.id, 'down'); }}
                            className="text-gray-500 hover:text-cyan-400 p-0.5"
                        >
                            <ChevronDown size={12} />
                        </button>
                    </div>
                </div>
            </div>
            {isGroup && sortedChildren.map((child: LayerData) => (
                <LayerItem 
                    key={child.id} 
                    layer={child} 
                    level={level + 1} 
                    isSelected={false} 
                    allLayers={allLayers} 
                    onSelect={onSelect}
                    onToggle={onToggle}
                    onReorder={onReorder}
                    onContextMenu={onContextMenu}
                    {...{isSelected: false}} 
                />
            ))}
        </>
    );
};

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  layers,
  selectedIds,
  activeTool,
  shapeType = 'polygon',
  onSetShapeType,
  brushMode,
  processingState,
  brushConfig,
  inpaintPrompt,
  onSetBrushConfig,
  onSetBrushMode,
  onSetInpaintPrompt,
  onSelectLayer,
  onDeleteLayer,
  onToggleVisibility,
  onLayerReorder,
  onDuplicateLayer,
  onUpdateLayer,
  onRemoveBackground,
  onCropImage,
  onSliceImage,
  onAIBlend,
  onAITransform,
  onGroup,
  onUngroup,
  onContextMenuAction,
  onInpaintSubmit,
}) => {
  const { t } = useTranslation(['properties', 'ai', 'common', 'dialog']);
  const [blendPrompt, setBlendPrompt] = useState('');
  const [blendStyle, setBlendStyle] = useState('Seamless');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  // AI Transform state
  const [transformPrompt, setTransformPrompt] = useState('');

  // Active Layer Logic
  const activeLayer = layers.find(l => selectedIds.length === 1 && l.id === selectedIds[0]);
  const isMultipleSelected = selectedIds.length > 1;
  const isGroupSelected = activeLayer?.type === 'group';

  // 检查多选的图层是否都是图片类型
  const selectedLayers = layers.filter(l => selectedIds.includes(l.id));
  const selectedImageLayers = selectedLayers.filter(l => l.type === 'image');
  const isMultipleImageSelected = selectedImageLayers.length >= 2;

  const showTransformForLayer = !!activeLayer && activeLayer.type !== 'line';


  const applyPreset = (preset: 'cyberpunk' | 'vintage' | 'bw' | 'reset') => {
      if (!activeLayer) return;
      const defaults = { brightness: 0, contrast: 0, blurRadius: 0, noise: 0, isGrayscale: false, saturation: 0 };
      let settings = {};
      switch(preset) {
          case 'cyberpunk': settings = { brightness: 0.1, contrast: 20, noise: 0.1, isGrayscale: false }; break;
          case 'vintage': settings = { brightness: -0.1, contrast: -10, noise: 0.2, isGrayscale: true }; break;
          case 'bw': settings = { isGrayscale: true, contrast: 10 }; break;
          case 'reset': settings = defaults; break;
      }
      onUpdateLayer(activeLayer.id, settings, true);
  };

  const handleLayerContextMenu = (e: React.MouseEvent, layerId: string) => {
      e.preventDefault();
      // Select layer if not already selected
      if (!selectedIds.includes(layerId)) {
          onSelectLayer(layerId, false);
      }
      setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const blendModes = [
      'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 
      'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'
  ];
  
  const isGlobalProcessing = processingState !== 'idle';

  return (
    <div className="w-80 bg-tech-900 border-l border-tech-700 flex flex-col z-20 shadow-2xl h-full">

      {/* Header */}
      <div className="h-12 border-b border-tech-700 flex items-center justify-between px-4 bg-tech-800/50 backdrop-blur">
        <span className="font-mono font-medium text-cyan-400 tracking-wider text-sm">{t('properties:controlCenter').toUpperCase()}</span>
        <div className="flex gap-2">
            {selectedIds.length > 0 && (
                <>
                    {selectedIds.length === 1 && (
                        <button onClick={() => onDuplicateLayer(selectedIds[0])} title={t('properties:duplicate')} className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-tech-700 rounded transition-colors">
                            <Copy size={14} />
                        </button>
                    )}
                    <button onClick={() => onDeleteLayer(selectedIds[0])} title={t('properties:delete')} className="p-1.5 text-gray-400 hover:text-danger hover:bg-tech-700 rounded transition-colors">
                        <Trash2 size={14} />
                    </button>
                </>
            )}
        </div>
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Shape Tool Type Selector */}
        {activeTool === 'shape' && onSetShapeType && (
          <div className="p-4 border-b border-tech-700">
            <InputGroup label={t('properties:shapeType')}>
              <select
                value={shapeType}
                onChange={(e) => onSetShapeType(e.target.value as ShapeType)}
                className="w-full bg-tech-900 border border-tech-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-cyan-500 focus:outline-none"
              >
                <option value="polygon">{t('toolbar:polygon')}</option>
                <option value="star">{t('toolbar:star')}</option>
                <option value="rounded-rect">{t('toolbar:roundedRect')}</option>
                <option value="ellipse">{t('toolbar:ellipse')}</option>
                <option value="arrow">{t('toolbar:arrow')}</option>
                <option value="wedge">{t('toolbar:wedge')}</option>
                <option value="ring">{t('toolbar:ring')}</option>
                <option value="arc">{t('toolbar:arc')}</option>
              </select>
            </InputGroup>
          </div>
        )}

        {/* Properties Section */}
        <div className="p-4 border-b border-tech-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Sliders size={14} /> {t('properties:properties')}
                </h3>
            </div>

            {/* Multi Select Actions */}
            {isMultipleSelected && (
                <div className="mb-4">
                     <button
                        onClick={onGroup}
                        className="w-full flex items-center justify-center gap-2 bg-tech-800 border border-tech-600 hover:bg-tech-700 hover:text-white text-gray-300 text-xs py-2 rounded transition-colors"
                     >
                        <Group size={14} /> {t('properties:groupLayers')} (Ctrl+G)
                     </button>
                </div>
            )}

                        {activeLayer ? (
                <div className="space-y-5">
                    {/* Basic Transform */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* 对画笔图层（line）隐藏位置/尺寸/旋转，只保留透明度 */}
                        {showTransformForLayer && (
                            <>
                                <InputGroup label={t('properties:positionX')}>
                                    <NumberInput
                                        value={activeLayer.x}
                                        onChange={(v) => onUpdateLayer(activeLayer.id, { x: v }, false)}
                                        onCommit={(v) => onUpdateLayer(activeLayer.id, { x: v }, true)}
                                    />
                                </InputGroup>
                                <InputGroup label={t('properties:positionY')}>
                                    <NumberInput
                                        value={activeLayer.y}
                                        onChange={(v) => onUpdateLayer(activeLayer.id, { y: v }, false)}
                                        onCommit={(v) => onUpdateLayer(activeLayer.id, { y: v }, true)}
                                    />
                                </InputGroup>
                                <InputGroup label={t('properties:width')}>
                                    <NumberInput
                                        value={activeLayer.width || 0}
                                        onChange={(v) => onUpdateLayer(activeLayer.id, { width: v }, false)}
                                        onCommit={(v) => onUpdateLayer(activeLayer.id, { width: v }, true)}
                                    />
                                </InputGroup>
                                <InputGroup label={t('properties:height')}>
                                    <NumberInput
                                        value={activeLayer.height || 0}
                                        onChange={(v) => onUpdateLayer(activeLayer.id, { height: v }, false)}
                                        onCommit={(v) => onUpdateLayer(activeLayer.id, { height: v }, true)}
                                    />
                                </InputGroup>
                                <InputGroup label={t('properties:rotation')}>
                                    <NumberInput
                                        value={activeLayer.rotation}
                                        onChange={(v) => onUpdateLayer(activeLayer.id, { rotation: v }, false)}
                                        onCommit={(v) => onUpdateLayer(activeLayer.id, { rotation: v }, true)}
                                        label="°"
                                    />
                                </InputGroup>
                            </>
                        )}
                        <InputGroup label={t('properties:opacity')}>
                            <input
                             type="range" min="0" max="1" step="0.1"
                             value={activeLayer.opacity}
                             onChange={(e) => onUpdateLayer(activeLayer.id, { opacity: parseFloat(e.target.value) }, false)}
                             onMouseUp={(e) => onUpdateLayer(activeLayer.id, { opacity: parseFloat((e.target as HTMLInputElement).value) }, true)}
                             onTouchEnd={(e) => onUpdateLayer(activeLayer.id, { opacity: parseFloat((e.target as HTMLInputElement).value) }, true)}
                             className="w-full h-6 bg-transparent cursor-pointer accent-cyan-500"
                            />
                        </InputGroup>
                    </div>

                    {isGroupSelected && (
                        <div className="pt-2">
                             <button
                                onClick={onUngroup}
                                className="w-full flex items-center justify-center gap-2 bg-tech-800 border border-tech-600 hover:bg-tech-700 hover:text-white text-gray-300 text-xs py-2 rounded transition-colors"
                            >
                                <Group size={14} className="rotate-180" /> {t('properties:ungroup')} (Ctrl+Shift+G)
                            </button>
                        </div>
                    )}

                    {/* Blending & Effects */}
                    <div className="pt-3 border-t border-tech-700 space-y-4">
                             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                                <Sliders size={14} /> {t('properties:appearance')}
                            </h3>

                            {/* 混合模式：只对image类型显示，因为形状的混合模式在Konva中不生效 */}
                            {activeLayer.type === 'image' && (
                                <InputGroup label={t('properties:blendMode')}>
                                    <select
                                        value={activeLayer.blendMode || 'source-over'}
                                        onChange={(e) => onUpdateLayer(activeLayer.id, { blendMode: e.target.value }, true)}
                                        className="w-full bg-tech-800 border border-tech-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                                    >
                                        {blendModes.map(mode => (
                                            <option key={mode} value={mode}>{t(`properties:blendModes.${mode}`)}</option>
                                        ))}
                                    </select>
                                </InputGroup>
                            )}

                            {activeLayer.type === 'image' && (
                            <div className="space-y-3 bg-tech-800/30 p-2 rounded border border-tech-700">

                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <button
                                        onClick={onCropImage}
                                        disabled={isGlobalProcessing}
                                        className="flex items-center justify-center gap-1.5 bg-tech-700 hover:bg-tech-600 text-gray-200 text-[10px] py-1.5 rounded transition-colors disabled:opacity-50"
                                    >
                                        <Crop size={12} />
                                        {t('properties:cropImage')}
                                    </button>
                                    <button
                                        onClick={onSliceImage}
                                        disabled={isGlobalProcessing}
                                        className="flex items-center justify-center gap-1.5 bg-tech-700 hover:bg-tech-600 text-gray-200 text-[10px] py-1.5 rounded transition-colors disabled:opacity-50"
                                    >
                                        <Grid3X3 size={12} />
                                        {t('properties:sliceImage')}
                                    </button>
                                    <button
                                        onClick={onRemoveBackground}
                                        disabled={isGlobalProcessing}
                                        className="flex items-center justify-center gap-1.5 bg-tech-700 hover:bg-tech-600 text-gray-200 text-[10px] py-1.5 rounded transition-colors disabled:opacity-50"
                                    >
                                        <Wand size={12} />
                                        {processingState === 'removing-bg' ? t('properties:removing') : t('properties:removeBackground')}
                                    </button>
                                </div>

                                {/* AI Transform Section */}
                                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded p-2 mb-3">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <ImageIcon size={12} className="text-cyan-400" />
                                            <span className="text-[10px] font-medium text-cyan-300 uppercase tracking-wide">
                                                {t('properties:aiTransform')}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-gray-500 mb-1">
                                            {t('properties:aiTransformDesc')}
                                        </p>
                                        <textarea
                                            value={transformPrompt}
                                            onChange={(e) => setTransformPrompt(e.target.value)}
                                            placeholder={t('properties:transformPromptPlaceholder')}
                                            className="w-full bg-tech-900 border border-tech-600 rounded p-1.5 text-[10px] text-gray-300 h-16 resize-none focus:border-cyan-500 focus:outline-none placeholder:text-gray-600"
                                        />
                                        <button
                                            onClick={() => {
                                                if (transformPrompt.trim()) {
                                                    onAITransform(transformPrompt);
                                                    setTransformPrompt('');
                                                }
                                            }}
                                            disabled={isGlobalProcessing || !transformPrompt.trim()}
                                            className="w-full flex items-center justify-center gap-2 bg-cyan-600/80 hover:bg-cyan-500 text-white text-[10px] py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {processingState === 'transforming' ? (
                                                <>
                                                    <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    {t('properties:transforming')}
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={12} />
                                                    {t('properties:generateTransform')}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>


                                {/* Presets */}
                                <InputGroup label={t('properties:presets')}>
                                    <div className="flex gap-1">
                                        {(['cyberpunk', 'vintage', 'bw', 'reset'] as const).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => applyPreset(p)}
                                                className="flex-1 text-[9px] bg-tech-900 border border-tech-600 py-1 rounded hover:bg-tech-700 uppercase"
                                            >
                                                {t(`properties:${p}`)}
                                            </button>
                                        ))}
                                    </div>
                                </InputGroup>

                                <Slider label={t('properties:brightness')} min={-1} max={1} step={0.05} value={activeLayer.brightness || 0} onChange={(v) => onUpdateLayer(activeLayer.id, { brightness: v }, false)} onCommit={(v) => onUpdateLayer(activeLayer.id, { brightness: v }, true)} />
                                <Slider label={t('properties:contrast')} min={-100} max={100} value={activeLayer.contrast || 0} onChange={(v) => onUpdateLayer(activeLayer.id, { contrast: v }, false)} onCommit={(v) => onUpdateLayer(activeLayer.id, { contrast: v }, true)} />
                                <Slider label={t('properties:blur')} min={0} max={40} value={activeLayer.blurRadius || 0} onChange={(v) => onUpdateLayer(activeLayer.id, { blurRadius: v }, false)} onCommit={(v) => onUpdateLayer(activeLayer.id, { blurRadius: v }, true)} />
                                <Slider label={t('properties:noise')} min={0} max={1} step={0.05} value={activeLayer.noise || 0} onChange={(v) => onUpdateLayer(activeLayer.id, { noise: v }, false)} onCommit={(v) => onUpdateLayer(activeLayer.id, { noise: v }, true)} />

                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-[10px] text-gray-400">{t('properties:grayscale')}</span>
                                    <button
                                        onClick={() => onUpdateLayer(activeLayer.id, { isGrayscale: !activeLayer.isGrayscale }, true)}
                                        className={clsx(
                                            "w-8 h-4 rounded-full transition-colors relative",
                                            activeLayer.isGrayscale ? "bg-cyan-600" : "bg-tech-600"
                                        )}
                                    >
                                        <div
                                            className={clsx(
                                                "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                                                activeLayer.isGrayscale ? "translate-x-4" : "translate-x-0"
                                            )}
                                        />
                                    </button>
                                </div>
                            </div>
                        )}

                            {activeLayer.type === 'line' && (
                                <div className="space-y-3 bg-tech-800/30 p-2 rounded border border-tech-700">
                                    <Slider
                                        label={t('properties:strokeWidth')}
                                        min={1}
                                        max={50}
                                        value={activeLayer.strokeWidth || 5}
                                        onChange={(v) =>
                                            onUpdateLayer(activeLayer.id, { strokeWidth: v }, false)
                                        }
                                        onCommit={(v) =>
                                            onUpdateLayer(activeLayer.id, { strokeWidth: v }, true)
                                        }
                                    />
                                    <InputGroup label={t('properties:color')}>
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-8 h-8 rounded border border-tech-600 overflow-hidden">
                                                <input
                                                    type="color"
                                                    value={activeLayer.stroke || '#ffffff'}
                                                    onChange={(e) =>
                                                        onUpdateLayer(
                                                            activeLayer.id,
                                                            { stroke: e.target.value },
                                                            false,
                                                        )
                                                    }
                                                    onBlur={(e) =>
                                                        onUpdateLayer(
                                                            activeLayer.id,
                                                            { stroke: e.target.value },
                                                            true,
                                                        )
                                                    }
                                                    className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] p-0 m-0 border-0 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </InputGroup>
                                </div>
                            )}
                    </div>

                    {(activeLayer.type === 'rect' || activeLayer.type === 'circle' || activeLayer.type === 'text' || activeLayer.type === 'polygon' || activeLayer.type === 'star' || activeLayer.type === 'rounded-rect' || activeLayer.type === 'ellipse' || activeLayer.type === 'arrow' || activeLayer.type === 'wedge' || activeLayer.type === 'ring' || activeLayer.type === 'arc') && (
                         <div className="pt-3 border-t border-tech-700 space-y-3">
                             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                                <Palette size={14} /> {t('properties:style')}
                            </h3>
                            <InputGroup label={t('properties:fillColor')}>
                                <div className="flex items-center gap-2">
                                    <div className="relative w-8 h-8 rounded border border-tech-600 overflow-hidden">
                                        <input
                                            type="color"
                                            value={(() => {
                                                const fill = activeLayer.fill || '#06B6D4';
                                                // 如果是rgba格式，提取rgb部分
                                                if (fill.startsWith('rgba')) {
                                                    const match = fill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                                                    if (match) {
                                                        return `#${parseInt(match[1]).toString(16).padStart(2, '0')}${parseInt(match[2]).toString(16).padStart(2, '0')}${parseInt(match[3]).toString(16).padStart(2, '0')}`;
                                                    }
                                                }
                                                // 如果是hex格式，直接返回
                                                return fill.startsWith('#') ? fill : '#06B6D4';
                                            })()}
                                            onChange={(e) => {
                                                const rgb = e.target.value;
                                                const currentFill = activeLayer.fill || '#06B6D4';
                                                // 如果当前是rgba，保留alpha值
                                                let alpha = 1;
                                                if (currentFill.startsWith('rgba')) {
                                                    const match = currentFill.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
                                                    if (match) alpha = parseFloat(match[1]);
                                                }
                                                const newFill = alpha < 1 ? `rgba(${parseInt(rgb.slice(1, 3), 16)}, ${parseInt(rgb.slice(3, 5), 16)}, ${parseInt(rgb.slice(5, 7), 16)}, ${alpha})` : rgb;
                                                onUpdateLayer(activeLayer.id, { fill: newFill }, false);
                                            }}
                                            onBlur={(e) => {
                                                const rgb = e.target.value;
                                                const currentFill = activeLayer.fill || '#06B6D4';
                                                let alpha = 1;
                                                if (currentFill.startsWith('rgba')) {
                                                    const match = currentFill.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
                                                    if (match) alpha = parseFloat(match[1]);
                                                }
                                                const newFill = alpha < 1 ? `rgba(${parseInt(rgb.slice(1, 3), 16)}, ${parseInt(rgb.slice(3, 5), 16)}, ${parseInt(rgb.slice(5, 7), 16)}, ${alpha})` : rgb;
                                                onUpdateLayer(activeLayer.id, { fill: newFill }, true);
                                            }}
                                            className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] p-0 m-0 border-0 cursor-pointer"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={activeLayer.fill || '#06B6D4'}
                                        onChange={(e) => onUpdateLayer(activeLayer.id, { fill: e.target.value }, false)}
                                        onBlur={(e) => onUpdateLayer(activeLayer.id, { fill: e.target.value }, true)}
                                        className="flex-1 bg-tech-900 border border-tech-700 rounded px-2 py-1.5 text-xs text-gray-300 font-mono"
                                        placeholder="#RRGGBB or rgba(r,g,b,a)"
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-gray-500">{t('properties:fillOpacity')}</span>
                                    <Slider
                                        value={(() => {
                                            const fill = activeLayer.fill || '#06B6D4';
                                            if (fill.startsWith('rgba')) {
                                                const match = fill.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
                                                if (match) return parseFloat(match[1]) * 100;
                                            }
                                            return 100;
                                        })()}
                                        min={0}
                                        max={100}
                                        onChange={(v) => {
                                            const currentFill = activeLayer.fill || '#06B6D4';
                                            let r = 6, g = 182, b = 212;
                                            if (currentFill.startsWith('rgba')) {
                                                const match = currentFill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                                                if (match) {
                                                    r = parseInt(match[1]);
                                                    g = parseInt(match[2]);
                                                    b = parseInt(match[3]);
                                                }
                                            } else if (currentFill.startsWith('#')) {
                                                r = parseInt(currentFill.slice(1, 3), 16);
                                                g = parseInt(currentFill.slice(3, 5), 16);
                                                b = parseInt(currentFill.slice(5, 7), 16);
                                            }
                                            const alpha = v / 100;
                                            const newFill = alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
                                            onUpdateLayer(activeLayer.id, { fill: newFill }, false);
                                        }}
                                        onCommit={(v) => {
                                            const currentFill = activeLayer.fill || '#06B6D4';
                                            let r = 6, g = 182, b = 212;
                                            if (currentFill.startsWith('rgba')) {
                                                const match = currentFill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                                                if (match) {
                                                    r = parseInt(match[1]);
                                                    g = parseInt(match[2]);
                                                    b = parseInt(match[3]);
                                                }
                                            } else if (currentFill.startsWith('#')) {
                                                r = parseInt(currentFill.slice(1, 3), 16);
                                                g = parseInt(currentFill.slice(3, 5), 16);
                                                b = parseInt(currentFill.slice(5, 7), 16);
                                            }
                                            const alpha = v / 100;
                                            const newFill = alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
                                            onUpdateLayer(activeLayer.id, { fill: newFill }, true);
                                        }}
                                        label="%"
                                    />
                                </div>
                            </InputGroup>

                            {/* Stroke */}
                            <InputGroup label={t('properties:strokeColor')}>
                                <div className="flex items-center gap-2">
                                    <div className="relative w-8 h-8 rounded border border-tech-600 overflow-hidden">
                                        <input
                                            type="color"
                                            value={activeLayer.stroke ?? '#000000'}
                                            onChange={(e) => onUpdateLayer(activeLayer.id, { stroke: e.target.value }, false)}
                                            onBlur={(e) => onUpdateLayer(activeLayer.id, { stroke: e.target.value }, true)}
                                            className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] p-0 m-0 border-0 cursor-pointer"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={activeLayer.stroke ?? '#000000'}
                                        onChange={(e) => onUpdateLayer(activeLayer.id, { stroke: e.target.value }, false)}
                                        onBlur={(e) => onUpdateLayer(activeLayer.id, { stroke: e.target.value }, true)}
                                        className="flex-1 bg-tech-900 border border-tech-700 rounded px-2 py-1.5 text-xs text-gray-300 font-mono"
                                    />
                                </div>
                            </InputGroup>

                            <InputGroup label={t('properties:strokeWidth')}>
                                <NumberInput
                                    value={activeLayer.strokeWidth ?? 0}
                                    onChange={(v) => onUpdateLayer(activeLayer.id, { strokeWidth: v }, false)}
                                    onCommit={(v) => onUpdateLayer(activeLayer.id, { strokeWidth: v }, true)}
                                    label="PX"
                                />
                            </InputGroup>

                            {/* Dash Pattern */}
                            <InputGroup label={t('properties:dashPattern')}>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onUpdateLayer(activeLayer.id, { dash: undefined }, true)}
                                        className={clsx(
                                            "flex-1 py-1.5 text-xs rounded border transition-colors",
                                            !activeLayer.dash
                                                ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                                                : "bg-tech-800 border-tech-700 text-gray-400 hover:border-tech-600"
                                        )}
                                    >
                                        {t('properties:solid')}
                                    </button>
                                    <button
                                        onClick={() => onUpdateLayer(activeLayer.id, { dash: [5, 5] }, true)}
                                        className={clsx(
                                            "flex-1 py-1.5 text-xs rounded border transition-colors",
                                            activeLayer.dash?.length === 2 && activeLayer.dash[0] === 5
                                                ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                                                : "bg-tech-800 border-tech-700 text-gray-400 hover:border-tech-600"
                                        )}
                                    >
                                        {t('properties:dashed')}
                                    </button>
                                    <button
                                        onClick={() => onUpdateLayer(activeLayer.id, { dash: [2, 2] }, true)}
                                        className={clsx(
                                            "flex-1 py-1.5 text-xs rounded border transition-colors",
                                            activeLayer.dash?.length === 2 && activeLayer.dash[0] === 2
                                                ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                                                : "bg-tech-800 border-tech-700 text-gray-400 hover:border-tech-600"
                                        )}
                                    >
                                        {t('properties:dotted')}
                                    </button>
                                </div>
                            </InputGroup>

                            {/* Shadow */}
                            <div className="pt-2 border-t border-tech-700 space-y-3">
                                <h4 className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{t('properties:shadow')}</h4>
                                <InputGroup label={t('properties:shadowColor')}>
                                    <div className="flex items-center gap-2">
                                        <div className="relative w-8 h-8 rounded border border-tech-600 overflow-hidden">
                                            <input
                                                type="color"
                                                value={activeLayer.shadowColor || '#000000'}
                                                onChange={(e) => onUpdateLayer(activeLayer.id, { shadowColor: e.target.value }, false)}
                                                onBlur={(e) => onUpdateLayer(activeLayer.id, { shadowColor: e.target.value }, true)}
                                                className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] p-0 m-0 border-0 cursor-pointer"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={activeLayer.shadowColor || '#000000'}
                                            onChange={(e) => onUpdateLayer(activeLayer.id, { shadowColor: e.target.value }, false)}
                                            onBlur={(e) => onUpdateLayer(activeLayer.id, { shadowColor: e.target.value }, true)}
                                            className="flex-1 bg-tech-900 border border-tech-700 rounded px-2 py-1.5 text-xs text-gray-300 font-mono"
                                        />
                                    </div>
                                </InputGroup>
                                <InputGroup label={t('properties:shadowBlur')}>
                                    <Slider
                                        value={activeLayer.shadowBlur || 0}
                                        min={0}
                                        max={50}
                                        onChange={(v) => onUpdateLayer(activeLayer.id, { shadowBlur: v }, false)}
                                        onCommit={(v) => onUpdateLayer(activeLayer.id, { shadowBlur: v }, true)}
                                        label="PX"
                                    />
                                </InputGroup>
                                <div className="grid grid-cols-2 gap-2">
                                    <InputGroup label={t('properties:shadowOffsetX')}>
                                        <NumberInput
                                            value={activeLayer.shadowOffsetX || 0}
                                            onChange={(v) => onUpdateLayer(activeLayer.id, { shadowOffsetX: v }, false)}
                                            onCommit={(v) => onUpdateLayer(activeLayer.id, { shadowOffsetX: v }, true)}
                                        />
                                    </InputGroup>
                                    <InputGroup label={t('properties:shadowOffsetY')}>
                                        <NumberInput
                                            value={activeLayer.shadowOffsetY || 0}
                                            onChange={(v) => onUpdateLayer(activeLayer.id, { shadowOffsetY: v }, false)}
                                            onCommit={(v) => onUpdateLayer(activeLayer.id, { shadowOffsetY: v }, true)}
                                        />
                                    </InputGroup>
                                </div>
                                <InputGroup label={t('properties:shadowOpacity')}>
                                    <Slider
                                        value={(activeLayer.shadowOpacity ?? 1) * 100}
                                        min={0}
                                        max={100}
                                        onChange={(v) => onUpdateLayer(activeLayer.id, { shadowOpacity: v / 100 }, false)}
                                        onCommit={(v) => onUpdateLayer(activeLayer.id, { shadowOpacity: v / 100 }, true)}
                                        label="%"
                                    />
                                </InputGroup>
                            </div>
                         </div>
                    )}

                    {activeLayer.type === 'text' && (
                        <div className="pt-3 border-t border-tech-700 space-y-3">
                            <InputGroup label={t('properties:textContent')}>
                                <textarea
                                    value={activeLayer.text || ''}
                                    onChange={(e) => onUpdateLayer(activeLayer.id, { text: e.target.value }, false)}
                                    onBlur={(e) => onUpdateLayer(activeLayer.id, { text: e.target.value }, true)}
                                    className="w-full bg-tech-900 border border-tech-700 rounded px-2 py-2 text-xs text-gray-300 min-h-[60px] resize-none focus:border-cyan-500 focus:outline-none"
                                />
                            </InputGroup>
                            <InputGroup label={t('properties:fontFamily')}>
                                <select
                                    value={activeLayer.fontFamily || DEFAULT_FONT}
                                    onChange={(e) => onUpdateLayer(activeLayer.id, { fontFamily: e.target.value }, true)}
                                    className="w-full bg-tech-900 border border-tech-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-cyan-500 focus:outline-none"
                                    style={{ fontFamily: activeLayer.fontFamily || DEFAULT_FONT }}
                                >
                                    {AVAILABLE_FONTS.map((font) => (
                                        <option 
                                            key={font} 
                                            value={font} 
                                            style={{ fontFamily: isSymbolFont(font) ? DEFAULT_FONT : font }}
                                        >
                                            {font}
                                        </option>
                                    ))}
                                </select>
                            </InputGroup>
                             <InputGroup label={t('properties:fontSize')}>
                                <NumberInput
                                    value={activeLayer.fontSize || 24}
                                    onChange={(v) => onUpdateLayer(activeLayer.id, { fontSize: v }, false)}
                                    onCommit={(v) => onUpdateLayer(activeLayer.id, { fontSize: v }, true)}
                                    label="PX"
                                />
                            </InputGroup>
                        </div>
                    )}

                </div>
            ) : isMultipleSelected ? (
                <div className="space-y-4">
                    <div className="text-xs text-gray-400 py-2 text-center">
                        {t('properties:multipleLayersSelected', { count: selectedIds.length })}
                    </div>
                    
                    {/* 多选图片图层时显示AI融合选项 */}
                    {isMultipleImageSelected && (
                        <div className="bg-purple-900/20 border border-purple-500/30 rounded p-3">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Merge size={14} className="text-purple-400" />
                                    <span className="text-xs font-medium text-purple-300 uppercase tracking-wide">
                                        {t('properties:aiBlendMultiple')}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-500 mb-1">
                                    {t('properties:aiBlendMultipleDesc', { count: selectedImageLayers.length })}
                                </p>
                                <div className="flex gap-2 mb-1">
                                    <select
                                        value={blendStyle}
                                        onChange={(e) => setBlendStyle(e.target.value)}
                                        className="w-full bg-tech-900 border border-tech-600 rounded px-2 py-1 text-[10px] text-gray-300 focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="Seamless">{t('properties:blendStyles.seamless')}</option>
                                        <option value="Double Exposure">{t('properties:blendStyles.doubleExposure')}</option>
                                        <option value="Splash Effect">{t('properties:blendStyles.splashEffect')}</option>
                                        <option value="Glitch/Cyberpunk">{t('properties:blendStyles.cyberpunk')}</option>
                                        <option value="Surreal">{t('properties:blendStyles.surreal')}</option>
                                    </select>
                                </div>
                                <textarea
                                    value={blendPrompt}
                                    onChange={(e) => setBlendPrompt(e.target.value)}
                                    placeholder={t('properties:blendPromptPlaceholder')}
                                    className="w-full bg-tech-900 border border-tech-600 rounded p-2 text-[10px] text-gray-300 h-16 resize-none focus:border-purple-500 focus:outline-none placeholder:text-gray-600"
                                />
                                <button
                                    onClick={() => onAIBlend(blendPrompt, blendStyle)}
                                    disabled={isGlobalProcessing}
                                    className="w-full flex items-center justify-center gap-2 bg-purple-600/80 hover:bg-purple-500 text-white text-xs py-2 rounded transition-colors disabled:opacity-50"
                                >
                                    {processingState === 'blending' ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('properties:processing')}
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} />
                                            {t('properties:aiBlendAction')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-xs text-gray-600 italic py-8 text-center border border-dashed border-tech-800 rounded-lg">
                    {t('properties:selectLayerHint')}
                </div>
            )}
        </div>

        {/* Layers List */}
        <div className="p-2 pb-20">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-3 mt-2 flex items-center gap-2">
                <Layers size={14} /> {t('properties:layers')}
            </h3>
            <div className="space-y-1">
            {layers.slice().reverse().map((layer) => {
                if (layer.parentId) return null;
                return (
                    <LayerItem
                        key={layer.id}
                        layer={layer}
                        level={0}
                        isSelected={selectedIds.includes(layer.id)}
                        allLayers={layers}
                        onSelect={onSelectLayer}
                        onToggle={onToggleVisibility}
                        onReorder={onLayerReorder}
                        onContextMenu={handleLayerContextMenu}
                    />
                );
            })}
            </div>
        </div>

        {contextMenu && (
            <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                onAction={onContextMenuAction}
                items={[
                    { id: 'group', label: t('dialog:contextMenu.group'), icon: Group, shortcut: 'Ctrl+G' },
                    { id: 'ungroup', label: t('dialog:contextMenu.ungroup'), icon: Folder, shortcut: 'Ctrl+Sh+G' },
                    { type: 'divider', id: 'd1', label: '' },
                    { id: 'fit-to-canvas', label: t('dialog:contextMenu.fitToCanvas'), icon: Maximize, color: 'text-cyan-400' },
                    { type: 'divider', id: 'd2', label: '' },
                    { id: 'duplicate', label: t('dialog:contextMenu.duplicate'), icon: Copy, shortcut: 'Ctrl+D' },
                    { id: 'delete', label: t('dialog:contextMenu.delete'), icon: Trash2, shortcut: 'Del', color: 'text-red-400' },
                ]}
            />
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;
