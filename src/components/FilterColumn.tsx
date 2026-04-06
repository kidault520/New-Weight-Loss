import React from 'react';
import { Check, Edit2 } from 'lucide-react';

interface FilterColumnProps {
  items: Array<{
    id: string;
    label: string;
    sublabel?: string;
    isActive?: boolean;
    lockStatus?: 'none' | 'partial' | 'full';
  }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
  showEditButton?: boolean;
  onEdit?: (id: string) => void;
}

const FilterColumn: React.FC<FilterColumnProps> = ({
  items,
  selectedId,
  onSelect,
  emptyMessage = '暂无选项',
  showEditButton = false,
  onEdit
}) => {
  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full text-left px-3 py-3.5 transition-all relative flex items-center justify-between group border-b border-gray-100 last:border-b-0 ${
                selectedId === item.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex-1 min-w-0 mr-2">
                <div className={`text-sm truncate ${selectedId === item.id ? 'font-medium' : 'font-normal'}`}>
                  {item.label}
                </div>
                {item.sublabel && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {item.sublabel}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {showEditButton && onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(item.id);
                    }}
                    className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                )}
                {item.lockStatus && (
                  <Check
                    className={`w-4 h-4 flex-shrink-0 ${
                      item.lockStatus === 'full' ? 'text-green-600' :
                      item.lockStatus === 'partial' ? 'text-yellow-600' :
                      'text-gray-400'
                    }`}
                    strokeWidth={3}
                  />
                )}
                {selectedId === item.id && !item.lockStatus && (
                  <Check className="w-4 h-4 text-blue-600 flex-shrink-0" strokeWidth={3} />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterColumn;
