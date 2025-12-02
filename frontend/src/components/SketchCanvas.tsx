/**
 * SketchCanvas - 草图绘制画布组件
 * 用于在 AI 生成面板中绘制简单的草图
 */

import React, { useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SketchCanvasProps {
  /** 画布宽度 */
  width: number;
  /** 画布高度 */
  height: number;
  /** 草图数据变化回调 */
  onChange?: (imageData: string | null) => void;
  /** 初始草图数据（base64） */
  initialImage?: string | null;
}

const SketchCanvas: React.FC<SketchCanvasProps> = ({
  width,
  height,
  onChange,
  initialImage,
}) => {
  const { t } = useTranslation(['ai']);
  const [lines, setLines] = useState<number[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const currentLineRef = useRef<number[]>([]);

  // 从初始图像加载线条（如果有）
  React.useEffect(() => {
    if (initialImage && lines.length === 0) {
      // 如果有初始图像，可以在这里解析并加载
      // 目前简化处理，只清空画布
    }
  }, [initialImage, lines.length]);

  // 导出画布为 base64 图像
  const exportToImage = useCallback((): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;

    try {
      const dataURL = stage.toDataURL({ pixelRatio: 1 });
      return dataURL;
    } catch (error) {
      console.error('导出草图失败:', error);
      return null;
    }
  }, []);

  // 当线条变化时，导出并通知父组件
  React.useEffect(() => {
    if (!onChange) return;
    
    // 如果没有线条，直接通知 null
    if (lines.length === 0) {
      onChange(null);
      return;
    }
    
    // 使用 setTimeout 确保 DOM 更新后再导出
    const timer = setTimeout(() => {
      const imageData = exportToImage();
      onChange(imageData);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [lines.length, onChange, exportToImage]);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // 如果点击的是清除按钮，不处理
    if ((e.evt.target as HTMLElement)?.closest('button')) {
      return;
    }
    e.evt.preventDefault();
    setIsDrawing(true);
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (pos) {
      // 确保坐标在画布范围内
      const x = Math.max(0, Math.min(pos.x, width));
      const y = Math.max(0, Math.min(pos.y, height));
      currentLineRef.current = [x, y];
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const point = stage.getPointerPosition();
    if (!point) return;
    
    // 确保坐标在画布范围内
    const x = Math.max(0, Math.min(point.x, width));
    const y = Math.max(0, Math.min(point.y, height));

    // 添加点到当前线条（使用限制后的坐标）
    currentLineRef.current = currentLineRef.current.concat([x, y]);

    // 更新最后一条线
    setLines((prev) => {
      const newLines = [...prev];
      if (newLines.length > 0 && newLines[newLines.length - 1] === currentLineRef.current) {
        // 如果最后一条线就是当前线，直接更新
        newLines[newLines.length - 1] = [...currentLineRef.current];
      } else if (newLines.length > 0) {
        // 替换最后一条线
        newLines[newLines.length - 1] = [...currentLineRef.current];
      } else {
        // 添加新线
        newLines.push([...currentLineRef.current]);
      }
      return newLines;
    });
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // 完成当前线条，准备下一条
      if (currentLineRef.current.length > 0) {
        setLines((prev) => {
          const newLines = [...prev];
          if (newLines.length === 0 || newLines[newLines.length - 1] !== currentLineRef.current) {
            newLines.push([...currentLineRef.current]);
          }
          return newLines;
        });
      }
      currentLineRef.current = [];
    }
  };

  // 触摸事件处理器
  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    setIsDrawing(true);
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (pos) {
      // 确保坐标在画布范围内
      const x = Math.max(0, Math.min(pos.x, width));
      const y = Math.max(0, Math.min(pos.y, height));
      currentLineRef.current = [x, y];
    }
  };

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const point = stage.getPointerPosition();
    if (!point) return;
    
    // 确保坐标在画布范围内
    const x = Math.max(0, Math.min(point.x, width));
    const y = Math.max(0, Math.min(point.y, height));

    // 添加点到当前线条（使用限制后的坐标）
    currentLineRef.current = currentLineRef.current.concat([x, y]);

    // 更新最后一条线
    setLines((prev) => {
      const newLines = [...prev];
      if (newLines.length > 0 && newLines[newLines.length - 1] === currentLineRef.current) {
        // 如果最后一条线就是当前线，直接更新
        newLines[newLines.length - 1] = [...currentLineRef.current];
      } else if (newLines.length > 0) {
        // 替换最后一条线
        newLines[newLines.length - 1] = [...currentLineRef.current];
      } else {
        // 添加新线
        newLines.push([...currentLineRef.current]);
      }
      return newLines;
    });
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  const handleClear = () => {
    setLines([]);
    currentLineRef.current = [];
    if (onChange) {
      onChange(null);
    }
  };

  return (
    <div className="relative w-full" style={{ height }}>
      <div className="relative bg-white rounded-lg border border-tech-600 overflow-hidden w-full" style={{ height, aspectRatio: `${width}/${height}` }}>
        <Stage
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          ref={stageRef}
          className="cursor-crosshair"
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line}
                stroke="#000000"
                strokeWidth={2}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            ))}
            {isDrawing && currentLineRef.current.length > 0 && (
              <Line
                points={currentLineRef.current}
                stroke="#000000"
                strokeWidth={2}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>
      
      {/* 清除按钮 - 使用 z-index 确保在 Stage 上方，但不遮挡绘制区域 */}
      {lines.length > 0 && (
        <button
          onClick={handleClear}
          className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg z-10"
          title={t('ai:clearSketch')}
          style={{ pointerEvents: 'auto' }}
        >
          <Trash2 size={14} />
        </button>
      )}
      
      {/* 提示文字 */}
      {lines.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0" style={{ width, height }}>
          <p className="text-xs text-gray-400 bg-white/80 px-3 py-1 rounded">
            {t('ai:sketchHint')}
          </p>
        </div>
      )}
    </div>
  );
};

export default SketchCanvas;

