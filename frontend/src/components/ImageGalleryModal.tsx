/**
 * 图库组件
 * 显示导出目录中的所有图片，并允许选择导入到画布
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Loader2, RefreshCw, ZoomIn, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ListImagesInDirectory, ReadImageFile } from '../../wailsjs/go/core/App';

interface ImageFile {
  name: string;
  path: string;
  size: number;
  modified: number;
}

// 图片缩略图组件（懒加载预览）
const ImageThumbnail: React.FC<{
  imagePath: string;
  imageName: string;
  preview?: string;
}> = ({ imagePath, imageName, preview }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(preview || null);
  const [loading, setLoading] = useState(!preview);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (preview) {
      setImgSrc(preview);
      setLoading(false);
      setHasLoaded(true);
    } else if (!hasLoaded) {
      // 懒加载：延迟加载预览，避免阻塞UI
      setLoading(true);
      const timer = setTimeout(() => {
        ReadImageFile(imagePath)
          .then((dataUrl) => {
            setImgSrc(dataUrl);
            setLoading(false);
            setHasLoaded(true);
          })
          .catch(() => {
            setLoading(false);
          });
      }, 50); // 小延迟，避免阻塞UI
      
      return () => clearTimeout(timer);
    }
  }, [imagePath, preview, hasLoaded]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-tech-900">
        <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
      </div>
    );
  }

  if (!imgSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-tech-900 text-gray-600">
        <ImageIcon className="w-8 h-8" />
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={imageName}
      className="w-full h-full object-cover"
    />
  );
};

interface ImageGalleryModalProps {
  isOpen: boolean;
  exportDirectory: string;
  onSelectImage: (imageDataUrl: string) => void;
  onClose: () => void;
}

export default function ImageGalleryModal({
  isOpen,
  exportDirectory,
  onSelectImage,
  onClose,
}: ImageGalleryModalProps) {
  const { t } = useTranslation(['toolbar', 'common']);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<{ path: string; name: string; dataUrl: string } | null>(null);

  // 加载图片预览（使用函数式更新避免依赖 imagePreviews）
  const loadImagePreview = useCallback(async (imagePath: string) => {
    // 检查是否已有预览（通过函数式更新获取最新值）
    setImagePreviews(prev => {
      if (prev[imagePath]) {
        return prev; // 已有预览，不更新
      }
      // 异步加载预览
      ReadImageFile(imagePath)
        .then((dataUrl) => {
          setImagePreviews(current => {
            if (current[imagePath]) {
              return current; // 避免重复设置
            }
            return { ...current, [imagePath]: dataUrl };
          });
        })
        .catch((err) => {
          console.error('[ImageGallery] Failed to load image preview:', err);
        });
      return prev; // 立即返回，不等待加载完成
    });
    
    // 返回已有的预览或 null
    return imagePreviews[imagePath] || null;
  }, []); // 移除 imagePreviews 依赖

  // 加载图片列表函数（用于手动刷新）
  const loadImages = useCallback(async () => {
    if (!exportDirectory) {
      setImages([]);
      setError(t('toolbar:galleryNoDirectory', '未设置导出目录'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[ImageGallery] Loading images from:', exportDirectory);
      // 先加载图片列表，不等待预览
      const imagesJSON = await ListImagesInDirectory(exportDirectory);
      console.log('[ImageGallery] Received images JSON:', imagesJSON);
      
      if (!imagesJSON || imagesJSON === '[]') {
        setImages([]);
        setLoading(false);
        return;
      }
      
      const imageList: ImageFile[] = JSON.parse(imagesJSON);
      console.log('[ImageGallery] Parsed image list:', imageList.length, 'images');
      
      setImages(imageList);
      setLoading(false); // 立即结束加载状态，显示图片列表
      
      // 异步预加载前几张图片的预览（不阻塞UI，直接调用 ReadImageFile）
      if (imageList.length > 0) {
        setTimeout(() => {
          imageList.slice(0, 10).forEach(img => {
            ReadImageFile(img.path)
              .then((dataUrl) => {
                setImagePreviews(prev => {
                  if (prev[img.path]) {
                    return prev; // 避免重复设置
                  }
                  return { ...prev, [img.path]: dataUrl };
                });
              })
              .catch((err) => {
                console.warn('[ImageGallery] Failed to preload preview:', err);
              });
          });
        }, 100);
      }
    } catch (err: any) {
      console.error('[ImageGallery] Failed to load images:', err);
      const errorMessage = err?.message || err?.toString() || t('toolbar:galleryLoadError', '加载图片失败');
      setError(errorMessage);
      setImages([]);
      setLoading(false);
    }
  }, [exportDirectory, t]);

  // 当模态框打开或导出目录变化时加载图片
  useEffect(() => {
    if (!isOpen) {
      return; // 模态框关闭时不执行
    }

    if (!exportDirectory) {
      // 如果没有导出目录，立即显示错误
      setImages([]);
      setError(t('toolbar:galleryNoDirectory', '未设置导出目录'));
      setLoading(false);
      return;
    }

    // 重置状态
    setImages([]);
    setError(null);
    setImagePreviews({});
    
    // 使用 setTimeout 确保模态框先渲染，然后再异步加载图片列表
    // 避免阻塞UI，让用户立即看到模态框
    const loadTimer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('[ImageGallery] Loading images from:', exportDirectory);
        const imagesJSON = await ListImagesInDirectory(exportDirectory);
        console.log('[ImageGallery] Received images JSON:', imagesJSON);
        
        if (!imagesJSON || imagesJSON === '[]') {
          setImages([]);
          setLoading(false);
          return;
        }
        
        const imageList: ImageFile[] = JSON.parse(imagesJSON);
        console.log('[ImageGallery] Parsed image list:', imageList.length, 'images');
        
        setImages(imageList);
        setLoading(false);
        
        // 异步预加载前几张图片的预览
        if (imageList.length > 0) {
          setTimeout(() => {
            imageList.slice(0, 10).forEach(img => {
              ReadImageFile(img.path)
                .then((dataUrl) => {
                  setImagePreviews(prev => {
                    if (prev[img.path]) {
                      return prev;
                    }
                    return { ...prev, [img.path]: dataUrl };
                  });
                })
                .catch((err) => {
                  console.warn('[ImageGallery] Failed to preload preview:', err);
                });
            });
          }, 100);
        }
      } catch (err: any) {
        console.error('[ImageGallery] Failed to load images:', err);
        const errorMessage = err?.message || err?.toString() || t('toolbar:galleryLoadError', '加载图片失败');
        setError(errorMessage);
        setImages([]);
        setLoading(false);
      }
    }, 10);
    
    return () => {
      clearTimeout(loadTimer);
    };
  }, [isOpen, exportDirectory, t]); // 直接依赖必要的值

  // 选择图片并导入
  const handleSelectImage = useCallback(async (imagePath: string) => {
    setSelectedImagePath(imagePath);
    setPreviewLoading(true);

    try {
      const imageDataUrl = await ReadImageFile(imagePath);
      onSelectImage(imageDataUrl);
      onClose();
    } catch (err: any) {
      console.error('Failed to read image:', err);
      alert(err.message || t('toolbar:galleryReadError', '读取图片失败'));
    } finally {
      setPreviewLoading(false);
      setSelectedImagePath(null);
    }
  }, [onSelectImage, onClose, t]);

  // 放大查看图片
  const handlePreviewImage = useCallback(async (imagePath: string, imageName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发导入
    
    // 如果已有预览数据，直接显示
    if (imagePreviews[imagePath]) {
      setPreviewImage({
        path: imagePath,
        name: imageName,
        dataUrl: imagePreviews[imagePath],
      });
      return;
    }

    // 否则加载图片
    try {
      const imageDataUrl = await ReadImageFile(imagePath);
      setImagePreviews(prev => ({ ...prev, [imagePath]: imageDataUrl }));
      setPreviewImage({
        path: imagePath,
        name: imageName,
        dataUrl: imageDataUrl,
      });
    } catch (err: any) {
      console.error('Failed to load preview image:', err);
      alert(err.message || t('toolbar:galleryReadError', '读取图片失败'));
    }
  }, [imagePreviews, t]);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 格式化修改时间
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[90vw] h-[85vh] max-w-6xl bg-tech-900 border border-tech-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-tech-700">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-gray-100">
              {t('toolbar:imageGallery', '图库')}
            </h2>
            {exportDirectory && (
              <span className="text-xs text-gray-500 ml-2">
                {exportDirectory}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadImages}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-tech-800 rounded-lg transition-colors"
              title={t('toolbar:refresh', '刷新')}
            >
              <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-tech-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-red-400 mb-2">{error}</p>
              {!exportDirectory && (
                <p className="text-sm text-gray-500">
                  {t('toolbar:gallerySetDirectoryHint', '请在设置中配置导出目录')}
                </p>
              )}
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <p>{t('toolbar:galleryEmpty', '暂无图片')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((image) => (
                <div
                  key={image.path}
                  className={clsx(
                    'group relative bg-tech-800 rounded-lg overflow-hidden border-2 transition-all',
                    selectedImagePath === image.path
                      ? 'border-cyan-400 shadow-lg shadow-cyan-400/20'
                      : 'border-transparent hover:border-tech-600'
                  )}
                >
                  {/* 图片预览 */}
                  <div className="aspect-square bg-tech-900 relative overflow-hidden">
                    {selectedImagePath === image.path && previewLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                      </div>
                    ) : (
                      <ImageThumbnail
                        imagePath={image.path}
                        imageName={image.name}
                        preview={imagePreviews[image.path]}
                      />
                    )}
                    {/* 悬停遮罩 */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => handlePreviewImage(image.path, image.name, e)}
                        className="px-3 py-1.5 bg-tech-800/90 hover:bg-tech-700 rounded-lg flex items-center gap-1.5 text-xs text-white font-medium transition-colors"
                        title={t('toolbar:previewImage', '放大查看')}
                      >
                        <ZoomIn size={14} />
                        {t('toolbar:preview', '查看')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止事件冒泡，避免触发父元素的 onClick
                          handleSelectImage(image.path);
                        }}
                        className="px-3 py-1.5 bg-cyan-500/90 hover:bg-cyan-500 rounded-lg flex items-center gap-1.5 text-xs text-white font-medium transition-colors"
                        title={t('toolbar:clickToImport', '点击导入')}
                      >
                        <Download size={14} />
                        {t('toolbar:import', '导入')}
                      </button>
                    </div>
                  </div>

                  {/* 图片信息 */}
                  <div className="p-2">
                    <p className="text-xs text-gray-300 truncate mb-1" title={image.name}>
                      {image.name}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>{formatFileSize(image.size)}</span>
                      <span>{formatDate(image.modified)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 图片预览模态框 */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-[95vw] max-h-[95vh] bg-tech-900 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-tech-700">
              <h3 className="text-sm font-medium text-gray-200 truncate flex-1 mr-4">
                {previewImage.name}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleSelectImage(previewImage.path);
                    setPreviewImage(null);
                  }}
                  className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 rounded-lg flex items-center gap-1.5 text-xs text-white font-medium transition-colors"
                  title={t('toolbar:clickToImport', '点击导入')}
                >
                  <Download size={14} />
                  {t('toolbar:import', '导入')}
                </button>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-tech-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 图片内容 */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              <img
                src={previewImage.dataUrl}
                alt={previewImage.name}
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: 'calc(95vh - 80px)' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

