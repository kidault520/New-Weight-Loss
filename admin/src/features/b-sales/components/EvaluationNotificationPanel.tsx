/**
 * 考核通知面板组件
 * 显示考核通知列表，支持筛选和批量操作
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell, XCircle, Filter, CheckSquare, Square,
  ChevronDown, ChevronUp, AlertCircle, TrendingUp, TrendingDown, UserX, UserCheck
} from 'lucide-react';
import { EvaluationAction } from '../types/commissionRules';
import { EvaluationApprovalService } from '../services/evaluationApprovalService';
import { OrganizationUpdateService } from '../services/organizationUpdateService';
import { EvaluationStorage } from '../utils/evaluationStorage';
import { OrganizationService } from '../services/organizationService';

interface EvaluationNotificationPanelProps {
  orgService: OrganizationService;
  onClose?: () => void;
  onUpdate?: () => void; // 更新回调，用于刷新组织架构
  key?: number; // 用于强制刷新
}

export const EvaluationNotificationPanel: React.FC<EvaluationNotificationPanelProps> = ({
  orgService,
  onClose,
  onUpdate,
  key,
}) => {
  const [filter, setFilter] = useState<EvaluationAction | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const approvalService = useMemo(() => new EvaluationApprovalService('current-user'), []);
  const updateService = useMemo(() => new OrganizationUpdateService(orgService), [orgService]);

  // 当key变化时，触发刷新
  useEffect(() => {
    if (key !== undefined) {
      setRefreshKey(key);
    }
  }, [key]);

  // 获取通知列表
  const notifications = useMemo(() => {
    const all = EvaluationStorage.getNotifications();
    if (filter === 'all') {
      return all;
    }
    return all.filter(n => n.action === filter);
  }, [filter, refreshKey]); // 添加refreshKey作为依赖

  const pendingNotifications = useMemo(() => {
    return notifications.filter(n => n.status === 'pending');
  }, [notifications]);

  // 切换选择
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 切换展开
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // 一键全部通过
  const handleApproveAll = async () => {
    if (pendingNotifications.length === 0) {
      return;
    }

    if (!confirm(`确定要一键通过所有 ${pendingNotifications.length} 条待审批通知吗？`)) {
      return;
    }

    setLoading(true);
    try {
      const result = approvalService.approveAll();
      
      if (result.success) {
        // 应用组织更新
        const approvedNotifications = pendingNotifications.map(n => ({
          ...n,
          status: 'approved' as const,
        }));
        void updateService.applyEvaluationResults(approvedNotifications);

        alert(`成功通过 ${result.approvedCount} 条通知，组织架构已更新`);
        setSelectedIds(new Set());
        onUpdate?.();
      } else {
        alert(`部分通知审批失败：${result.errors.join('; ')}`);
      }
    } catch (error) {
      alert(`审批失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 批量通过选中的
  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) {
      alert('请先选择要审批的通知');
      return;
    }

    setLoading(true);
    try {
      const result = approvalService.approveAll(Array.from(selectedIds));
      
      if (result.success) {
        // 应用组织更新
        const approvedNotifications = notifications
          .filter(n => selectedIds.has(n.id))
          .map(n => ({ ...n, status: 'approved' as const }));
        void updateService.applyEvaluationResults(approvedNotifications);

        alert(`成功通过 ${result.approvedCount} 条通知`);
        setSelectedIds(new Set());
        onUpdate?.();
      } else {
        alert(`部分通知审批失败：${result.errors.join('; ')}`);
      }
    } catch (error) {
      alert(`审批失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 单独通过
  const handleApproveSingle = async (id: string) => {
    setLoading(true);
    try {
      const result = approvalService.approveSingle(id);
      
      if (result.success) {
        // 应用组织更新
        const notification = notifications.find(n => n.id === id);
        if (notification) {
          const approvedNotification = { ...notification, status: 'approved' as const };
          updateService.applyEvaluationResults([approvedNotification]);
        }
        
        alert('审批通过');
        onUpdate?.();
      } else {
        alert(`审批失败：${result.error}`);
      }
    } catch (error) {
      alert(`审批失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 单独驳回
  const handleRejectSingle = async (id: string) => {
    const reason = prompt('请输入驳回原因：');
    if (!reason || reason.trim().length === 0) {
      return;
    }

    setLoading(true);
    try {
      const result = approvalService.rejectSingle(id, reason);
      
      if (result.success) {
        alert('已驳回');
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } else {
        alert(`驳回失败：${result.error}`);
      }
    } catch (error) {
      alert(`驳回失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 获取操作图标
  const getActionIcon = (action: EvaluationAction) => {
    switch (action) {
      case 'promote':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'demote':
        return <TrendingDown className="w-4 h-4 text-orange-500" />;
      case 'leave':
        return <UserX className="w-4 h-4 text-red-500" />;
      case 'maintain':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  // 获取操作标签
  const getActionLabel = (action: EvaluationAction) => {
    switch (action) {
      case 'promote':
        return '晋升';
      case 'demote':
        return '降级';
      case 'leave':
        return '脱落';
      case 'maintain':
        return '维持';
      default:
        return '未知';
    }
  };

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">待审批</span>;
      case 'approved':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">已通过</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">已驳回</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">考核通知</h2>
            <span className="px-3 py-1 text-sm rounded-full bg-indigo-100 text-indigo-700">
              {pendingNotifications.length} 待审批
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <XCircle className="w-5 h-5 text-slate-500" />
            </button>
          )}
        </div>

        {/* 筛选和操作栏 */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as EvaluationAction | 'all')}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">全部</option>
              <option value="promote">晋升</option>
              <option value="demote">降级</option>
              <option value="leave">脱落</option>
              <option value="maintain">维持</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            {pendingNotifications.length > 0 && (
              <>
                <button
                  onClick={handleApproveAll}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  一键全部通过
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleApproveSelected}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    通过选中 ({selectedIds.size})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 通知列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Bell className="w-12 h-12 mb-3 opacity-50" />
              <p>暂无考核通知</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const isSelected = selectedIds.has(notification.id);
                const isExpanded = expandedIds.has(notification.id);
                const isPending = notification.status === 'pending';

                return (
                  <div
                    key={notification.id}
                    className={`border rounded-lg transition-all ${
                      isPending ? 'border-yellow-200 bg-yellow-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 p-4">
                      {/* 选择框 */}
                      {isPending && (
                        <button
                          onClick={() => toggleSelect(notification.id)}
                          className="flex-shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      )}

                      {/* 操作图标 */}
                      {getActionIcon(notification.action)}

                      {/* 人员信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{notification.personName}</span>
                          <span className="text-sm text-slate-500">({notification.currentRank})</span>
                          {notification.targetRank && (
                            <>
                              <span className="text-slate-400">→</span>
                              <span className="text-sm font-medium text-indigo-600">{notification.targetRank}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(notification.status)}
                          <span className="text-xs text-slate-500">
                            {notification.evaluationPeriod} · {notification.evaluationDate}
                          </span>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleApproveSingle(notification.id)}
                              disabled={loading}
                              className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              通过
                            </button>
                            <button
                              onClick={() => handleRejectSingle(notification.id)}
                              disabled={loading}
                              className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              驳回
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => toggleExpand(notification.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-200 bg-white">
                        <div className="pt-3 space-y-2">
                          <div>
                            <span className="text-sm font-medium text-slate-700">操作类型：</span>
                            <span className="ml-2 text-sm text-slate-900">{getActionLabel(notification.action)}</span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-700">原因说明：</span>
                            <p className="mt-1 text-sm text-slate-600">{notification.reason}</p>
                          </div>
                          {notification.conditionDetails.length > 0 && (
                            <div>
                              <span className="text-sm font-medium text-slate-700">考核条件：</span>
                              <div className="mt-1 space-y-1">
                                {notification.conditionDetails.map((detail, idx) => (
                                  <div
                                    key={idx}
                                    className={`text-sm ${
                                      detail.passed ? 'text-green-700' : 'text-red-700'
                                    }`}
                                  >
                                    {detail.passed ? '✓' : '✗'} {detail.condition.description || detail.condition.field}：
                                    要求 {detail.condition.operator} {detail.condition.value}，实际 {detail.actualValue}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {notification.rejectReason && (
                            <div>
                              <span className="text-sm font-medium text-slate-700">驳回原因：</span>
                              <p className="mt-1 text-sm text-red-600">{notification.rejectReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

