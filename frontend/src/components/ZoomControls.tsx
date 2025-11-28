import React from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({ scale, onZoomIn, onZoomOut, onFit }) => {
  return (
    <div className="absolute bottom-4 right-4 flex gap-2 bg-tech-800 p-1.5 rounded-lg border border-tech-600 shadow-lg z-30">
      <button
        onClick={onZoomOut}
        className="p-1 text-gray-400 hover:text-white hover:bg-tech-700 rounded transition-colors"
        title="Zoom Out"
      >
        <ZoomOut size={16} />
      </button>
      <span className="text-xs text-gray-300 font-mono flex items-center px-2 min-w-[3rem] justify-center select-none">
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        className="p-1 text-gray-400 hover:text-white hover:bg-tech-700 rounded transition-colors"
        title="Zoom In"
      >
        <ZoomIn size={16} />
      </button>
      <div className="w-px bg-tech-600 mx-1"></div>
      <button
        onClick={onFit}
        className="p-1 text-gray-400 hover:text-white hover:bg-tech-700 rounded transition-colors"
        title="Fit to Screen"
      >
        <Maximize size={16} />
      </button>
    </div>
  );
};

export default ZoomControls;
