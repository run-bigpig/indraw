
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Transformer, Group, Circle, Line } from 'react-konva';
import useImage from 'use-image';
import { LayerData, ToolType, ShapeType, CanvasConfig } from '../types';
import Konva from 'konva';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Ruler from './Ruler';
import LayerRenderer from './LayerRenderer';
import DrawingLayer from './DrawingLayer';
import TextEditorOverlay, { EditingTextState } from './TextEditorOverlay';
import ZoomControls from './ZoomControls';
import { createPolygonLayer, createStarLayer, createRoundedRectLayer, createEllipseLayer, createArrowLayer, createWedgeLayer, createRingLayer, createArcLayer } from '../utils/shapeDrawing';
import { createLayerName } from '../utils/layerName';

// Generate a simple checkerboard pattern (16x16)
const createCheckerboardPattern = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 20, 20);
        ctx.fillStyle = '#DDDDDD';
        ctx.fillRect(0, 0, 10, 10);
        ctx.fillRect(10, 10, 10, 10);
    }
    return canvas.toDataURL();
}
const CHECKERBOARD_URL = createCheckerboardPattern();

interface CanvasBoardProps {
    layers: LayerData[];
    selectedIds: string[];
    activeTool: ToolType;
    shapeType?: ShapeType;
    brushMode: 'normal' | 'ai' | 'heal';
    drawingLines: any[];
    brushConfig: { size: number, color: string, opacity: number };
    eraserConfig: { size: number };
    canvasConfig: CanvasConfig;
    onSetDrawingLines: (lines: any[]) => void;
    onSelectLayer: (id: string | null, multi?: boolean) => void;
    onUpdateLayer: (id: string, attrs: Partial<LayerData>, saveHistory?: boolean) => void;
    onLineDrawn: (points: number[], strokeWidth: number, options?: { erase?: boolean; targetLayerId?: string }) => void;
    onAddText: (x: number, y: number) => void;
    onAddShape: (shape: LayerData) => void;
    onContextMenuAction: (action: string) => void;
    stageRef: React.RefObject<Konva.Stage>;
    isDraggingFile?: boolean;
    onDragEnter?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
}

const CanvasBoard: React.FC<CanvasBoardProps> = ({
    layers,
    selectedIds,
    activeTool,
    shapeType = 'polygon',
    brushMode,
    drawingLines,
    brushConfig,
    eraserConfig,
    canvasConfig,
    onSetDrawingLines,
    onSelectLayer,
    onUpdateLayer,
    onLineDrawn,
    onAddText,
    onAddShape,
    onContextMenuAction,
    stageRef,
    isDraggingFile = false,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
}) => {
    const { t: tToolbar } = useTranslation(['toolbar']);
    const { t } = useTranslation('common');
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const trRef = useRef<Konva.Transformer>(null);
    const [patternImage] = useImage(CHECKERBOARD_URL);
    const selectionDrag = useRef<{
        start: { x: number, y: number };
        originals: Record<string, { x: number, y: number }>;
    } | null>(null);

    // Drawing state
    const isDrawing = useRef(false);
    // 当前一次擦除操作命中的目标图层（用于图层级橡皮擦）
    const eraseTargetId = useRef<string | null>(null);
    // 形状绘制状态
    const shapeDrawingState = useRef<{
        startPos: { x: number; y: number };
        currentShape: LayerData | null;
    } | null>(null);

    // ✅ 性能优化：使用 Konva 原生 API 直接绘制
    // 当前正在绘制的线条引用（直接操作 Konva 节点，不触发 React 更新）
    const currentLineRef = useRef<Konva.Line | null>(null);
    // 绘制图层引用
    const drawingLayerRef = useRef<Konva.Layer | null>(null);
    // 当前绘制的点数组（直接修改，不触发 React 更新）
    const currentPointsRef = useRef<number[]>([]);
    // 当前绘制模式
    const currentModeRef = useRef<'draw' | 'erase'>('draw');
    // requestAnimationFrame ID
    const rafIdRef = useRef<number | null>(null);

    // Text Editing State
    const [editingText, setEditingText] = useState<EditingTextState | null>(null);

    // 自定义光标状态：跟踪鼠标在画布上的位置
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const clampPointToCanvas = (point: { x: number, y: number }) => ({
        x: clampValue(point.x, 0, canvasConfig.width),
        y: clampValue(point.y, 0, canvasConfig.height),
    });

    // 已移除边界自动回收，允许拖出画布再拖回

    const fitToScreen = () => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;

        const padding = 60;
        const scaleW = (containerWidth - padding) / canvasConfig.width;
        const scaleH = (containerHeight - padding) / canvasConfig.height;
        const newScale = Math.min(scaleW, scaleH, 1);

        const newX = (containerWidth - canvasConfig.width * newScale) / 2;
        const newY = (containerHeight - canvasConfig.height * newScale) / 2;

        setScale(newScale);
        setPosition({ x: newX, y: newY });
    };

    const centerWithScale = (nextScale: number) => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const newX = (containerWidth - canvasConfig.width * nextScale) / 2;
        const newY = (containerHeight - canvasConfig.height * nextScale) / 2;
        setScale(nextScale);
        setPosition({ x: newX, y: newY });
    };

    useEffect(() => {
        const updateSize = () => {
            if (!containerRef.current) return;
            setViewportSize({
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight,
            });
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Initial Center on Mount or Config/size Change
    useEffect(() => {
        fitToScreen();
    }, [canvasConfig, viewportSize.width, viewportSize.height]);

    // Transformer Logic for Multi-Select
    // 优化：移除 layers 依赖，避免每次图层属性变化都重新绑定 Transformer
    // 只在 selectedIds 变化时重新绑定
    useEffect(() => {
        if (trRef.current && stageRef.current) {
            const stage = stageRef.current;
            const selectedNodes: Konva.Node[] = [];

            selectedIds.forEach(id => {
                const node = stage.findOne(`#${id}`);
                if (node) selectedNodes.push(node);
            });

            trRef.current.nodes(selectedNodes);
            trRef.current.getLayer()?.batchDraw();
        }
    }, [selectedIds]); // 移除 layers 依赖

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const stage = e.target.getStage();
        if (!stage) return;

        const oldScale = stage.scaleX();
        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

        if (newScale < 0.1 || newScale > 10) return;

        centerWithScale(newScale);
    };

    const handleZoomIn = () => {
        centerWithScale(Math.min(scale * 1.2, 10));
    };

    const handleZoomOut = () => {
        centerWithScale(Math.max(scale / 1.2, 0.1));
    };

    const checkDeselect = (e: any) => {
        const isStage = e.target === e.target.getStage();
        const isBackground = e.target.name() === 'canvas-background';
        const hasOutsideSelection = selectedIds.some(id => {
            const layer = layers.find(l => l.id === id);
            if (!layer) return false;
            const w = layer.width || 0;
            const h = layer.height || 0;
            if (layer.x < 0 || layer.y < 0) return true;
            if (w && layer.x + w > canvasConfig.width) return true;
            if (h && layer.y + h > canvasConfig.height) return true;
            return false;
        });

        if ((isStage || isBackground) && activeTool === 'select' && !hasOutsideSelection) {
            onSelectLayer(null);
        }
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (contextMenu) setContextMenu(null);

        if (e.evt.type === 'mousedown' && (e.evt as MouseEvent).button === 2) {
            return;
        }

        if (activeTool === 'select' || activeTool === 'ai-gen') {
            const isStage = e.target === e.target.getStage();
            const isBackground = e.target.name() === 'canvas-background';
            if (activeTool === 'select' && selectedIds.length > 0 && (isStage || isBackground)) {
                const stage = e.target.getStage();
                const pos = stage?.getRelativePointerPosition();
                if (stage && pos) {
                    const originals: Record<string, { x: number, y: number }> = {};
                    selectedIds.forEach(id => {
                        const layer = layers.find(l => l.id === id);
                        if (layer) originals[id] = { x: layer.x, y: layer.y };
                    });
                    selectionDrag.current = { start: pos, originals };
                }
            } else {
                checkDeselect(e);
            }
            return;
        }

        const stage = e.target.getStage();
        if (!stage) return;
        const pos = stage.getRelativePointerPosition();
        if (!pos) return;
        const clampedPos = clampPointToCanvas(pos);

        if (activeTool === 'text') {
            const transform = stage.getAbsoluteTransform().copy();
            transform.invert();
            const absolutePos = stage.getPointerPosition();
            if (absolutePos) {
                const layerPos = transform.point(absolutePos);
                const clamped = clampPointToCanvas(layerPos);
                onAddText(clamped.x, clamped.y);
            }
            return;
        }

        // 形状工具绘制
        if (activeTool === 'shape') {
            shapeDrawingState.current = {
                startPos: clampedPos,
                currentShape: null,
            };
            isDrawing.current = true;
            // 创建初始形状（合理的初始尺寸，避免太小）
            const initialWidth = 100;
            const initialHeight = 100;
            let initialShape: LayerData | null = null;
            if (shapeType === 'polygon') {
                const name = createLayerName('polygon', t, layers.length, { numPoints: 6 });
                initialShape = createPolygonLayer(clampedPos.x, clampedPos.y, initialWidth, initialHeight, 6, name);
            } else if (shapeType === 'star') {
                const name = createLayerName('star', t, layers.length, { numPoints: 5 });
                initialShape = createStarLayer(clampedPos.x, clampedPos.y, initialWidth, initialHeight, 5, name);
            } else if (shapeType === 'rounded-rect') {
                const name = createLayerName('rounded-rect', t, layers.length);
                initialShape = createRoundedRectLayer(clampedPos.x, clampedPos.y, initialWidth, initialHeight, 10, name);
            } else if (shapeType === 'ellipse') {
                const name = createLayerName('ellipse', t, layers.length);
                initialShape = createEllipseLayer(clampedPos.x, clampedPos.y, initialWidth, initialHeight, name);
            } else if (shapeType === 'arrow') {
                const name = createLayerName('arrow', t, layers.length);
                initialShape = createArrowLayer(clampedPos.x, clampedPos.y, initialWidth, initialHeight, name);
            } else if (shapeType === 'wedge') {
                const name = createLayerName('wedge', t, layers.length);
                initialShape = createWedgeLayer(clampedPos.x, clampedPos.y, initialWidth, initialHeight, 60, name);
            } else if (shapeType === 'ring') {
                const name = createLayerName('ring', t, layers.length);
                initialShape = createRingLayer(clampedPos.x, clampedPos.y, initialWidth, initialHeight, name);
            } else if (shapeType === 'arc') {
                const name = createLayerName('arc', t, layers.length);
                initialShape = createArcLayer(clampedPos.x, clampedPos.y, initialWidth, initialHeight, 60, name);
            }
            if (initialShape) {
                shapeDrawingState.current.currentShape = initialShape;
                onAddShape(initialShape);
            }
            return;
        }

        if (activeTool === 'brush' || activeTool === 'eraser') {
            // 每次新绘制重置目标图层
            eraseTargetId.current = null;

            const targetNode = e.target;
            const stageNode = targetNode.getStage();

            if (stageNode && targetNode !== stageNode) {
                const hitLayerNode = targetNode.findAncestor((node: Konva.Node) => {
                    const nodeId = node.id();
                    if (!nodeId) return false;
                    return layers.some(l => l.id === nodeId);
                }, true) as Konva.Node | null;

                if (hitLayerNode) {
                    const hitLayerId = hitLayerNode.id();
                    const layer = layers.find(l => l.id === hitLayerId);

                    // 橡皮擦命中图层：记录目标用于图层级擦除
                    if (activeTool === 'eraser') {
                        eraseTargetId.current = hitLayerId;
                        console.log('[mouseDown] eraser hit layer', eraseTargetId.current);
                    }

                    // AI 画笔或 Heal 画笔命中图片图层：自动选中该图层
                    if (activeTool === 'brush' && (brushMode === 'ai' || brushMode === 'heal') && layer && layer.type === 'image') {
                        onSelectLayer(hitLayerId, false);
                    }
                } else if (activeTool === 'eraser') {
                    console.log('[mouseDown] eraser hit no layer, will use global erase');
                }
            }

            isDrawing.current = true;
            currentModeRef.current = activeTool === 'eraser' ? 'erase' : 'draw';
            currentPointsRef.current = [clampedPos.x, clampedPos.y];

            // ✅ 性能优化：使用 Konva 原生 API 直接创建线条
            // 对于 AI 画笔模式、Heal 画笔模式或橡皮擦工具，使用 React 状态（因为需要特殊渲染/蒙层显示）
            if (brushMode === 'ai' || brushMode === 'heal' || activeTool === 'eraser') {
                onSetDrawingLines([
                    ...drawingLines,
                    { points: [clampedPos.x, clampedPos.y], mode: currentModeRef.current },
                ]);
            } else {
                // 普通画笔：直接操作 Konva 节点
                const layer = drawingLayerRef.current;
                if (layer) {
                    const line = new Konva.Line({
                        points: currentPointsRef.current,
                        stroke: brushConfig.color,
                        strokeWidth: brushConfig.size / scale,
                        tension: 0.5,
                        lineCap: 'round',
                        lineJoin: 'round',
                        listening: false,
                        perfectDrawEnabled: false,
                        globalCompositeOperation: 'source-over',
                    });
                    layer.add(line);
                    currentLineRef.current = line;
                    layer.batchDraw();
                }
            }
        }
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;
        const pos = stage.getRelativePointerPosition();
        if (!pos) return;
        const clampedPos = clampPointToCanvas(pos);

        // 更新自定义光标位置（用于画笔/橡皮擦工具）
        if (activeTool === 'brush' || activeTool === 'eraser') {
            setCursorPos(pos);
        }

        if (activeTool === 'select' && selectionDrag.current) {
            const dx = pos.x - selectionDrag.current.start.x;
            const dy = pos.y - selectionDrag.current.start.y;
            Object.entries(selectionDrag.current.originals).forEach(([id, origin]) => {
                onUpdateLayer(id, { x: origin.x + dx, y: origin.y + dy }, false);
            });
            return;
        }

        if ((activeTool === 'brush' || activeTool === 'eraser') && isDrawing.current) {
            // ✅ 性能优化：对于 AI 画笔模式、Heal 画笔模式或橡皮擦工具，使用 React 状态（需要显示蒙层）
            if (brushMode === 'ai' || brushMode === 'heal' || activeTool === 'eraser') {
                const lastLine = drawingLines[drawingLines.length - 1];
                if (lastLine) {
                    lastLine.points.push(clampedPos.x, clampedPos.y);
                    const newLines = [...drawingLines];
                    onSetDrawingLines(newLines);
                }
            } else {
                // ✅ 性能优化：普通画笔直接操作 Konva 节点
                // 将点添加到 ref 中
                currentPointsRef.current.push(clampedPos.x, clampedPos.y);

                // 使用 requestAnimationFrame 节流更新
                if (rafIdRef.current === null) {
                    rafIdRef.current = requestAnimationFrame(() => {
                        rafIdRef.current = null;
                        const line = currentLineRef.current;
                        if (line) {
                            // 直接更新 Konva 节点的 points
                            line.points(currentPointsRef.current);
                            // 只重绘当前 Layer，不重绘整个 Stage
                            line.getLayer()?.batchDraw();
                        }
                    });
                }
            }
        }
    };

    const handleMouseUp = () => {
        // ✅ 性能优化：批量移动选中图层结束时，触发一次历史保存
        if (selectionDrag.current) {
            const movedIds = Object.keys(selectionDrag.current.originals);
            if (movedIds.length > 0) {
                // 检查是否真的发生了移动
                const hasMoved = movedIds.some(id => {
                    const layer = layers.find(l => l.id === id);
                    const original = selectionDrag.current?.originals[id];
                    return layer && original && (layer.x !== original.x || layer.y !== original.y);
                });

                if (hasMoved) {
                    // 使用第一个移动的图层触发历史保存
                    const firstId = movedIds[0];
                    const layer = layers.find(l => l.id === firstId);
                    if (layer) {
                        // 触发一次带历史保存的更新（只更新第一个，其他已经在 mouseMove 中更新了）
                        // ✅ 性能优化：直接同步调用，不再使用 requestAnimationFrame
                        // updateLayer 内部已经有防抖机制，不会阻塞 UI
                        onUpdateLayer(firstId, { x: layer.x, y: layer.y }, true);
                    }
                }
            }
            selectionDrag.current = null;
        }

        // 形状工具绘制完成
        if (activeTool === 'shape' && isDrawing.current && shapeDrawingState.current?.currentShape) {
            const shape = shapeDrawingState.current.currentShape;
            // 确保形状有最小尺寸，然后保存历史
            if (shape.width && shape.width > 5 && shape.height && shape.height > 5) {
                // 触发一次历史保存
                onUpdateLayer(shape.id, {
                    x: shape.x,
                    y: shape.y,
                    width: shape.width,
                    height: shape.height,
                }, true);
            } else {
                // 如果形状太小，删除它
                onUpdateLayer(shape.id, { visible: false }, true);
            }
            shapeDrawingState.current = null;
            isDrawing.current = false;
            return;
        }

        if ((activeTool === 'brush' || activeTool === 'eraser') && isDrawing.current) {
            isDrawing.current = false;

            // 取消待执行的 RAF
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }

            // 橡皮擦工具、AI 画笔模式或 Heal 画笔模式：从 drawingLines 获取数据
            if (activeTool === 'eraser' || brushMode === 'ai' || brushMode === 'heal') {
                const lastLine = drawingLines[drawingLines.length - 1];
                if (lastLine && lastLine.points.length > 2) {
                    const isErase = activeTool === 'eraser';
                    const strokeSize = isErase ? eraserConfig.size : brushConfig.size;
                    
                    console.log('[mouseUp] finalize stroke', {
                        activeTool,
                        brushMode,
                        isErase,
                        pointsLen: lastLine.points.length,
                        eraseTargetId: eraseTargetId.current,
                        strokeSize,
                    });

                    const finalPoints = [...lastLine.points];
                    const finalEraseTargetId = eraseTargetId.current;

                    // 延迟执行创建图层和保存历史记录
                    if ('requestIdleCallback' in window) {
                        (window as any).requestIdleCallback(() => {
                            onLineDrawn(finalPoints, strokeSize / scale, {
                                erase: isErase,
                                targetLayerId: isErase ? finalEraseTargetId || undefined : undefined,
                            });
                        }, { timeout: 50 });
                    } else {
                        // 降级方案：使用 setTimeout
                        setTimeout(() => {
                            onLineDrawn(finalPoints, strokeSize / scale, {
                                erase: isErase,
                                targetLayerId: isErase ? finalEraseTargetId || undefined : undefined,
                            });
                        }, 0);
                    }
                }
                
                // 橡皮擦工具：清空 drawingLines（AI 模式不清空，由外部控制）
                if (activeTool === 'eraser') {
                    onSetDrawingLines([]);
                }
                
                // 重置状态
                eraseTargetId.current = null;
            } else {
                // 普通画笔模式：从 Konva 节点获取最终的点数据
                const points = currentPointsRef.current;
                const strokeSize = brushConfig.size;

                if (points.length > 2) {
                    console.log('[mouseUp] finalize stroke', {
                        activeTool,
                        brushMode,
                        isErase: false,
                        pointsLen: points.length,
                        strokeSize,
                    });

                    const finalPoints = [...points]; // 复制一份，因为 ref 会被重置
                    const tempLine = currentLineRef.current; // 保存临时线条引用

                    // ✅ 修复闪烁：先同步创建新图层，确保新图层已经添加到图层列表
                    onLineDrawn(finalPoints, strokeSize / scale, {
                        erase: false,
                    });

                    // ✅ 修复闪烁：使用 requestAnimationFrame 确保新图层渲染完成后再销毁临时线条
                    // 这样可以避免临时线条消失和新图层显示之间的时间差导致的闪烁
                    requestAnimationFrame(() => {
                        // 再等一帧，确保新图层已经完全渲染
                        requestAnimationFrame(() => {
                            if (tempLine) {
                                tempLine.destroy();
                                drawingLayerRef.current?.batchDraw();
                            }
                        });
                    });
                } else {
                    // 点数不足，直接清理
                    if (currentLineRef.current) {
                        currentLineRef.current.destroy();
                        currentLineRef.current = null;
                        drawingLayerRef.current?.batchDraw();
                    }
                }

                // 重置状态
                currentLineRef.current = null;
                currentPointsRef.current = [];
            }
        }
    };

    const handleLayerDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>, layer: LayerData) => {
        if (layer.type !== 'text') return;

        const textNode = e.target as Konva.Text;
        const absPos = textNode.getAbsolutePosition();

        setEditingText({
            id: layer.id,
            value: layer.text || '',
            x: absPos.x,
            y: absPos.y,
            width: textNode.width() * textNode.getAbsoluteScale().x,
            rotation: textNode.getAbsoluteRotation(),
            fontSize: textNode.fontSize() * textNode.getAbsoluteScale().x,
            fontFamily: textNode.fontFamily(),
            fill: textNode.fill() as string,
            align: textNode.align(),
            lineHeight: textNode.lineHeight()
        });
    };

    const handleTextEditEnd = () => {
        if (editingText) {
            onUpdateLayer(editingText.id, { text: editingText.value });
            setEditingText(null);
        }
    };

    const handleContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
        const isBackground = e.target.name() === 'canvas-background';
        if (e.target === e.target.getStage() || isBackground) {
            // Optional: Stage context menu
        } else {
            setContextMenu({ x: e.evt.clientX, y: e.evt.clientY });
        }
    };

    const getRootLayerId = (id: string): string => {
        let current = layers.find(l => l.id === id);
        while (current && current.parentId) {
            const parent = layers.find(l => l.id === current.parentId);
            if (parent) {
                current = parent;
            } else {
                break;
            }
        }
        return current ? current.id : id;
    };

    const handleObjectSelect = (id: string | null, multi: boolean) => {
        // If we are in brush mode, we do NOT want to select objects, we want to ignore them
        if (activeTool !== 'select') return;

        if (!id) {
            onSelectLayer(null, multi);
            return;
        }
        const rootId = getRootLayerId(id);
        onSelectLayer(rootId, multi);
    };

    return (
        <div
            className="w-full h-full bg-[#0f1119] relative overflow-hidden shadow-inner"
            ref={containerRef}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* 拖拽上传提示遮罩 */}
            {isDraggingFile && (
                <div className="absolute inset-0 z-50 bg-cyan-500/10 border-4 border-dashed border-cyan-400 flex items-center justify-center pointer-events-none backdrop-blur-sm">
                    <div className="bg-tech-900/95 px-8 py-6 rounded-xl border border-cyan-400/50 shadow-2xl">
                        <div className="flex flex-col items-center gap-3">
                            <Upload size={48} className="text-cyan-400" />
                            <p className="text-lg font-medium text-cyan-100">
                                {t('toolbar:dragDropHint', '拖拽图片到此处上传')}
                            </p>
                            <p className="text-sm text-gray-400">
                                {t('toolbar:onlyImageSupported', '仅支持图片格式')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <Ruler orientation="horizontal" scale={scale} offset={position.x} width={containerRef.current?.clientWidth} />
            <Ruler orientation="vertical" scale={scale} offset={position.y} height={containerRef.current?.clientHeight} />

            <div className="absolute top-0 left-0 w-5 h-5 bg-tech-800 border-r border-b border-tech-600 z-20"></div>

            <div className="absolute inset-0 top-5 left-5 opacity-5 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(#4B5563 1px, transparent 1px), linear-gradient(90deg, #4B5563 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}>
            </div>

            <Stage
                width={viewportSize.width}
                height={viewportSize.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setCursorPos(null)}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={handleContextMenu}
                ref={stageRef}
                scaleX={scale}
                scaleY={scale}
                x={position.x}
                y={position.y}
                draggable={false}
                className={
                    activeTool === 'brush' || activeTool === 'eraser'
                        ? "cursor-none"
                        : activeTool === 'text'
                            ? "cursor-crosshair"
                            : "cursor-default"
                }
            >
                <Layer>
                    <Group
                        clipX={0}
                        clipY={0}
                        clipWidth={canvasConfig.width}
                        clipHeight={canvasConfig.height}
                    >
                        <Rect
                            name="canvas-background"
                            x={0}
                            y={0}
                            width={canvasConfig.width}
                            height={canvasConfig.height}
                            fill={canvasConfig.background === 'color' ? canvasConfig.backgroundColor : undefined}
                            fillPatternImage={canvasConfig.background === 'transparent' ? patternImage : undefined}
                            listening={false}
                        />

                        <LayerRenderer
                            layers={layers}
                            selectedIds={selectedIds}
                            activeTool={activeTool}
                            editingTextId={editingText?.id}
                            onSelectLayer={handleObjectSelect}
                            onUpdateLayer={onUpdateLayer}
                            onLayerDoubleClick={handleLayerDoubleClick}
                        />

                        <DrawingLayer
                            drawingLines={drawingLines}
                            brushMode={brushMode}
                            activeTool={activeTool}
                            brushConfig={brushConfig}
                            eraserConfig={eraserConfig}
                            scale={scale}
                            canvasConfig={canvasConfig}
                        />
                    </Group>

                    {selectedIds.length > 0 && activeTool === 'select' && (
                        <Transformer
                            ref={trRef}
                            flipEnabled={false}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                                return newBox;
                            }}
                            borderStroke="#06B6D4"
                            anchorStroke="#06B6D4"
                            anchorFill="#0B0E14"
                            anchorSize={8}
                            anchorCornerRadius={2}
                        />
                    )}

                    {/* 自定义圆形光标：画笔/橡皮擦工具 */}
                    {(activeTool === 'brush' || activeTool === 'eraser') && cursorPos && (
                        <Circle
                            x={cursorPos.x}
                            y={cursorPos.y}
                            radius={(activeTool === 'eraser' ? eraserConfig.size : brushConfig.size) / 2 / scale}
                            stroke={activeTool === 'eraser' ? '#EF4444' : '#06B6D4'}
                            strokeWidth={1.5 / scale}
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    )}
                </Layer>

                {/* ✅ 性能优化：专门用于实时绘制的 Layer */}
                {/* 这个 Layer 独立于主 Layer，可以单独重绘，不影响其他元素 */}
                <Layer
                    ref={(node) => {
                        drawingLayerRef.current = node;
                    }}
                    listening={false}
                    x={0}
                    y={0}
                    clipX={0}
                    clipY={0}
                    clipWidth={canvasConfig.width}
                    clipHeight={canvasConfig.height}
                />

            </Stage>

            <TextEditorOverlay
                editingText={editingText}
                onChange={(value) => setEditingText(prev => prev ? { ...prev, value } : prev)}
                onCommit={handleTextEditEnd}
            />

            {/* Context Menu Portal */}
            {contextMenu && (
                <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
                    {/* Handled by ContextMenu component rendering inside App */}
                </div>
            )}

            <ZoomControls scale={scale} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onFit={fitToScreen} />

        </div>
    );
};

export default CanvasBoard;
