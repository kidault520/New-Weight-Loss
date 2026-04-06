/**
 * 我的健康 - 标题栏（sticky 悬浮，折叠时隐藏实时数据+推荐问题）
 */

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTopSummaryRow } from './TopSummaryRowContext';

export default function TopSummaryRowHeader() {
  const {
    expanded,
    stageText,
    handleToggleExpand,
  } = useTopSummaryRow();

  return (
    <div className={`pt-3 ${expanded ? 'pb-0' : 'pb-2'}`}>
      <div className={`bg-white/95 rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${expanded ? 'rounded-b-none' : ''}`}>
        <div className="px-4 pt-[15px] pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-end gap-1 min-w-0">
              <span className="text-sm font-semibold text-gray-900">我的健康</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                {stageText}
              </span>
              <button
                type="button"
                onClick={handleToggleExpand}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                title={expanded ? '折叠' : '展开'}
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
