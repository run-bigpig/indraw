import React from 'react';

interface LogoProps {
  size?: number;
  variant?: 'full' | 'simple' | 'icon';
  className?: string;
}

/**
 * Indraw Editor Logo 组件 (v2)
 * 设计风格：数字笔锋 (Digital Nib)
 */
export const Logo: React.FC<LogoProps> = ({ 
  size, 
  variant = 'full',
  className = '' 
}) => {
  const defaultSize = size || (variant === 'icon' ? 32 : variant === 'simple' ? 64 : 128);
  
  const logoContent = {
    full: (
      <svg width={defaultSize} height={defaultSize} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="nibGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#e0f2fe', stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:'#bae6fd', stopOpacity:1}} />
          </linearGradient>
          <linearGradient id="inkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#22d3ee', stopOpacity:1}} />
            <stop offset="50%" style={{stopColor:'#3b82f6', stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:'#8b5cf6', stopOpacity:1}} />
          </linearGradient>
          <filter id="dropShadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
            <feOffset dx="0" dy="8" result="offsetblur"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g transform="translate(256, 256) rotate(45)" filter="url(#dropShadow)">
          <path d="M -60 -160 L 60 -160 L 60 40 L -60 40 Z" fill="url(#inkGradient)" />
          <path d="M -60 40 L 60 40 L 0 140 Z" fill="url(#nibGradient)" />
          <path d="M 0 40 L 0 110" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          <rect x="-60" y="-140" width="120" height="20" fill="#ffffff" opacity="0.2" />
        </g>
        <path d="M 256 360 Q 150 360 100 280 T 50 150" fill="none" stroke="url(#inkGradient)" strokeWidth="24" strokeLinecap="round" strokeDasharray="20 10" filter="url(#dropShadow)" opacity="0.9"/>
        <g fill="url(#inkGradient)" filter="url(#dropShadow)">
          <rect x="360" y="180" width="24" height="24" rx="4" opacity="0.8" />
          <rect x="400" y="140" width="16" height="16" rx="3" opacity="0.6" />
          <rect x="420" y="200" width="20" height="20" rx="4" opacity="0.7" />
          <rect x="350" y="120" width="12" height="12" rx="2" opacity="0.5" />
        </g>
      </svg>
    ),
    simple: (
      <svg width={defaultSize} height={defaultSize} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#06b6d4', stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:'#8b5cf6', stopOpacity:1}} />
          </linearGradient>
        </defs>
        <g transform="translate(256, 256) rotate(45)">
          <path d="M -50 -100 L 50 -100 L 50 40 L 0 120 L -50 40 Z" fill="none" stroke="url(#grad)" strokeWidth="16" strokeLinejoin="round" strokeLinecap="round"/>
          <path d="M -50 40 L 50 40 L 0 120 Z" fill="url(#grad)" opacity="0.2"/>
        </g>
        <rect x="380" y="100" width="30" height="30" rx="6" fill="#06b6d4" opacity="0.8"/>
        <rect x="430" y="150" width="20" height="20" rx="4" fill="#8b5cf6" opacity="0.6"/>
      </svg>
    ),
    icon: (
      <svg width={defaultSize} height={defaultSize} viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#22d3ee', stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:'#3b82f6', stopOpacity:1}} />
          </linearGradient>
        </defs>
        <g transform="translate(64, 64) rotate(45)">
          <path d="M -25 -40 L 25 -40 L 25 10 L 0 40 L -25 10 Z" fill="url(#iconGrad)" />
          <path d="M 0 10 L 0 30" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    )
  };

  return logoContent[variant];
};

export default Logo;
