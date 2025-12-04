import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // 开发模式下代理 /models/ 请求到 Wails 后端
        proxy: {
          '/models': {
            target: 'http://localhost:34115',
            changeOrigin: true,
          },
        },
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
      optimizeDeps: {},
      build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'konva-vendor': ['konva', 'react-konva', 'use-image'],
              'ai-vendor': ['@google/genai'],
            }
          }
        },
        // 增加 chunk 大小限制，因为 OpenCV.js 较大
        // 注意：AI 模型文件现在由后端管理，不再包含在前端构建中
        chunkSizeWarningLimit: 2000,
        // 确保大文件不被内联
        assetsInlineLimit: 0,
      },
      // public 目录下的文件被正确复制（不包含 AI 模型，模型由后端管理）
      publicDir: 'public',
    };
});
