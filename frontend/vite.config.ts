import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      optimizeDeps: {
        // 排除 OpenCV.js 从预构建，因为它很大且需要特殊处理
        exclude: ['@techstark/opencv-js'],
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'konva-vendor': ['konva', 'react-konva', 'use-image'],
              'ai-vendor': ['@google/genai'],
              // OpenCV.js 单独打包，因为文件很大
              'opencv-vendor': ['@techstark/opencv-js'],
            }
          }
        },
        // 增加 chunk 大小限制，因为 OpenCV.js 很大
        chunkSizeWarningLimit: 1000,
      }
    };
});
