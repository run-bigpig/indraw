/**
 * shapeDrawing - 形状绘制工具模块
 * 提供形状创建的辅助函数
 */

import { v4 as uuidv4 } from 'uuid';
import { LayerData } from '../types';
import { DEFAULT_LAYER_PROPS } from '../constants';

/**
 * 创建多边形图层
 */
export const createPolygonLayer = (
  x: number,
  y: number,
  width: number,
  height: number,
  numPoints: number = 6
): LayerData => {
  return {
    id: uuidv4(),
    type: 'polygon',
    name: `Polygon ${numPoints}`,
    x,
    y,
    width,
    height,
    numPoints,
    ...DEFAULT_LAYER_PROPS,
    fill: '#06B6D4',
    stroke: '#000000',
    strokeWidth: 10,
  };
};

/**
 * 创建星形图层
 */
export const createStarLayer = (
  x: number,
  y: number,
  width: number,
  height: number,
  numPoints: number = 5
): LayerData => {
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = outerRadius * 0.5;
  
  return {
    id: uuidv4(),
    type: 'star',
    name: `Star ${numPoints}`,
    x,
    y,
    width,
    height,
    numPoints,
    innerRadius,
    outerRadius,
    ...DEFAULT_LAYER_PROPS,
    fill: '#06B6D4',
    stroke: '#000000',
    strokeWidth: 10,
  };
};

/**
 * 创建圆角矩形图层
 */
export const createRoundedRectLayer = (
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number = 10
): LayerData => {
  return {
    id: uuidv4(),
    type: 'rounded-rect',
    name: 'Rounded Rectangle',
    x,
    y,
    width,
    height,
    cornerRadius,
    ...DEFAULT_LAYER_PROPS,
    fill: '#06B6D4',
    stroke: '#000000',
    strokeWidth: 10,
  };
};

/**
 * 创建椭圆图层
 */
export const createEllipseLayer = (
  x: number,
  y: number,
  width: number,
  height: number
): LayerData => {
  return {
    id: uuidv4(),
    type: 'ellipse',
    name: 'Ellipse',
    x,
    y,
    width,
    height,
    radiusX: width / 2,
    radiusY: height / 2,
    ...DEFAULT_LAYER_PROPS,
    fill: '#06B6D4',
    stroke: '#000000',
    strokeWidth: 10,
  };
};

/**
 * 创建箭头图层
 */
export const createArrowLayer = (
  x: number,
  y: number,
  width: number,
  height: number
): LayerData => {
  return {
    id: uuidv4(),
    type: 'arrow',
    name: 'Arrow',
    x,
    y,
    width,
    height,
    pointerLength: Math.min(width, height) * 0.3,
    pointerWidth: Math.min(width, height) * 0.3,
    ...DEFAULT_LAYER_PROPS,
    fill: '#06B6D4',
    stroke: '#000000',
    strokeWidth: 10,
  };
};

/**
 * 创建扇形图层
 */
export const createWedgeLayer = (
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number = 60
): LayerData => {
  const radius = Math.min(width, height) / 2;
  return {
    id: uuidv4(),
    type: 'wedge',
    name: 'Wedge',
    x,
    y,
    width,
    height,
    radiusX: radius,
    radiusY: radius,
    angle,
    ...DEFAULT_LAYER_PROPS,
    fill: '#06B6D4',
    stroke: '#000000',
    strokeWidth: 10,
  };
};

/**
 * 创建环形图层
 */
export const createRingLayer = (
  x: number,
  y: number,
  width: number,
  height: number
): LayerData => {
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = outerRadius * 0.6;
  return {
    id: uuidv4(),
    type: 'ring',
    name: 'Ring',
    x,
    y,
    width,
    height,
    innerRadius,
    outerRadius,
    ...DEFAULT_LAYER_PROPS,
    fill: '#06B6D4',
    stroke: '#000000',
    strokeWidth: 10,
  };
};

/**
 * 创建弧形图层
 */
export const createArcLayer = (
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number = 60
): LayerData => {
  const radius = Math.min(width, height) / 2;
  return {
    id: uuidv4(),
    type: 'arc',
    name: 'Arc',
    x,
    y,
    width,
    height,
    radiusX: radius,
    radiusY: radius,
    angle,
    clockwise: false,
    ...DEFAULT_LAYER_PROPS,
    fill: '#06B6D4',
    stroke: '#000000',
    strokeWidth: 10,
  };
};

