type ListPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (nextPage: number) => void;
  onLimitChange?: (nextLimit: number) => void;
  className?: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

export default function ListPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  className = '',
}: ListPaginationProps) {
  if (totalPages <= 1 && !onLimitChange) return null;

  const safePage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));

  return (
    <div className={`mt-6 flex items-center justify-between gap-3 ${className}`.trim()}>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span>共 {total} 条记录</span>
        {onLimitChange ? (
          <div className="flex items-center gap-2">
            <span>每页</span>
            <select
              value={String(limit)}
              onChange={(e) => onLimitChange(Number(e.target.value) || 20)}
              className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-700"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>条</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className={`px-3 py-1 rounded border ${
            safePage <= 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          上一页
        </button>
        <span className="text-sm text-gray-600">
          第 {safePage} / {Math.max(totalPages, 1)} 页
        </span>
        <button
          onClick={() => onPageChange(Math.min(Math.max(totalPages, 1), safePage + 1))}
          disabled={safePage >= Math.max(totalPages, 1)}
          className={`px-3 py-1 rounded border ${
            safePage >= Math.max(totalPages, 1)
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
