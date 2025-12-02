
import React, { useState, useRef, useEffect } from 'react';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';
import CanvasBoard from './src/components/CanvasBoard';
import Toolbar from './src/components/Toolbar';
import PropertiesPanel from './src/components/PropertiesPanel';
import LanguageSwitcher from './src/components/LanguageSwitcher';
import SettingsPanel from './src/components/SettingsPanel';
import HistoryPanel from './src/components/HistoryPanel';
import SketchCanvas from './src/components/SketchCanvas';
import { LayerData, ToolType, CanvasConfig, ShapeType} from '@/types';
import { generateImageFromText, editImageWithAI, removeBackgroundWithAI, blendImagesWithAI, enhancePrompt } from '@/services/ai';
import {
  Download,
  Zap,
  Command,
  X,
  Undo2,
  Redo2,
  FileText,
  FolderOpen,
  Save,
  FilePlus,
  ChevronDown,
  Sparkles,
  Upload,
  Settings,
  Trash2,
  Loader2,
  History,
  Clock
} from 'lucide-react';
import clsx from 'clsx';
import { useHistory, useLayerManager, useProjectManager, useLayerGrouping, useAutoSave } from '@/hooks';
import { compositeInpaint } from '@/utils/imageComposite.ts';
import { loadAndFitImage } from '@/utils/imageLayout';
import { DEFAULT_BRUSH_CONFIG, DEFAULT_ERASER_CONFIG, DEFAULT_LAYER_PROPS, DEFAULT_TEXT_PROPS } from '@/constants';
import FullScreenLoading from '@/components/FullScreenLoading';
import { useSettings } from './src/contexts/SettingsContext';
import { ExportImage } from './wailsjs/go/core/App';

export type ProcessingState = 'idle' | 'generating' | 'inpainting' | 'removing-bg' | 'blending' | 'transforming';

export default function App() {
  // i18n
  const { t } = useTranslation(['common', 'dialog', 'message']);

  // Hooks
  const projectManager = useProjectManager();

  // 临时的 layers 状态，用于初始化 autoSave
  const [tempLayers, setTempLayers] = useState<LayerData[]>([]);

  // Auto Save - 需要在 historyManager 之前初始化
  const autoSave = useAutoSave({
    layers: tempLayers,
    canvasConfig: projectManager.canvasConfig,
    isProjectCreated: projectManager.isProjectCreated,
    projectPath: projectManager.projectInfo?.isTemporary === false ? projectManager.projectInfo.path : undefined,
  });

  const historyManager = useHistory([], autoSave.triggerSave);
  const layerManager = useLayerManager([], historyManager.saveToHistory);
  const { layers, selectedIds, setSelectedIds, clipboard } = layerManager;

  // 同步 layers 到 tempLayers
  useEffect(() => {
    setTempLayers(layers);
  }, [layers]);

  const groupingManager = useLayerGrouping(
    layers,
    selectedIds,
    layerManager.updateLayersWithHistory,
    setSelectedIds
  );

  // UI State
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [shapeType, setShapeType] = useState<ShapeType>('polygon');
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [drawingLines, setDrawingLines] = useState<any[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Settings - 需要在工具配置之前获取
  const { settings, isLoaded: settingsLoaded } = useSettings();

  // Brush & AI State - 使用设置中的默认值初始化
  const [brushMode, setBrushMode] = useState<'normal' | 'ai'>('normal');
  // 当前生效的画笔配置（根据 brushMode 在 normal / ai 间切换）
  const [brushConfig, setBrushConfig] = useState(DEFAULT_BRUSH_CONFIG);
  // 各模式独立配置，避免互相影响
  const [normalBrushConfig, setNormalBrushConfig] = useState(DEFAULT_BRUSH_CONFIG);
  const [aiBrushConfig, setAiBrushConfig] = useState(DEFAULT_BRUSH_CONFIG);
  // 橡皮擦独立配置
  const [eraserConfig, setEraserConfig] = useState(DEFAULT_ERASER_CONFIG);
  const [inpaintPrompt, setInpaintPrompt] = useState('');

  // 当设置加载完成后，同步工具配置
  const hasInitializedToolsRef = useRef(false);
  useEffect(() => {
    if (settingsLoaded && !hasInitializedToolsRef.current) {
      hasInitializedToolsRef.current = true;
      // 从设置中初始化工具配置
      const brushFromSettings = {
        size: settings.tools.brush.size,
        color: settings.tools.brush.color,
        opacity: settings.tools.brush.opacity,
      };
      const eraserFromSettings = {
        size: settings.tools.eraser.size,
      };
      setBrushConfig(brushFromSettings);
      setNormalBrushConfig(brushFromSettings);
      setAiBrushConfig(brushFromSettings);
      setEraserConfig(eraserFromSettings);
    }
  }, [settingsLoaded, settings.tools]);

  // Modal State
  const [showNewCanvasModal, setShowNewCanvasModal] = useState(false);
  const [newCanvasConfig, setNewCanvasConfig] = useState({
    width: 1080,
    height: 1080,
    bg: 'transparent',
    color: '#ffffff',
    projectName: '',
    projectPath: '',
  });
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  // Recovery Modal State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // 检查是否有可恢复的数据（等待检查完成后再显示弹窗）
  useEffect(() => {
    if (!autoSave.isCheckingRecovery && autoSave.hasRecoverableData && !projectManager.isProjectCreated) {
      setShowRecoveryModal(true);
    }
  }, [autoSave.isCheckingRecovery, autoSave.hasRecoverableData, projectManager.isProjectCreated]);

  // AI Generator Panel State
  const [aiGenPrompt, setAiGenPrompt] = useState('');
  const [aiGenImageSize, setAiGenImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aiGenAspectRatio, setAiGenAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '3:4' | '4:3'>('1:1');
  const [aiGenReferenceImage, setAiGenReferenceImage] = useState<string | null>(null);
  const [aiGenSketchImage, setAiGenSketchImage] = useState<string | null>(null);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const aiGenFileInputRef = useRef<HTMLInputElement>(null);

  // Refs
  const stageRef = useRef<Konva.Stage>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  // Close file menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setShowFileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLayer = layers?.find(l => selectedIds.length === 1 && l.id === selectedIds[0]);
  const isImageLayerSelected = activeLayer?.type === 'image';

  // --- History Handlers ---
  const handleUndo = () => {
    const prevLayers = historyManager.undo();
    if (prevLayers) {
      layerManager.setLayers(prevLayers);
      setSelectedIds([]);
    }
  };

  const handleRedo = () => {
    const nextLayers = historyManager.redo();
    if (nextLayers) {
      layerManager.setLayers(nextLayers);
    }
  };

  const handleJumpToHistoryStep = (step: number) => {
    const targetLayers = historyManager.jumpToStep(step);
    if (targetLayers) {
      layerManager.setLayers(targetLayers);
      setSelectedIds([]);
      setShowHistoryPanel(false);
    }
  };

  // --- Project Management ---
  const handleNewProject = () => {
    // 重置新建项目配置
    setNewCanvasConfig({
      width: 1080,
      height: 1080,
      bg: 'transparent',
      color: '#ffffff',
      projectName: '',
      projectPath: '',
    });
    setShowNewCanvasModal(true);
    setShowFileMenu(false);
  };

  // 选择项目保存路径
  const handleSelectProjectPath = async () => {
    const dirPath = await projectManager.selectDirectory(t('dialog:newProject.selectPath', '选择项目保存位置'));
    if (dirPath) {
      setNewCanvasConfig(prev => ({ ...prev, projectPath: dirPath }));
    }
  };

  const handleCreateCanvas = async () => {
    // 验证必填项
    if (!newCanvasConfig.projectName.trim()) {
      alert(t('message:error.projectNameRequired', '请输入项目名称'));
      return;
    }
    if (!newCanvasConfig.projectPath) {
      alert(t('message:error.projectPathRequired', '请选择项目保存位置'));
      return;
    }

    const config: CanvasConfig = {
      width: newCanvasConfig.width,
      height: newCanvasConfig.height,
      background: newCanvasConfig.bg as any,
      backgroundColor: newCanvasConfig.color
    };

    setIsCreatingProject(true);

    try {
      // 创建项目并保存到指定路径
      await projectManager.createProjectWithPath(
        newCanvasConfig.projectName.trim(),
        newCanvasConfig.projectPath,
        config
      );

      layerManager.setLayers([]);
      historyManager.resetHistory([]);
      setSelectedIds([]);
      setShowNewCanvasModal(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert(t('message:error.createProjectFailed', '创建项目失败') + ': ' + error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // 恢复自动保存的项目（异步）
  const handleRecoverProject = async () => {
    setIsRecovering(true);
    try {
      const data = await autoSave.recoverData();
      if (data) {
        projectManager.createProject(data.canvasConfig);
        layerManager.setLayers(data.layers);
        historyManager.resetHistory(data.layers);
        setSelectedIds([]);
      }
    } catch (error) {
      console.error('恢复项目失败:', error);
    } finally {
      setIsRecovering(false);
      setShowRecoveryModal(false);
    }
  };

  // 忽略恢复（异步）
  const handleDismissRecovery = async () => {
    try {
      await autoSave.dismissRecovery();
    } catch (error) {
      console.error('忽略恢复失败:', error);
    } finally {
      setShowRecoveryModal(false);
    }
  };

  const handleSaveProject = () => {
    projectManager.saveProject(layers);
    setShowFileMenu(false);
  };

  const handleLoadProject = async () => {
    setIsLoadingProject(true);
    try {
      const { layers: loadedLayers, config } = await projectManager.loadProject();
      layerManager.setLayers(loadedLayers);
      historyManager.resetHistory(loadedLayers);
      setSelectedIds([]);
    } catch (err: any) {
      if (err.message !== "No project selected") {
        alert(err.message || "Failed to load project");
      }
    } finally {
      setIsLoadingProject(false);
    }

    setShowFileMenu(false);
  };

  // 从最近项目列表打开项目
  const handleOpenRecentProject = async (path: string, name: string) => {
    setIsLoadingProject(true);
    try {
      const { layers: loadedLayers, config } = await projectManager.loadProjectFromPath(path, name);
      layerManager.setLayers(loadedLayers);
      historyManager.resetHistory(loadedLayers);
      setSelectedIds([]);
    } catch (err: any) {
      alert(t('message:error.loadProjectFailed', '加载项目失败') + ': ' + err.message);
      // 如果加载失败，可能是项目已被删除，从列表中移除
      projectManager.removeFromRecentProjects(path);
    } finally {
      setIsLoadingProject(false);
    }
    setShowFileMenu(false);
  };

  // 加载最近项目列表（当文件菜单打开时）
  useEffect(() => {
    if (showFileMenu) {
      projectManager.fetchRecentProjects();
    }
  }, [showFileMenu, projectManager.fetchRecentProjects]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      const key = e.key.toLowerCase();

      if ((e.metaKey || e.ctrlKey) && key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupingManager.groupLayers();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && key === 'g' && e.shiftKey) {
        e.preventDefault();
        groupingManager.ungroupLayers();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && key === 'c') {
        if (isInput) return;
        layerManager.copyToClipboard();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && key === 'v') {
        if (isInput) return;
        layerManager.pasteFromClipboard();
        return;
      }

      if ((key === 'delete' || key === 'backspace') && selectedIds.length > 0) {
        if (isInput) return;
        layerManager.deleteLayers(selectedIds);
      }
      if (key === 'escape') {
        setSelectedIds([]);
        if (activeTool === 'brush') {
          setDrawingLines([]);
          setActiveTool('select');
        }
      }
      if ((e.metaKey || e.ctrlKey) && key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && key === 's') {
        e.preventDefault();
        handleSaveProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, activeTool, clipboard, layers, layerManager, groupingManager, handleUndo, handleRedo, handleSaveProject]);


  const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const clampPointsToCanvas = (points: number[], width: number, height: number) => {
    const result: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      result.push(clampValue(points[i], 0, width), clampValue(points[i + 1], 0, height));
    }
    return result;
  };

  const clampLayerPlacement = (layer: LayerData): LayerData => {
    const { width, height } = projectManager.canvasConfig;
    const layerWidth = layer.width ?? 0;
    const layerHeight = layer.height ?? 0;
    const maxX = Math.max(0, width - layerWidth);
    const maxY = Math.max(0, height - layerHeight);
    const x = clampValue(layer.x, 0, maxX);
    const y = clampValue(layer.y, 0, maxY);
    const nextLayer: LayerData = { ...layer, x, y };
    if (layer.type === 'line' && layer.points) {
      nextLayer.points = clampPointsToCanvas(layer.points, width, height);
    }
    return nextLayer;
  };

  const addLayer = (layer: LayerData) => {
    layerManager.addLayer(clampLayerPlacement(layer));
    if (activeTool !== 'brush' && activeTool !== 'eraser' && activeTool !== 'ai-gen') {
      setActiveTool('select');
    }
  };

  const handleAddShape = (shape: LayerData) => {
    addLayer(shape);
  };

  const handleSelectLayer = (id: string | null, multi: boolean = false) => {
    if (!id) {
      if (!multi) setSelectedIds([]);
      return;
    }
    if (multi) {
      setSelectedIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(p => p !== id);
        }
        return [...prev, id];
      });
    } else {
      setSelectedIds([id]);
    }
  };

  const handleAddTextAt = (x: number, y: number) => {
    // 使用设置中的文本默认配置
    const textProps = {
      text: settings.tools.text.defaultText,
      fontSize: settings.tools.text.fontSize,
      fill: settings.tools.text.color,
    };
    addLayer({
      id: uuidv4(),
      type: 'text',
      name: `Text ${layers.length + 1}`,
      x, y,
      ...DEFAULT_LAYER_PROPS,
      ...textProps,
    });
  };

  const handleLineDrawn = (points: number[], strokeWidth: number, options?: { erase?: boolean; targetLayerId?: string }) => {
    if (brushMode === 'ai') return;

    const isErase = !!options?.erase;
    const targetFromOptions = options?.targetLayerId || null;
    const targetFromSelection = selectedIds.length === 1 ? selectedIds[0] : null;
    const targetId = targetFromOptions || targetFromSelection;

    console.log(
      '[lineDrawn] called',
      { brushMode, isErase, pointsLen: points.length, selectedIds, targetFromOptions, targetFromSelection, targetId }
    );

    // 橡皮擦模式：必须有目标图层才能擦除
    if (isErase) {
      // 没有目标图层时，直接返回，不创建任何图层
      if (!targetId) {
        console.log('[lineDrawn] erase ignored: no target layer');
        return;
      }

      if (!stageRef.current) {
        console.log('[lineDrawn] erase ignored: no stage ref');
        return;
      }
    }

    // 橡皮擦：按选中图层做“图层级擦除”
    if (isErase && targetId && stageRef.current) {
      const targetLayer = layers?.find(l => l.id === targetId);

      console.log('[lineDrawn] erase targetLayer', {
        targetId,
        found: !!targetLayer,
        type: targetLayer?.type,
      });

      // 目前对 image / line / group 图层做图层级擦除
      if (targetLayer && (targetLayer.type === 'image' || targetLayer.type === 'line' || targetLayer.type === 'group')) {
        const stage = stageRef.current;
        const node = stage.findOne('#' + targetLayer.id);

        console.log('[lineDrawn] stage node for target', {
          targetId: targetLayer.id,
          hasNode: !!node,
          nodeClass: node ? node.getClassName && node.getClassName() : undefined,
        });

        if (node) {
          const stageAbsTransform = stage.getAbsoluteTransform().copy();
          const nodeAbsTransform = node.getAbsoluteTransform().copy();
          const invNodeAbsTransform = nodeAbsTransform.invert();

          const localPoints: number[] = [];

          for (let i = 0; i < points.length; i += 2) {
            const stageRx = points[i];
            const stageRy = points[i + 1];

            // Stage 相对坐标 -> 屏幕坐标
            const screenP = stageAbsTransform.point({ x: stageRx, y: stageRy });
            // 屏幕坐标 -> 目标图层本地坐标
            const localP = invNodeAbsTransform.point(screenP);

            localPoints.push(localP.x, localP.y);
          }

          console.log('[lineDrawn] localPoints computed', {
            localPointsLen: localPoints.length,
          });

          const eraseMaskLayer: LayerData = {
            id: uuidv4(),
            type: 'line',
            name: `Erase Mask`,
            x: 0,
            y: 0,
            points: localPoints,
            ...DEFAULT_LAYER_PROPS,
            stroke: '#000000',
            strokeWidth,
            blendMode: 'destination-out',
            parentId: targetLayer.id,
            // Store parent layer dimensions at creation time for proper scaling when layer is resized
            originalParentWidth: targetLayer.width,
            originalParentHeight: targetLayer.height,
          };

          // 直接更新图层列表，不改变当前选中图层
          layerManager.updateLayersWithHistory([...layers, eraseMaskLayer], 'history.erase');
          console.log('[lineDrawn] added eraseMaskLayer', {
            parentId: targetLayer.id,
            strokeWidth,
          });
          return;
        }

        console.log('[lineDrawn] node not found for target, erase ignored');
      } else {
        console.log('[lineDrawn] target layer type not supported for erase, ignored');
      }

      // 橡皮擦模式下，如果无法完成图层级擦除，直接返回，不创建全局擦除图层
      return;
    }

    // 画笔模式：新增一条独立的画笔图层
    console.log('[lineDrawn] add brush stroke layer', {
      strokeWidth,
    });
    addLayer({
      id: uuidv4(),
      type: 'line',
      name: `Brush Stroke`,
      x: 0,
      y: 0,
      points,
      ...DEFAULT_LAYER_PROPS,
      stroke: brushConfig.color,
      strokeWidth,
      blendMode: 'source-over',
    });
  };

  // 通用的处理图片文件函数
  const processImageFile = async (file: File) => {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert(t('toolbar:invalidFileType', '无效的文件类型，仅支持图片'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result as string;

      // 获取画布配置
      const { width: canvasWidth, height: canvasHeight } = projectManager.canvasConfig;

      // 加载图片并计算适配画布的尺寸和位置
      const layout = await loadAndFitImage(base64Image, canvasWidth, canvasHeight, 1.0);

      addLayer({
        id: uuidv4(),
        type: 'image',
        name: `Image ${layers.length + 1}`,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        ...DEFAULT_LAYER_PROPS,
        src: base64Image,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processImageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 拖拽上传处理函数
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!projectManager.isProjectCreated) return;
    setIsDraggingFile(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有当离开整个拖放区域时才重置状态
    if (e.currentTarget === e.target) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (!projectManager.isProjectCreated) return;

    const files = Array.from(e.dataTransfer.files);
    // 只处理图片文件
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert(t('toolbar:invalidFileType', '无效的文件类型，仅支持图片'));
      return;
    }

    // 处理所有图片文件
    for (const file of imageFiles) {
      await processImageFile(file);
    }
  };

  const handleAIGenerate = async (prompt: string, referenceImage: string | null, sketchImage: string | null, imageSize: '1K' | '2K' | '4K', aspectRatio: '1:1' | '16:9' | '9:16' | '3:4' | '4:3') => {
    // 显示全屏 Loading，禁止用户操作
    setProcessingState('generating');

    try {
      // 异步生成图片（支持同时使用草图和参考图）
      const base64Image = await generateImageFromText(
        prompt,
        referenceImage || undefined,
        sketchImage || undefined,
        imageSize,
        aspectRatio
      );

      // 获取画布配置
      const { width: canvasWidth, height: canvasHeight } = projectManager.canvasConfig;

      // 加载图片并计算适配画布的尺寸和位置
      const layout = await loadAndFitImage(base64Image, canvasWidth, canvasHeight, 1.0);

      // 直接添加生成的图层
      addLayer({
        id: uuidv4(),
        type: 'image',
        name: `AI Gen ${layers.length + 1}`,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        ...DEFAULT_LAYER_PROPS,
        src: base64Image,
      });

      setActiveTool('select');
    } catch (error: any) {
      alert(`AI Generation failed: ${error.message}`);
    } finally {
      // 关闭全屏 Loading，恢复用户操作
      setProcessingState('idle');
    }
  };

	  const handleAIBlend = async (prompt: string, style: string) => {
    // 获取选中的图片图层
    const selectedImageLayers = layers.filter(
      l => selectedIds.includes(l.id) && l.type === 'image' && l.src
    );

    if (selectedImageLayers.length < 2) {
      alert(t('message:error.selectMultipleImages', '请至少选择2个图片图层进行AI融合'));
      return;
    }

    // 检查是否在同一组/层级
    const firstParentId = selectedImageLayers[0].parentId;
    const sameGroup = selectedImageLayers.every(l => l.parentId === firstParentId);
    if (!sameGroup) {
      alert(t('message:error.blendSameGroup', '只能融合同一组/层级内的图层'));
      return;
    }

    // 显示全屏 Loading，禁止用户操作
    setProcessingState('blending');

    try {
      // 按图层顺序排序（索引小的在下面，即底层优先）
      const sortedLayers = [...selectedImageLayers].sort((a, b) => {
        const indexA = layers.findIndex(l => l.id === a.id);
        const indexB = layers.findIndex(l => l.id === b.id);
        return indexA - indexB;
      });

      // 提取图片数据，按图层顺序（下层到上层）
      const images = sortedLayers.map(l => l.src!);

      // 调用后端多图融合接口
      const resultBase64 = await blendImagesWithAI(images, prompt, style);

      // 获取画布配置
      const { width: canvasWidth, height: canvasHeight } = projectManager.canvasConfig;

      // 加载混合结果图片并计算适配尺寸
      const layout = await loadAndFitImage(resultBase64, canvasWidth, canvasHeight, 1.0);

      // 获取原图层的 ID 列表，用于移除
      const oldLayerIds = selectedImageLayers.map(l => l.id);

      // 创建新的融合结果图层
      const newLayer: LayerData = {
        id: uuidv4(),
        type: 'image',
        name: `${style} Blend (${selectedImageLayers.length} layers)`,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        ...DEFAULT_LAYER_PROPS,
        src: resultBase64,
        parentId: firstParentId
      };

      // 移除原图层，添加新图层
      const updatedLayers = layers.filter(l => !oldLayerIds.includes(l.id));
      updatedLayers.push(newLayer);

      // 更新图层并保存历史
      layerManager.updateLayersWithHistory(updatedLayers, 'history.aiBlend');

      // 选中新图层
      setSelectedIds([newLayer.id]);

    } catch (e: any) {
      console.error("Blend failed", e);
      alert(`Blend failed: ${e.message}`);
    } finally {
      // 关闭全屏 Loading，恢复用户操作
      setProcessingState('idle');
    }
  };

	  const handleInpaintSubmit = async () => {
    const targetLayer = layers?.find(l => selectedIds.includes(l.id));
    if (!targetLayer || targetLayer.type !== 'image' || !targetLayer.src) {
      alert("Please select an image layer to apply AI Inpaint.");
      return;
    }

    if (!inpaintPrompt || !stageRef.current || drawingLines.length === 0) return;
    setProcessingState('inpainting');

    try {
      const stage = stageRef.current;
      const node = stage.findOne('#' + targetLayer.id);
      const imageNode = node instanceof Konva.Image 
        ? node 
        : node instanceof Konva.Group 
          ? (node.findOne('Image') as Konva.Image) 
          : null;

      if (!imageNode || !imageNode.image()) {
        throw new Error("Could not access image data. Ensure the image is loaded.");
      }

      const imageElement = imageNode.image() as HTMLImageElement;
      // Use natural dimensions for high-res editing
      const naturalWidth = imageElement.naturalWidth || imageElement.width;
      const naturalHeight = imageElement.naturalHeight || imageElement.height;

      // 1. Create Native-Resolution Mask Canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = naturalWidth;
      maskCanvas.height = naturalHeight;
      const ctx = maskCanvas.getContext('2d');
      if (!ctx) throw new Error("Could not create mask context");

      // 2. Coordinate Transformation: Map Stage Strokes -> Image Native Pixels
      // We need to invert the image's transform to map global points back to local image space
      const imageAbsTransform = imageNode.getAbsoluteTransform().copy();
      const invImageAbsTransform = imageAbsTransform.invert();

      const stageAbsTransform = stage.getAbsoluteTransform().copy();

	      // Calculate Brush Scale relative to the Image's current scale
	      // visualBrushSize (from current brushConfig.size) / currentScale = localBrushSize
      const currentScaleX = imageNode.getAbsoluteScale().x;
      // Ratio between natural size and current node size
      const widthRatio = naturalWidth / imageNode.width();
      const heightRatio = naturalHeight / imageNode.height();

	      ctx.lineCap = 'round';
	      ctx.lineJoin = 'round';
	      // Adjust brush size to match visual size on screen relative to image resolution
	      ctx.lineWidth = (brushConfig.size / currentScaleX) * widthRatio;
      ctx.strokeStyle = '#FFFFFF';

      drawingLines.forEach(line => {
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < line.points.length; i += 2) {
          const stageRx = line.points[i];
          const stageRy = line.points[i + 1];

          // Stage Relative Point -> Screen Point
          const screenP = stageAbsTransform.point({ x: stageRx, y: stageRy });

          // Screen Point -> Image Local Point
          const localP = invImageAbsTransform.point(screenP);

          // Image Local Point -> Native Pixel
          // (localP is in 'node size' units, we need 'natural size' units)
          const nativeX = localP.x * widthRatio;
          const nativeY = localP.y * heightRatio;

          if (first) {
            ctx.moveTo(nativeX, nativeY);
            first = false;
          } else {
            ctx.lineTo(nativeX, nativeY);
          }
        }
        ctx.stroke();
      });

      const maskBase64 = maskCanvas.toDataURL();

      // 3. Prepare the Prompt Image (Image + Red Strokes)
      // We must send the image WITH red strokes to the AI so it knows what to remove/change
      const promptImageCanvas = document.createElement('canvas');
      promptImageCanvas.width = naturalWidth;
      promptImageCanvas.height = naturalHeight;
      const pCtx = promptImageCanvas.getContext('2d');
      if (!pCtx) throw new Error("Could not create prompt canvas");

      // Draw original image
      const imgOriginal = new Image();
      imgOriginal.src = targetLayer.src;
      // Ensure sync loading for canvas op
      await new Promise((resolve) => {
        if (imgOriginal.complete) resolve(true);
        else imgOriginal.onload = () => resolve(true);
      });

      pCtx.drawImage(imgOriginal, 0, 0);

	      // Re-draw strokes in Red on top (Reuse transform logic)
	      pCtx.lineCap = 'round';
	      pCtx.lineJoin = 'round';
	      pCtx.lineWidth = (brushConfig.size / currentScaleX) * widthRatio;
      pCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Translucent Red

      drawingLines.forEach(line => {
        pCtx.beginPath();
        let first = true;
        for (let i = 0; i < line.points.length; i += 2) {
          const stageRx = line.points[i];
          const stageRy = line.points[i + 1];
          const screenP = stageAbsTransform.point({ x: stageRx, y: stageRy });
          const localP = invImageAbsTransform.point(screenP);
          const nativeX = localP.x * widthRatio;
          const nativeY = localP.y * heightRatio;
          if (first) {
            pCtx.moveTo(nativeX, nativeY);
            first = false;
          } else {
            pCtx.lineTo(nativeX, nativeY);
          }
        }
        pCtx.stroke();
      });

      const promptImageBase64 = promptImageCanvas.toDataURL();

      const fullPrompt = `${inpaintPrompt} Keep original style and high clarity. IMPORTANT: The image contains TRANSLUCENT RED brush strokes acting as a mask. Modify the content under the red strokes according to the prompt. Keep the rest of the image unchanged. Remove the red strokes from the final result. Return the image with transparent background where appropriate.`;

      // 4. Call AI
      const aiResultBase64 = await editImageWithAI(promptImageBase64, fullPrompt);

      // 5. Composite Final Result (Original + (AI * Mask))
      // We use the original clean source, the AI result, and our generated mask
      const finalImage = await compositeInpaint(targetLayer.src, aiResultBase64, maskBase64, naturalWidth, naturalHeight);

      // 6. Update Layer
      // 注意：updateLayer 内部会根据修改的属性自动生成描述，但这里是 AI 修复，需要特殊处理
      // 我们先更新图层，然后手动保存历史记录
      const updatedLayers = layers.map(l =>
        l.id === targetLayer.id
          ? { ...l, src: finalImage, name: `${targetLayer.name.replace(' (Edited)', '')} (Edited)` }
          : l
      );
      layerManager.updateLayersWithHistory(updatedLayers, 'history.aiInpaint');

      setDrawingLines([]);
      setInpaintPrompt('');
      setActiveTool('select');

    } catch (e: any) {
      console.error(e);
      alert(`Inpainting failed: ${e.message}`);
    } finally {
      setProcessingState('idle');
    }
  };


  const handleRemoveBackground = async () => {
    const targetLayer = layers?.find(l => selectedIds.includes(l.id));
    if (!targetLayer || targetLayer.type !== 'image' || !targetLayer.src) {
      alert("Please select an image layer.");
      return;
    }
    setProcessingState('removing-bg');
    try {
      const resultBase64 = await removeBackgroundWithAI(targetLayer.src);
      layerManager.updateLayer(targetLayer.id, {
        src: resultBase64,
        name: `${targetLayer.name} (No BG)`
      });
    } catch (e: any) {
      console.error("Remove BG failed", e);
      alert(`Failed to remove background: ${e.message}`);
    } finally {
      setProcessingState('idle');
    }
  };

  // AI Transform: 基于当前图片和提示词生成变换后的新图片（直接替换原图层）
  const handleAITransform = async (prompt: string) => {
    const targetLayer = layers?.find(l => selectedIds.includes(l.id));
    if (!targetLayer || targetLayer.type !== 'image' || !targetLayer.src) {
      alert(t('properties:selectImageLayerHint', 'Please select an image layer.'));
      return;
    }

    if (!prompt.trim()) {
      return;
    }

    setProcessingState('transforming');

    try {
      // 使用 editImageWithAI 进行图像变换
      // 构建完整的提示词，说明这是图像变换而非局部修复
      const fullPrompt = `Transform the entire image based on this instruction: ${prompt}. 
Maintain the overall composition and subject matter, but apply the requested transformation style/effect to the whole image.
Keep high quality and clarity.`;

      const resultBase64 = await editImageWithAI(targetLayer.src, fullPrompt);

      // 直接更新原图层的图片（与 AI Inpaint 行为一致）
      const updatedLayers = layers.map(l =>
        l.id === targetLayer.id
          ? { ...l, src: resultBase64, name: `${targetLayer.name.replace(' (Transformed)', '')} (Transformed)` }
          : l
      );
      layerManager.updateLayersWithHistory(updatedLayers, 'history.aiTransform');

    } catch (e: any) {
      console.error("AI Transform failed", e);
      alert(`AI Transform failed: ${e.message}`);
    } finally {
      setProcessingState('idle');
    }
  };

  const handleContextMenuAction = (action: string) => {
    if (selectedIds.length === 0) return;
    const selectedId = selectedIds[0];

    switch (action) {
      case 'group':
        groupingManager.groupLayers();
        break;
      case 'ungroup':
        groupingManager.ungroupLayers();
        break;
      case 'ai-blend':
        handleAIBlend('', 'Seamless');
        break;
      case 'fit-to-canvas':
        handleFitToCanvas();
        break;
      case 'duplicate':
        layerManager.duplicateLayer(selectedId);
        break;
      case 'delete':
        layerManager.deleteLayers(selectedIds);
        break;
      case 'bringToFront':
      case 'bringForward':
        layerManager.reorderLayer(selectedId, 'up');
        break;
      case 'sendBackward':
        layerManager.reorderLayer(selectedId, 'down');
        break;
    }
  };

  // 适配画布：将选中的图片图层根据原图尺寸缩放并居中以完全填充画布（cover 模式）
  const handleFitToCanvas = async () => {
    const { width: canvasWidth, height: canvasHeight } = projectManager.canvasConfig;
    
    // 获取选中的图片图层
    const selectedImageLayers = layers.filter(
      l => selectedIds.includes(l.id) && l.type === 'image' && l.src
    );

    if (selectedImageLayers.length === 0) return;

    // 获取每个图片的原始尺寸
    const getOriginalSize = (src: string): Promise<{ width: number; height: number }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          resolve({ width: 100, height: 100 }); // 默认尺寸
        };
        img.src = src;
      });
    };

    // 并行获取所有原图尺寸
    const originalSizes = await Promise.all(
      selectedImageLayers.map(layer => getOriginalSize(layer.src!))
    );

    // 创建尺寸映射
    const sizeMap = new Map<string, { width: number; height: number }>();
    selectedImageLayers.forEach((layer, index) => {
      sizeMap.set(layer.id, originalSizes[index]);
    });

    const updatedLayers = layers.map(layer => {
      if (!selectedIds.includes(layer.id) || layer.type !== 'image') {
        return layer;
      }

      const originalSize = sizeMap.get(layer.id);
      if (!originalSize) return layer;

      // 使用原图尺寸计算缩放比例（cover 模式，完全填充画布）
      const scaleX = canvasWidth / originalSize.width;
      const scaleY = canvasHeight / originalSize.height;
      const scale = Math.max(scaleX, scaleY);

      // 计算新的尺寸
      const newWidth = originalSize.width * scale;
      const newHeight = originalSize.height * scale;

      // 居中放置
      const newX = (canvasWidth - newWidth) / 2;
      const newY = (canvasHeight - newHeight) / 2;

      return {
        ...layer,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };
    });

    layerManager.updateLayersWithHistory(updatedLayers, 'history.fitToCanvas');
  };

  const handleExport = async () => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const { canvasConfig } = projectManager;

    const oldScale = stage.scaleX();
    const oldPos = stage.position();

    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });

    const bgNode = stage.findOne('.canvas-background');
    const wasBgVisible = bgNode ? bgNode.visible() : true;

    if (bgNode && canvasConfig.background === 'transparent') {
      bgNode.hide();
    }

    const transformers = stage.find('Transformer');
    transformers.forEach(t => t.hide());

    stage.draw();

    const uri = stage.toDataURL({
      pixelRatio: 1,
      mimeType: 'image/png',
      x: 0,
      y: 0,
      width: canvasConfig.width,
      height: canvasConfig.height
    });

    if (bgNode && canvasConfig.background === 'transparent') {
      if (wasBgVisible) bgNode.show();
    }
    transformers.forEach(t => t.show());

    stage.scale({ x: oldScale, y: oldScale });
    stage.position(oldPos);
    stage.batchDraw();

    // 使用 Wails 后端导出
    try {
      const suggestedName = `indraw-export-${Date.now()}.png`;
      const filePath = await ExportImage(uri, suggestedName);
      if (filePath) {
        console.log('Image exported to:', filePath);
      }
    } catch (error) {
      console.error('Failed to export image:', error);
      alert('Failed to export image: ' + error);
    }
  };

	  return (
	    <div className="flex flex-col h-screen bg-tech-900 text-gray-200 font-sans overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadImage}
        className="hidden"
        accept="image/*"
      />


	      {/* Top Bar */}
	      <div className="h-12 bg-tech-900 border-b border-tech-700 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            <Zap size={18} className="text-white" />
	      </div>
          <h1 className="font-bold text-lg tracking-tight text-gray-100">INDRAW <span className="text-cyan-400 font-light">EDITOR</span></h1>

          {/* 当前项目名称 */}
          {projectManager.projectInfo && (
            <div className="flex items-center gap-2 ml-2 pl-3 border-l border-tech-700">
              <span className="text-sm text-gray-400">/</span>
              <span className="text-sm font-medium text-cyan-400 max-w-[200px] truncate" title={projectManager.projectInfo.path}>
                {projectManager.projectInfo.name}
              </span>
            </div>
          )}

          {/* File Menu */}
          <div className="relative" ref={fileMenuRef}>
            <button
              onClick={() => setShowFileMenu(!showFileMenu)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                showFileMenu ? "bg-tech-700 text-white" : "text-gray-400 hover:bg-tech-800 hover:text-white"
              )}
            >
              <FileText size={16} />
              <span>{t('common:file')}</span>
              <ChevronDown size={12} className={clsx("transition-transform", showFileMenu ? "rotate-180" : "")} />
            </button>

            {showFileMenu && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-tech-900 border border-tech-600 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2">
                <button onClick={handleNewProject} className="w-full text-left px-4 py-2 hover:bg-tech-800 text-sm text-gray-300 flex items-center gap-2">
                  <FilePlus size={14} /> {t('dialog:fileMenu.newProject')}
                </button>
                <button onClick={handleLoadProject} className="w-full text-left px-4 py-2 hover:bg-tech-800 text-sm text-gray-300 flex items-center gap-2">
                  <FolderOpen size={14} /> {t('dialog:fileMenu.openProject')}
                </button>
                <button onClick={handleSaveProject} className="w-full text-left px-4 py-2 hover:bg-tech-800 text-sm text-gray-300 flex items-center gap-2">
                  <Save size={14} /> {t('dialog:fileMenu.saveProject')}
                </button>

                {/* 最近项目列表 */}
                {projectManager.recentProjects.length > 0 && (
                  <>
                    <div className="border-t border-tech-700 my-1" />
                    <div className="px-4 py-1.5 text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Clock size={12} />
                      {t('dialog:fileMenu.recentProjects', '最近项目')}
                    </div>
                    {projectManager.recentProjects.slice(0, 5).map((project) => (
                      <div
                        key={project.path}
                        className="group flex items-center justify-between px-4 py-1.5 hover:bg-tech-800 text-sm text-gray-300"
                      >
                        <button
                          onClick={() => handleOpenRecentProject(project.path, project.name)}
                          className="flex-1 text-left truncate"
                          title={project.path}
                        >
                          {project.name}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            projectManager.removeFromRecentProjects(project.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-tech-700 rounded text-gray-500 hover:text-red-400 transition-all"
                          title={t('common:remove', '移除')}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {projectManager.recentProjects.length > 0 && (
                      <button
                        onClick={() => {
                          projectManager.clearRecentProjects();
                        }}
                        className="w-full text-left px-4 py-1.5 hover:bg-tech-800 text-xs text-gray-500 hover:text-red-400 flex items-center gap-2"
                      >
                        <Trash2 size={12} /> {t('dialog:fileMenu.clearRecent', '清除最近项目')}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="ml-4 flex items-center gap-1 border-l border-tech-700 pl-4">
            <button
              onClick={handleUndo}
              disabled={!historyManager.canUndo}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-tech-800 rounded disabled:opacity-30"
              title={t('message:shortcuts.undo')}
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!historyManager.canRedo}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-tech-800 rounded disabled:opacity-30"
              title={t('message:shortcuts.redo')}
            >
              <Redo2 size={16} />
            </button>
            <button
              onClick={() => setShowHistoryPanel(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-tech-800 rounded"
              title={t('common:history', '历史记录')}
            >
              <History size={16} />
            </button>
          </div>
	      {/* Tool Options Bar (Eraser Size etc.) */}
	  {/* Tool Options Bar - Brush / Eraser */}
{projectManager.isProjectCreated && (activeTool === 'brush' || activeTool === 'eraser') && (
  <div className="h-10 bg-tech-900 border-b border-tech-800 px-4 flex items-center justify-between text-xs z-20 shrink-0">
    <div className="flex items-center gap-4 text-gray-400">
      {/* Brush 块：仅在画笔工具时显示 */}
      {activeTool === 'brush' && (
        <>
          <span className="font-mono uppercase tracking-wide text-[11px] text-gray-500">
            {t('common:brush')}
          </span>

          {/* Brush Mode Toggle */}
          <div className="flex bg-tech-900 rounded-lg p-0.5 border border-tech-700">
            <button
              onClick={() => {
                setBrushMode('normal');
                setDrawingLines([]);
                setBrushConfig(normalBrushConfig);
              }}
              className={clsx(
                'px-2 py-0.5 text-[11px] rounded-md transition-all font-medium',
                brushMode === 'normal'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200',
              )}
            >
              {t('common:normal')}
            </button>
            <button
              onClick={() => {
                setBrushMode('ai');
                setDrawingLines([]);
                setBrushConfig(aiBrushConfig);
              }}
              className={clsx(
                'px-2 py-0.5 text-[11px] rounded-md transition-all font-medium flex items-center gap-1',
                brushMode === 'ai'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200',
              )}
            >
              <Zap size={10} /> {t('common:ai')}
            </button>
          </div>

          {/* Brush Size */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500">大小</span>
            <input
              type="range"
              min={1}
              max={brushMode === 'ai' ? 100 : 50}
              value={brushConfig.size}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                const nextConfig = { ...brushConfig, size: nextSize };
                setBrushConfig(nextConfig);
                if (brushMode === 'normal') {
                  setNormalBrushConfig(nextConfig);
                } else {
                  setAiBrushConfig(nextConfig);
                }
              }}
              className="w-32 h-1 bg-tech-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="w-8 text-right font-mono text-gray-300">
              {brushConfig.size}
            </span>
          </div>

          {/* Brush Color：仅普通画笔模式 */}
          {brushMode === 'normal' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">颜色</span>
              <div className="relative w-6 h-6 rounded border border-tech-600 overflow-hidden">
                <input
                  type="color"
                  value={brushConfig.color}
                  onChange={(e) => {
                    const nextConfig = { ...brushConfig, color: e.target.value };
                    setBrushConfig(nextConfig);
                    setNormalBrushConfig(nextConfig);
                  }}
                  className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] p-0 m-0 border-0 cursor-pointer"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Eraser 块：使用独立的橡皮擦配置 */}
      {activeTool === 'eraser' && (
        <>
          <span className="font-mono uppercase tracking-wide text-[11px] text-gray-500">
            ERASER
          </span>
          <span className="text-gray-500">大小</span>
          <input
            type="range"
            min={5}
            max={150}
            value={eraserConfig.size}
            onChange={(e) => {
              const nextSize = Number(e.target.value);
              setEraserConfig({ ...eraserConfig, size: nextSize });
            }}
            className="w-40 h-1 bg-tech-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="w-8 text-right font-mono text-gray-300">
            {eraserConfig.size}
          </span>
        </>
      )}
    </div>

    <div className="hidden md:flex items-center gap-3 text-[11px] text-gray-500">
      {activeTool === 'eraser' && <span>在画布上拖动以擦除选中图层像素</span>}
      {activeTool === 'brush' && brushMode === 'ai' && (
        <span>在图像上涂抹需要 AI 编辑的区域</span>
      )}
    </div>
  </div>
)}

        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-gray-500">
            <span className="flex items-center gap-1"><Command size={10} /> {t('message:shortcuts.multiSelect')}</span>
          </div>
          <div className="h-4 w-px bg-tech-700"></div>
          <LanguageSwitcher />
          <button
            onClick={() => setShowSettingsPanel(true)}
            className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-tech-800 rounded transition-colors"
            title={t('common:settings')}
          >
            <Settings size={16} />
          </button>
          <div className="h-4 w-px bg-tech-700"></div>
          <button
            onClick={handleExport}
            disabled={!projectManager.isProjectCreated}
            className={clsx(
              "flex items-center gap-2 px-4 py-1.5 border border-tech-600 rounded text-sm transition-colors",
              !projectManager.isProjectCreated
                ? "bg-tech-800/50 text-gray-600 cursor-not-allowed opacity-50"
                : "bg-tech-800 hover:bg-tech-700 text-cyan-100"
            )}
            title={!projectManager.isProjectCreated ? t('common:exportDisabled') : t('common:export')}
          >
            <Download size={14} />
            {t('common:export')}
          </button>
        </div>
      </div>

	      <div className="flex flex-1 overflow-hidden relative">
        <Toolbar
          activeTool={activeTool}
          setActiveTool={(t) => {
            setActiveTool(t);
            if (t !== 'brush' && t !== 'eraser') {
              setDrawingLines([]);
            } else if (activeTool !== t) {
              setDrawingLines([]);
            }
            // 切换到橡皮擦工具时，自动重置为 normal 模式，确保橡皮擦功能正常工作
            if (t === 'eraser' && brushMode === 'ai') {
              setBrushMode('normal');
              setBrushConfig(normalBrushConfig);
            }
          }}
          onUploadClick={() => fileInputRef.current?.click()}
          isProjectCreated={projectManager.isProjectCreated}
        />

        <main className="flex-1 relative flex flex-col min-w-0 bg-[#0f1119]">
          {!projectManager.isProjectCreated ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-radial-gradient from-tech-800 to-tech-900">
              <div className="mb-8 p-6 bg-tech-800/30 rounded-3xl border border-tech-700 shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-50 duration-500">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mx-auto mb-6">
                  <Zap size={40} className="text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{t('dialog:welcome.title')}</h1>
                <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">{t('dialog:welcome.subtitle')}</p>

                <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                  <button
                    onClick={handleNewProject}
                    className="w-full py-3 px-6 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <FilePlus size={20} /> {t('dialog:welcome.createNew')}
                  </button>
                  <button
                    onClick={handleLoadProject}
                    className="w-full py-3 px-6 bg-tech-700 hover:bg-tech-600 text-gray-200 rounded-xl font-medium border border-tech-600 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <FolderOpen size={20} /> {t('dialog:welcome.openExisting')}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 font-mono">{t('dialog:welcome.version')}</p>
            </div>
          ) : (
            <>
              <CanvasBoard
                layers={layers}
                selectedIds={selectedIds}
                activeTool={activeTool}
                shapeType={shapeType}
                brushMode={brushMode}
                drawingLines={drawingLines}
                brushConfig={brushConfig}
                eraserConfig={eraserConfig}
                canvasConfig={projectManager.canvasConfig}
                onSetDrawingLines={setDrawingLines}
                onSelectLayer={handleSelectLayer}
                onUpdateLayer={layerManager.updateLayer}
                onLineDrawn={handleLineDrawn}
                onAddText={handleAddTextAt}
                onAddShape={handleAddShape}
                onContextMenuAction={handleContextMenuAction}
                stageRef={stageRef}
                isDraggingFile={isDraggingFile}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />

              {activeTool === 'brush' && brushMode === 'ai' && isImageLayerSelected && drawingLines.length > 0 && (
                <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl bg-tech-900/95 border border-purple-500/40 shadow-[0_18px_40px_rgba(15,23,42,0.9)] backdrop-blur-md flex flex-col gap-2 text-xs text-gray-200 max-w-xl w-[90%]">
                  <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] text-purple-300 uppercase">
                    <Zap size={12} className="text-purple-400" />
                    AI INPAINT
                  </span>
                  <textarea
                    value={inpaintPrompt}
                    onChange={(e) => setInpaintPrompt(e.target.value)}
                    placeholder={t('ai:inpaintPrompt')}
                    rows={3}
                    className="w-full bg-tech-900 border border-tech-700 rounded-lg px-3 py-2 text-[11px] text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/60 transition-all resize-none"
                  />
                  <button
                    onClick={handleInpaintSubmit}
                    disabled={processingState !== 'idle' || !inpaintPrompt}
                    className={clsx(
                      'w-full mt-1 px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-colors',
                      processingState === 'inpainting' || !inpaintPrompt
                        ? 'bg-tech-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white shadow-lg shadow-purple-900/40',
                    )}
                  >
                    {processingState === 'inpainting' ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{t('properties:processing')}</span>
                      </>
                    ) : (
                      <>
                        <Zap size={12} />
                        <span>{t('properties:generateEdit')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {projectManager.isProjectCreated && (
          <PropertiesPanel
            layers={layers}
            selectedIds={selectedIds}
            activeTool={activeTool}
            shapeType={shapeType}
            onSetShapeType={setShapeType}
            brushMode={brushMode}
            processingState={processingState}
            brushConfig={brushConfig}
            inpaintPrompt={inpaintPrompt}
            onSetBrushConfig={(config) => {
              setBrushConfig(config);
              if (brushMode === 'normal') {
                setNormalBrushConfig(config);
              } else {
                setAiBrushConfig(config);
              }
            }}
            onSetBrushMode={(mode) => {
              setBrushMode(mode);
              setDrawingLines([]);
              // 切换模式时恢复各自独立的配置
              setBrushConfig(mode === 'normal' ? normalBrushConfig : aiBrushConfig);
            }}
            onSetInpaintPrompt={setInpaintPrompt}
            onSelectLayer={handleSelectLayer}
            onDeleteLayer={(id) => layerManager.deleteLayers([id])}
            onToggleVisibility={layerManager.toggleVisibility}
            onLayerReorder={layerManager.reorderLayer}
            onDuplicateLayer={layerManager.duplicateLayer}
            onUpdateLayer={layerManager.updateLayer}
            onRemoveBackground={handleRemoveBackground}
            onAIBlend={handleAIBlend}
            onAITransform={handleAITransform}
            onGroup={groupingManager.groupLayers}
            onUngroup={groupingManager.ungroupLayers}
            onContextMenuAction={handleContextMenuAction}
            onInpaintSubmit={handleInpaintSubmit}
          />
        )}
      </div>

      {/* New Canvas Modal */}
      {showNewCanvasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-tech-900 border border-tech-600 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-tech-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <FilePlus size={20} className="text-cyan-400" />
                {t('dialog:newProject.title')}
              </h2>
              <button onClick={() => setShowNewCanvasModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 项目名称（必填） */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400 uppercase">
                  {t('dialog:newProject.projectName', '项目名称')}
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={newCanvasConfig.projectName}
                  onChange={(e) => setNewCanvasConfig({ ...newCanvasConfig, projectName: e.target.value })}
                  placeholder={t('dialog:newProject.projectNamePlaceholder', '输入项目名称')}
                  className="w-full bg-tech-800 border border-tech-600 rounded p-2 text-white focus:border-cyan-500 focus:outline-none placeholder:text-gray-500"
                />
              </div>

              {/* 项目路径（必填） */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400 uppercase">
                  {t('dialog:newProject.projectPath', '保存位置')}
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCanvasConfig.projectPath}
                    readOnly
                    placeholder={t('dialog:newProject.projectPathPlaceholder', '选择保存位置')}
                    className="flex-1 bg-tech-800 border border-tech-600 rounded p-2 text-white focus:border-cyan-500 focus:outline-none placeholder:text-gray-500 cursor-pointer"
                    onClick={handleSelectProjectPath}
                  />
                  <button
                    onClick={handleSelectProjectPath}
                    className="px-3 py-2 bg-tech-700 hover:bg-tech-600 rounded text-gray-300 border border-tech-600 transition-colors"
                  >
                    <FolderOpen size={18} />
                  </button>
                </div>
              </div>

              {/* 画布尺寸 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-400 uppercase">{t('dialog:newProject.width')}</label>
                  <input
                    type="number"
                    value={newCanvasConfig.width}
                    onChange={(e) => setNewCanvasConfig({ ...newCanvasConfig, width: Number(e.target.value) })}
                    className="w-full bg-tech-800 border border-tech-600 rounded p-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-400 uppercase">{t('dialog:newProject.height')}</label>
                  <input
                    type="number"
                    value={newCanvasConfig.height}
                    onChange={(e) => setNewCanvasConfig({ ...newCanvasConfig, height: Number(e.target.value) })}
                    className="w-full bg-tech-800 border border-tech-600 rounded p-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400 uppercase">{t('dialog:newProject.presets')}</label>
                <div className="flex gap-2">
                  <button onClick={() => setNewCanvasConfig({ ...newCanvasConfig, width: 1080, height: 1080 })} className="px-3 py-1 bg-tech-800 hover:bg-tech-700 rounded text-xs text-gray-300 border border-tech-700">{t('dialog:newProject.square')}</button>
                  <button onClick={() => setNewCanvasConfig({ ...newCanvasConfig, width: 1920, height: 1080 })} className="px-3 py-1 bg-tech-800 hover:bg-tech-700 rounded text-xs text-gray-300 border border-tech-700">{t('dialog:newProject.fhd')}</button>
                  <button onClick={() => setNewCanvasConfig({ ...newCanvasConfig, width: 1080, height: 1920 })} className="px-3 py-1 bg-tech-800 hover:bg-tech-700 rounded text-xs text-gray-300 border border-tech-700">{t('dialog:newProject.mobile')}</button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400 uppercase">{t('dialog:newProject.background')}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bg"
                      checked={newCanvasConfig.bg === 'transparent'}
                      onChange={() => setNewCanvasConfig({ ...newCanvasConfig, bg: 'transparent' })}
                      className="accent-cyan-500"
                    />
                    <span className="text-sm text-gray-300">{t('dialog:newProject.transparent')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bg"
                      checked={newCanvasConfig.bg === 'color'}
                      onChange={() => setNewCanvasConfig({ ...newCanvasConfig, bg: 'color' })}
                      className="accent-cyan-500"
                    />
                    <span className="text-sm text-gray-300">{t('dialog:newProject.color')}</span>
                  </label>
                  {newCanvasConfig.bg === 'color' && (
                    <input
                      type="color"
                      value={newCanvasConfig.color}
                      onChange={(e) => setNewCanvasConfig({ ...newCanvasConfig, color: e.target.value })}
                      className="h-6 w-8 rounded cursor-pointer border-0 p-0"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-tech-700 bg-tech-800/50 flex justify-end gap-3">
              <button
                onClick={() => setShowNewCanvasModal(false)}
                className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-tech-700 transition-colors"
                disabled={isCreatingProject}
              >
                {t('common:cancel')}
              </button>
              <button
                onClick={handleCreateCanvas}
                disabled={isCreatingProject || !newCanvasConfig.projectName.trim() || !newCanvasConfig.projectPath}
                className="px-6 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingProject ? t('common:creating', '创建中...') : t('dialog:newProject.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generator Panel - 弹出面板 */}
      {activeTool === 'ai-gen' && projectManager.isProjectCreated && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-tech-900 border border-purple-500/30 rounded-xl w-full max-w-md shadow-2xl shadow-purple-900/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-tech-700 flex items-center justify-between bg-gradient-to-r from-purple-900/20 to-cyan-900/20">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Zap size={20} className="text-purple-400" />
                {t('ai:generator')}
              </h2>
              <button
                onClick={() => setActiveTool('select')}
                className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-tech-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Prompt */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{t('ai:prompt')}</label>
                <div className="relative">
                  <textarea
                    value={aiGenPrompt}
                    onChange={(e) => setAiGenPrompt(e.target.value)}
                    placeholder={t('ai:promptPlaceholder')}
                    className="w-full bg-tech-800 border border-tech-600 rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none h-28 placeholder-gray-600"
                  />
                  <button
                    onClick={async () => {
                      if (!aiGenPrompt.trim()) return;
                      setIsEnhancingPrompt(true);
                      try {
                        const enhanced = await enhancePrompt(aiGenPrompt);
                        if (enhanced) setAiGenPrompt(enhanced);
                      } catch (e) {
                        console.error("Enhance failed", e);
                      } finally {
                        setIsEnhancingPrompt(false);
                      }
                    }}
                    disabled={isEnhancingPrompt || !aiGenPrompt}
                    className={clsx(
                      "absolute bottom-2 right-2 p-1.5 rounded-lg transition-all border",
                      isEnhancingPrompt
                        ? "bg-purple-600/20 border-purple-500 text-purple-300"
                        : "bg-tech-800 border-tech-700 text-gray-500 hover:text-purple-400 hover:bg-tech-700"
                    )}
                    title={t('ai:enhancePrompt')}
                  >
                    {isEnhancingPrompt ? (
                      <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* Resolution */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{t('ai:resolution')}</label>
                <div className="flex bg-tech-800 rounded-lg p-1 border border-tech-700">
                  {(['1K', '2K', '4K'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => setAiGenImageSize(size)}
                      className={clsx(
                        "flex-1 py-1.5 text-xs rounded-md transition-all font-medium",
                        aiGenImageSize === size ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{t('ai:aspectRatio')}</label>
                <div className="grid grid-cols-5 gap-1 bg-tech-800 rounded-lg p-1 border border-tech-700">
                  {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAiGenAspectRatio(ratio)}
                      className={clsx(
                        "py-2 text-[10px] rounded-md transition-all font-medium flex flex-col items-center justify-center gap-1",
                        aiGenAspectRatio === ratio ? "bg-cyan-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
                      )}
                      title={ratio}
                    >
                      <div className={clsx("border border-current opacity-60",
                        ratio === '1:1' && "w-3 h-3",
                        ratio === '16:9' && "w-4 h-2",
                        ratio === '9:16' && "w-2 h-4",
                        ratio === '4:3' && "w-3.5 h-2.5",
                        ratio === '3:4' && "w-2.5 h-3.5",
                      )}></div>
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sketch Canvas */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{t('ai:sketchCanvas')}</label>
                <div className="w-full">
                  <SketchCanvas
                    width={400}
                    height={225}
                    onChange={(imageData) => setAiGenSketchImage(imageData)}
                    initialImage={aiGenSketchImage}
                  />
                </div>
                {/* 预留固定高度的提示文字区域，避免布局抖动 */}
                <div className="h-5 flex items-center">
                  {aiGenSketchImage && (
                    <p className="text-[10px] text-cyan-400">{t('ai:sketchDrawn')}</p>
                  )}
                </div>
              </div>

              {/* Reference Image */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{t('ai:referenceImage')}</label>
                <input
                  type="file"
                  ref={aiGenFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setAiGenReferenceImage(evt.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                    if (aiGenFileInputRef.current) aiGenFileInputRef.current.value = '';
                  }}
                  accept="image/*"
                  className="hidden"
                />
                {!aiGenReferenceImage ? (
                  <button
                    onClick={() => aiGenFileInputRef.current?.click()}
                    className="w-full h-20 border border-dashed border-tech-600 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-tech-800/50 transition-all"
                  >
                    <Upload size={16} />
                    <span className="text-[10px]">{t('ai:uploadReference')}</span>
                  </button>
                ) : (
                  <div className="relative rounded-lg overflow-hidden border border-tech-600 group">
                    <img src={aiGenReferenceImage} alt="Reference" className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => setAiGenReferenceImage(null)}
                        className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full backdrop-blur transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
                {/* 预留固定高度的提示文字区域，避免布局抖动 */}
                <div className="h-5 flex items-center">
                  {aiGenReferenceImage && aiGenSketchImage && (
                    <p className="text-[10px] text-purple-400">{t('ai:sketchAndReference')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-tech-700 bg-tech-800/50">
              <button
                onClick={() => {
                  if (!aiGenPrompt.trim()) return;
                  handleAIGenerate(aiGenPrompt, aiGenReferenceImage, aiGenSketchImage, aiGenImageSize, aiGenAspectRatio);
                }}
                disabled={processingState !== 'idle' || !aiGenPrompt}
                className={clsx(
                  "w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                  processingState !== 'idle' || !aiGenPrompt
                    ? "bg-tech-700 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-lg shadow-purple-900/50"
                )}
              >
                {processingState === 'generating' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('ai:generating')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>{t('ai:generate')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
      />

      {/* Recovery Modal - 恢复确认弹窗 */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-tech-900 border border-cyan-500/30 rounded-xl p-6 w-full max-w-md shadow-2xl shadow-cyan-900/20">
            <h3 className="text-lg font-semibold text-cyan-100 mb-2">
              {t('dialog:recovery.title', '恢复未保存的项目')}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {t('dialog:recovery.message', '检测到上次未保存的项目，是否恢复？')}
            </p>
            {autoSave.recoverableTimestamp && (
              <p className="text-xs text-gray-500 mb-4">
                {t('dialog:recovery.timestamp', '保存时间')}: {autoSave.recoverableTimestamp}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleDismissRecovery}
                disabled={isRecovering}
                className="px-4 py-2 rounded bg-tech-800 hover:bg-tech-700 text-gray-300 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('dialog:recovery.dismiss', '忽略')}
              </button>
              <button
                onClick={handleRecoverProject}
                disabled={isRecovering}
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRecovering && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isRecovering ? t('dialog:recovery.recovering', '恢复中...') : t('dialog:recovery.recover', '恢复')}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Project Loading Overlay - 项目加载动画 */}
      {isLoadingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-6 p-8 bg-tech-900/90 border border-tech-600 rounded-2xl shadow-2xl">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-tech-700 border-t-cyan-400 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={32} className="text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-200 mb-2">
                {t('message:loading.project', '正在加载项目')}
              </h3>
              <p className="text-sm text-gray-500">
                {t('message:loading.pleaseWait', '请稍候，正在加载图层数据...')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* History Panel - 历史记录面板 */}
      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        history={historyManager.history}
        currentStep={historyManager.historyStep}
        onJumpToStep={handleJumpToHistoryStep}
      />

      {/* 全屏 Loading 遮罩 - AI 操作期间显示 */}
      <FullScreenLoading processingState={processingState} />
    </div>
  );
}
