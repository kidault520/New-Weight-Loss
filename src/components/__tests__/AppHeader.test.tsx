/**
 * AppHeader 组件测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../AppHeader';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  ChevronLeft: () => <div data-testid="chevron-left-icon">ChevronLeft</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">ChevronDown</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  Menu: () => <div data-testid="menu-icon">Menu</div>,
}));
vi.mock('../PlusMenuPopup', () => ({ default: () => null }));
vi.mock('../../hooks/useProfileBadges', () => ({
  useProfileBadges: () => ({ profileBadge: false }),
}));

describe('AppHeader', () => {
  const mockProps = {
    currentScreen: 'dashboard' as const,
    selectedDate: new Date(2025, 0, 15),
    showCalendar: false,
    onDateClick: vi.fn(),
    onBackClick: vi.fn(),
    formatDate: (date: Date) => {
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return '今日';
      }
      return '回今天';
    },
    generateCalendarDays: () => {
      const days: Date[] = [];
      for (let i = 0; i < 42; i++) {
        days.push(new Date(2025, 0, i + 1));
      }
      return days;
    },
    isToday: (date: Date) => {
      const today = new Date();
      return date.toDateString() === today.toDateString();
    },
    isSameMonth: (date: Date) => {
      return date.getMonth() === mockProps.selectedDate.getMonth();
    },
    onCalendarDateSelect: vi.fn(),
    onCalendarClose: vi.fn(),
    onCalendarMonthChange: vi.fn(),
    onGoToToday: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dashboard header', () => {
    render(<AppHeader {...mockProps} />);
    expect(screen.getByText('健康档案')).toBeInTheDocument();
  });

  it('should render AI screen header', () => {
    render(<AppHeader {...mockProps} currentScreen="ai" />);
    expect(screen.getByText('瑞丹维')).toBeInTheDocument();
  });

  it('should render mealplan screen header', () => {
    render(<AppHeader {...mockProps} currentScreen="mealplan" />);
    expect(screen.getByText('瑞丹维专属方案')).toBeInTheDocument();
  });

  it('should render profile screen header', () => {
    render(<AppHeader {...mockProps} currentScreen="profile" />);
    expect(screen.getByText('我的')).toBeInTheDocument();
  });

  it('should show calendar when showCalendar is true', () => {
    render(<AppHeader {...mockProps} showCalendar={true} />);
    expect(screen.getByText('2025年1月')).toBeInTheDocument();
  });

  it('should call onDateClick when date button is clicked', () => {
    render(<AppHeader {...mockProps} />);
    const dateButton = screen.getByText('回今天').closest('button');
    dateButton?.click();
    expect(mockProps.onDateClick).toHaveBeenCalled();
  });

  it('should call onOpenLeftDrawer when menu button is clicked on AI screen', () => {
    const onOpenLeftDrawer = vi.fn();
    render(<AppHeader {...mockProps} currentScreen="ai" onOpenLeftDrawer={onOpenLeftDrawer} />);
    const menuButton = screen.getByTestId('menu-icon').closest('button');
    menuButton?.click();
    expect(onOpenLeftDrawer).toHaveBeenCalled();
  });
});




