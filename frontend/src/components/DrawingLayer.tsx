import React, { useMemo } from 'react';
import { Group, Line } from 'react-konva';
import { CanvasConfig } from '../types';

interface DrawingLayerProps {
  drawingLines: any[];
  brushMode: 'normal' | 'ai' | 'heal';
  activeTool: string;
  brushConfig: { size: number; color: string; opacity: number };
  eraserConfig: { size: number };
  scale: number;
  canvasConfig: CanvasConfig;
}

/**
 * DrawingLayer 组件 - 优化版
 *
 * 性能优化：
 * 1. 使用 React.memo 避免不必要的重渲染
 * 2. 使用 useMemo 缓存过滤结果
 * 3. 为每条线生成稳定的 key
 */
const DrawingLayer: React.FC<DrawingLayerProps> = React.memo(({
  drawingLines,
  brushMode,
  activeTool,
  brushConfig,
  eraserConfig,
  scale,
  canvasConfig,
}) => {
  // ✅ 优化1: 使用 useMemo 缓存过滤结果，避免每次渲染都重新过滤
  const { eraseLines, drawLines } = useMemo(() => {
    const erase: any[] = [];
    const draw: any[] = [];

    drawingLines.forEach((line) => {
      if (line.mode === 'erase') {
        erase.push(line);
      } else {
        draw.push(line);
      }
    });

    return { eraseLines: erase, drawLines: draw };
  }, [drawingLines]);

  // ✅ 优化2: 缓存画笔颜色和透明度
  const brushStroke = useMemo(() => {
    if (brushMode === 'ai') return '#EF4444';
    if (brushMode === 'heal') return '#10B981'; // 绿色表示修复模式
    return brushConfig.color;
  }, [brushMode, brushConfig.color]);

  const brushOpacity = useMemo(() => {
    if (brushMode === 'ai') return 0.5;
    if (brushMode === 'heal') return 0.6; // 稍微透明，便于看到修复区域
    return 1;
  }, [brushMode]);

  return (
    <Group clipX={0} clipY={0} clipWidth={canvasConfig.width} clipHeight={canvasConfig.height}>
      {drawLines.map((line, i) => (
        <Line
          key={`draw-${i}-${line.points.length}`}
          points={line.points}
          stroke={brushStroke}
          strokeWidth={brushConfig.size / scale}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          opacity={brushOpacity}
          listening={false}
          globalCompositeOperation="source-over"
          perfectDrawEnabled={false}
        />
      ))}

      {eraseLines.length > 0 && (
        <Group>
          {eraseLines.map((line, i) => (
            <Line
              key={`erase-${i}-${line.points.length}`}
              points={line.points}
              stroke="#EF4444"
              strokeWidth={eraserConfig.size / scale}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              opacity={0.5}
              listening={false}
              perfectDrawEnabled={false}
              globalCompositeOperation="source-over"
            />
          ))}
        </Group>
      )}
    </Group>
  );
}, (prevProps, nextProps) => {
  // ✅ 优化3: 自定义比较函数，只在必要时重新渲染
  return (
    prevProps.drawingLines === nextProps.drawingLines &&
    prevProps.brushMode === nextProps.brushMode &&
    prevProps.brushConfig.color === nextProps.brushConfig.color &&
    prevProps.brushConfig.size === nextProps.brushConfig.size &&
    prevProps.eraserConfig.size === nextProps.eraserConfig.size &&
    prevProps.scale === nextProps.scale
  );
});

DrawingLayer.displayName = 'DrawingLayer';

export default DrawingLayer;
