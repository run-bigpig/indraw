import React, { useRef, useLayoutEffect, useMemo } from 'react';
import { Group, Image as KonvaImage, Line, Text } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import type { Filter } from 'konva/lib/Node';
import { LayerData, ToolType } from '../types';
import { renderPolygon, renderStar, renderRoundedRect, renderEllipse, renderArrow, renderWedge, renderRing, renderArc } from '../utils/shapeRenderer';
import { DEFAULT_FONT } from '../constants/fonts';

/**
 * Scale eraser mask points and strokeWidth based on parent layer's current vs original dimensions.
 * This ensures eraser strokes remain correctly positioned when the parent layer is resized.
 */
const getScaledEraseLineProps = (
  mask: LayerData,
  currentParentWidth: number,
  currentParentHeight: number
): { points: number[]; strokeWidth: number } => {
  const originalWidth = mask.originalParentWidth;
  const originalHeight = mask.originalParentHeight;
  const points = mask.points || [];
  const strokeWidth = mask.strokeWidth || 10;

  // If no original dimensions stored, use points as-is (backward compatibility)
  if (!originalWidth || !originalHeight || originalWidth === 0 || originalHeight === 0) {
    return { points, strokeWidth };
  }

  // Calculate scale ratios
  const scaleX = currentParentWidth / originalWidth;
  const scaleY = currentParentHeight / originalHeight;

  // If no scaling needed, return original values
  if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) {
    return { points, strokeWidth };
  }

  // Scale points
  const scaledPoints: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    scaledPoints.push(points[i] * scaleX);
    scaledPoints.push(points[i + 1] * scaleY);
  }

  // Scale strokeWidth by the average of scaleX and scaleY to maintain visual consistency
  const avgScale = (scaleX + scaleY) / 2;
  const scaledStrokeWidth = strokeWidth * avgScale;

  return { points: scaledPoints, strokeWidth: scaledStrokeWidth };
};

interface URLImageProps {
  layer: LayerData;
  isDraggable: boolean;
  activeTool: ToolType;
  onSelect: (multi: boolean) => void;
  onChange: (newAttrs: Partial<LayerData>) => void;
  // 擦除蒙版子线段（只对当前图层生效）
  eraseLines?: LayerData[];
  // 是否是组的子元素（用于事件冒泡控制）
  isGroupChild?: boolean;
}

const URLImage: React.FC<URLImageProps> = ({ layer, isDraggable, activeTool, onSelect, onChange, eraseLines, isGroupChild = false }) => {
  const [image] = useImage(layer.src || '', 'anonymous');
  const shapeRef = useRef<Konva.Image>(null);
  const groupRef = useRef<Konva.Group>(null);
  const width = layer.width || image?.width || 0;
  const height = layer.height || image?.height || 0;
  const offsetX = width ? width / 2 : 0;
  const offsetY = height ? height / 2 : 0;
  const centerX = layer.x + offsetX;
  const centerY = layer.y + offsetY;

  // 使用 useMemo 缓存滤镜数组，避免每次渲染都重新创建
  // 这样可以确保依赖数组中的 filters 引用稳定
  const filters = useMemo(() => {
    const result: Filter[] = [];
    if (layer.brightness !== 0) result.push(Konva.Filters.Brighten);
    if (layer.contrast !== 0) result.push(Konva.Filters.Contrast);
    if (layer.blurRadius && layer.blurRadius > 0) result.push(Konva.Filters.Blur);
    if (layer.noise && layer.noise > 0) result.push(Konva.Filters.Noise);
    if (layer.pixelSize && layer.pixelSize > 1) result.push(Konva.Filters.Pixelate);
    if (layer.isGrayscale) result.push(Konva.Filters.Grayscale);
    return result;
  }, [
    layer.brightness,
    layer.contrast,
    layer.blurRadius,
    layer.noise,
    layer.pixelSize,
    layer.isGrayscale
  ]);

  const hasEraseLines = eraseLines && eraseLines.length > 0;

  // 使用 useLayoutEffect 确保在 DOM 更新后立即执行，避免闪烁
  // 优化：移除 filters.length 依赖，因为 filters 已经是 memoized 的
  useLayoutEffect(() => {
    const imgNode = shapeRef.current;
    const group = groupRef.current;

    if (!imgNode || !image) {
      return;
    }

    // 步骤1: 清除所有缓存
    imgNode.clearCache();
    if (group) {
      group.clearCache();
    }

    // 步骤2: 显式设置滤镜到 Konva 节点
    imgNode.filters(filters);
    imgNode.brightness(layer.brightness || 0);
    imgNode.contrast(layer.contrast || 0);
    imgNode.blurRadius(layer.blurRadius || 0);
    imgNode.noise(layer.noise || 0);
    imgNode.pixelSize(layer.pixelSize || 1);

    // 步骤3: 缓存 imgNode 以应用滤镜
    imgNode.cache();

    // 步骤4: 如果有擦除线，需要缓存 Group
    if (hasEraseLines && group) {
      group.cache();
    }

    // 步骤5: 触发重绘
    imgNode.getLayer()?.batchDraw();
  }, [
    image,
    layer.id,
    filters, // 使用 memoized 的 filters 引用
    layer.brightness,
    layer.contrast,
    layer.blurRadius,
    layer.noise,
    layer.pixelSize,
    layer.width,
    layer.height,
    hasEraseLines,
    eraseLines?.length,
  ]);

  return (
    <Group
      ref={groupRef}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={centerX}
      y={centerY}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={layer.opacity}
      offsetX={offsetX}
      offsetY={offsetY}
      draggable={isDraggable}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        // 如果是组的子元素，不阻止冒泡，让父组处理选中
        if (isGroupChild) return;
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        // 如果是组的子元素，不阻止冒泡，让父组处理拖拽
        if (isGroupChild) return;
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        // 如果是组的子元素，不阻止冒泡，让父组处理
        if (isGroupChild) return;
        e.cancelBubble = true;
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onChange({
          x: e.target.x() - offsetX,
          y: e.target.y() - offsetY,
        });
      }}
      onTransformEnd={() => {
        const group = groupRef.current;
        const imgNode = shapeRef.current;
        if (!group || !imgNode) return;
        const scaleX = group.scaleX();
        const scaleY = group.scaleY();
        group.scale({ x: 1, y: 1 });

        const newWidth = Math.max(5, (layer.width || imgNode.width()) * scaleX);
        const newHeight = Math.max(5, (layer.height || imgNode.height()) * scaleY);
        const newOffsetX = newWidth / 2;
        const newOffsetY = newHeight / 2;

        onChange({
          x: group.x() - newOffsetX,
          y: group.y() - newOffsetY,
          rotation: group.rotation(),
          width: newWidth,
          height: newHeight,
          scaleX: 1,
          scaleY: 1,
        });
      }}
      globalCompositeOperation={(layer.blendMode as any) || 'source-over'}
    >
      <KonvaImage
        image={image}
        ref={shapeRef}
        width={width}
        height={height}
        filters={filters}
        brightness={layer.brightness || 0}
        contrast={layer.contrast || 0}
        blurRadius={layer.blurRadius || 0}
        noise={layer.noise || 0}
        pixelSize={layer.pixelSize || 1}
        listening={true}
      />
      {/* 图层级橡皮擦蒙版：只影响当前图片图层 */}
      {eraseLines && eraseLines.length > 0 && (
        <Group globalCompositeOperation="destination-out" listening={false}>
          {eraseLines.map((mask) => {
            // Scale eraser points based on current vs original parent dimensions
            const { points: scaledPoints, strokeWidth: scaledStrokeWidth } =
              getScaledEraseLineProps(mask, width, height);
            return (
              <Line
                key={mask.id}
                points={scaledPoints}
                stroke={mask.stroke || '#000000'}
                strokeWidth={scaledStrokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                opacity={1}
                listening={false}
              />
            );
          })}
        </Group>
      )}
    </Group>
  );
};

// LineLayer 组件：处理 line 类型图层的渲染和擦除蒙版缓存
interface LineLayerProps {
  layer: LayerData;
  isDraggable: boolean;
  activeTool: ToolType;
  onSelect: (multi: boolean) => void;
  onChange: (newAttrs: Partial<LayerData>) => void;
  eraseLines: LayerData[];
  // 是否是组的子元素（用于事件冒泡控制）
  isGroupChild?: boolean;
}

const LineLayer: React.FC<LineLayerProps> = ({ layer, isDraggable, activeTool, onSelect, onChange, eraseLines, isGroupChild = false }) => {
  const groupRef = useRef<Konva.Group>(null);
  const hasEraseLines = eraseLines.length > 0;

  // 当有擦除蒙版时，需要缓存 Group 以使 destination-out 混合模式正确工作
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    if (hasEraseLines) {
      group.cache();
    } else {
      group.clearCache();
    }

    group.getLayer()?.batchDraw();
  }, [hasEraseLines, eraseLines.length, layer.points, layer.strokeWidth, layer.stroke]);

  const lineNode = (
    <Line
      points={layer.points || []}
      stroke={layer.stroke || '#ffffff'}
      strokeWidth={layer.strokeWidth || 5}
      hitStrokeWidth={Math.max(layer.strokeWidth || 5, 12)}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      opacity={layer.opacity}
      globalCompositeOperation="source-over"
      listening={true}
    />
  );

  return (
    <Group
      ref={groupRef}
      key={layer.id}
      id={layer.id}
      name={`layer-${layer.id}`}
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      draggable={isDraggable}
      globalCompositeOperation={(layer.blendMode as any) || 'source-over'}
      onClick={(e) => {
        if (activeTool !== 'select') return;
        // 如果是组的子元素，不阻止冒泡，让父组处理选中
        if (isGroupChild) return;
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onMouseDown={(e) => {
        if (activeTool !== 'select') return;
        // 如果是组的子元素，不阻止冒泡，让父组处理拖拽
        if (isGroupChild) return;
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        if (activeTool !== 'select') return;
        // 如果是组的子元素，不阻止冒泡，让父组处理
        if (isGroupChild) return;
        e.cancelBubble = true;
        onSelect(false);
      }}
      onDragStart={() => onSelect(false)}
      onDragEnd={(e) => {
        onChange({ x: e.target.x(), y: e.target.y() });
      }}
    >
      {lineNode}
      {hasEraseLines && (
        <Group globalCompositeOperation="destination-out" listening={false}>
          {eraseLines.map((mask) => (
            <Line
              key={mask.id}
              points={mask.points || []}
              stroke={mask.stroke || '#000000'}
              strokeWidth={mask.strokeWidth || 10}
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

interface LayerRendererProps {
  layers: LayerData[];
  selectedIds: string[];
  activeTool: ToolType;
  editingTextId?: string;
  onSelectLayer: (id: string | null, multi: boolean) => void;
  onUpdateLayer: (id: string, attrs: Partial<LayerData>) => void;
  onLayerDoubleClick: (e: Konva.KonvaEventObject<MouseEvent>, layer: LayerData) => void;
}

const LayerRenderer: React.FC<LayerRendererProps> = ({
  layers,
  selectedIds,
  activeTool,
  editingTextId,
  onSelectLayer,
  onUpdateLayer,
  onLayerDoubleClick,
}) => {
  const renderLayerRecursive = (layer: LayerData): React.ReactNode => {
    if (!layer.visible) return null;

    const opacity = editingTextId === layer.id ? 0 : layer.opacity;
    const isChild = !!layer.parentId;
    // 检查父图层是否是组类型，用于控制事件冒泡
    const parentLayer = layer.parentId ? layers.find(l => l.id === layer.parentId) : null;
    const isGroupChild = parentLayer?.type === 'group';
    const isSelected = selectedIds.includes(layer.id);
    const isDraggable = activeTool === 'select' && (!isChild || isSelected);

    if (layer.type === 'group') {
      const children = layers.filter((l) => l.parentId === layer.id);
      return (
        <Group
          key={layer.id}
          id={layer.id}
          name={`layer-${layer.id}`}
          x={layer.x}
          y={layer.y}
          rotation={layer.rotation}
          scaleX={layer.scaleX}
          scaleY={layer.scaleY}
          opacity={layer.opacity}
          draggable={isDraggable}
          onClick={(e) => {
            if (activeTool !== 'select') return;
            e.cancelBubble = true;
            onSelectLayer(layer.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
          }}
          onMouseDown={(e) => {
            if (activeTool !== 'select') return;
            e.cancelBubble = true;
            onSelectLayer(layer.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
          }}
          onTap={(e) => {
            if (activeTool !== 'select') return;
            e.cancelBubble = true;
            onSelectLayer(layer.id, false);
          }}
          onDragStart={() => onSelectLayer(layer.id, false)}
          onDragEnd={(e) => {
            onUpdateLayer(layer.id, { x: e.target.x(), y: e.target.y() });
          }}
        >
          {children.map((child) => renderLayerRecursive(child))}
        </Group>
      );
    }

    if (layer.type === 'image') {
      const eraseLines = layers.filter(
        (l) =>
          l.parentId === layer.id &&
          l.type === 'line' &&
          l.blendMode === 'destination-out'
      );

      if (eraseLines.length > 0) {
        console.log('[render] image eraseLines', {
          layerId: layer.id,
          eraseLines: eraseLines.length,
        });
      }

      return (
        <URLImage
          key={layer.id}
          layer={{ ...layer, opacity }}
          isDraggable={isDraggable}
          activeTool={activeTool}
          onSelect={(multi) => onSelectLayer(layer.id, multi)}
          onChange={(newAttrs) => onUpdateLayer(layer.id, newAttrs)}
          eraseLines={eraseLines}
          isGroupChild={isGroupChild}
        />
      );
    }

    // 文字图层渲染
    if (layer.type === 'text') {
      // 判断是否启用阴影（任意阴影属性有值时启用）
      const hasShadow = !!(layer.shadowColor || layer.shadowBlur || layer.shadowOffsetX || layer.shadowOffsetY);
      
      return (
        <Text
          key={layer.id}
          id={layer.id}
          name={`layer-${layer.id}`}
          x={layer.x}
          y={layer.y}
          text={layer.text || 'Double click to edit'}
          fontSize={layer.fontSize || 32}
          fontFamily={layer.fontFamily || DEFAULT_FONT}
          fill={layer.fill || '#ffffff'}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth || 0}
          dash={layer.dash && layer.strokeWidth && layer.strokeWidth > 0 ? layer.dash : undefined}
          rotation={layer.rotation}
          scaleX={layer.scaleX}
          scaleY={layer.scaleY}
          opacity={opacity}
          shadowEnabled={hasShadow}
          shadowColor={layer.shadowColor || '#000000'}
          shadowBlur={layer.shadowBlur || 0}
          shadowOffsetX={layer.shadowOffsetX || 0}
          shadowOffsetY={layer.shadowOffsetY || 0}
          shadowOpacity={layer.shadowOpacity ?? 1}
          draggable={isDraggable}
          onClick={(e) => {
            if (activeTool !== 'select') return;
            // 如果是组的子元素，不阻止冒泡，让父组处理选中
            if (isGroupChild) return;
            e.cancelBubble = true;
            onSelectLayer(layer.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
          }}
          onMouseDown={(e) => {
            if (activeTool !== 'select') return;
            // 如果是组的子元素，不阻止冒泡，让父组处理拖拽
            if (isGroupChild) return;
            e.cancelBubble = true;
            onSelectLayer(layer.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
          }}
          onTap={(e) => {
            if (activeTool !== 'select') return;
            // 如果是组的子元素，不阻止冒泡，让父组处理
            if (isGroupChild) return;
            e.cancelBubble = true;
            onSelectLayer(layer.id, false);
          }}
          onDblClick={(e) => onLayerDoubleClick(e, layer)}
          onDblTap={(e) => onLayerDoubleClick(e as any, layer)}
          onDragStart={() => onSelectLayer(layer.id, false)}
          onDragEnd={(e) => {
            onUpdateLayer(layer.id, { x: e.target.x(), y: e.target.y() });
          }}
          onTransformEnd={(e) => {
            const node = e.target as Konva.Text;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            // 重置 scale，更新 fontSize
            node.scaleX(1);
            node.scaleY(1);

            onUpdateLayer(layer.id, {
              x: node.x(),
              y: node.y(),
              rotation: node.rotation(),
              fontSize: Math.max(8, (layer.fontSize || 32) * Math.max(scaleX, scaleY)),
              scaleX: 1,
              scaleY: 1,
            });
          }}
        />
      );
    }

    if (layer.type === 'line' && layer.points) {
      // 子线段 + destination-out 作为当前线段图层的蒙版
      const eraseLines = layers.filter(
        (l) =>
          l.parentId === layer.id &&
          l.type === 'line' &&
          l.blendMode === 'destination-out'
      );

      // 使用 LineLayer 组件处理渲染和缓存
      return (
        <LineLayer
          key={layer.id}
          layer={{ ...layer, opacity }}
          isDraggable={isDraggable}
          activeTool={activeTool}
          onSelect={(multi) => onSelectLayer(layer.id, multi)}
          onChange={(newAttrs) => onUpdateLayer(layer.id, newAttrs)}
          eraseLines={eraseLines}
          isGroupChild={isGroupChild}
        />
      );
    }

    // 多边形渲染
    if (layer.type === 'polygon') {
      return renderPolygon({
        layer: { ...layer, opacity },
        isDraggable,
        activeTool,
        isGroupChild,
        opacity,
        onSelect: (multi) => onSelectLayer(layer.id, multi),
        onUpdate: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
        onTransformEnd: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
      });
    }

    // 星形渲染
    if (layer.type === 'star') {
      return renderStar({
        layer: { ...layer, opacity },
        isDraggable,
        activeTool,
        isGroupChild,
        opacity,
        onSelect: (multi) => onSelectLayer(layer.id, multi),
        onUpdate: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
        onTransformEnd: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
      });
    }

    // 圆角矩形渲染
    if (layer.type === 'rounded-rect') {
      return renderRoundedRect({
        layer: { ...layer, opacity },
        isDraggable,
        activeTool,
        isGroupChild,
        opacity,
        onSelect: (multi) => onSelectLayer(layer.id, multi),
        onUpdate: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
        onTransformEnd: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
      });
    }

    // 椭圆渲染
    if (layer.type === 'ellipse') {
      return renderEllipse({
        layer: { ...layer, opacity },
        isDraggable,
        activeTool,
        isGroupChild,
        opacity,
        onSelect: (multi) => onSelectLayer(layer.id, multi),
        onUpdate: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
        onTransformEnd: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
      });
    }

    // 箭头渲染
    if (layer.type === 'arrow') {
      return renderArrow({
        layer: { ...layer, opacity },
        isDraggable,
        activeTool,
        isGroupChild,
        opacity,
        onSelect: (multi) => onSelectLayer(layer.id, multi),
        onUpdate: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
        onTransformEnd: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
      });
    }

    // 扇形渲染
    if (layer.type === 'wedge') {
      return renderWedge({
        layer: { ...layer, opacity },
        isDraggable,
        activeTool,
        isGroupChild,
        opacity,
        onSelect: (multi) => onSelectLayer(layer.id, multi),
        onUpdate: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
        onTransformEnd: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
      });
    }

    // 环形渲染
    if (layer.type === 'ring') {
      return renderRing({
        layer: { ...layer, opacity },
        isDraggable,
        activeTool,
        isGroupChild,
        opacity,
        onSelect: (multi) => onSelectLayer(layer.id, multi),
        onUpdate: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
        onTransformEnd: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
      });
    }

    // 弧形渲染
    if (layer.type === 'arc') {
      return renderArc({
        layer: { ...layer, opacity },
        isDraggable,
        activeTool,
        isGroupChild,
        opacity,
        onSelect: (multi) => onSelectLayer(layer.id, multi),
        onUpdate: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
        onTransformEnd: (newAttrs) => onUpdateLayer(layer.id, newAttrs),
      });
    }

    return null;
  };

  // ✅ 性能优化：使用 useMemo 缓存根图层列表
  const rootLayers = useMemo(() => {
    return layers.filter((layer) => !layer.parentId);
  }, [layers]);

  return <>{rootLayers.map((layer) => renderLayerRecursive(layer))}</>;
};

// ✅ 性能优化：使用 React.memo 包装组件，添加自定义比较函数
export default React.memo(LayerRenderer, (prevProps, nextProps) => {
  // 只在必要时重新渲染
  return (
    prevProps.layers === nextProps.layers &&
    prevProps.selectedIds === nextProps.selectedIds &&
    prevProps.activeTool === nextProps.activeTool &&
    prevProps.editingTextId === nextProps.editingTextId
  );
});
