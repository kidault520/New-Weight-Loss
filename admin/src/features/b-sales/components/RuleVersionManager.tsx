import React, { useState, useEffect } from 'react';
import { RuleSet } from '../types/commissionRules';
import { RuleStorage } from '../utils/ruleStorage';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Copy, 
  Calendar,
  FileText,
  ChevronRight,
  ChevronDown,
  Menu
} from 'lucide-react';
import { getTodayBeijing } from '../../../utils/timezone';

interface RuleVersionManagerProps {
  onRuleSetChange?: (ruleSet: RuleSet) => void;
}

export const RuleVersionManager: React.FC<RuleVersionManagerProps> = ({ onRuleSetChange }) => {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [currentRuleSetId, setCurrentRuleSetId] = useState<string>('');
  const [selectedRuleSet, setSelectedRuleSet] = useState<RuleSet | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'promotion' | 'evaluation'>('rules');

  // 新建版本表单状态
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [newVersionEffectiveDate, setNewVersionEffectiveDate] = useState(
    getTodayBeijing()
  );

  // 加载规则集
  useEffect(() => {
    loadRuleSets();
  }, []);

  const loadRuleSets = () => {
    const allRuleSets = RuleStorage.getAllRuleSets();
    const currentId = RuleStorage.getCurrentRuleSetId();
    setRuleSets(allRuleSets);
    setCurrentRuleSetId(currentId);
    
    const current = allRuleSets.find((rs) => rs.id === currentId);
    if (current) {
      setSelectedRuleSet(current);
      onRuleSetChange?.(current);
    }
  };

  // 切换规则集
  const handleSwitchRuleSet = (ruleSetId: string) => {
    RuleStorage.setCurrentRuleSetId(ruleSetId);
    const ruleSet = ruleSets.find((rs) => rs.id === ruleSetId);
    if (ruleSet) {
      setCurrentRuleSetId(ruleSetId);
      setSelectedRuleSet(ruleSet);
      onRuleSetChange?.(ruleSet);
    }
  };

  // 创建新版本
  const handleCreateVersion = () => {
    if (!newVersionName.trim()) {
      alert('请输入版本名称');
      return;
    }

    const currentRuleSet = selectedRuleSet || RuleStorage.getCurrentRuleSet();
    const newVersion: RuleSet = {
      id: `${currentRuleSet.id}-v${Date.now()}`,
      name: newVersionName,
      version: currentRuleSet.version + 1,
      effectiveDate: newVersionEffectiveDate,
      description: newVersionDescription,
      rules: currentRuleSet.rules.map((rule) => ({
        ...rule,
        version: (rule.version || 1),
      })),
    };

    RuleStorage.saveRuleSet(newVersion);
    setNewVersionName('');
    setNewVersionDescription('');
    setNewVersionEffectiveDate(getTodayBeijing());
    setIsCreating(false);
    loadRuleSets();
    handleSwitchRuleSet(newVersion.id);
  };

  // 复制规则集
  const handleCopyRuleSet = (ruleSet: RuleSet) => {
    const copied: RuleSet = {
      ...ruleSet,
      id: `${ruleSet.id}-copy-${Date.now()}`,
      name: `${ruleSet.name} (副本)`,
      version: 1,
    };
    RuleStorage.saveRuleSet(copied);
    loadRuleSets();
  };

  // 删除规则集
  const handleDeleteRuleSet = (ruleSetId: string) => {
    if (ruleSets.length <= 1) {
      alert('至少需要保留一个规则版本');
      return;
    }
    
    if (confirm('确定要删除这个规则版本吗？')) {
      RuleStorage.deleteRuleSet(ruleSetId);
      loadRuleSets();
      if (ruleSetId === currentRuleSetId) {
        const remaining = ruleSets.filter((rs) => rs.id !== ruleSetId);
        if (remaining.length > 0) {
          handleSwitchRuleSet(remaining[0].id);
        }
      }
    }
  };

  // 切换规则展开状态
  const toggleRuleExpand = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const getRuleTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      sales: 'bg-blue-100 text-blue-700',
      allowance: 'bg-green-100 text-green-700',
      management: 'bg-purple-100 text-purple-700',
      training: 'bg-orange-100 text-orange-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || colors.other;
  };

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sales: '销售',
      allowance: '津贴',
      management: '管理',
      training: '培育',
      other: '其他',
    };
    return labels[type] || type;
  };

  // 参数名称中英文映射（根据规则类型和参数名）
  const getParameterLabel = (key: string, ruleType?: string, ruleId?: string): string => {
    // 通用参数
    if (key === 'discountRate') return '折算率';
    if (key === 'commissionRate') return '佣金率';
    if (key === 'personalAllowanceRate') return '个人津贴率'; // 向后兼容
    if (key === 'directRecommendationAllowanceRate') return '直接推荐个人津贴率';
    if (key === 'indirectRecommendationAllowanceRate') return '间接推荐个人津贴率';
    
    // 管理津贴参数
    if (ruleType === 'management' || ruleId === 'management-allowance') {
      if (key === 'groupRate') return '组管理津贴率';
      if (key === 'departmentRate') return '部管理津贴率';
      if (key === 'areaRate') return '区管理津贴率';
    }
    
    // 直接培育津贴参数
    if (ruleType === 'training' && ruleId === 'direct-training-allowance') {
      if (key === 'groupRate') return '组直接培育率';
      if (key === 'departmentRate') return '部直接培育率';
      if (key === 'areaRate') return '区直接培育率';
    }
    
    // 间接培育津贴参数
    if (ruleType === 'training' && ruleId === 'indirect-training-allowance') {
      if (key === 'groupRate') return '组间接培育率';
      if (key === 'departmentRate') return '部间接培育率';
      if (key === 'areaRate') return '区间接培育率';
    }
    
    return key;
  };

  // 公式变量中英文映射
  const translateFormula = (formula: string): string => {
    const translations: Record<string, string> = {
      performance: '业绩',
      discountRate: '折算率',
      commissionRate: '佣金率',
      directRecommendationPerformance: '直接推荐人员业绩',
      indirectRecommendationPerformance: '间接推荐人员业绩',
      personalAllowanceRate: '个人津贴率', // 向后兼容
      directRecommendationAllowanceRate: '直接推荐个人津贴率',
      indirectRecommendationAllowanceRate: '间接推荐个人津贴率',
      groupPerformance: '直辖组业绩',
      departmentPerformance: '直辖部业绩',
      areaPerformance: '直辖区业绩',
      directCultivationPerformance: '直接培育业绩',
      indirectCultivationPerformance: '间接培育业绩',
      // 新的统一参数名（根据上下文判断）
      groupRate: '组费率',
      departmentRate: '部费率',
      areaRate: '区费率',
    };

    let translated = formula;
    Object.entries(translations).forEach(([en, zh]) => {
      const regex = new RegExp(`\\b${en}\\b`, 'g');
      translated = translated.replace(regex, `${zh}(${en})`);
    });
    return translated;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 头部 */}
      <div className="flex-none bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-800">规则版本管理</h1>
                <p className="text-xs md:text-sm text-slate-500">管理基本法规则版本，切换和配置不同版本</p>
              </div>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              新建
            </button>
          </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-row relative">
        {/* 左侧版本列表 - 可折叠 */}
        <div className={`flex-none bg-white border-r border-slate-200 overflow-hidden h-full transition-all duration-300 ${
          isSidebarCollapsed ? 'w-0' : 'w-72'
        }`}>
          <div className={`h-full overflow-y-auto transition-opacity duration-300 ${
            isSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">规则版本列表</h2>
              </div>
            <div className="space-y-2">
              {ruleSets.map((ruleSet) => (
                <div
                  key={ruleSet.id}
                  className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    ruleSet.id === currentRuleSetId
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => handleSwitchRuleSet(ruleSet.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800">{ruleSet.name}</h3>
                        {ruleSet.id === currentRuleSetId && (
                          <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                            当前
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-2">版本 {ruleSet.version}</p>
                      {ruleSet.description && (
                        <div className="text-xs text-slate-600 mb-2">
                          {ruleSet.description.includes('（') ? (
                            <>
                              <div>{ruleSet.description.split('（')[0]}</div>
                              <div>（{ruleSet.description.split('（')[1]}</div>
                            </>
                          ) : (
                            <p>{ruleSet.description}</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>生效日期: {ruleSet.effectiveDate}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        规则数量: {ruleSet.rules.length}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyRuleSet(ruleSet);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="复制版本"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {ruleSet.id !== currentRuleSetId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRuleSet(ruleSet.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="删除版本"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>


        {/* 右侧规则详情 - 占据剩余空间 */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          {selectedRuleSet ? (
            <div>
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title={isSidebarCollapsed ? "展开" : "折叠"}
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-bold text-slate-800">{selectedRuleSet.name}</h2>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <span>版本 {selectedRuleSet.version}</span>
                  <span>•</span>
                  <span>生效日期: {selectedRuleSet.effectiveDate}</span>
                  <span>•</span>
                  <span>规则数量: {selectedRuleSet.rules.length}</span>
                  {selectedRuleSet.promotionRules && (
                    <>
                      <span>•</span>
                      <span>职级规则: {selectedRuleSet.promotionRules.length}</span>
                    </>
                  )}
                  {selectedRuleSet.evaluationRules && (
                    <>
                      <span>•</span>
                      <span>评估规则: {selectedRuleSet.evaluationRules.length}</span>
                    </>
                  )}
                </div>
                {selectedRuleSet.description && (
                  <p className="text-sm text-slate-600 mt-2">{selectedRuleSet.description}</p>
                )}
              </div>

              {/* 标签页切换 */}
              <div className="mb-4 flex gap-2 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('rules')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'rules'
                      ? 'text-indigo-600 border-indigo-600'
                      : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  费率规则 ({selectedRuleSet.rules?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('promotion')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'promotion'
                      ? 'text-indigo-600 border-indigo-600'
                      : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  职级标准 ({selectedRuleSet.promotionRules?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('evaluation')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'evaluation'
                      ? 'text-indigo-600 border-indigo-600'
                      : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  职级评估 ({selectedRuleSet.evaluationRules?.length || 0})
                </button>
              </div>

              {/* 费率规则内容 */}
              {activeTab === 'rules' && (
                <div className="space-y-3">
                {selectedRuleSet.rules.map((rule) => {
                  const isExpanded = expandedRules.has(rule.id);
                  return (
                    <div
                      key={rule.id}
                      className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                    >
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleRuleExpand(rule.id)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getRuleTypeColor(
                              rule.type
                            )}`}
                          >
                            {getRuleTypeLabel(rule.type)}
                          </span>
                          <span className="font-semibold text-slate-800">{rule.name}</span>
                          {rule.version && (
                            <span className="text-xs text-slate-500">v{rule.version}</span>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-slate-100">
                          <div className="pt-4 space-y-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-600">公式</label>
                              <div className="mt-1 p-3 bg-slate-50 rounded text-sm text-slate-800 space-y-2">
                                {rule.formula.includes('|') ? (
                                  rule.formula.split('|').map((part, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500 w-6">{index === 0 ? '组:' : index === 1 ? '部:' : '区:'}</span>
                                      <span>{translateFormula(part.trim())}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div>{translateFormula(rule.formula)}</div>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-600">参数</label>
                              <div className="mt-1 grid grid-cols-2 gap-2">
                                {Object.entries(rule.parameters).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="p-2 bg-slate-50 rounded flex items-center justify-between"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium text-slate-800">{getParameterLabel(key, rule.type, rule.id)}</span>
                                      <span className="text-xs text-slate-500">{key}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-800">
                                      {(value * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {rule.applicableRanks && rule.applicableRanks.length > 0 && (
                              <div>
                                <label className="text-xs font-semibold text-slate-600">适用职级</label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {rule.applicableRanks.map((rank) => (
                                    <span
                                      key={rank}
                                      className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded"
                                    >
                                      {rank}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {rule.effectiveDate && (
                              <div>
                                <label className="text-xs font-semibold text-slate-600">生效日期</label>
                                <div className="mt-1 text-sm text-slate-700">{rule.effectiveDate}</div>
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

              {/* 职级标准规则内容 */}
              {activeTab === 'promotion' && selectedRuleSet.promotionRules && (
                <div className="space-y-3">
                  {selectedRuleSet.promotionRules.map((promotionRule) => {
                    return (
                      <div
                        key={promotionRule.level}
                        className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                      >
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <span className="text-indigo-600 font-bold">{promotionRule.level}</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-800">{promotionRule.title}</h3>
                            <p className="text-sm text-slate-600 mt-1">{promotionRule.requirements}</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 pb-4 border-t border-slate-100">
                        <div className="pt-4 space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 mb-2 block">考核标准</label>
                            {promotionRule.requirementsConditions && promotionRule.requirementsConditions.length > 0 ? (
                              <div className="space-y-2">
                                {promotionRule.requirementsConditions.map((condition, idx) => {
                                  const fieldLabels: Record<string, string> = {
                                    personalPerformance: '个人业绩',
                                    groupPerformance: '小组业绩',
                                    departmentPerformance: '部业绩',
                                    areaPerformance: '区业绩',
                                    directTeamSize: '直辖人力',
                                    directGroupCount: '直辖组数量',
                                    directDepartmentCount: '直辖部数量',
                                    directRecommendationCount: '直接推荐人数',
                                  };
                                  const operatorLabels: Record<string, string> = {
                                    '>=': '≥',
                                    '<=': '≤',
                                    '==': '=',
                                    '!=': '≠',
                                    '>': '>',
                                    '<': '<',
                                  };
                                  const fieldLabel = fieldLabels[condition.field] || condition.field;
                                  const operatorLabel = operatorLabels[condition.operator] || condition.operator;
                                  const value = condition.value >= 10000 
                                    ? `${(condition.value / 10000).toFixed(0)}w` 
                                    : condition.value.toString();
                                  return (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                      <span className="font-medium text-indigo-700">{fieldLabel}</span>
                                      <span className="text-indigo-600 font-semibold">{operatorLabel}</span>
                                      <span className="font-bold text-indigo-800">{value}</span>
                                      {condition.description && (
                                        <span className="text-xs text-slate-500 ml-auto">({condition.description})</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-600">{promotionRule.requirements}</p>
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 mb-2 block">权益</label>
                            <div className="flex flex-wrap gap-2">
                              {promotionRule.benefits.map((benefit, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded"
                                >
                                  {benefit}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {/* 职级评估规则内容 */}
              {activeTab === 'evaluation' && selectedRuleSet.evaluationRules && (
                <div className="space-y-3">
                  {selectedRuleSet.evaluationRules.map((evaluationRule) => {
                    const isExpanded = expandedRules.has(evaluationRule.id);
                    return (
                      <div
                        key={evaluationRule.id}
                        className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                      >
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleRuleExpand(evaluationRule.id)}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            )}
                            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                              {evaluationRule.evaluationPeriod === 'quarterly' ? '季度' : 
                               evaluationRule.evaluationPeriod === 'monthly' ? '月度' : '年度'}
                            </span>
                            <span className="font-semibold text-slate-800">{evaluationRule.name}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-slate-100">
                            <div className="pt-4 space-y-3">
                              <div>
                                <label className="text-xs font-semibold text-slate-600">考核周期</label>
                                <div className="mt-1 text-sm text-slate-700">
                                  {evaluationRule.evaluationPeriod === 'quarterly' ? '季度考核' : 
                                   evaluationRule.evaluationPeriod === 'monthly' ? '月度考核' : '年度考核'}
                                </div>
                              </div>

                              <div>
                                <label className="text-xs font-semibold text-slate-600">评估时间点</label>
                                <div className="mt-1 text-sm text-slate-700">{evaluationRule.evaluationDate}</div>
                              </div>

                              <div>
                                <label className="text-xs font-semibold text-slate-600">达标条件</label>
                                <div className="mt-1 space-y-2">
                                  {evaluationRule.conditions.map((condition, idx) => (
                                    <div key={idx} className="p-2 bg-slate-50 rounded text-sm">
                                      <span className="font-medium text-slate-800">
                                        {condition.description || condition.field}
                                      </span>
                                      <span className="text-slate-600 ml-2">
                                        {condition.operator} {condition.value.toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {evaluationRule.applicableRanks && evaluationRule.applicableRanks.length > 0 && (
                                <div>
                                  <label className="text-xs font-semibold text-slate-600">适用职级</label>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    {evaluationRule.applicableRanks.map((rank) => (
                                      <span
                                        key={rank}
                                        className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded"
                                      >
                                        {rank}
                                      </span>
                                    ))}
                                  </div>
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
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>请选择一个规则版本查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 新建版本对话框 */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">创建新版本</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  版本名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                  placeholder="例如: 2025年Q1规则"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">版本描述</label>
                <textarea
                  value={newVersionDescription}
                  onChange={(e) => setNewVersionDescription(e.target.value)}
                  placeholder="描述此版本的变更内容..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">生效日期</label>
                <input
                  type="date"
                  value={newVersionEffectiveDate}
                  onChange={(e) => setNewVersionEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewVersionName('');
                  setNewVersionDescription('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateVersion}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑规则对话框 - 省略部分重复代码以节省空间，完整代码见源文件 */}
      {/* 编辑职级规则对话框 - 省略 */}
      {/* 编辑评估规则对话框 - 省略 */}
    </div>
  );
};
