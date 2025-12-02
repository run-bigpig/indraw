/**
 * ShapesToolbar - 形状工具模块
 * 独立模块，提供多边形、星形、圆角矩形等形状工具
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ToolType } from '../types';
import { Triangle, Star, Square } from 'lucide-react';
import clsx from 'clsx';

interface ShapesToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  isProjectCreated?: boolean;
}

const ShapesToolbar: React.FC<ShapesToolbarProps> = ({ 
  activeTool, 
  setActiveTool, 
  isProjectCreated = true 
}) => {
  const { t } = useTranslation(['toolbar', 'shapes']);

  const handleToolChange = (tool: ToolType) => {
    if (!isProjectCreated) return;
    setActiveTool(tool);
  };

  const shapeTools: Array<{
    tool: ToolType;
    icon: React.ReactNode;
    labelKey: string;
    tooltipKey: string;
  }> = [
    {
      tool: 'polygon',
      icon: <Triangle size={20} />,
      labelKey: 'polygon',
      tooltipKey: 'polygonTooltip',
    },
    {
      tool: 'star',
      icon: <Star size={20} />,
      labelKey: 'star',
      tooltipKey: 'starTooltip',
    },
    {
      tool: 'rounded-rect',
      icon: <Square size={20} />,
      labelKey: 'roundedRect',
      tooltipKey: 'roundedRectTooltip',
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {shapeTools.map(({ tool, icon, labelKey, tooltipKey }) => {
        const isActive = activeTool === tool;
        return (
          <button
            key={tool}
            onClick={() => handleToolChange(tool)}
            disabled={!isProjectCreated}
            className={clsx(
              "p-3 rounded-xl border border-transparent transition-all duration-200 group relative focus:outline-none",
              !isProjectCreated
                ? "text-gray-700 opacity-40 cursor-not-allowed"
                : isActive
                  ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-500/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-tech-800"
            )}
            title={!isProjectCreated ? t('toolbar:disabledTooltip') : t(`toolbar:${tooltipKey}`)}
          >
            {icon}
            <span className="absolute left-full ml-4 px-2 py-1 bg-tech-800 text-xs text-cyan-100 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-tech-700 whitespace-nowrap z-50">
              {!isProjectCreated ? t('toolbar:disabledTooltip') : t(`toolbar:${labelKey}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ShapesToolbar;

