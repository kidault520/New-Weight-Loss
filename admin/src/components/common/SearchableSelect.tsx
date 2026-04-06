import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  keywords?: string[];
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** 禁用时渲染为普通只读框（无搜索/箭头），与锁定表单中的 input 一致 */
  plainWhenDisabled?: boolean;
  required?: boolean;
  loading?: boolean;
  emptyText?: string;
  className?: string;
  showSearchHint?: boolean;
}

const normalize = (text: string) => text.toLowerCase().trim();

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = '请选择',
  searchPlaceholder = '输入关键词搜索...',
  disabled = false,
  plainWhenDisabled = false,
  required = false,
  loading = false,
  emptyText = '未找到匹配项',
  className = '',
  showSearchHint = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  /** 未选真实值（value 为空）时不能把 query 设成「请选择」等占位文案，否则再次打开会用该字符串过滤，列表只剩占位项 */
  useEffect(() => {
    if (!isOpen) {
      setQuery(value !== '' && selected?.label ? selected.label : '');
    }
  }, [isOpen, selected, value]);

  const filteredOptions = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((option) => {
      const labelMatch = normalize(option.label).includes(q);
      const keywordsMatch = (option.keywords || []).some((keyword) => normalize(keyword).includes(q));
      return labelMatch || keywordsMatch;
    });
  }, [options, query]);

  if (disabled && plainWhenDisabled) {
    const text = selected?.label || placeholder || '—';
    return (
      <div className={`relative w-full ${className}`}>
        <div
          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-700 text-sm min-h-[2.5rem] flex items-center"
          title={text}
        >
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => !disabled && setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onChange('');
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsOpen(false);
              setQuery(value !== '' && selected?.label ? selected.label : '');
            }, 120);
          }}
          placeholder={selected ? selected.label : placeholder}
          disabled={disabled}
          required={required}
          className="w-full pl-9 pr-16 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        />

        {!disabled && value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setIsOpen(true);
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="清空选择"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="展开下拉"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500">加载中...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyText}</div>
          ) : (
            filteredOptions.map((option, idx) => (
              <button
                key={`${option.value}::${option.label}::${idx}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setQuery(option.label);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                  value === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}

      {required && <input type="hidden" value={value} required readOnly />}
      {showSearchHint && (
        <div className={`mt-1 min-h-[1.25rem] text-xs text-gray-500 ${!isOpen ? 'invisible' : ''}`}>
          {searchPlaceholder}
        </div>
      )}
    </div>
  );
}
