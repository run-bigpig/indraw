/**
 * shapeRenderer - 形状渲染工具模块
 * 提供统一的形状渲染函数，支持新形状类型
 */

import React from 'react';
import { RegularPolygon, Star, Rect, Ellipse, Arrow, Wedge, Ring, Arc } from 'react-konva';
import Konva from 'konva';
import { LayerData, ToolType } from '../types';

interface ShapeRendererProps {
  layer: LayerData;
  isDraggable: boolean;
  activeTool: ToolType;
  isGroupChild: boolean;
  opacity: number;
  onSelect: (multi: boolean) => void;
  onUpdate: (attrs: Partial<LayerData>) => void;
  onTransformEnd: (attrs: Partial<LayerData>) => void;
}

/**
 * 应用渐变填充到 Konva 节点
 */
export const applyGradientFill = (node: Konva.Shape, gradient?: LayerData['fillGradient']) => {
  if (!gradient || !node) return;

  if (gradient.type === 'linear') {
    // Konva 使用 fillLinearGradientColorStops
    const colorStops: (string | number)[] = [];
    gradient.colorStops.forEach(stop => {
      colorStops.push(stop.offset, stop.color);
    });
    node.fillLinearGradientStartPoint({ x: gradient.startX || 0, y: gradient.startY || 0 });
    node.fillLinearGradientEndPoint({ x: gradient.endX || 0, y: gradient.endY || 0 });
    node.fillLinearGradientColorStops(colorStops);
  } else if (gradient.type === 'radial') {
    const colorStops: (string | number)[] = [];
    gradient.colorStops.forEach(stop => {
      colorStops.push(stop.offset, stop.color);
    });
    node.fillRadialGradientStartPoint({ x: gradient.startX || 0, y: gradient.startY || 0 });
    node.fillRadialGradientEndPoint({ x: gradient.endX || 0, y: gradient.endY || 0 });
    node.fillRadialGradientColorStops(colorStops);
  }
};

/**
 * 渲染多边形
 */
export const renderPolygon = ({
  layer,
  isDraggable,
  activeTool,
  isGroupChild,
  opacity,
  onSelect,
  onUpdate,
  onTransformEnd,
}: ShapeRendererProps) => {
  const numPoints = layer.numPoints || 6; // 默认六边形
  const radius = Math.min(layer.width || 50, layer.height || 50) / 2;

  return (
    <RegularPolygon
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x + (layer.width || 0) / 2}
      y={layer.y + (layer.height || 0) / 2}
      sides={numPoints}
      radius={radius}
      fill={layer.fill || '#06B6D4'}
      stroke={layer.stroke ?? '#000000'}
      strokeWidth={layer.strokeWidth ?? 10}
      dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
      lineCap={layer.lineCap || 'round'}
      lineJoin={layer.lineJoin || 'round'}
      listening={true}
      hitStrokeWidth={Math.max(layer.strokeWidth || 0, 10)}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={opacity}
      draggable={isDraggable}
      shadowColor={layer.shadowColor}
      shadowBlur={layer.shadowBlur || 0}
      shadowOffsetX={layer.shadowOffsetX || 0}
      shadowOffsetY={layer.shadowOffsetY || 0}
      shadowOpacity={layer.shadowOpacity || 1}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x() - (layer.width || 0) / 2, y: e.target.y() - (layer.height || 0) / 2 });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.RegularPolygon;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const newRadius = radius * Math.max(scaleX, scaleY);

        node.scaleX(1);
        node.scaleY(1);

        onTransformEnd({
          x: node.x() - newRadius,
          y: node.y() - newRadius,
          rotation: node.rotation(),
          width: newRadius * 2,
          height: newRadius * 2,
          scaleX: 1,
          scaleY: 1,
        });
      }}
    />
  );
};

/**
 * 渲染星形
 */
export const renderStar = ({
  layer,
  isDraggable,
  activeTool,
  isGroupChild,
  opacity,
  onSelect,
  onUpdate,
  onTransformEnd,
}: ShapeRendererProps) => {
  const numPoints = layer.numPoints || 5;
  const outerRadius = Math.min(layer.width || 50, layer.height || 50) / 2;
  const innerRadius = layer.innerRadius || outerRadius * 0.5;

  return (
    <Star
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x + (layer.width || 0) / 2}
      y={layer.y + (layer.height || 0) / 2}
      numPoints={numPoints}
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      fill={layer.fill || '#06B6D4'}
      stroke={layer.stroke ?? '#000000'}
      strokeWidth={layer.strokeWidth ?? 10}
      dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
      lineCap={layer.lineCap || 'round'}
      lineJoin={layer.lineJoin || 'round'}
      listening={true}
      hitStrokeWidth={Math.max(layer.strokeWidth || 0, 10)}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={opacity}
      draggable={isDraggable}
      shadowColor={layer.shadowColor}
      shadowBlur={layer.shadowBlur || 0}
      shadowOffsetX={layer.shadowOffsetX || 0}
      shadowOffsetY={layer.shadowOffsetY || 0}
      shadowOpacity={layer.shadowOpacity || 1}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x() - (layer.width || 0) / 2, y: e.target.y() - (layer.height || 0) / 2 });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Star;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const newOuterRadius = outerRadius * Math.max(scaleX, scaleY);
        const newInnerRadius = innerRadius * Math.max(scaleX, scaleY);

        node.scaleX(1);
        node.scaleY(1);

        onTransformEnd({
          x: node.x() - newOuterRadius,
          y: node.y() - newOuterRadius,
          rotation: node.rotation(),
          width: newOuterRadius * 2,
          height: newOuterRadius * 2,
          innerRadius: newInnerRadius,
          outerRadius: newOuterRadius,
          scaleX: 1,
          scaleY: 1,
        });
      }}
    />
  );
};

/**
 * 渲染圆角矩形
 */
export const renderRoundedRect = ({
  layer,
  isDraggable,
  activeTool,
  isGroupChild,
  opacity,
  onSelect,
  onUpdate,
  onTransformEnd,
}: ShapeRendererProps) => {
  return (
    <Rect
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x}
      y={layer.y}
      width={layer.width || 100}
      height={layer.height || 100}
      cornerRadius={layer.cornerRadius || 0}
      fill={layer.fill || '#06B6D4'}
      stroke={layer.stroke ?? '#000000'}
      strokeWidth={layer.strokeWidth ?? 10}
      dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
      lineCap={layer.lineCap || 'round'}
      lineJoin={layer.lineJoin || 'round'}
      listening={true}
      hitStrokeWidth={Math.max(layer.strokeWidth || 0, 10)}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={opacity}
      draggable={isDraggable}
      shadowColor={layer.shadowColor}
      shadowBlur={layer.shadowBlur || 0}
      shadowOffsetX={layer.shadowOffsetX || 0}
      shadowOffsetY={layer.shadowOffsetY || 0}
      shadowOpacity={layer.shadowOpacity || 1}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Rect;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        onTransformEnd({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: (layer.width || 100) * scaleX,
          height: (layer.height || 100) * scaleY,
          scaleX: 1,
          scaleY: 1,
        });
      }}
    />
  );
};

/**
 * 渲染椭圆
 */
export const renderEllipse = ({
  layer,
  isDraggable,
  activeTool,
  isGroupChild,
  opacity,
  onSelect,
  onUpdate,
  onTransformEnd,
}: ShapeRendererProps) => {
  return (
    <Ellipse
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x + (layer.width || 0) / 2}
      y={layer.y + (layer.height || 0) / 2}
      radiusX={layer.radiusX || (layer.width || 100) / 2}
      radiusY={layer.radiusY || (layer.height || 100) / 2}
      fill={layer.fill || '#06B6D4'}
      stroke={layer.stroke ?? '#000000'}
      strokeWidth={layer.strokeWidth ?? 10}
      dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
      lineCap={layer.lineCap || 'round'}
      lineJoin={layer.lineJoin || 'round'}
      listening={true}
      hitStrokeWidth={Math.max(layer.strokeWidth ?? 10, 10)}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={opacity}
      draggable={isDraggable}
      shadowColor={layer.shadowColor}
      shadowBlur={layer.shadowBlur || 0}
      shadowOffsetX={layer.shadowOffsetX || 0}
      shadowOffsetY={layer.shadowOffsetY || 0}
      shadowOpacity={layer.shadowOpacity || 1}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x() - (layer.width || 0) / 2, y: e.target.y() - (layer.height || 0) / 2 });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Ellipse;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        onTransformEnd({
          x: node.x() - (layer.radiusX || 50) * scaleX,
          y: node.y() - (layer.radiusY || 50) * scaleY,
          rotation: node.rotation(),
          width: (layer.radiusX || 50) * scaleX * 2,
          height: (layer.radiusY || 50) * scaleY * 2,
          radiusX: (layer.radiusX || 50) * scaleX,
          radiusY: (layer.radiusY || 50) * scaleY,
          scaleX: 1,
          scaleY: 1,
        });
      }}
    />
  );
};

/**
 * 渲染箭头
 */
export const renderArrow = ({
  layer,
  isDraggable,
  activeTool,
  isGroupChild,
  opacity,
  onSelect,
  onUpdate,
  onTransformEnd,
}: ShapeRendererProps) => {
  return (
    <Arrow
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x}
      y={layer.y}
      points={[0, 0, layer.width || 100, 0]}
      pointerLength={layer.pointerLength || 20}
      pointerWidth={layer.pointerWidth || 20}
      fill={layer.fill || '#06B6D4'}
      stroke={layer.stroke ?? '#000000'}
      strokeWidth={layer.strokeWidth ?? 10}
      dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
      lineCap={layer.lineCap || 'round'}
      lineJoin={layer.lineJoin || 'round'}
      listening={true}
      hitStrokeWidth={Math.max(layer.strokeWidth ?? 10, 10)}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={opacity}
      draggable={isDraggable}
      shadowColor={layer.shadowColor}
      shadowBlur={layer.shadowBlur || 0}
      shadowOffsetX={layer.shadowOffsetX || 0}
      shadowOffsetY={layer.shadowOffsetY || 0}
      shadowOpacity={layer.shadowOpacity || 1}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Arrow;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        const newWidth = (layer.width || 100) * scaleX;
        const newHeight = (layer.height || 20) * scaleY;

        onTransformEnd({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: newWidth,
          height: newHeight,
          pointerLength: (layer.pointerLength || 20) * scaleX,
          pointerWidth: (layer.pointerWidth || 20) * scaleY,
          scaleX: 1,
          scaleY: 1,
        });
      }}
    />
  );
};

/**
 * 渲染扇形
 */
export const renderWedge = ({
  layer,
  isDraggable,
  activeTool,
  isGroupChild,
  opacity,
  onSelect,
  onUpdate,
  onTransformEnd,
}: ShapeRendererProps) => {
  return (
    <Wedge
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x + (layer.width || 0) / 2}
      y={layer.y + (layer.height || 0) / 2}
      radius={layer.radiusX || Math.min(layer.width || 100, layer.height || 100) / 2}
      angle={layer.angle || 60}
      fill={layer.fill || '#06B6D4'}
      stroke={layer.stroke ?? '#000000'}
      strokeWidth={layer.strokeWidth ?? 10}
      dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
      lineCap={layer.lineCap || 'round'}
      lineJoin={layer.lineJoin || 'round'}
      listening={true}
      hitStrokeWidth={Math.max(layer.strokeWidth ?? 10, 10)}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={opacity}
      draggable={isDraggable}
      shadowColor={layer.shadowColor}
      shadowBlur={layer.shadowBlur || 0}
      shadowOffsetX={layer.shadowOffsetX || 0}
      shadowOffsetY={layer.shadowOffsetY || 0}
      shadowOpacity={layer.shadowOpacity || 1}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x() - (layer.width || 0) / 2, y: e.target.y() - (layer.height || 0) / 2 });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Wedge;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const newRadius = (layer.radiusX || 50) * Math.max(scaleX, scaleY);

        node.scaleX(1);
        node.scaleY(1);

        onTransformEnd({
          x: node.x() - newRadius,
          y: node.y() - newRadius,
          rotation: node.rotation(),
          width: newRadius * 2,
          height: newRadius * 2,
          radiusX: newRadius,
          radiusY: newRadius,
          scaleX: 1,
          scaleY: 1,
        });
      }}
    />
  );
};

/**
 * 渲染环形
 */
export const renderRing = ({
  layer,
  isDraggable,
  activeTool,
  isGroupChild,
  opacity,
  onSelect,
  onUpdate,
  onTransformEnd,
}: ShapeRendererProps) => {
  return (
    <Ring
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x + (layer.width || 0) / 2}
      y={layer.y + (layer.height || 0) / 2}
      innerRadius={layer.innerRadius || 30}
      outerRadius={layer.outerRadius || 50}
      fill={layer.fill || '#06B6D4'}
      stroke={layer.stroke ?? '#000000'}
      strokeWidth={layer.strokeWidth ?? 10}
      dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
      lineCap={layer.lineCap || 'round'}
      lineJoin={layer.lineJoin || 'round'}
      listening={true}
      hitStrokeWidth={Math.max(layer.strokeWidth ?? 10, 10)}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={opacity}
      draggable={isDraggable}
      shadowColor={layer.shadowColor}
      shadowBlur={layer.shadowBlur || 0}
      shadowOffsetX={layer.shadowOffsetX || 0}
      shadowOffsetY={layer.shadowOffsetY || 0}
      shadowOpacity={layer.shadowOpacity || 1}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x() - (layer.width || 0) / 2, y: e.target.y() - (layer.height || 0) / 2 });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Ring;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const newOuterRadius = (layer.outerRadius || 50) * Math.max(scaleX, scaleY);
        const newInnerRadius = (layer.innerRadius || 30) * Math.max(scaleX, scaleY);

        node.scaleX(1);
        node.scaleY(1);

        onTransformEnd({
          x: node.x() - newOuterRadius,
          y: node.y() - newOuterRadius,
          rotation: node.rotation(),
          width: newOuterRadius * 2,
          height: newOuterRadius * 2,
          innerRadius: newInnerRadius,
          outerRadius: newOuterRadius,
          scaleX: 1,
          scaleY: 1,
        });
      }}
    />
  );
};

/**
 * 渲染弧形
 */
export const renderArc = ({
  layer,
  isDraggable,
  activeTool,
  isGroupChild,
  opacity,
  onSelect,
  onUpdate,
  onTransformEnd,
}: ShapeRendererProps) => {
  return (
    <Arc
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x + (layer.width || 0) / 2}
      y={layer.y + (layer.height || 0) / 2}
      innerRadius={0}
      outerRadius={layer.radiusX || Math.min(layer.width || 100, layer.height || 100) / 2}
      angle={layer.angle || 60}
      clockwise={layer.clockwise || false}
      fill={layer.fill || '#06B6D4'}
      stroke={layer.stroke ?? '#000000'}
      strokeWidth={layer.strokeWidth ?? 10}
      dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
      lineCap={layer.lineCap || 'round'}
      lineJoin={layer.lineJoin || 'round'}
      listening={true}
      hitStrokeWidth={Math.max(layer.strokeWidth ?? 10, 10)}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={opacity}
      draggable={isDraggable}
      shadowColor={layer.shadowColor}
      shadowBlur={layer.shadowBlur || 0}
      shadowOffsetX={layer.shadowOffsetX || 0}
      shadowOffsetY={layer.shadowOffsetY || 0}
      shadowOpacity={layer.shadowOpacity || 1}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        if (isGroupChild) return;
        e.cancelBubble = true;
        e.evt.stopPropagation();
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x() - (layer.width || 0) / 2, y: e.target.y() - (layer.height || 0) / 2 });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Arc;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const newRadius = (layer.radiusX || 50) * Math.max(scaleX, scaleY);

        node.scaleX(1);
        node.scaleY(1);

        onTransformEnd({
          x: node.x() - newRadius,
          y: node.y() - newRadius,
          rotation: node.rotation(),
          width: newRadius * 2,
          height: newRadius * 2,
          radiusX: newRadius,
          radiusY: newRadius,
          scaleX: 1,
          scaleY: 1,
        });
      }}
    />
  );
};

