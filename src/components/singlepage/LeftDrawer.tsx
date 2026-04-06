/**
 * 左侧抽屉 - 日历日记流
 * 时间线风格：垂直虚线、每对话前情绪 emoji；长按菜单：多选、删除
 */
 

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, User, Package, FileText, MessageSquare, CheckSquare, Trash2 } from 'lucide-react';
import { useConversationDaysQuery } from '../../hooks/useChatMessagesQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useProfileBadges } from '../../hooks/useProfileBadges';
import { useQueryClient } from '@tanstack/react-query';
import { chatMessagesService } from '../../services/chatMessagesService';
import { ConfirmModal } from '../common/ConfirmModal';
import { toLocalDateString } from '../../utils/dateUtils';

export interface LeftDrawerProps {
  show: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenServicePackage: () => void;
  onOpenHealthArchive: () => void;
  onSelectDate?: (date: Date) => void;
}

function normalizeToDate(input: unknown): Date {
  if (input instanceof Date) return input;
  return new Date(input as any);
}

function formatDayLabel(input: unknown): string {
  const d = normalizeToDate(input);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return '今天';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return '明天';
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

const LeftDrawer: React.FC<LeftDrawerProps> = ({
  show,
  onClose,
  onOpenProfile,
  onOpenServicePackage,
  onOpenHealthArchive,
  onSelectDate,
}) => {
  const { days, isLoading, refresh } = useConversationDaysQuery(60);
  const { user } = useAuth();
  const { profileBadge } = useProfileBadges();
  const queryClient = useQueryClient();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: Date } | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ dates: Date[]; message: string } | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const suppressClickRef = useRef(false);
  const onCloseCallbackRef = useRef<(() => void) | null>(null);

  const ANIMATION_DURATION_MS = 200;

  useEffect(() => {
    if (show && !hasAnimatedIn) {
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setHasAnimatedIn(true));
      });
      return () => cancelAnimationFrame(t);
    }
    if (!show) setHasAnimatedIn(false);
  }, [show, hasAnimatedIn]);

  const handleRequestClose = useCallback((afterClose?: () => void) => {
    setContextMenu(null);
    if (!multiSelectMode && !isClosing) {
      // onClick 直接传 handleRequestClose 时首参会是 SyntheticEvent，绝不能写入 ref
      const safeAfter = typeof afterClose === 'function' ? afterClose : null;
      onCloseCallbackRef.current = safeAfter;
      setIsClosing(true);
    }
  }, [multiSelectMode, isClosing]);

  useEffect(() => {
    if (!isClosing) return;
    const t = setTimeout(() => {
      setIsClosing(false);
      onClose();
      const cb = onCloseCallbackRef.current;
      onCloseCallbackRef.current = null;
      if (typeof cb === 'function') {
        cb();
      }
    }, ANIMATION_DURATION_MS);
    return () => clearTimeout(t);
  }, [isClosing, onClose]);

  const handleDayClick = (date: Date) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const dayDate = normalizeToDate(date);
    if (multiSelectMode) {
      const key = toLocalDateString(dayDate);
      setSelectedDates(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    } else {
      setContextMenu(null);
      onSelectDate?.(dayDate);
      handleRequestClose();
    }
  };

  const handleLongPress = useCallback((e: React.TouchEvent | React.MouseEvent, date: Date) => {
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = true;
    const dayDate = normalizeToDate(date);
    if ('touches' in e) {
      const t = e.touches[0];
      setContextMenu({ x: t.clientX, y: t.clientY, date: dayDate });
    } else {
      setContextMenu({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY, date: dayDate });
    }
    setTimeout(() => { suppressClickRef.current = false; }, 400);
  }, []);

  const handleMultiSelect = () => {
    if (contextMenu) {
      const key = toLocalDateString(contextMenu.date);
      setSelectedDates(new Set([key]));
      setMultiSelectMode(true);
      setContextMenu(null);
    }
  };

  const handleDeleteOne = () => {
    if (contextMenu) {
      setDeleteConfirm({
        dates: [contextMenu.date],
        message: `确定删除「${formatDayLabel(contextMenu.date)}」的对话记录吗？`,
      });
      setContextMenu(null);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedDates.size === 0) return;
    const dates = Array.from(selectedDates).map(k => new Date(k + 'T12:00:00'));
    setDeleteConfirm({
      dates,
      message: `确定删除选中的 ${selectedDates.size} 天对话记录吗？`,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || !user?.id) return;
    try {
      for (const d of deleteConfirm.dates) {
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setDate(end.getDate() + 1);
        end.setHours(0, 0, 0, 0);
        await chatMessagesService.deleteMessagesByDateRange(user.id, start, end);
      }
      queryClient.invalidateQueries({ queryKey: ['conversation-days', user.id] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', user.id] });
      refresh();
      setSelectedDates(new Set());
      setMultiSelectMode(false);
    } catch (err) {
      console.error('Delete conversation failed:', err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const exitMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedDates(new Set());
  };

  // 按日期分组，插入分隔符，形成时间线
  const timelineItems: ({ type: 'separator'; label: string } | { type: 'day'; date: Date; preview: string; emotionEmoji: string; timeLabel: string })[] = [];
  let lastDateKey = '';
  for (const item of days) {
    const d = normalizeToDate(item.date);
    const key = toLocalDateString(d);
    const dateLabel = formatDayLabel(d);
    if (key !== lastDateKey) {
      timelineItems.push({ type: 'separator', label: dateLabel });
      lastDateKey = key;
    }
    timelineItems.push({
      type: 'day',
      date: d,
      preview: item.preview || '对话记录',
      emotionEmoji: item.emotionEmoji || '💬',
      timeLabel: item.timeLabel || '--:--',
    });
  }

  if (!show) return null;

  return (
    <>
      {/* 遮罩：仅覆盖 app 主窗口（max-w-sm 居中区域），left 与主窗口左边缘对齐 */}
      <div
        className={`fixed top-0 bottom-0 w-[min(100vw,384px)] bg-black/30 z-40 transition-opacity duration-200 ${isClosing ? 'opacity-0 pointer-events-none' : ''}`}
        style={{ left: 'max(0px, calc((100vw - 384px) / 2))' }}
        onClick={() => handleRequestClose()}
        aria-hidden="true"
      />
      {/* 抽屉：从 app 主窗口内部左侧弹出，与主窗口左边缘对齐 */}
      <div
        className={`fixed top-0 bottom-0 w-[min(85%,320px)] max-w-sm bg-white shadow-xl z-50 flex flex-col transition-transform duration-200 ease-out ${
          isClosing || !hasAnimatedIn ? '-translate-x-full' : 'translate-x-0'
        }`}
        style={{ left: 'max(0px, calc((100vw - 384px) / 2))' }}
        role="dialog"
        aria-label="侧边栏"
      >
        <div className="pt-[env(safe-area-inset-top)] pb-4 flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center px-4 py-2">
            {multiSelectMode ? (
              <button
                onClick={exitMultiSelect}
                className="text-sm text-purple-600 font-medium"
              >
                取消多选
              </button>
            ) : (
              <div />
            )}
            <button type="button" onClick={() => handleRequestClose()} className="p-2 rounded-full hover:bg-gray-100 ml-auto">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div
            className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50"
            onClick={() => handleRequestClose(onOpenProfile)}
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">我的</p>
              <p className="text-xs text-gray-500">订单 · 设置</p>
            </div>
            <div className="flex items-center gap-2">
              {profileBadge && <div className="w-2 h-2 bg-red-500 rounded-full shrink-0" />}
              <span className="text-gray-400">›</span>
            </div>
          </div>

          <div
            className="mx-4 mt-4 p-4 rounded-xl bg-blue-50/80 border border-blue-100 cursor-pointer hover:bg-blue-100/80 transition-colors"
            onClick={() => handleRequestClose(onOpenServicePackage)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">服务套餐</p>
                <p className="text-xs text-gray-500">餐食 · 补剂服务</p>
              </div>
              <span className="text-gray-400 ml-auto">›</span>
            </div>
          </div>

          <div
            className="mx-4 mt-2 p-4 rounded-xl bg-purple-50/80 border border-purple-100 cursor-pointer hover:bg-purple-100/80 transition-colors"
            onClick={() => handleRequestClose(onOpenHealthArchive)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">健康档案</p>
                <p className="text-xs text-gray-500">数据汇总与洞察</p>
              </div>
              <span className="text-gray-400 ml-auto">›</span>
            </div>
          </div>

          <div className="mt-4 px-4 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                对话记录
              </p>
              {multiSelectMode && selectedDates.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 text-sm text-red-600 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  删除({selectedDates.size})
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {isLoading ? (
                <p className="text-xs text-gray-500 py-4">加载中…</p>
              ) : days.length === 0 ? (
                <p className="text-xs text-gray-500 py-4">暂无对话记录</p>
              ) : (
                <div className="border-l-2 border-dotted border-gray-200 pl-4 ml-2">
                  {timelineItems.map((item, idx) => {
                    if (item.type === 'separator') {
                      return (
                        <div key={`sep-${idx}`} className="flex items-center py-1 mt-2 first:mt-0">
                          <span className="w-10 shrink-0 text-left text-[11px] text-gray-500 bg-gray-100 pl-0 pr-1 py-0.5 rounded">
                            {item.label}
                          </span>
                        </div>
                      );
                    }
                    const { date, preview, emotionEmoji } = item;
                    const key = toLocalDateString(date);
                    const isSelected = selectedDates.has(key);
                    return (
                      <div key={key} className="flex items-center gap-2 py-2">
                        <div
                          className="flex-1 min-w-0 rounded-xl border border-dashed border-green-200/80 bg-green-50/30 px-3 py-2 cursor-pointer hover:bg-green-50/60 transition-colors flex items-center gap-3"
                          onClick={() => handleDayClick(date)}
                          onContextMenu={(e) => { e.preventDefault(); handleLongPress(e, date); }}
                          onTouchStart={(e) => {
                            const t = setTimeout(() => handleLongPress(e, date), 500);
                            (e.currentTarget as any)._longPressTimer = t;
                          }}
                          onTouchEnd={(e) => {
                            const t = (e.currentTarget as any)._longPressTimer;
                            if (t) clearTimeout(t);
                          }}
                          onTouchMove={(e) => {
                            const t = (e.currentTarget as any)._longPressTimer;
                            if (t) { clearTimeout(t); (e.currentTarget as any)._longPressTimer = null; }
                          }}
                        >
                          {multiSelectMode ? (
                            <div
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                              }`}
                            >
                              {isSelected && <span className="text-white text-xs">✓</span>}
                            </div>
                          ) : (
                            <span className="text-xl shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 border border-green-200/60">
                              {emotionEmoji}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{preview}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 长按菜单 */}
      {contextMenu && (
        <div
          className="fixed z-[60] bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={handleMultiSelect}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-gray-800 hover:bg-gray-50 text-left"
          >
            <CheckSquare className="w-4 h-4 text-purple-600" />
            多选
          </button>
          <button
            type="button"
            onClick={handleDeleteOne}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-red-600 hover:bg-red-50 text-left"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      )}

      <ConfirmModal
        show={!!deleteConfirm}
        title="删除确认"
        message={deleteConfirm?.message || ''}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        cancelText="取消"
        confirmText="删除"
        confirmColor="red"
      />
    </>
  );
};

export default LeftDrawer;
