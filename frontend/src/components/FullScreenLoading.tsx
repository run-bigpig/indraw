import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProcessingState } from '../../App';

interface FullScreenLoadingProps {
  processingState: ProcessingState;
}

/**
 * 全屏 Loading 遮罩组件
 * 在 AI 操作期间显示，禁止用户进行任何操作
 */
const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({ processingState }) => {
  const { t } = useTranslation(['ai', 'common']);

  // 只在非 idle 状态时显示
  if (processingState === 'idle') {
    return null;
  }

  // 根据状态获取显示文本
  const getLoadingText = () => {
    switch (processingState) {
      case 'generating':
        return t('ai:generating', 'AI Generating...');
      case 'inpainting':
        return t('ai:inpainting', 'AI Inpainting...');
      case 'blending':
        return t('ai:blending', 'AI Blending...');
      case 'removing-bg':
        return t('ai:removingBg', 'Removing Background...');
      case 'transforming':
        return t('ai:transforming', 'AI Transforming...');
      default:
        return t('common:processing', 'Processing...');
    }
  };

  // 根据状态获取提示文本
  const getHintText = () => {
    switch (processingState) {
      case 'generating':
        return t('ai:generatingHint', 'Creating your image with AI...');
      case 'inpainting':
        return t('ai:inpaintingHint', 'Editing selected area with AI...');
      case 'blending':
        return t('ai:blendingHint', 'Blending layers with AI...');
      case 'removing-bg':
        return t('ai:removingBgHint', 'Removing background from image...');
      case 'transforming':
        return t('ai:transformingHint', 'Transforming image with AI...');
      default:
        return '';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      // 阻止所有点击事件穿透
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-tech-900/90 border border-tech-700 shadow-2xl">
        {/* 加载动画 */}
        <div className="relative">
          {/* 外圈 */}
          <div className="w-20 h-20 rounded-full border-4 border-tech-700 animate-pulse" />
          {/* 旋转圈 */}
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin" />
          {/* 内圈反向旋转 */}
          <div 
            className="absolute inset-2 w-16 h-16 rounded-full border-4 border-transparent border-b-purple-500 animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          />
          {/* 中心图标 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-cyan-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" 
              />
            </svg>
          </div>
        </div>

        {/* 主文本 */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white mb-2">
            {getLoadingText()}
          </h3>
          <p className="text-sm text-gray-400 max-w-xs">
            {getHintText()}
          </p>
        </div>

        {/* 进度条动画 */}
        <div className="w-64 h-1.5 bg-tech-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500 rounded-full animate-pulse"
            style={{
              width: '100%',
              animation: 'shimmer 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* 提示文本 */}
        <p className="text-xs text-gray-500">
          {t('ai:pleaseWait', 'Please wait, this may take a moment...')}
        </p>
      </div>

      {/* 添加 shimmer 动画样式 */}
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};

export default FullScreenLoading;

