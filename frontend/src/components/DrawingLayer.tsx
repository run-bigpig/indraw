import React from 'react';
import { Group, Line } from 'react-konva';
import { CanvasConfig } from '../types';

interface DrawingLayerProps {
  drawingLines: any[];
  brushMode: 'normal' | 'ai';
  activeTool: string;
  brushConfig: { size: number; color: string; opacity: number };
  eraserConfig: { size: number };
  scale: number;
  canvasConfig: CanvasConfig;
}

const DrawingLayer: React.FC<DrawingLayerProps> = ({
  drawingLines,
  brushMode,
  activeTool,
  brushConfig,
  eraserConfig,
  scale,
  canvasConfig,
}) => {
  const eraseLines = drawingLines.filter((l) => l.mode === 'erase');
  const drawLines = drawingLines.filter((l) => l.mode !== 'erase');

  return (
    <Group clipX={0} clipY={0} clipWidth={canvasConfig.width} clipHeight={canvasConfig.height}>
      {drawLines.map((line, i) => (
        <Line
          key={`draw-${i}`}
          points={line.points}
          stroke={brushMode === 'ai' ? '#EF4444' : brushConfig.color}
          strokeWidth={brushConfig.size / scale}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          opacity={brushMode === 'ai' ? 0.5 : 1}
          listening={false}
          globalCompositeOperation="source-over"
        />
      ))}

      {eraseLines.length > 0 && (
        <Group globalCompositeOperation="destination-out">
          {eraseLines.map((line, i) => (
            <Line
              key={`erase-${i}`}
              points={line.points}
              stroke="#000000"
              strokeWidth={eraserConfig.size / scale}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              opacity={1}
              listening={false}
            />
          ))}
        </Group>
      )}
    </Group>
  );
};

export default DrawingLayer;
