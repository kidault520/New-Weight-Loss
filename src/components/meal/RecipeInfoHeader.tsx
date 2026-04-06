import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatMealPlanDate } from '../../utils/dateUtils';

interface RecipeInfoHeaderProps {
  title: string;
  duration?: number; // 天数，无订单时可不传
  startDate?: Date;
  endDate?: Date;
  startDateStr?: string; // 如果已有格式化字符串
  endDateStr?: string;
  /** 无订单时设为 true，仅显示标题，不显示时长/日期 */
  hideDuration?: boolean;
  /** 有订单但摄入托管尚未开启：隐藏计划周期、适用人群与说明文案（与配送计划闸门一致） */
  hideServicePackageSummary?: boolean;
  tags?: Array<{ text: string; bgColor: string; textColor: string }>;
  description?: string;
  onRecipeIntroClick?: () => void;
  /** 右侧说明链接文案，默认「食谱介绍」 */
  introLinkLabel?: string;
  className?: string;
}

export const RecipeInfoHeader: React.FC<RecipeInfoHeaderProps> = ({
  title,
  duration = 0,
  startDate,
  endDate,
  startDateStr,
  endDateStr,
  hideDuration = false,
  hideServicePackageSummary = false,
  tags = [
    { text: '适合人群', bgColor: 'bg-blue-100', textColor: 'text-green-600' },
    { text: '不适合人群', bgColor: 'bg-red-100', textColor: 'text-gray-600' }
  ],
  description = '身材微胖，胖，体脂率高，亚健康人群',
  onRecipeIntroClick,
  introLinkLabel = '食谱介绍',
  className = ''
}) => {
  const showPlanMetrics = !hideDuration && !hideServicePackageSummary;
  const showAudienceCopy = !hideServicePackageSummary;

  const getStartDateDisplay = () => {
    if (startDateStr) return startDateStr;
    if (startDate) return formatMealPlanDate(startDate);
    return '';
  };

  const getEndDateDisplay = () => {
    if (endDateStr) return endDateStr;
    if (endDate) return formatMealPlanDate(endDate);
    return '';
  };

  return (
    <div className={`px-4 mt-6 box-border ${className}`}>
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        {title}
      </h2>
      
      {showPlanMetrics && (
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <div className="text-sm text-gray-500">计划时长</div>
          <div className="text-2xl font-bold text-gray-800">{duration}天</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">开始时间</div>
          <div className="text-2xl font-bold text-gray-800">
            {getStartDateDisplay()}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">结束时间</div>
          <div className="text-2xl font-bold text-gray-800">
            {getEndDateDisplay()}
          </div>
        </div>
      </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {showAudienceCopy &&
          tags.map((tag, index) => (
            <span
              key={index}
              className={`${tag.bgColor} ${tag.textColor} px-3 py-1 rounded-full text-sm`}
            >
              {tag.text}
            </span>
          ))}
        {onRecipeIntroClick && (
          <button
            type="button"
            onClick={onRecipeIntroClick}
            className="flex items-center space-x-1 hover:bg-gray-100 px-2 py-1 rounded-full transition-colors"
          >
            <span className="text-xs text-gray-600">{introLinkLabel}</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {showAudienceCopy && description && (
        <div className="text-sm text-gray-600 mb-4">
          {description}
        </div>
      )}
    </div>
  );
};














