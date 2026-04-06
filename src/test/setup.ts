/**
 * Vitest setup file
 * 配置测试环境
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 每个测试后清理
afterEach(() => {
  cleanup();
});

// Mock Supabase client
// 注意：Supabase使用链式调用，每个方法返回的对象需要支持后续方法
const createMockQueryBuilder = () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return builder;
};

vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(() => createMockQueryBuilder()),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

// Mock window对象
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

