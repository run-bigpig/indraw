
import React, { useEffect, useRef } from 'react';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  scale: number;
  offset: number;
  width?: number;
  height?: number;
}

const Ruler: React.FC<RulerProps> = ({ orientation, scale, offset, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (width || 0) * dpr;
    canvas.height = (height || 0) * dpr;
    ctx.scale(dpr, dpr);

    // Style
    ctx.fillStyle = '#1E2433'; // tech-700
    ctx.fillRect(0, 0, width || 0, height || 0);
    
    ctx.strokeStyle = '#4B5563'; // tech-500
    ctx.fillStyle = '#94a3b8'; // text-gray-400
    ctx.font = '10px "JetBrains Mono"';
    ctx.lineWidth = 1;

    const step = 50; // Logical pixels between major ticks
    
    // Calculate start based on offset (visual viewport start)
    // offset is usually negative (panning moves stage left/up)
    // We want to draw ruler ticks starting from the visual 0, mapped to logical coordinate
    
    if (orientation === 'horizontal') {
      const w = width || 0;
      ctx.beginPath();
      
      // Calculate the starting logical value visible on screen
      const startLogical = -offset / scale;
      // Round down to nearest step
      const startTick = Math.floor(startLogical / step) * step;
      
      for (let i = startTick; ; i += step) {
        // Convert logical coordinate i to screen coordinate x
        const x = (i * scale) + offset;
        
        if (x > w) break;
        if (x < -50) continue; // Optimization

        // Draw tick
        ctx.moveTo(x, 15);
        ctx.lineTo(x, 20);
        
        // Draw label
        if (i % 100 === 0) {
            ctx.fillText(i.toString(), x + 2, 12);
            ctx.moveTo(x, 0); // Long tick
            ctx.lineTo(x, 20);
        }
      }
      ctx.stroke();
    } else {
      const h = height || 0;
      ctx.beginPath();
      
      const startLogical = -offset / scale;
      const startTick = Math.floor(startLogical / step) * step;

      for (let i = startTick; ; i += step) {
        const y = (i * scale) + offset;
        
        if (y > h) break;
        if (y < -50) continue;

        ctx.moveTo(15, y);
        ctx.lineTo(20, y);

        if (i % 100 === 0) {
            // Vertical text drawing
            ctx.save();
            ctx.translate(12, y + 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(i.toString(), 0, 0);
            ctx.restore();
            
            ctx.moveTo(0, y);
            ctx.lineTo(20, y);
        }
      }
      ctx.stroke();
    }

  }, [scale, offset, width, height, orientation]);

  const style: React.CSSProperties = orientation === 'horizontal' 
    ? { width: '100%', height: '20px', left: '20px', top: 0, position: 'absolute' }
    : { width: '20px', height: '100%', top: '20px', left: 0, position: 'absolute' };

  return <canvas ref={canvasRef} style={{...style, width: width, height: height}} className="pointer-events-none z-10 bg-tech-800 border-b border-r border-tech-600" />;
};

export default Ruler;
