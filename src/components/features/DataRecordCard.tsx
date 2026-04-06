 
import { Edit2, Trash2 } from 'lucide-react';
import { RecordSourceTag, extractRecordSource, extractDeviceName } from '../common/RecordSourceTag';
import { formatTimeChinese } from '../../utils/dateUtils';

export interface DataRecord {
  id: string;
  value: number;
  unit?: string;
  recorded_at: string;
  notes?: string;
  // 扩展数据（用于特殊类型）
  exercise_data?: any;
  measurement_data?: any;
  nutrition_data?: any;
}

interface DataRecordCardProps {
  record: DataRecord;
  formatValue?: (value: number) => string | number;
  /** 主数值样式（如睡眠时长文案较长时用较小字号避免换行错乱） */
  valueClassName?: string;
  showSourceTag?: boolean;
  showNotes?: boolean;
  onEdit?: (record: DataRecord) => void;
  onDelete?: (record: DataRecord) => void;
  isDeleting?: boolean;
  className?: string;
  highlightSource?: ('guide' | 'onboarding')[];
  defaultSourceToManual?: boolean;
}

export function DataRecordCard({
  record,
  formatValue = (v) => v,
  valueClassName = 'text-2xl font-bold text-gray-800',
  showSourceTag = true,
  showNotes = true,
  onEdit,
  onDelete,
  isDeleting = false,
  className = '',
  highlightSource = ['guide', 'onboarding'],
  defaultSourceToManual = false
}: DataRecordCardProps) {
  const recordSource = extractRecordSource(record.notes, defaultSourceToManual);
  const deviceName = extractDeviceName(record.notes);
  const hasSourceTag = recordSource !== null;
  const isHighlighted = recordSource && highlightSource.includes(recordSource as any);

  // 过滤掉来源标签相关的notes
  const shouldShowNotes = showNotes && record.notes && 
    !record.notes.includes('手动记录') && 
    !record.notes.includes('AI记录') && 
    !record.notes.includes('AI创建') &&
    !record.notes.includes('初始体重记录') &&
    !record.notes.includes('引导记录') &&
    !(record.notes.includes('记录') && !record.notes.includes('手动') && !record.notes.includes('AI'));

  const displayValue = formatValue(record.value);

  return (
    <div
      className={`bg-gray-50 rounded-xl p-4 transition-opacity relative ${
        isDeleting ? 'opacity-50' : ''
      } ${
        isHighlighted ? 'border-2 border-emerald-200 bg-emerald-50/50' : ''
      } ${className}`}
    >
      {showSourceTag && recordSource && (
        <RecordSourceTag 
          source={recordSource} 
          deviceName={deviceName || undefined}
        />
      )}

      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mb-1 min-w-0">
            <span className={valueClassName}>
              {typeof displayValue === 'number' ? displayValue.toFixed(record.unit === 'kg' ? 1 : 0) : displayValue}
            </span>
            {record.unit && (
              <span className="text-sm text-gray-500">{record.unit}</span>
            )}
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {formatTimeChinese(record.recorded_at)}
            </span>
          </div>
          {shouldShowNotes && (
            <div className="text-sm text-gray-600 mt-2">{record.notes}</div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex space-x-2 ml-4" style={{ marginTop: hasSourceTag ? '24px' : '0' }}>
            {onEdit && (
              <button
                onClick={() => onEdit(record)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isDeleting}
              >
                <Edit2 className="w-4 h-4 text-gray-500" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(record)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

