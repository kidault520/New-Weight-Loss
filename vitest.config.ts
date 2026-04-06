import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const verboseTestLogs = process.env.VITEST_SHOW_LOGS === '1';
const noisyLogPatterns = [
  '[HealthMetricDetection]',
  'calculateBMR input',
  'calculateBMR result',
  'calculateBMR: Missing required fields',
];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'server/utils/**/*.{test,spec}.{ts,tsx,js}',
    ],
    exclude: [
      'server/tests/**',
      'admin/**',
      'server/node_modules/**',
      'node_modules/**',
      'dist/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
      ],
    },
    onConsoleLog(log) {
      if (verboseTestLogs) return;
      return !noisyLogPatterns.some((pattern) => log.includes(pattern));
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});




