import React from 'react';
import { useTranslation } from 'react-i18next';
import { ToolType } from '../types';
import { MousePointer2, Type, Wand2, Brush, Upload, Eraser, Shapes } from 'lucide-react';
import clsx from 'clsx';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onUploadClick: () => void;
  isProjectCreated?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ activeTool, setActiveTool, onUploadClick, isProjectCreated = true }) => {
  const { t } = useTranslation(['toolbar', 'shapes']);

  // Handle tool change; disable when project does not exist
  const handleToolChange = (tool: ToolType) => {
    if (!isProjectCreated) return;
    setActiveTool(tool);
  };

  // Handle upload click; disable when project does not exist
  const handleUploadClick = () => {
    if (!isProjectCreated) return;
    onUploadClick();
  };

  return (
    <div className="w-16 bg-tech-900 border-r border-tech-700 flex flex-col items-center py-4 gap-4 z-20 shadow-xl">
      <div className="text-cyan-400 font-bold text-xs tracking-widest mb-2 rotate-[-90deg] whitespace-nowrap mt-4">{t('title')}</div>

      {/* Upload */}
      <button
        onClick={handleUploadClick}
        disabled={!isProjectCreated}
        className={clsx(
          "p-3 rounded-xl border border-transparent transition-all duration-200 group relative focus:outline-none",
          !isProjectCreated
            ? "text-gray-700 opacity-40 cursor-not-allowed"
            : "text-gray-500 hover:text-cyan-400 hover:bg-tech-800"
        )}
        title={!isProjectCreated ? t('disabledTooltip') : t('uploadImageTooltip')}
      >
        <Upload size={20} />
        <span className="absolute left-full ml-4 px-2 py-1 bg-tech-800 text-xs text-cyan-100 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-tech-700 whitespace-nowrap z-50">
          {!isProjectCreated ? t('disabledTooltip') : t('uploadImage')}
        </span>
      </button>

      <div className="w-8 h-px bg-tech-700 my-1"></div>

      {/* Select */}
      <button
        onClick={() => handleToolChange('select')}
        disabled={!isProjectCreated}
        className={clsx(
          "p-3 rounded-xl border border-transparent transition-all duration-200 group relative focus:outline-none",
          !isProjectCreated
            ? "text-gray-700 opacity-40 cursor-not-allowed"
            : activeTool === 'select'
              ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-500/30"
              : "text-gray-500 hover:text-gray-300 hover:bg-tech-800"
        )}
        title={!isProjectCreated ? t('disabledTooltip') : t('selectTooltip')}
      >
        <MousePointer2 size={20} />
        <span className="absolute left-full ml-4 px-2 py-1 bg-tech-800 text-xs text-cyan-100 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-tech-700 whitespace-nowrap z-50">
          {!isProjectCreated ? t('disabledTooltip') : t('select')}
        </span>
      </button>

      {/* Brush Tool */}
      <button
        onClick={() => handleToolChange('brush')}
        disabled={!isProjectCreated}
        className={clsx(
          "p-3 rounded-xl border border-transparent transition-all duration-200 group relative focus:outline-none",
          !isProjectCreated
            ? "text-gray-700 opacity-40 cursor-not-allowed"
            : activeTool === 'brush'
              ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-500/30"
              : "text-gray-500 hover:text-gray-300 hover:bg-tech-800"
        )}
        title={!isProjectCreated ? t('disabledTooltip') : t('brushTooltip')}
      >
        <Brush size={20} />
        <span className="absolute left-full ml-4 px-2 py-1 bg-tech-800 text-xs text-cyan-100 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-tech-700 whitespace-nowrap z-50">
          {!isProjectCreated ? t('disabledTooltip') : t('brush')}
        </span>
      </button>

      {/* Eraser Tool */}
      <button
        onClick={() => handleToolChange('eraser')}
        disabled={!isProjectCreated}
        className={clsx(
          "p-3 rounded-xl border border-transparent transition-all duration-200 group relative focus:outline-none",
          !isProjectCreated
            ? "text-gray-700 opacity-40 cursor-not-allowed"
            : activeTool === 'eraser'
              ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-500/30"
              : "text-gray-500 hover:text-gray-300 hover:bg-tech-800"
        )}
        title={!isProjectCreated ? t('disabledTooltip') : t('eraserTooltip' as any)}
      >
        <Eraser size={20} />
        <span className="absolute left-full ml-4 px-2 py-1 bg-tech-800 text-xs text-cyan-100 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-tech-700 whitespace-nowrap z-50">
          {!isProjectCreated ? t('disabledTooltip') : t('eraser' as any)}
        </span>
      </button>

      {/* Text */}
      <button
        onClick={() => handleToolChange('text')}
        disabled={!isProjectCreated}
        className={clsx(
          "p-3 rounded-xl border border-transparent transition-all duration-200 group relative focus:outline-none",
          !isProjectCreated
            ? "text-gray-700 opacity-40 cursor-not-allowed"
            : activeTool === 'text'
              ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-500/30"
              : "text-gray-500 hover:text-gray-300 hover:bg-tech-800"
        )}
        title={!isProjectCreated ? t('disabledTooltip') : t('textToolTooltip')}
      >
        <Type size={20} />
        <span className="absolute left-full ml-4 px-2 py-1 bg-tech-800 text-xs text-cyan-100 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-tech-700 whitespace-nowrap z-50">
          {!isProjectCreated ? t('disabledTooltip') : t('textTool')}
        </span>
      </button>

      <div className="w-8 h-px bg-tech-700 my-1"></div>

      {/* Shape Tool */}
      <button
        onClick={() => handleToolChange('shape')}
        disabled={!isProjectCreated}
        className={clsx(
          "p-3 rounded-xl border border-transparent transition-all duration-200 group relative focus:outline-none",
          !isProjectCreated
            ? "text-gray-700 opacity-40 cursor-not-allowed"
            : activeTool === 'shape'
              ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-500/30"
              : "text-gray-500 hover:text-gray-300 hover:bg-tech-800"
        )}
        title={!isProjectCreated ? t('disabledTooltip') : t('shapeTooltip')}
      >
        <Shapes size={20} />
        <span className="absolute left-full ml-4 px-2 py-1 bg-tech-800 text-xs text-cyan-100 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-tech-700 whitespace-nowrap z-50">
          {!isProjectCreated ? t('disabledTooltip') : t('shape')}
        </span>
      </button>

      <div className="w-8 h-px bg-tech-700 my-2"></div>

      {/* AI Generate */}
      <button
        onClick={() => handleToolChange('ai-gen')}
        disabled={!isProjectCreated}
        className={clsx(
          "p-3 rounded-xl border border-transparent transition-all duration-200 group relative focus:outline-none",
          !isProjectCreated
            ? "text-gray-700 opacity-40 cursor-not-allowed"
            : activeTool === 'ai-gen'
              ? "bg-purple-500/10 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-500/30"
              : "text-gray-500 hover:text-gray-300 hover:bg-tech-800"
        )}
        title={!isProjectCreated ? t('disabledTooltip') : t('aiGenerateTooltip')}
      >
        <Wand2 size={20} />
        <span className="absolute left-full ml-4 px-2 py-1 bg-tech-800 text-xs text-purple-100 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-tech-700 whitespace-nowrap z-50">
          {!isProjectCreated ? t('disabledTooltip') : t('aiGenerate')}
        </span>
      </button>

    </div>
  );
};

export default Toolbar;
