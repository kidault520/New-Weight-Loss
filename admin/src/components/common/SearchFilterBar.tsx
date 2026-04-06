/**
 * 统一搜索与筛选顶部栏（按截图样式）
 * - 搜索框：左侧放大镜、占位符、右侧下拉箭头
 * - 筛选按钮：青绿色系
 */
import { useState } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface FilterFieldOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** 该字段的可选值（用于下拉选择） */
  options?: { value: string; label: string }[];
}

export interface SearchFilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSearch?: () => void;
  filterFields?: FilterFieldOption[];
  filterConditions?: FilterCondition[];
  onFilterConditionsChange?: (conditions: FilterCondition[]) => void;
  onFilterApply?: () => void;
  onFilterClear?: () => void;
  rightSlot?: React.ReactNode;
  /** 是否显示高级筛选面板 */
  showAdvancedFilter?: boolean;
}

export default function SearchFilterBar({
  searchPlaceholder = '搜索数据',
  searchValue,
  onSearchChange,
  onSearch,
  filterFields = [],
  filterConditions = [],
  onFilterConditionsChange,
  onFilterApply,
  onFilterClear,
  rightSlot,
  showAdvancedFilter = true,
}: SearchFilterBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterLogic, setFilterLogic] = useState<'all' | 'any'>('all');

  const handleAddCondition = () => {
    if (!onFilterConditionsChange || filterFields.length === 0) return;
    onFilterConditionsChange([
      ...filterConditions,
      {
        id: `f-${Date.now()}`,
        field: filterFields[0].value,
        operator: 'eq',
        value: '',
      },
    ]);
  };

  const handleRemoveCondition = (id: string) => {
    if (!onFilterConditionsChange) return;
    onFilterConditionsChange(filterConditions.filter((c) => c.id !== id));
  };

  const handleConditionChange = (id: string, key: keyof FilterCondition, val: string) => {
    if (!onFilterConditionsChange) return;
    onFilterConditionsChange(
      filterConditions.map((c) => (c.id === id ? { ...c, [key]: val } : c))
    );
  };

  return (
    <div className="space-y-2">
      {/* 顶部栏：搜索 + 筛选按钮 + 图标 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch?.()}
              className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/25"
            />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer" />
          </div>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filterOpen || filterConditions.length > 0
                ? 'bg-teal-50 border-teal-300 text-teal-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选
            {filterConditions.length > 0 && (
              <span className="ml-0.5 bg-teal-500 text-white text-xs px-1.5 rounded">
                {filterConditions.length}
              </span>
            )}
          </button>
        </div>
        {rightSlot}
      </div>

      {/* 高级筛选面板 */}
      {showAdvancedFilter && filterOpen && (
        <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">筛选出符合以下</span>
            <select
              value={filterLogic}
              onChange={(e) => setFilterLogic(e.target.value as 'all' | 'any')}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="all">所有</option>
              <option value="any">任意</option>
            </select>
            <span className="text-sm text-gray-600">条件的数据</span>
          </div>
          <button
            onClick={handleAddCondition}
            className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700 text-sm font-medium mb-3"
          >
            <span className="text-lg font-bold">+</span>
            添加过滤条件
          </button>
          {filterConditions.length > 0 && (
            <div className="space-y-2 mb-4">
              {filterConditions.map((cond) => (
                <div
                  key={cond.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <select
                    value={cond.field}
                    onChange={(e) => handleConditionChange(cond.id, 'field', e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-0"
                  >
                    {filterFields.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => handleConditionChange(cond.id, 'operator', e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm w-32"
                  >
                    <option value="eq">等于</option>
                    <option value="eq_any">等于任意一个</option>
                    <option value="neq">不等于</option>
                    <option value="contains">包含</option>
                    <option value="range">选择范围</option>
                  </select>
                  {(() => {
                    const fieldOpt = filterFields.find((f) => f.value === cond.field);
                    const options = fieldOpt?.options;
                    if (options && options.length > 0) {
                      return (
                        <select
                          value={cond.value}
                          onChange={(e) => handleConditionChange(cond.id, 'value', e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-0"
                        >
                          <option value="">请选择</option>
                          {options.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        type="text"
                        value={cond.value}
                        onChange={(e) => handleConditionChange(cond.id, 'value', e.target.value)}
                        placeholder="输入值"
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-0"
                      />
                    );
                  })()}
                  <button
                    onClick={() => handleRemoveCondition(cond.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onFilterApply}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600"
            >
              筛选
            </button>
            <button
              onClick={() => {
                onFilterClear?.();
                onFilterConditionsChange?.([]);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清空
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
