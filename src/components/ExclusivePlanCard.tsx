import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useExecutionProgram } from '../hooks/useExecutionProgram';
import { useActiveSupplementStage } from '../hooks/useActiveSupplementStage';
import { useUserProfile } from '../contexts/UserProfileContext';

interface ExclusivePlanCardProps {
  onOpen: () => void;
}

/**
 * 瑞丹维专属方案入口：整合定制餐食与补剂；阶段数据与 active-supplement-stage / 执行计划一致。
 */
const ExclusivePlanCard: React.FC<ExclusivePlanCardProps> = ({ onOpen }) => {
  const { intakePlanActive } = useUserProfile();
  const { program, currentDay, totalDays } = useExecutionProgram();
  const { data: stageSummary, isLoading: stageLoading } = useActiveSupplementStage();
  const hasProgram = !!program && (totalDays || 0) > 0;
  const hasStage = !!stageSummary?.has_plan && !!stageSummary?.current_stage;
  /** 配送/摄入托管未开启时不展示疗程进度，避免与「我的配送计划·待开启」矛盾 */
  const showPlanSummary = intakePlanActive && (hasProgram || hasStage);
  const dayLabel = hasProgram ? Math.min(Math.max(currentDay || 1, 1), totalDays || 1) : 0;

  return (
    <button
      type="button"
      className="w-full min-h-[5.75rem] bg-white rounded-2xl p-3 text-gray-800 relative overflow-hidden mb-4 text-left shadow-sm border border-gray-300"
      onClick={onOpen}
    >
      {/* 与「我的配送计划」卡片同一结构：右上状态区 + 左侧图标 + 中间文案，保证卡片高度一致 */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
        {showPlanSummary && (
          <div className="bg-violet-100 backdrop-blur-sm px-2 py-1 rounded-full">
            <span className="text-xs font-medium text-gray-700">
              {hasStage
                ? `第${stageSummary?.current_stage?.index ?? 1}阶段`
                : `第${dayLabel}/${totalDays}天`}
            </span>
          </div>
        )}
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
      </div>

      <div className="flex items-center space-x-3">
        <div className="w-16 h-16 shrink-0 bg-violet-100 rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0 pr-14">
          <h3 className="text-lg font-bold mb-1">我的专属方案</h3>
          {showPlanSummary ? (
            <>
              <p className="text-sm text-gray-600 mb-2">
                {stageLoading
                  ? '当前阶段：加载中…'
                  : hasStage
                    ? `当前阶段：${stageSummary?.current_stage?.stage_name || '-'}`
                    : '当前阶段：暂无'}
              </p>
              <div className="text-xs text-gray-500">
                当前进度：第{' '}
                {hasStage
                  ? `${stageSummary?.current_day || 0}/${stageSummary?.total_days || 0}`
                  : `${currentDay || 0}/${totalDays || 0}`}{' '}
                天
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-2">查看定制餐食与补剂汇总</p>
              <div className="text-xs text-gray-500">开启服务并配置后将展示疗程进度</div>
            </>
          )}
        </div>
      </div>
    </button>
  );
};

export default ExclusivePlanCard;
