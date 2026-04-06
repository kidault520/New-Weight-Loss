import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // 监听所有网络接口，包括 IPv4 和 IPv6
    open: true, // 启动时自动打开浏览器，避免端口变更时访问错误地址
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
    hmr: {
      // 🔥 修复：增加 HMR 超时时间，减少动态导入失败
      timeout: 30000,
      // 启用客户端重连
      overlay: true,
    },
  },
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.[tj]sx?$/,
    exclude: []
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    // 解决 Outdated Optimize Dep 错误：清除 node_modules/.vite 缓存后重启
    // 🔥 修复：强制预构建某些依赖，减少动态导入失败
    include: ['react', 'react-dom'],
  },
  build: {
    // 🔥 修复：优化代码分割，减少动态导入失败
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'react-query': ['@tanstack/react-query'],
        },
      },
    },
    // 增加 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
  },
});
