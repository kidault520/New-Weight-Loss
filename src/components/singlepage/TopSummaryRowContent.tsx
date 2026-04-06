/**
 * 我的健康 - 可折叠内容（实时数据 4 卡片 + 3 个推荐问题）
 */

import type { Ref } from 'react';
import { ChevronRight, Hash, TrendingUp } from 'lucide-react';
import { useTopSummaryRow } from './TopSummaryRowContext';

export default function TopSummaryRowContent() {
  const {
    expanded,
    weight,
    bloodGlucose,
    calorieDeficit,
    steps,
    isMetricsLoading,
    todoUpdatedAt,
    handleQuestionClick,
    hasAskQuestion,
    suggestedQuestions,
    collapsibleRef,
    onRealtimeCardClick,
  } = useTopSummaryRow();

  if (!expanded) return null;

  return (
    <div ref={collapsibleRef as Ref<HTMLDivElement>} className="pt-0 pb-2">
      <div className="bg-white/95 rounded-b-2xl border border-t-0 border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-t border-gray-100">
          {/* 实时数据 - 4 个卡片 */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-800">实时数据</span>
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">更新于{todoUpdatedAt}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => onRealtimeCardClick?.('weight')}
                className="bg-gray-100 rounded-xl px-1.5 py-2 border border-gray-200 min-w-0 text-left active:scale-[0.98] transition-transform"
              >
                <p className="text-[10px] text-gray-500 truncate">体重</p>
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {isMetricsLoading ? '—' : (weight ?? '—')}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">kg</p>
              </button>
              <button
                type="button"
                onClick={() => onRealtimeCardClick?.('blood_glucose')}
                className="bg-gray-100 rounded-xl px-1.5 py-2 border border-gray-200 min-w-0 text-left active:scale-[0.98] transition-transform"
              >
                <p className="text-[10px] text-gray-500 truncate">血糖</p>
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {isMetricsLoading ? '—' : (bloodGlucose ?? '—')}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">mmol/L</p>
              </button>
              <button
                type="button"
                onClick={() => onRealtimeCardClick?.('calorie_deficit')}
                className="bg-gray-100 rounded-xl px-1.5 py-2 border border-gray-200 min-w-0 text-left active:scale-[0.98] transition-transform"
              >
                <p className="text-[10px] text-gray-500 truncate">热量缺口</p>
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {isMetricsLoading ? '—' : (calorieDeficit != null ? `${calorieDeficit}` : '—')}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">kcal</p>
              </button>
              <button
                type="button"
                onClick={() => onRealtimeCardClick?.('steps')}
                className="bg-gray-100 rounded-xl px-1.5 py-2 border border-gray-200 min-w-0 text-left active:scale-[0.98] transition-transform"
              >
                <p className="text-[10px] text-gray-500 truncate">步数</p>
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {isMetricsLoading ? '—' : (steps != null ? steps.toLocaleString() : '—')}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">步</p>
              </button>
            </div>
          </div>

          {/* 阶段专属推荐问题 */}
          <div className="space-y-2">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuestionClick(q)}
                disabled={!hasAskQuestion}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50/80 hover:bg-purple-50/80 border border-gray-100 hover:border-purple-200/60 transition-colors text-left disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                  <Hash className="w-4 h-4 text-white" />
                </div>
                <span className="flex-1 text-sm text-gray-800 font-medium truncate">{q}</span>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
