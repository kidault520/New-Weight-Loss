import React from 'react';
import { DataRecordCard, DataRecord } from './DataRecordCard';
import { EmptyState } from '../common/EmptyState';
import { LoadingState } from '../common/LoadingState';
import { SectionCard } from '../common/SectionCard';

// 重新导出 DataRecord 类型，供其他组件使用
export type { DataRecord };

export interface GroupedRecords {
  [date: string]: DataRecord[];
}

interface DataRecordListProps {
  records: DataRecord[];
  groupedRecords?: GroupedRecords;
  isLoading?: boolean;
  formatValue?: (value: number) => string | number;
  showSourceTag?: boolean;
  showNotes?: boolean;
  onEdit?: (record: DataRecord) => void;
  onDelete?: (record: DataRecord) => void;
  deletingRecordId?: string | null;
  emptyStateIcon?: React.ReactNode;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  sectionTitle?: string;
  sectionIcon?: React.ReactNode;
  groupByDate?: boolean;
  className?: string;
  highlightSource?: ('guide' | 'onboarding')[];
  defaultSourceToManual?: boolean;
  /** 传给每条记录主数值的 className */
  valueClassName?: string;
}

export function DataRecordList({
  records = [],
  groupedRecords,
  isLoading = false,
  formatValue,
  showSourceTag = true,
  showNotes = true,
  onEdit,
  onDelete,
  deletingRecordId = null,
  emptyStateIcon,
  emptyStateTitle = '暂无记录',
  emptyStateDescription = '请点击右上「+」添加',
  sectionTitle = '记录',
  sectionIcon,
  groupByDate = true,
  className = '',
  highlightSource = ['guide', 'onboarding'],
  defaultSourceToManual = false,
  valueClassName
}: DataRecordListProps) {
  // 如果没有提供groupedRecords，则根据records生成
  const getGroupedRecords = (): GroupedRecords => {
    if (groupedRecords) {
      return groupedRecords;
    }

    if (!groupByDate) {
      return { '': records };
    }

    const grouped: GroupedRecords = {};
    records.forEach(record => {
      const date = new Date(record.recorded_at);
      const dateKey = `${date.getMonth() + 1}月${date.getDate()}日`;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(record);
    });

    return grouped;
  };

  const finalGroupedRecords = getGroupedRecords();
  const hasRecords = Object.keys(finalGroupedRecords).length > 0 && 
    Object.values(finalGroupedRecords).some(group => group.length > 0);

  if (isLoading) {
    return (
      <SectionCard className={`my-1 ${className}`}>
        {sectionTitle && (
          <div className="flex items-center space-x-2 mb-6">
            {sectionIcon && (
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                {sectionIcon}
              </div>
            )}
            <span className="text-lg font-medium text-gray-700">{sectionTitle}</span>
          </div>
        )}
        <LoadingState spinnerColor="text-blue-400" />
      </SectionCard>
    );
  }

  if (!hasRecords) {
    return (
      <SectionCard className={`my-1 ${className}`}>
        {sectionTitle && (
          <div className="flex items-center space-x-2 mb-6">
            {sectionIcon && (
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                {sectionIcon}
              </div>
            )}
            <span className="text-lg font-medium text-gray-700">{sectionTitle}</span>
          </div>
        )}
        <EmptyState
          icon={emptyStateIcon}
          title={emptyStateTitle}
          description={emptyStateDescription}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard className={`my-1 ${className}`}>
      {sectionTitle && (
        <div className="flex items-center space-x-2 mb-6">
          {sectionIcon && (
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              {sectionIcon}
            </div>
          )}
          <span className="text-lg font-medium text-gray-700">{sectionTitle}</span>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(finalGroupedRecords).map(([date, dateRecords]) => (
          <div key={date}>
            {groupByDate && date && (
              <div className="text-sm font-medium text-gray-500 mb-2">{date}</div>
            )}
            <div className="space-y-2">
              {dateRecords.map((record) => (
                <DataRecordCard
                  key={record.id}
                  record={record}
                  formatValue={formatValue}
                  valueClassName={valueClassName}
                  showSourceTag={showSourceTag}
                  showNotes={showNotes}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isDeleting={deletingRecordId === record.id}
                  highlightSource={highlightSource}
                  defaultSourceToManual={defaultSourceToManual}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}











