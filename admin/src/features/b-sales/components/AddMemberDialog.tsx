/**
 * 添加成员对话框 - 支持推荐加入和自主加入
 */

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Users, Shield, Copy, Check } from 'lucide-react';
import { Person, JoinMethod } from '../types/organization';
import { getAllRegions, getProvincesByRegion, getCitiesByProvince } from '../data/chinaRegions';
import { OrganizationService } from '../services/organizationService';
import { RecommendationService } from '../services/recommendationService';
import { UserAuth } from '../utils/userAuth';

interface AddMemberDialogProps {
  orgService: OrganizationService;
  onSave: (person: Person) => void;
  onCancel: () => void;
}

// 职级选项已移除 - 新加入人员固定为收展员（外部引进除外）

const AddMemberCopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors shrink-0"
      title="复制"
    >
      {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
    </button>
  );
};

export const AddMemberDialog: React.FC<AddMemberDialogProps> = ({
  orgService,
  onSave,
  onCancel,
}) => {
  const [joinMethod, setJoinMethod] = useState<JoinMethod>('自主加入');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('https://i.pravatar.cc/150');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [generatedDisplayId, setGeneratedDisplayId] = useState<string>('');
  
  // 地区选择
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  
  // 推荐人选择
  const [selectedRecommender, setSelectedRecommender] = useState<string>('');

  // 外部引进相关
  const [approvedLevel, setApprovedLevel] = useState<'组经理' | '部经理' | '区经理'>('组经理');
  const isAdmin = UserAuth.isAdmin();

  const recommendationService = new RecommendationService(orgService);
  const regions = getAllRegions();
  const provinces = selectedRegion ? getProvincesByRegion(selectedRegion) : [];
  const cities = selectedProvince ? getCitiesByProvince(selectedProvince) : [];

  // 获取所有活跃人员作为推荐人候选
  const availableRecommenders = useMemo(() => {
    return orgService.persons.getAllPersons().filter(p => p.status === '活跃');
  }, [orgService]);

  // 生成独立展示ID（S+8位数字）
  const generateDisplayId = () => {
    const num = 10000000 + Math.floor(Math.random() * 89999999);
    return `S${num}`;
  };

  // 自动生成编号（基于姓名和时间戳）
  const generateCode = () => {
    if (!name.trim()) return '';
    const timestamp = Date.now().toString().slice(-6);
    const nameInitial = name.trim() ? name.trim().charAt(0).toUpperCase() : 'U';
    const randomSuffix = Math.random().toString(36).substr(2, 3);
    let code = `${nameInitial}${timestamp}${randomSuffix}`;
    
    // 确保编号唯一
    const existingPersons = orgService.persons.getAllPersons();
    let counter = 1;
    while (existingPersons.some(p => p.code === code)) {
      code = `${nameInitial}${timestamp}${randomSuffix}${counter}`;
      counter++;
    }
    
    return code;
  };

  // 实时生成编号和独立ID预览（当姓名变化时）
  useEffect(() => {
    if (name.trim()) {
      setGeneratedCode(generateCode());
      setGeneratedDisplayId(generateDisplayId());
    } else {
      setGeneratedCode('');
      setGeneratedDisplayId('');
    }
  }, [name]);

  // 使用 Portal 渲染到 body，确保在最顶层
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // 阻止背景滚动
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('请输入姓名');
      return;
    }

    // 使用已生成的编号（如果姓名已输入）或重新生成
    const finalCode = generatedCode || generateCode();

    if (joinMethod === '推荐加入' && !selectedRecommender) {
      alert('请选择推荐人');
      return;
    }

    if (joinMethod === '自主加入' && !selectedRegion) {
      alert('请选择地区');
      return;
    }

    if (joinMethod === '外部引进' && !isAdmin) {
      alert('外部引进需要管理员权限');
      return;
    }

    if (joinMethod === '外部引进' && !selectedRegion) {
      alert('请选择地区');
      return;
    }

    const normalizedPhone = phone.replace(/\s/g, '').trim();
    if (normalizedPhone && normalizedPhone.length < 11) {
      alert('请输入有效的11位手机号');
      return;
    }

    // 新加入成员默认业绩为0
    const performanceInYuan = 0;

    try {
      let newPerson: Person;

      const baseData = {
        code: finalCode,
        displayId: generatedDisplayId || generateDisplayId(),
        name: name.trim(),
        performance: performanceInYuan,
        avatarUrl,
        phone: normalizedPhone || undefined,
        regionId: selectedRegion,
        provinceId: selectedProvince,
        cityId: selectedCity,
      };

      if (joinMethod === '推荐加入') {
        // 推荐加入 - 固定为收展员
        newPerson = recommendationService.handleRecommendationJoin(
          baseData,
          selectedRecommender
        );
      } else if (joinMethod === '外部引进') {
        // 外部引进 - 特批职级（可选推荐人）
        newPerson = recommendationService.handleExternalJoin(
          {
            ...baseData,
            level: approvedLevel,
            originalLevel: approvedLevel,
          },
          approvedLevel,
          selectedRecommender || undefined // 可选的推荐人ID
        );
      } else {
        // 自主加入 - 固定为收展员
        newPerson = recommendationService.handleSelfJoin(baseData);
      }

      onSave(newPerson);
    } catch (error: any) {
      alert(`添加失败：${error.message}`);
    }
  };

  const dialogContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4"
      style={{ 
        pointerEvents: 'auto',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
      onClick={(e) => {
        // 点击遮罩层关闭对话框
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
      onMouseDown={(e) => {
        // 确保点击事件能正常传播
        if (e.target === e.currentTarget) {
          e.stopPropagation();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        style={{ 
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 100000
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">添加成员</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 加入方式选择 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              加入方式
            </label>
            <div className={`grid gap-3 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                onClick={() => {
                  setJoinMethod('自主加入');
                  setSelectedRecommender('');
                }}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  joinMethod === '自主加入'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <MapPin className="w-5 h-5 mx-auto mb-1" />
                <div className="text-sm font-medium">自主加入</div>
                <div className="text-xs text-slate-500 mt-1">按地区分配队伍</div>
              </button>
              <button
                onClick={() => setJoinMethod('推荐加入')}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  joinMethod === '推荐加入'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Users className="w-5 h-5 mx-auto mb-1" />
                <div className="text-sm font-medium">推荐加入</div>
                <div className="text-xs text-slate-500 mt-1">通过推荐人加入</div>
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setJoinMethod('外部引进');
                    setSelectedRecommender('');
                  }}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                    joinMethod === '外部引进'
                      ? 'border-amber-600 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Shield className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">外部引进</div>
                  <div className="text-xs text-slate-500 mt-1">特批职级（管理员）</div>
                </button>
              )}
            </div>
          </div>

          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                姓名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="请输入姓名"
                style={{ pointerEvents: 'auto' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                独立ID <span className="text-slate-400 text-xs">(自动生成)</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 text-sm font-mono">
                  {generatedDisplayId || '输入姓名后自动生成'}
                </div>
                {generatedDisplayId && (
                  <AddMemberCopyButton text={generatedDisplayId} />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                手机号 <span className="text-slate-400 text-xs">(登录账号，可选)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="11位手机号"
                maxLength={11}
                style={{ pointerEvents: 'auto' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                职级
              </label>
              {joinMethod === '外部引进' ? (
                <select
                  value={approvedLevel}
                  onChange={(e) => setApprovedLevel(e.target.value as '组经理' | '部经理' | '区经理')}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                  style={{ pointerEvents: 'auto' }}
                >
                  <option value="组经理">组经理</option>
                  <option value="部经理">部经理</option>
                  <option value="区经理">区经理</option>
                </select>
              ) : (
                <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600">
                  收展员（新加入人员默认职级）
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              头像URL
            </label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://..."
              style={{ pointerEvents: 'auto' }}
            />
          </div>

          {/* 推荐人选择（推荐加入和外部引进时显示） */}
          {(joinMethod === '推荐加入' || joinMethod === '外部引进') && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                推荐人 {joinMethod === '推荐加入' && <span className="text-rose-500">*</span>}
              </label>
              <select
                value={selectedRecommender}
                onChange={(e) => {
                  setSelectedRecommender(e.target.value);
                  const recommender = availableRecommenders.find(r => r.id === e.target.value);
                  if (recommender && (joinMethod === '推荐加入' || joinMethod === '外部引进')) {
                    // 推荐加入和外部引进：选择推荐人时，区域信息默认与推荐人同步
                    const region = (recommender.regionId || '').replace(/^region-大区-/, '');
                    const province = (recommender.provinceId || '').replace(/^region-省份-/, '');
                    const city = (recommender.cityId || '').replace(/^region-城市-/, '');
                    setSelectedRegion(region);
                    setSelectedProvince(province);
                    setSelectedCity(city);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ pointerEvents: 'auto' }}
              >
                <option value="">{joinMethod === '推荐加入' ? '请选择推荐人' : '请选择推荐人（可选）'}</option>
                {availableRecommenders.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.name} ({person.level})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 地区选择 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              地区 {(joinMethod === '自主加入' || joinMethod === '外部引进') && <span className="text-rose-500">*</span>}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedProvince('');
                  setSelectedCity('');
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ pointerEvents: 'auto' }}
              >
                <option value="">请选择地区</option>
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {selectedRegion && (
                <select
                  value={selectedProvince}
                  onChange={(e) => {
                    setSelectedProvince(e.target.value);
                    setSelectedCity('');
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ pointerEvents: 'auto' }}
                >
                  <option value="">请选择省份</option>
                  {provinces.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              )}

              {selectedProvince && (
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ pointerEvents: 'auto' }}
                >
                  <option value="">请选择城市</option>
                  {cities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body，确保在最顶层
  if (!mounted) return null;
  
  return createPortal(dialogContent, document.body);
};




