/**
 * 补剂疗程管理 - 功能合并：疗程名称、总天数、阶段排期统一在一个表单中
 * 不再区分「补剂疗程」与「补剂排期」两个独立区块
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2, Loader2 } from 'lucide-react';
import { apiClient } from '../../config/api';
import SearchableSelect from '../common/SearchableSelect';
import ListPagination from '../common/ListPagination';
import {
  ENTITY_DELETE_BLOCKED_IN_SERVICE,
  LIST_SERVICE_STRUCTURE_LOCKED_BADGE,
  SUPPLEMENT_SCHEDULE_SERVICE_STRUCTURE_BANNER,
} from '../../config/serviceStructureUi';

interface Stage {
  stage_name: string;
  duration_days: number;
  supplement_items: Array<{
    supplement_id?: string;
    per_day_qty?: number;
  }>;
}

interface Supplement {
  id: string;
  name: string;
  item_code?: string;
}

export default function SupplementCourseManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [totalDays, setTotalDays] = useState<number | ''>('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  /** 与商品一致：仅锁结构字段，名称仍可改（来自详情接口 structure_in_service） */
  const [structureInServiceForm, setStructureInServiceForm] = useState(false);
  /** 关联 supplement_plans.plan_code（STP），与商品补剂疗程一致 */
  const [editingCoursePlanCode, setEditingCoursePlanCode] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; schedule_name: string } | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<{
    schedule: any;
    stages: any[];
    /** 仅阶段列表异步拉取；头部信息来自列表卡片，无需等接口 */
    stagesLoading?: boolean;
  } | null>(null);
  /** 编辑弹窗：先打开再拉详情，避免长时间无反馈 */
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSupplements = useCallback(async () => {
    try {
      const data = await apiClient.get<{ supplements: any[] }>('/api/admin/content/supplements?limit=1000');
      setSupplements(
        (data.supplements || []).map((s) => ({ id: s.id, name: s.name, item_code: s.item_code })),
      );
    } catch {
      /* ignore */
    }
  }, []);

  /** 仅打开表单时需要补剂下拉，避免进入「补剂疗程」页就拉全量产品拖慢首屏 */
  useEffect(() => {
    if (!showForm || supplements.length > 0) return;
    void loadSupplements();
  }, [showForm, supplements.length, loadSupplements]);

  const loadSchedules = async () => {
    try {
      const data = await apiClient.get<{ schedules: any[] }>('/api/admin/menu/supplement-schedules');
      setSchedules(data.schedules || []);
    } catch {}
  };

  const addStageRow = () => {
    setStages([
      ...stages,
      {
        stage_name: '',
        duration_days: 1,
        supplement_items: [{ supplement_id: undefined, per_day_qty: 1 }],
      },
    ]);
  };

  const updateStage = (index: number, field: keyof Stage, value: any) => {
    const next = [...stages];
    if (field === 'duration_days') {
      const num = Math.max(1, parseInt(String(value)) || 1);
      const othersSum = next.reduce((acc, s, i) => (i === index ? acc : acc + (s.duration_days || 0)), 0);
      const total = typeof totalDays === 'number' ? totalDays : 999;
      const maxAllowed = Math.max(1, total - othersSum);
      (next[index] as any)[field] = Math.min(num, maxAllowed);
    } else {
      (next[index] as any)[field] = value;
    }
    setStages(next);
  };

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const addStageSupplementItem = (stageIndex: number) => {
    setStages((prev) => {
      const next = [...prev];
      next[stageIndex] = {
        ...next[stageIndex],
        supplement_items: [...(next[stageIndex].supplement_items || []), { supplement_id: undefined, per_day_qty: 1 }],
      };
      return next;
    });
  };

  const updateStageSupplementItem = (
    stageIndex: number,
    itemIndex: number,
    field: 'supplement_id' | 'per_day_qty',
    value: string | number | undefined,
  ) => {
    setStages((prev) => {
      const next = [...prev];
      const stage = next[stageIndex];
      const items = [...(stage.supplement_items || [])];
      const current = { ...(items[itemIndex] || {}) };
      if (field === 'per_day_qty') {
        current.per_day_qty = Math.max(1, parseInt(String(value)) || 1);
      } else {
        const newId = (value as string) || undefined;
        if (newId) {
          const dup = items.some((it, idx) => idx !== itemIndex && it.supplement_id === newId);
          if (dup) {
            alert('该阶段已选择此补剂，请勿重复添加；需要加量请改「一天颗数」');
            return prev;
          }
        }
        current.supplement_id = newId;
      }
      items[itemIndex] = current;
      next[stageIndex] = { ...stage, supplement_items: items };
      return next;
    });
  };

  const removeStageSupplementItem = (stageIndex: number, itemIndex: number) => {
    setStages((prev) => {
      const next = [...prev];
      const stage = next[stageIndex];
      const items = (stage.supplement_items || []).filter((_, idx) => idx !== itemIndex);
      next[stageIndex] = {
        ...stage,
        supplement_items: items.length > 0 ? items : [{ supplement_id: undefined, per_day_qty: 1 }],
      };
      return next;
    });
  };

  const saveCourse = async () => {
    if (isSaving) return;

    if (!courseName?.trim()) {
      alert('请填写疗程名称');
      return;
    }

    if (editingId && structureInServiceForm) {
      try {
        setIsSaving(true);
        await apiClient.put(`/api/admin/menu/supplement-schedules/${editingId}`, {
          schedule_name: courseName.trim(),
        });
        alert('疗程名称已更新');
        setShowForm(false);
        setEditingId(null);
        setStructureInServiceForm(false);
        setEditingCoursePlanCode(null);
        setCourseName('');
        setTotalDays('');
        setStages([]);
        loadSchedules();
      } catch (e: any) {
        alert(e?.message || '保存失败');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const totalNum = typeof totalDays === 'number' ? totalDays : (totalDays === '' ? 0 : parseInt(String(totalDays)) || 0);
    if (!totalNum || totalNum < 1) {
      alert('请填写总天数');
      return;
    }

    // 3. 阶段排期必填：至少添加一个阶段
    if (stages.length === 0) {
      alert('请添加阶段排期，点击「添加阶段」按钮');
      return;
    }

    // 4. 每个阶段的所有字段必填
    const missing: string[] = [];
    stages.forEach((s, i) => {
      if (!s.stage_name?.trim()) missing.push(`第${i + 1}阶段名称`);
      if (!(s.duration_days >= 1)) missing.push(`第${i + 1}阶段持续天数`);
      if (!s.supplement_items || s.supplement_items.length === 0) {
        missing.push(`第${i + 1}阶段补剂明细`);
      } else {
        s.supplement_items.forEach((item, itemIdx) => {
          if (!item.supplement_id) missing.push(`第${i + 1}阶段第${itemIdx + 1}个补剂`);
          if (!((item.per_day_qty ?? 0) >= 1)) missing.push(`第${i + 1}阶段第${itemIdx + 1}个补剂一天颗数`);
        });
      }
    });
    if (missing.length > 0) {
      alert('请完整填写阶段排期：\n' + missing.join('、'));
      return;
    }

    for (let si = 0; si < stages.length; si++) {
      const ids = (stages[si].supplement_items || [])
        .map((it) => it.supplement_id)
        .filter((id): id is string => Boolean(id));
      if (new Set(ids).size !== ids.length) {
        alert(`第${si + 1}阶段内不能重复选择同一种补剂，请删除重复行或合并每日颗数`);
        return;
      }
    }

    const validStages = stages
      .filter((s) => s.stage_name?.trim() && s.duration_days >= 1)
      .map((s) => ({
        stage_name: s.stage_name.trim(),
        duration_days: s.duration_days,
        // 兼容老接口字段，保留第一条补剂
        supplement_id: s.supplement_items?.[0]?.supplement_id || undefined,
        per_day_qty: s.supplement_items?.[0]?.per_day_qty ?? 1,
        supplement_items: (s.supplement_items || [])
          .filter((item) => item.supplement_id && (item.per_day_qty ?? 0) >= 1)
          .map((item) => ({
            supplement_id: item.supplement_id!,
            per_day_qty: item.per_day_qty ?? 1,
          })),
      }));
    const sumDays = validStages.reduce((acc, s) => acc + (s.duration_days || 0), 0);
    if (sumDays !== totalNum) {
      alert(`阶段持续天数之和(${sumDays})需等于总天数(${totalNum})`);
      return;
    }

    try {
      setIsSaving(true);
      if (editingId) {
        await apiClient.put(`/api/admin/menu/supplement-schedules/${editingId}`, {
          schedule_name: courseName.trim(),
          total_days: totalNum,
          stages: validStages,
        });
        alert('补剂疗程已更新');
      } else {
        await apiClient.post('/api/admin/menu/supplement-schedules', {
          schedule_name: courseName.trim(),
          total_days: totalNum,
          stages: validStages,
          create_plan: true,
        });
        alert('补剂疗程已保存');
      }
      setShowForm(false);
      setEditingId(null);
      setStructureInServiceForm(false);
      setEditingCoursePlanCode(null);
      setCourseName('');
      setTotalDays('');
      setStages([]);
      loadSchedules();
    } catch (e: any) {
      const msg = e?.message || e?.response?.data?.error || '保存失败';
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setIsFormLoading(false);
    setEditingId(null);
    setStructureInServiceForm(false);
    setEditingCoursePlanCode(null);
    setCourseName('');
    setTotalDays('');
    setStages([]);
  };

  const handleEdit = async (s: any) => {
    if (!s?.id) return;
    setShowForm(true);
    setIsFormLoading(true);
    setEditingId(s.id);
    setStructureInServiceForm(false);
    setEditingCoursePlanCode(null);
    setCourseName(typeof s.schedule_name === 'string' ? s.schedule_name : '');
    setTotalDays('');
    setStages([]);
    try {
      const data = await apiClient.get<{ schedule: any; stages: any[] }>(`/api/admin/menu/supplement-schedules/${s.id}`);
      const sch = data.schedule;
      const sts = (data.stages || []).map((st: any) => ({
        stage_name: st.stage_name,
        duration_days: st.duration_days,
        supplement_items: Array.isArray(st.supplement_items) && st.supplement_items.length > 0
          ? st.supplement_items.map((item: any) => ({
              supplement_id: item.supplement_id || item.supplements?.id,
              per_day_qty: item.per_day_qty ?? 1,
            }))
          : [
              {
                supplement_id: st.supplement_id || st.supplement_products?.id,
                per_day_qty: st.per_day_qty ?? 1,
              },
            ],
      }));
      setCourseName(sch.schedule_name || '');
      setTotalDays(sch.total_days || 30);
      setStages(
        sts.length > 0
          ? sts
          : [{ stage_name: '', duration_days: 1, supplement_items: [{ supplement_id: undefined, per_day_qty: 1 }] }],
      );
      setStructureInServiceForm(!!(sch.structure_in_service ?? s.structure_in_service));
      setEditingCoursePlanCode(sch.course_plan_code || null);
    } catch (e: any) {
      alert(e?.message || '加载详情失败');
      setShowForm(false);
      setEditingId(null);
      setCourseName('');
      setTotalDays('');
      setStages([]);
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleViewDetails = (s: any) => {
    setSelectedSchedule({
      schedule: { ...s, structure_in_service: s.structure_in_service },
      stages: [],
      stagesLoading: true,
    });
    void (async () => {
      try {
        /** 使用既有 GET /:id（避免未重启后端时 /:id/stages 返回 Route not found） */
        const data = await apiClient.get<{ schedule: any; stages: any[] }>(
          `/api/admin/menu/supplement-schedules/${s.id}`,
        );
        setSelectedSchedule((prev) =>
          prev && prev.schedule?.id === s.id
            ? {
                ...prev,
                schedule: {
                  ...data.schedule,
                  structure_in_service: s.structure_in_service,
                },
                stages: data.stages || [],
                stagesLoading: false,
              }
            : prev,
        );
      } catch (e: any) {
        setSelectedSchedule((prev) => (prev && prev.schedule?.id === s.id ? null : prev));
        alert(e?.message || '加载阶段排期失败');
      }
    })();
  };

  const handleDeleteClick = (s: any) => {
    if (s.structure_in_service) {
      alert(ENTITY_DELETE_BLOCKED_IN_SERVICE);
      return;
    }
    setDeleteConfirmTarget({ id: s.id, schedule_name: s.schedule_name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmTarget) return;
    try {
      setIsDeleting(true);
      await apiClient.delete(`/api/admin/menu/supplement-schedules/${deleteConfirmTarget.id}`);
      setDeleteConfirmTarget(null);
      loadSchedules();
      alert('已删除');
    } catch (e: any) {
      alert(e?.message || e?.response?.data?.error || '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const total = schedules.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedSchedules = useMemo(() => {
    const start = (page - 1) * limit;
    return schedules.slice(start, start + limit);
  }, [schedules, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">补剂疗程</h2>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setStructureInServiceForm(false);
            setEditingCoursePlanCode(null);
            setCourseName('');
            setTotalDays('');
            setStages([]);
            setShowForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加补剂疗程
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6 relative">
              {isFormLoading ? (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/80 backdrop-blur-[1px]"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
                  <span className="text-sm text-gray-600">正在加载疗程详情…</span>
                </div>
              ) : null}
              <div className="relative z-20 flex justify-between items-start mb-4 gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{editingId ? '编辑补剂疗程' : '添加补剂疗程'}</h3>
                </div>
                <button type="button" onClick={handleCancel} className="text-gray-500 hover:text-gray-700 shrink-0 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

          {structureInServiceForm && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {SUPPLEMENT_SCHEDULE_SERVICE_STRUCTURE_BANNER}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {editingId && editingCoursePlanCode ? (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    疗程编号（STP）
                    <span className="ml-2 text-xs text-gray-500 font-normal">(STP0001)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={editingCoursePlanCode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm text-gray-800 cursor-default"
                  />
                </div>
              ) : null}
              {!editingId ? (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    疗程编号（STP）
                    <span className="ml-2 text-xs text-gray-500 font-normal">(STP0001)</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value=""
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="留空自动生成，格式: STP0001"
                  />
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium mb-1">疗程名称 *</label>
                <input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="如：基础营养疗程"
                />
              </div>
              <div
                className={
                  structureInServiceForm
                    ? 'rounded-lg border border-gray-200 bg-gray-100 p-3'
                    : ''
                }
              >
                <label className="block text-sm font-medium mb-1">
                  总天数 *
                  {structureInServiceForm ? (
                    <span className="ml-2 text-xs font-normal text-amber-800">已锁定</span>
                  ) : null}
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={structureInServiceForm}
                  value={totalDays === '' ? '' : totalDays}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTotalDays(v === '' ? '' : Math.max(1, parseInt(v) || 1));
                  }}
                  placeholder="请输入"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    structureInServiceForm
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'border-gray-300 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            <div
              className={`border-t border-gray-200 pt-4 w-full ${
                structureInServiceForm
                  ? 'rounded-lg border border-gray-200 bg-gray-100 px-3 pb-3 -mt-1 pt-4'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">
                  阶段排期 *
                  {structureInServiceForm ? (
                    <span className="ml-2 text-xs font-normal text-amber-800">已锁定</span>
                  ) : null}
                </h4>
                <button
                  type="button"
                  onClick={addStageRow}
                  disabled={structureInServiceForm}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 mr-1" /> 添加阶段
                </button>
              </div>

              <div className="space-y-3 w-full">
                {stages.length > 0 && (() => {
                  const sumDays = stages.reduce((a, s) => a + (s.duration_days || 0), 0);
                  const totalNum = typeof totalDays === 'number' ? totalDays : (totalDays === '' ? 0 : parseInt(String(totalDays)) || 0);
                  const isMatch = totalNum > 0 && sumDays === totalNum;
                  return (
                    <div className="flex items-center gap-2 py-1 text-sm">
                      <span className="text-gray-600">阶段天数合计：</span>
                      <span className={`font-medium ${isMatch ? 'text-green-600' : 'text-amber-600'}`}>
                        {sumDays}
                      </span>
                      <span className="text-gray-500">/ 总天数：{totalDays === '' ? '请填写' : totalDays}</span>
                      {!isMatch && totalNum > 0 && (
                        <span className="text-amber-600 text-xs">（需等于总天数）</span>
                      )}
                    </div>
                  );
                })()}
                {stages.map((stage, i) => (
                  <div
                    key={i}
                    className={`p-4 border rounded-lg w-full ${
                      structureInServiceForm
                        ? 'bg-white/80 border-gray-300'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11.5rem] gap-4 items-end">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium mb-1 text-blue-600">阶段名称 *</label>
                        <input
                          value={stage.stage_name}
                          disabled={structureInServiceForm}
                          onChange={(e) => updateStage(i, 'stage_name', e.target.value)}
                          className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                          placeholder="阶段名称"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium mb-1">持续天数（天）*</label>
                        <input
                          type="number"
                          min={1}
                          max={typeof totalDays === 'number' ? totalDays : 999}
                          disabled={structureInServiceForm}
                          value={stage.duration_days}
                          onChange={(e) => updateStage(i, 'duration_days', e.target.value)}
                          className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                          placeholder="1"
                        />
                      </div>
                      <div className="flex justify-end items-end pb-0.5">
                        <button
                          type="button"
                          onClick={() => removeStage(i)}
                          disabled={structureInServiceForm}
                          className="p-2 text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {(stage.supplement_items || []).map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11.5rem] gap-4 items-end"
                        >
                          <div className="min-w-0">
                            <label className="block text-xs font-medium mb-1">选择补剂 *</label>
                            <SearchableSelect
                              value={item.supplement_id || ''}
                              onChange={(value) => updateStageSupplementItem(i, itemIndex, 'supplement_id', value || undefined)}
                              options={[
                                { value: '', label: '选择补剂' },
                                ...supplements.map((s) => {
                                  const label = s.item_code ? `${s.item_code} · ${s.name}` : s.name;
                                  return {
                                    value: s.id,
                                    label,
                                    keywords: [s.name, s.id, s.item_code || ''].filter(Boolean),
                                  };
                                }),
                              ]}
                              placeholder="选择补剂"
                              searchPlaceholder="输入补剂名称模糊搜索"
                              emptyText="没有匹配补剂"
                              showSearchHint={false}
                              disabled={structureInServiceForm}
                              plainWhenDisabled={!!structureInServiceForm}
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-xs font-medium mb-1">一天颗数 *</label>
                            <input
                              type="number"
                              min={1}
                              disabled={structureInServiceForm}
                              value={item.per_day_qty ?? 1}
                              onChange={(e) => updateStageSupplementItem(i, itemIndex, 'per_day_qty', parseInt(e.target.value) || 1)}
                              className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                              placeholder="1"
                            />
                          </div>
                          <div className="flex justify-end items-end gap-1 flex-wrap pb-0.5">
                            <button
                              type="button"
                              onClick={() => removeStageSupplementItem(i, itemIndex)}
                              disabled={structureInServiceForm}
                              className="p-2 text-red-600 hover:text-red-800 disabled:opacity-40 shrink-0"
                              title="删除补剂"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {itemIndex === (stage.supplement_items || []).length - 1 && (
                              <button
                                type="button"
                                onClick={() => addStageSupplementItem(i)}
                                disabled={structureInServiceForm}
                                className="px-2.5 py-2 text-xs sm:text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 whitespace-nowrap shrink-0"
                              >
                                添加补剂
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-20 flex justify-end space-x-2 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={saveCourse}
              disabled={isSaving || isFormLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
            </div>
          </div>
        </div>
      )}

      {/* 疗程详情弹窗 */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center gap-3">
              <h3 className="text-lg font-semibold">
                补剂疗程详情 - {selectedSchedule.schedule?.schedule_name || '…'}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={selectedSchedule.stagesLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={selectedSchedule.stagesLoading ? '阶段排期加载完成后可编辑' : undefined}
                  onClick={() => {
                    const row = {
                      id: selectedSchedule.schedule?.id,
                      schedule_name: selectedSchedule.schedule?.schedule_name,
                      structure_in_service: selectedSchedule.schedule?.structure_in_service,
                    };
                    setSelectedSchedule(null);
                    if (row.id) void handleEdit(row as any);
                  }}
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSchedule(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="关闭"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 relative min-h-[120px]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">疗程编号（STP）</p>
                  <p className="font-mono font-medium">{selectedSchedule.schedule?.course_plan_code || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">疗程名称</p>
                  <p className="font-medium">{selectedSchedule.schedule?.schedule_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">总天数</p>
                  <p className="font-medium">{selectedSchedule.schedule?.total_days} 天</p>
                </div>
                {selectedSchedule.schedule?.created_at ? (
                  <div>
                    <p className="text-sm text-gray-500">创建时间</p>
                    <p className="font-medium text-sm">
                      {new Date(selectedSchedule.schedule.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ) : null}
              </div>
              <div>
                <h4 className="font-medium mb-3">阶段排期</h4>
                {selectedSchedule.stagesLoading ? (
                  <div
                    className="flex flex-col items-center justify-center py-10 gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 text-gray-600"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
                    <span className="text-sm">正在加载阶段与补剂明细…</span>
                  </div>
                ) : selectedSchedule.stages && selectedSchedule.stages.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedSchedule.stages.map((st: any, i: number) => (
                      <li key={i} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="font-medium">{st.stage_name}</span>
                          <span className="text-xs text-gray-500">持续 {st.duration_days} 天</span>
                        </div>
                        <div className="rounded border border-gray-200 bg-white overflow-hidden">
                          <div className="grid grid-cols-[1fr_96px] bg-gray-100 text-xs text-gray-600">
                            <div className="px-3 py-2">补剂名</div>
                            <div className="px-3 py-2 text-left">每日颗数</div>
                          </div>
                          {(
                            Array.isArray(st.supplement_items) && st.supplement_items.length > 0
                              ? st.supplement_items
                              : [{
                                  supplements: st.supplements || st.supplement_products || null,
                                  supplement_name: st.supplement_name,
                                  per_day_qty: st.per_day_qty ?? 1,
                                }]
                          ).map((item: any, itemIndex: number) => (
                            <div
                              key={itemIndex}
                              className={`grid grid-cols-[1fr_96px] text-sm ${itemIndex !== 0 ? 'border-t border-gray-100' : ''}`}
                            >
                              <div className="px-3 py-2 text-gray-800">
                                {item.supplements?.name || item.supplement_name || '未知补剂'}
                              </div>
                              <div className="px-3 py-2 text-gray-700">
                                {item.per_day_qty ?? 1} 颗
                              </div>
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">暂无阶段</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {schedules.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-2">已创建疗程</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedSchedules.map((s) => (
              <div
                key={s.id}
                className="border-2 border-gray-300 rounded-lg p-4 bg-white shadow-sm flex flex-col cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                onClick={() => handleViewDetails(s)}
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium">{s.schedule_name}</h4>
                    {s.course_plan_code ? (
                      <span
                        className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200"
                        title="与商品 supplement_plan_id 指向的补剂计划编号一致"
                      >
                        {s.course_plan_code}
                      </span>
                    ) : null}
                    {s.structure_in_service ? (
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200"
                        title="存在进行中的已支付订单引用该补剂疗程，编辑时将锁定结构字段"
                      >
                        {LIST_SERVICE_STRUCTURE_LOCKED_BADGE}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">疗程 {s.total_days} 天</p>
                  {s.created_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      创建于 {new Date(s.created_at).toLocaleDateString('zh-CN')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(s)}
                    disabled={!!s.structure_in_service}
                    title={s.structure_in_service ? ENTITY_DELETE_BLOCKED_IN_SERVICE : '删除'}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      s.structure_in_service
                        ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-600 mb-4">
              确定要删除「{deleteConfirmTarget.schedule_name}」吗？删除后无法恢复。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '确定删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
