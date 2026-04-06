import { useEffect, useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../config/api';
import SearchableSelect from '../common/SearchableSelect';
import ListPagination from '../common/ListPagination';

const MEAL_TYPES = ['早餐', '午餐', '晚餐'] as const;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// dayPackages[dateStr][mealType] = packageId
type DayPackagesMap = Record<string, Record<string, string>>;

export default function MealScheduleDetailModal({
  id,
  onClose,
  onRefresh,
  initialMode = 'view',
}: {
  id: string;
  onClose: () => void;
  onRefresh?: () => void;
  initialMode?: 'view' | 'edit';
}) {
  const [schedule, setSchedule] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [dayPackages, setDayPackages] = useState<DayPackagesMap>({});
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [previewPackage, setPreviewPackage] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewLimit, setPreviewLimit] = useState(20);

  const previewNutrition = useMemo(() => {
    if (!previewPackage) return null;

    const toNum = (v: any) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const hasPackageTotals =
      previewPackage.total_calories_kcal != null ||
      previewPackage.total_carbohydrate_g != null ||
      previewPackage.total_protein_g != null ||
      previewPackage.total_fat_g != null ||
      previewPackage.total_fiber_g != null;

    if (hasPackageTotals) {
      return {
        calories: toNum(previewPackage.total_calories_kcal),
        carbs: toNum(previewPackage.total_carbohydrate_g),
        protein: toNum(previewPackage.total_protein_g),
        fat: toNum(previewPackage.total_fat_g),
        fiber: toNum(previewPackage.total_fiber_g),
      };
    }

    const totals = (previewPackage.items || []).reduce(
      (acc: any, item: any) => {
        const q = toNum(item.quantity || 1) || 1;
        const dish = item.dishes || {};
        acc.calories += toNum(dish.calories_kcal) * q;
        acc.carbs += toNum(dish.carbohydrate_g) * q;
        acc.protein += toNum(dish.protein_g) * q;
        acc.fat += toNum(dish.fat_g) * q;
        acc.fiber += toNum(dish.fiber_g) * q;
        return acc;
      },
      { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0 }
    );

    return totals;
  }, [previewPackage]);

  useEffect(() => {
    setMode(initialMode);
    loadDetail();
    loadPackages();
  }, [id, initialMode]);
  const loadDetail = async () => {
    try {
      setDetailLoading(true);
      const data = await apiClient.get<{ schedule: any; entries: any[] }>(`/api/admin/menu/meal-schedules/${id}`);
      setSchedule(data.schedule);
      const list = data.entries || [];
      const map: DayPackagesMap = {};
      list.forEach((e: any) => {
        const dateStr = e.date;
        if (!map[dateStr]) map[dateStr] = {};
        // 兼容后端字段 package_type（早餐/午餐/晚餐），旧数据使用 meal_type
        const mealType = e.package_type || e.meal_type;
        if (mealType) {
          map[dateStr][mealType] = e.package_id;
        }
      });
      setDayPackages(map);
    } catch {
      setSchedule(null);
      setDayPackages({});
    } finally {
      setDetailLoading(false);
    }
  };

  const loadPackages = async () => {
    const data = await apiClient.get<{ packages: any[] }>('/api/admin/menu/packages?limit=1000');
    setPackages(data.packages || []);
  };

  const handleClose = () => {
    onRefresh?.();
    onClose();
  };

  const days = useMemo(() => {
    if (!schedule?.start_time) return [];
    const start = new Date(schedule.start_time);
    start.setHours(0, 0, 0, 0);
    const arr: { date: Date; dateStr: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push({
        date: d,
        dateStr: toDateStr(d),
        label: d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }),
      });
    }
    return arr;
  }, [schedule?.start_time]);

  const displayRange = useMemo(() => {
    if (days.length > 0) {
      return {
        start: days[0].date.toLocaleDateString('zh-CN'),
        end: days[days.length - 1].date.toLocaleDateString('zh-CN'),
      };
    }
    return {
      start: schedule?.start_time ? new Date(schedule.start_time).toLocaleDateString('zh-CN') : '-',
      end: schedule?.end_time ? new Date(schedule.end_time).toLocaleDateString('zh-CN') : '-',
    };
  }, [days, schedule?.start_time, schedule?.end_time]);

  const handlePackageChange = (dateStr: string, mealType: string, packageId: string) => {
    setDayPackages((prev) => {
      const day = { ...(prev[dateStr] || {}) };
      if (packageId) {
        day[mealType] = packageId;
      } else {
        delete day[mealType];
      }
      return { ...prev, [dateStr]: day };
    });
  };

  const packagesByMealType = useMemo(() => {
    const m: Record<string, any[]> = {};
    MEAL_TYPES.forEach((mt) => {
      m[mt] = packages.filter((p) => p.package_type === mt);
    });
    return m;
  }, [packages]);

  const packageById = useMemo(() => {
    const m: Record<string, { package_code: string; name: string }> = {};
    packages.forEach((p) => {
      m[p.id] = { package_code: p.package_code, name: p.name };
    });
    return m;
  }, [packages]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entriesToSave: { date: string; package_id: string; package_type: string }[] = [];
      days.forEach((d) => {
        const dayMap = dayPackages[d.dateStr] || {};
        MEAL_TYPES.forEach((mealType) => {
          const pkgId = dayMap[mealType];
          if (pkgId) {
            entriesToSave.push({ date: d.dateStr, package_id: pkgId, package_type: mealType });
          }
        });
      });
      await apiClient.put(`/api/admin/menu/meal-schedules/${id}/entries`, { entries: entriesToSave });
      await loadDetail();
      handleClose();
    } catch (e: any) {
      alert(e?.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const isExpiredDate = (dateStr: string) => dateStr < todayStr;

  const handlePreviewPackage = async (packageId: string) => {
    setPreviewLoading(true);
    setPreviewPackage({ id: packageId, items: [] });
    setPreviewPage(1);
    try {
      const data = await apiClient.get<{ package: any; items: any[] }>(`/api/admin/menu/packages/${packageId}`);
      setPreviewPackage({ ...(data.package || {}), items: data.items || [] });
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || '加载套餐详情失败');
      setPreviewPackage(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewItems = previewPackage?.items || [];
  const previewTotal = previewItems.length;
  const previewTotalPages = Math.max(1, Math.ceil(previewTotal / previewLimit));
  const paginatedPreviewItems = useMemo(() => {
    const start = (previewPage - 1) * previewLimit;
    return previewItems.slice(start, start + previewLimit);
  }, [previewItems, previewPage, previewLimit]);

  useEffect(() => {
    if (previewPage > previewTotalPages) setPreviewPage(previewTotalPages);
  }, [previewPage, previewTotalPages]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">排期详情</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === 'view' ? '查看已配置的套餐' : '配置本周每日三餐套餐，非必填'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' ? (
              <button
                onClick={() => setMode('edit')}
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                编辑
              </button>
            ) : null}
            <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {schedule && (
            <div className="text-sm text-gray-700">
              <div className="mb-2">名称：{schedule.schedule_name}</div>
              <div className="mb-2">
                范围：{displayRange.start} ~ {displayRange.end}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">日期</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">早餐</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">午餐</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">晚餐</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detailLoading ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-500" colSpan={4}>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        加载中...
                      </div>
                    </td>
                  </tr>
                ) : days.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-500" colSpan={4}>
                      排期无有效日期范围
                    </td>
                  </tr>
                ) : (
                  days.map((d) => {
                    const expired = isExpiredDate(d.dateStr);
                    return (
                    <tr key={d.dateStr} className={expired ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                      <td className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${expired ? 'text-gray-400' : ''}`}>{d.label}</td>
                      {MEAL_TYPES.map((mealType) => {
                        const pkgId = dayPackages[d.dateStr]?.[mealType];
                        const pkg = pkgId ? packageById[pkgId] : null;
                        return (
                          <td key={mealType} className="px-2 py-2">
                            {mode === 'view' ? (
                              pkg ? (
                                <button
                                  type="button"
                                  onClick={() => handlePreviewPackage(pkgId)}
                                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm transition-colors ${
                                    expired
                                      ? 'bg-gray-100 text-gray-400 hover:bg-gray-100'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                  title="点击查看套餐详情"
                                >
                                  {pkg.name}
                                </button>
                              ) : (
                                <span className={`text-sm ${expired ? 'text-gray-400' : 'text-gray-700'}`}>—</span>
                              )
                            ) : (
                              expired ? (
                                pkg ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm bg-gray-100 text-gray-500 cursor-not-allowed">
                                    {pkg.name}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm bg-gray-100 text-gray-400 cursor-not-allowed">
                                    已过期不可修改
                                  </span>
                                )
                              ) : (
                                <SearchableSelect
                                  value={pkgId || ''}
                                  onChange={(value) => handlePackageChange(d.dateStr, mealType, value)}
                                  options={[
                                    { value: '', label: '选填' },
                                    ...(packagesByMealType[mealType]?.map((p) => ({
                                      value: p.id,
                                      label: p.name,
                                      keywords: [p.package_code, p.name, p.package_type],
                                    })) || []),
                                  ]}
                                  placeholder="选填"
                                  searchPlaceholder="输入套餐编号/名称搜索"
                                  emptyText="没有匹配套餐"
                                  className="min-w-[180px]"
                                />
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-2 gap-2">
            {mode === 'edit' && (
              <button
                onClick={handleSave}
                disabled={saving || days.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '确定'}
              </button>
            )}
            {mode === 'view' && (
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      </div>

      {previewPackage && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[88vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">套餐预览 - {previewPackage.name || previewPackage.package_code || ''}</h3>
              <button onClick={() => setPreviewPackage(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {previewLoading ? (
                <p className="text-sm text-gray-500">加载中...</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">套餐类型</p>
                      <p className="font-medium">{previewPackage.package_type || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">供应日期</p>
                      <p className="font-medium">{previewPackage.supply_date || '-'}</p>
                    </div>
                  </div>
                  {previewNutrition && (
                    <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="text-sm font-medium text-emerald-800 mb-2">套餐总热量与营养成分</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        <div className="rounded bg-white/80 px-2 py-1">
                          <p className="text-gray-500 text-xs">总热量</p>
                          <p className="font-semibold text-gray-900">{previewNutrition.calories.toFixed(1)} kcal</p>
                        </div>
                        <div className="rounded bg-white/80 px-2 py-1">
                          <p className="text-gray-500 text-xs">碳水</p>
                          <p className="font-semibold text-gray-900">{previewNutrition.carbs.toFixed(1)} g</p>
                        </div>
                        <div className="rounded bg-white/80 px-2 py-1">
                          <p className="text-gray-500 text-xs">蛋白质</p>
                          <p className="font-semibold text-gray-900">{previewNutrition.protein.toFixed(1)} g</p>
                        </div>
                        <div className="rounded bg-white/80 px-2 py-1">
                          <p className="text-gray-500 text-xs">脂肪</p>
                          <p className="font-semibold text-gray-900">{previewNutrition.fat.toFixed(1)} g</p>
                        </div>
                        <div className="rounded bg-white/80 px-2 py-1">
                          <p className="text-gray-500 text-xs">膳食纤维</p>
                          <p className="font-semibold text-gray-900">{previewNutrition.fiber.toFixed(1)} g</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {previewTotal > 0 ? (
                      paginatedPreviewItems.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded bg-gray-50">
                          <span>
                            {item.dishes?.name || '-'}（{item.dishes?.dish_code || '-'}）
                            {item.dishes?.dish_type ? (
                              <span className="ml-2 inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">{item.dishes.dish_type}</span>
                            ) : null}
                          </span>
                          <span className="text-sm text-gray-500">x{item.quantity || 1}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">暂无菜品</p>
                    )}
                  </div>
                  {previewTotal > 0 ? (
                    <ListPagination
                      page={previewPage}
                      totalPages={previewTotalPages}
                      total={previewTotal}
                      limit={previewLimit}
                      onPageChange={setPreviewPage}
                      onLimitChange={(nextLimit) => {
                        setPreviewLimit(nextLimit);
                        setPreviewPage(1);
                      }}
                      className="mt-4"
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
