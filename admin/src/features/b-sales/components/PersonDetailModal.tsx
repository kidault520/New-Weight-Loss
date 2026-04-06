/**
 * 销售人员个人详情弹窗
 * Tab: 个人信息、个人职级信息、个人学习相关信息、所在团队信息、历史订单、历史业绩、历史考核
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Edit2, User, Award, BookOpen, Users, ShoppingCart, TrendingUp, ClipboardCheck, Copy } from 'lucide-react';
import { Person } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { apiClient } from '@/config/api';
import { RuleStorage } from '../utils/ruleStorage';
import { EvaluationStorage } from '../utils/evaluationStorage';
import { PromotionEvaluator } from '../utils/promotionEvaluator';
import { OrganizationEngine } from '../utils/organizationEngine';
import { convertOrgTreeData } from '../utils/orgDataConverter';
import { orgTreeData } from '../data/orgTreeData';
import SearchableSelect from '@/components/common/SearchableSelect';
import CalendarDatePicker from '@/components/common/CalendarDatePicker';
import ListPagination from '@/components/common/ListPagination';
import { salesPersonService } from '../services/sales/salesPersonService';
import { ETHNIC_GROUPS } from '../data/ethnicGroups';

type TabId = 'info' | 'rank' | 'learning' | 'team' | 'orders' | 'performance' | 'evaluation';

interface PersonDetailModalProps {
  person: Person;
  orgService: OrganizationService;
  onClose: () => void;
  onUpdate: (person: Person) => void;
  isEditMode?: boolean;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'info', label: '基本信息', icon: User },
  { id: 'rank', label: '个人职级', icon: Award },
  { id: 'learning', label: '个人学习相关', icon: BookOpen },
  { id: 'team', label: '所在团队', icon: Users },
  { id: 'orders', label: '历史订单', icon: ShoppingCart },
  { id: 'performance', label: '历史业绩', icon: TrendingUp },
  { id: 'evaluation', label: '历史考核', icon: ClipboardCheck },
];

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  person,
  orgService,
  onClose,
  onUpdate,
  isEditMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [editMode, setEditMode] = useState(isEditMode);
  const [editSnapshot, setEditSnapshot] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit, setOrdersLimit] = useState(20);
  const [evaluationHistory, setEvaluationHistory] = useState<any[]>([]);

  const enterEditMode = () => {
    setEditSnapshot({ ...person });
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (editSnapshot) {
      orgService.persons.updatePerson(person.id, editSnapshot);
      const restored = orgService.persons.getPerson(person.id);
      if (restored) onUpdate(restored);
    }
    setEditSnapshot(null);
    setEditMode(false);
  };

  const saveEdit = async () => {
    const current = orgService.persons.getPerson(person.id);
    if (!current) return;
    setSaving(true);
    try {
      await salesPersonService.update(person.id, {
        name: current.name,
        phone: current.phone,
        birthDate: current.birthDate,
        gender: current.gender,
        ethnicity: current.ethnicity,
        education: current.education,
        idNumber: current.idNumber,
        workHistory: current.workHistory,
        accountStatus: current.accountStatus,
        isActivated: current.accountStatus === '激活',
      });
      setEditSnapshot(null);
      setEditMode(false);
      onUpdate(current);
    } catch (e: any) {
      alert(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const team = person.teamId ? orgService.teams.getTeam(person.teamId) : null;
  const subordinates = orgService.persons.getSubordinates(person.id);
  const recommender = person.recommenderId ? orgService.persons.getPerson(person.recommenderId) : null;

  useEffect(() => {
    if (editMode && !editSnapshot) {
      setEditSnapshot({ ...person });
    }
  }, [editMode, person, editSnapshot]);

  useEffect(() => {
    if (activeTab === 'orders') {
      setOrdersLoading(true);
      apiClient
        .get<{ orders: any[] }>(`/api/admin/orders?limit=100&salesperson_id=${person.id}`)
        .then((res) => {
          setOrders(res.orders || []);
          setOrdersPage(1);
        })
        .catch(() => setOrders([]))
        .finally(() => setOrdersLoading(false));
    }
  }, [activeTab, person.id]);

  const orderTotal = orders.length;
  const orderTotalPages = Math.max(1, Math.ceil(orderTotal / ordersLimit));
  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersLimit;
    return orders.slice(start, start + ordersLimit);
  }, [orders, ordersPage, ordersLimit]);

  useEffect(() => {
    if (activeTab === 'evaluation') {
      const notifications = EvaluationStorage.getNotifications();
      const personNotifs = notifications
        .filter((n) => n.personId === person.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEvaluationHistory(personNotifs);
    }
  }, [activeTab, person.id]);

  const currentPeriod = '2025-Q4';
  const { evaluationResult } = React.useMemo(() => {
    try {
      const orgNode = convertOrgTreeData(orgTreeData);
      const orgEngine = new OrganizationEngine(orgNode);
      const evaluator = new PromotionEvaluator(orgEngine);
      const ruleSet = RuleStorage.getCurrentRuleSet();
      const result = evaluator.evaluate(person.id, currentPeriod, ruleSet);
      return { evaluationResult: result };
    } catch {
      return { evaluationResult: null };
    }
  }, [person.id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 lg:pl-52">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={person.avatarUrl || 'https://i.pravatar.cc/150'}
              alt={person.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h3 className="text-lg font-bold text-slate-800">{person.name}</h3>
              <p className="text-sm text-slate-500">{person.level} · {person.displayId || person.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </>
            ) : (
              <button
                onClick={enterEditMode}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                title="编辑"
              >
                <Edit2 className="w-4 h-4" />
                编辑
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-200 overflow-x-auto shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === id
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">独立ID</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono">{person.displayId || person.code}</div>
                    <button
                      type="button"
                      onClick={() => {
                        const id = person.displayId || person.code;
                        navigator.clipboard?.writeText(id).then(() => alert('已复制')).catch(() => {});
                      }}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                      title="复制"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">姓名</label>
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => {
                      orgService.persons.updatePerson(person.id, { name: e.target.value });
                      const u = orgService.persons.getPerson(person.id);
                      if (u) onUpdate(u);
                    }}
                    readOnly={!editMode}
                    className={`w-full px-3 py-2 border rounded-lg ${editMode ? 'border-slate-300' : 'border-slate-200 bg-slate-50'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">出生年月日</label>
                  {editMode ? (
                    <CalendarDatePicker
                      value={
                        person.birthDate
                          ? person.birthDate.length === 7
                            ? `${person.birthDate}-01`
                            : person.birthDate
                          : ''
                      }
                      onChange={(v) => {
                        orgService.persons.updatePerson(person.id, { birthDate: v || undefined });
                        const u = orgService.persons.getPerson(person.id);
                        if (u) onUpdate(u);
                      }}
                      placeholder="请选择出生日期"
                      className="w-full"
                    />
                  ) : (
                    <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                      {person.birthDate ? person.birthDate.replace(/-/g, '/') : '-'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">年龄</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                    {(() => {
                      const current = orgService.persons.getPerson(person.id) || person;
                      const bd = current.birthDate;
                      if (!bd) return '-';
                      const parts = bd.split('-').map(Number);
                      const y = parts[0];
                      const m = parts[1] || 1;
                      const d = parts[2] || 1;
                      const now = new Date();
                      let age = now.getFullYear() - y;
                      if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
                      return age >= 0 ? `${age}岁` : '-';
                    })()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">性别</label>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`gender-${person.id}`}
                        checked={person.gender === '男'}
                        onChange={() => {
                          orgService.persons.updatePerson(person.id, { gender: '男' });
                          const u = orgService.persons.getPerson(person.id);
                          if (u) onUpdate(u);
                        }}
                        disabled={!editMode}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span>男</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`gender-${person.id}`}
                        checked={person.gender === '女'}
                        onChange={() => {
                          orgService.persons.updatePerson(person.id, { gender: '女' });
                          const u = orgService.persons.getPerson(person.id);
                          if (u) onUpdate(u);
                        }}
                        disabled={!editMode}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span>女</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">民族</label>
                  {editMode ? (
                    <SearchableSelect
                      value={person.ethnicity || ''}
                      options={ETHNIC_GROUPS.map((name) => ({ value: name, label: name, keywords: [name] }))}
                      onChange={(v) => {
                        orgService.persons.updatePerson(person.id, { ethnicity: v || undefined });
                        const u = orgService.persons.getPerson(person.id);
                        if (u) onUpdate(u);
                      }}
                      placeholder="输入或选择民族"
                      searchPlaceholder="输入关键词模糊检索..."
                      emptyText="没有匹配的民族"
                      className="min-h-[42px]"
                    />
                  ) : (
                    <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                      {person.ethnicity || '-'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">学历</label>
                  <select
                    value={person.education || ''}
                    onChange={(e) => {
                      orgService.persons.updatePerson(person.id, { education: e.target.value || undefined });
                      const u = orgService.persons.getPerson(person.id);
                      if (u) onUpdate(u);
                    }}
                    disabled={!editMode}
                    className={`w-full px-3 py-2 border rounded-lg ${editMode ? 'border-slate-300' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <option value="">请选择</option>
                    <option value="初中及以下">初中及以下</option>
                    <option value="高中/中专">高中/中专</option>
                    <option value="大专">大专</option>
                    <option value="本科">本科</option>
                    <option value="硕士">硕士</option>
                    <option value="博士">博士</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">身份证号</label>
                  <input
                    type="text"
                    value={person.idNumber || ''}
                    onChange={(e) => {
                      orgService.persons.updatePerson(person.id, { idNumber: e.target.value.trim() || undefined });
                      const u = orgService.persons.getPerson(person.id);
                      if (u) onUpdate(u);
                    }}
                    readOnly={!editMode}
                    placeholder="18位身份证号"
                    maxLength={18}
                    className={`w-full px-3 py-2 border rounded-lg ${editMode ? 'border-slate-300' : 'border-slate-200 bg-slate-50'}`}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">之前工作履历</label>
                  <textarea
                    value={person.workHistory || ''}
                    onChange={(e) => {
                      orgService.persons.updatePerson(person.id, { workHistory: e.target.value.trim() || undefined });
                      const u = orgService.persons.getPerson(person.id);
                      if (u) onUpdate(u);
                    }}
                    readOnly={!editMode}
                    placeholder="填写之前的工作经历..."
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg ${editMode ? 'border-slate-300' : 'border-slate-200 bg-slate-50'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">手机号</label>
                  <input
                    type="tel"
                    value={person.phone || ''}
                    onChange={(e) => {
                      orgService.persons.updatePerson(person.id, { phone: e.target.value.trim() || undefined });
                      const u = orgService.persons.getPerson(person.id);
                      if (u) onUpdate(u);
                    }}
                    readOnly={!editMode}
                    placeholder="登录账号"
                    className={`w-full px-3 py-2 border rounded-lg ${editMode ? 'border-slate-300' : 'border-slate-200 bg-slate-50'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">账号状态</label>
                  <div className="flex items-center gap-2">
                    {editMode ? (
                      <select
                        value={person.accountStatus || (person.isActivated ? '激活' : '未激活')}
                        onChange={(e) => {
                          const v = e.target.value as '未激活' | '激活' | '禁用';
                          orgService.persons.updatePerson(person.id, {
                            accountStatus: v,
                            isActivated: v === '激活',
                          });
                          const u = orgService.persons.getPerson(person.id);
                          if (u) onUpdate(u);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option value="未激活">未激活</option>
                        <option value="激活">激活</option>
                        <option value="禁用">禁用（无法登录，管理员可设置）</option>
                      </select>
                    ) : (
                      <div
                        className={`px-3 py-2 rounded-lg flex-1 ${
                          person.accountStatus === '禁用'
                            ? 'bg-rose-50 text-rose-700'
                            : person.accountStatus === '激活' || person.isActivated
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {person.accountStatus === '禁用'
                          ? '禁用'
                          : person.accountStatus === '激活' || person.isActivated
                          ? '激活'
                          : '未激活'}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {person.accountStatus === '禁用' ? '该账号已被禁用，无法登录系统' : '首次使用手机号+密码登录后激活'}
                  </p>
                  {person.phone && person.accountStatus !== '禁用' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const pwd = prompt('设置登录密码（至少6位）：');
                        if (!pwd || pwd.length < 6) return;
                        try {
                          await apiClient.post(`/api/admin/sales-persons/${person.id}/set-password`, { password: pwd });
                          alert('密码已设置');
                        } catch (e: any) {
                          alert(e.message || '设置失败');
                        }
                      }}
                      className="mt-2 text-xs text-indigo-600 hover:underline"
                    >
                      设置/重置密码
                    </button>
                  )}
                </div>
                {(person.regionId || person.provinceId || person.cityId) && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-600 mb-1">区域</label>
                    <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                      {[person.regionId, person.provinceId, person.cityId]
                        .filter(Boolean)
                        .map((r) => (r || '').replace(/^region-(大区|省份|城市)-/, ''))
                        .join(' · ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rank' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">状态</label>
                  <div
                    className={`px-3 py-2 rounded-lg ${
                      person.status === '活跃' ? 'bg-emerald-50 text-emerald-700' : person.status === '脱落' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {person.status === '活跃' ? '活跃中' : person.status === '脱落' ? '已脱落' : person.status}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">当前职级</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">{person.level}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">加入时职级</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">{person.originalLevel}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">加入时间</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">{person.joinDate}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">最近晋升时间</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">{person.promoteDate || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">加入方式</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">{person.joinMethod || '-'}</div>
                </div>
                {recommender && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">推荐人</label>
                    <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">{recommender.name}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'learning' && (
            <div className="text-center py-12 text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>个人学习相关信息（待配置）</p>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-4">
              {team && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">所属队伍</label>
                  <div className="px-4 py-3 border border-slate-200 rounded-lg bg-slate-50">
                    {team.name} {team.customName && `(${team.customName})`}
                  </div>
                </div>
              )}
              {subordinates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">直辖下属 ({subordinates.length}人)</label>
                  <ul className="space-y-2">
                    {subordinates.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-sm text-slate-500">{p.level}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!team && subordinates.length === 0 && (
                <p className="text-slate-500 text-center py-8">暂无团队信息</p>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              {ordersLoading ? (
                <p className="text-center py-8 text-slate-500">加载中...</p>
              ) : orders.length === 0 ? (
                <p className="text-center py-8 text-slate-500">暂无关联订单</p>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2">订单号</th>
                        <th className="text-left py-2">金额</th>
                        <th className="text-left py-2">状态</th>
                        <th className="text-left py-2">时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map((o) => (
                        <tr key={o.id} className="border-b border-slate-100">
                          <td className="py-2 font-mono">{o.order_number}</td>
                          <td className="py-2 text-red-600">¥{Number(o.total_amount || 0).toFixed(2)}</td>
                          <td className="py-2">{o.payment_status}</td>
                          <td className="py-2 text-slate-500">{o.created_at ? new Date(o.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ListPagination
                    page={ordersPage}
                    totalPages={orderTotalPages}
                    total={orderTotal}
                    limit={ordersLimit}
                    onPageChange={setOrdersPage}
                    onLimitChange={(nextLimit) => {
                      setOrdersLimit(nextLimit);
                      setOrdersPage(1);
                    }}
                    className="mt-4"
                  />
                </>
              )}
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">当前业绩</label>
                  <div className="px-4 py-3 border border-slate-200 rounded-lg text-indigo-600 font-semibold">
                    {(person.performance / 10000).toFixed(1)}w
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-500">历史业绩趋势（待接入订单汇总）</p>
            </div>
          )}

          {activeTab === 'evaluation' && (
            <div className="space-y-4">
              {evaluationResult && (
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <h5 className="font-medium mb-2">当前周期 ({currentPeriod})</h5>
                  <p>{evaluationResult.action} · {evaluationResult.passed ? '达标' : '不达标'}</p>
                </div>
              )}
              {evaluationHistory.length > 0 ? (
                <ul className="space-y-2">
                  {evaluationHistory.map((n, i) => (
                    <li key={i} className="px-4 py-2 border border-slate-200 rounded-lg">
                      {n.action} · {new Date(n.createdAt).toLocaleDateString('zh-CN')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-center py-8">暂无考核记录</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
