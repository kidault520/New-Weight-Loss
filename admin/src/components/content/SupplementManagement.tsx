import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../config/api';
import { Plus, Trash2, X } from 'lucide-react';
import ListPagination from '../common/ListPagination';

interface SupplementDetailModalProps {
  supplement: Supplement;
  onClose: () => void;
  onEdit: () => void;
}

function SupplementDetailModal({ supplement, onClose, onEdit }: SupplementDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center gap-3">
          <h3 className="text-lg font-semibold">
            补剂详情
            {supplement.item_code ? (
              <span className="ml-2 font-mono text-sm font-normal text-gray-600">{supplement.item_code}</span>
            ) : null}
            <span className="text-gray-400 mx-1">·</span>
            {supplement.name}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              编辑
            </button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="关闭">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            {supplement.subtitle && <span className="text-sm text-gray-500">({supplement.subtitle})</span>}
            {supplement.is_active ? (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">启用</span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">禁用</span>
            )}
          </div>
          {supplement.description && !supplement.description.startsWith('{') && (
            <p className="text-sm text-gray-600">{supplement.description}</p>
          )}
          {supplement.benefits && supplement.benefits.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">功效</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {supplement.benefits.map((b, i) => (
                  <li key={i}>{b.text}</li>
                ))}
              </ul>
            </div>
          )}
          {supplement.scenarios && supplement.scenarios.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">适用场景</h4>
              <div className="space-y-2">
                {supplement.scenarios.map((s, i) => (
                  <div key={i} className="bg-gray-50 p-2 rounded">
                    <div className="font-medium text-sm">{s.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{s.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-sm text-gray-500">
            <span>用量: {supplement.dosage || '-'}</span>
            <span className="ml-4">频率: {supplement.frequency || '-'}</span>
            <span className="ml-4">显示顺序: {supplement.display_order ?? 0}</span>
          </div>
          {supplement.tags && supplement.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {supplement.tags.map((tag, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 text-xs rounded">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Supplement {
  id: string;
  name: string;
  item_code?: string;
  description?: string;
  dosage?: string;
  frequency?: string;
  supplement_type: string;
  icon_path: string;
  tags: string[];
  is_active: boolean;
  display_order: number;
  // Extended fields for ReDanVia supplement plan
  subtitle?: string; // e.g., "每日一颗"
  benefits?: Array<{ text: string; references?: string[] }>; // 功效列表
  scenarios?: Array<{ title: string; description: string }>; // 适用场景
  references?: Array<{ text: string; url?: string }>; // 参考文献
  metadata?: any; // 其他扩展数据
}

export default function SupplementManagement() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [selectedSupplement, setSelectedSupplement] = useState<Supplement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  useEffect(() => {
    loadSupplements();
  }, []);

  const loadSupplements = async () => {
    try {
      const data = await apiClient.get<{ supplements: Supplement[] }>('/api/admin/content/supplements');
      // Parse metadata if it's a string
      const parsedSupplements = data.supplements.map(s => ({
        ...s,
        benefits: typeof s.metadata === 'string' ? JSON.parse(s.metadata || '{}').benefits : (s.metadata?.benefits || s.benefits),
        scenarios: typeof s.metadata === 'string' ? JSON.parse(s.metadata || '{}').scenarios : (s.metadata?.scenarios || s.scenarios),
        references: typeof s.metadata === 'string' ? JSON.parse(s.metadata || '{}').references : (s.metadata?.references || s.references),
        subtitle: typeof s.metadata === 'string' ? JSON.parse(s.metadata || '{}').subtitle : (s.metadata?.subtitle || s.subtitle),
      }));
      setSupplements(parsedSupplements);
    } catch (error) {
      console.error('Failed to load supplements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: Partial<Supplement>) => {
    try {
      // Prepare metadata
      const metadata = {
        subtitle: formData.subtitle,
        benefits: formData.benefits || [],
        scenarios: formData.scenarios || [],
        references: formData.references || [],
      };

      const payload = {
        ...formData,
        metadata,
        // Store in description as JSON for backward compatibility
        description: formData.description || JSON.stringify(metadata),
      };

      if (editing) {
        await apiClient.put(`/api/admin/content/supplements/${editing.id}`, payload);
      } else {
        await apiClient.post('/api/admin/content/supplements', payload);
      }
      setShowForm(false);
      setEditing(null);
      loadSupplements();
    } catch (error) {
      console.error('Save error:', error);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此补剂吗？')) return;
    try {
      await apiClient.delete(`/api/admin/content/supplements/${id}`);
      loadSupplements();
    } catch (error) {
      alert('删除失败');
    }
  };

  const total = supplements.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedSupplements = useMemo(() => {
    const start = (page - 1) * limit;
    return supplements.slice(start, start + limit);
  }, [supplements, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">ReDanVia专属补剂方案</h2>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加补剂
        </button>
      </div>

      {selectedSupplement && (
        <SupplementDetailModal
          supplement={selectedSupplement}
          onClose={() => setSelectedSupplement(null)}
          onEdit={() => {
            setEditing(selectedSupplement);
            setSelectedSupplement(null);
            setShowForm(true);
          }}
        />
      )}

      {showForm && (
        <SupplementForm
          supplement={editing}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="space-y-4">
        {supplements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无补剂，点击"添加补剂"开始创建
          </div>
        ) : (
          paginatedSupplements.map((supplement) => (
            <div
              key={supplement.id}
              className="border border-gray-200 rounded-lg p-4 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setSelectedSupplement(supplement)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    {supplement.item_code ? (
                      <span className="text-xs font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                        {supplement.item_code}
                      </span>
                    ) : null}
                    <h3 className="text-lg font-semibold">{supplement.name}</h3>
                    {supplement.subtitle && (
                      <span className="text-sm text-gray-500">({supplement.subtitle})</span>
                    )}
                    {supplement.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">启用</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">禁用</span>
                    )}
                  </div>
                  
                  {supplement.description && !supplement.description.startsWith('{') && (
                    <p className="text-sm text-gray-600 mt-1 mb-2">{supplement.description}</p>
                  )}

                  {supplement.benefits && supplement.benefits.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">功效：</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {supplement.benefits.map((benefit, i) => (
                          <li key={i}>
                            {benefit.text}
                            {benefit.references && benefit.references.length > 0 && (
                              <span className="text-blue-600 ml-1">[{benefit.references.join(',')}]</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {supplement.scenarios && supplement.scenarios.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">适用场景：</h4>
                      <div className="space-y-2">
                        {supplement.scenarios.map((scenario, i) => (
                          <div key={i} className="bg-gray-50 p-2 rounded">
                            <div className="font-medium text-sm">{scenario.title}</div>
                            <div className="text-sm text-gray-600 mt-1">{scenario.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {supplement.references && supplement.references.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">参考文献：</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {supplement.references.map((ref, i) => (
                          <li key={i}>
                            {ref.url ? (
                              <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {ref.text}
                              </a>
                            ) : (
                              ref.text
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-2 text-sm text-gray-500">
                    <span>用量: {supplement.dosage || '-'}</span>
                    <span className="ml-4">频率: {supplement.frequency || '-'}</span>
                    <span className="ml-4">显示顺序: {supplement.display_order || 0}</span>
                  </div>
                  
                  {supplement.tags && supplement.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {supplement.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 ml-4" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleDelete(supplement.id)}
                    className="text-red-600 hover:text-red-800"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
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
  );
}

function SupplementForm({
  supplement,
  onSave,
  onCancel,
}: {
  supplement: Supplement | null;
  onSave: (data: Partial<Supplement>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<Supplement>>({
    name: supplement?.name || '',
    description: supplement?.description || '',
    dosage: supplement?.dosage || '',
    frequency: supplement?.frequency || '',
    supplement_type: supplement?.supplement_type || 'general',
    icon_path: supplement?.icon_path || '/buji.png',
    tags: supplement?.tags || [],
    is_active: supplement?.is_active ?? true,
    display_order: supplement?.display_order || 0,
    subtitle: supplement?.subtitle || '',
    benefits: supplement?.benefits || [],
    scenarios: supplement?.scenarios || [],
    references: supplement?.references || [],
  });

  const [newTag, setNewTag] = useState('');
  const [newBenefit, setNewBenefit] = useState({ text: '', references: '' });
  const [newScenario, setNewScenario] = useState({ title: '', description: '' });
  const [newReference, setNewReference] = useState({ text: '', url: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addTag = () => {
    if (newTag && !formData.tags?.includes(newTag)) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), newTag],
      });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag),
    });
  };

  const addBenefit = () => {
    if (newBenefit.text) {
      const references = newBenefit.references
        ? newBenefit.references.split(',').map(r => r.trim()).filter(r => r)
        : [];
      setFormData({
        ...formData,
        benefits: [...(formData.benefits || []), { text: newBenefit.text, references }],
      });
      setNewBenefit({ text: '', references: '' });
    }
  };

  const removeBenefit = (index: number) => {
    setFormData({
      ...formData,
      benefits: formData.benefits?.filter((_, i) => i !== index),
    });
  };

  const addScenario = () => {
    if (newScenario.title && newScenario.description) {
      setFormData({
        ...formData,
        scenarios: [...(formData.scenarios || []), { ...newScenario }],
      });
      setNewScenario({ title: '', description: '' });
    }
  };

  const removeScenario = (index: number) => {
    setFormData({
      ...formData,
      scenarios: formData.scenarios?.filter((_, i) => i !== index),
    });
  };

  const addReference = () => {
    if (newReference.text) {
      setFormData({
        ...formData,
        references: [...(formData.references || []), { ...newReference }],
      });
      setNewReference({ text: '', url: '' });
    }
  };

  const removeReference = (index: number) => {
    setFormData({
      ...formData,
      references: formData.references?.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
      >
        <div className="flex justify-between items-start gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
          <h3 className="text-lg font-semibold">{supplement ? '编辑补剂' : '添加补剂'}</h3>
          <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 p-1 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-[calc(90vh-8rem)] overflow-y-auto px-6 py-4 pr-2">
        {/* 基本信息 */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h4 className="font-medium mb-3 text-gray-700">基本信息</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                单颗补剂编号（SPM）
                <span className="ml-2 text-xs text-gray-500 font-normal">(SPM0001)</span>
              </label>
              {supplement?.item_code ? (
                <>
                  <input
                    type="text"
                    readOnly
                    value={supplement.item_code}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm text-gray-800 cursor-default"
                  />
                  <p className="mt-1 text-xs text-gray-500">编号不可修改</p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    disabled
                    value=""
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="留空自动生成，格式: SPM0001"
                  />
                  <p className="mt-1 text-xs text-gray-500">新建时留空即可，保存后由系统自动生成 SPM 编号</p>
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">补剂名称 *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="如：维生素C"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">副标题</label>
              <input
                type="text"
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="如：每日一颗"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="补剂的简要描述"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">用量</label>
                <input
                  type="text"
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="如：1000mg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">频率</label>
                <input
                  type="text"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="如：每日一次"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">图标路径</label>
                <input
                  type="text"
                  value={formData.icon_path}
                  onChange={(e) => setFormData({ ...formData, icon_path: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="/buji.png"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">显示顺序</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <label className="text-sm">启用</label>
            </div>
          </div>
        </div>

        {/* 功效列表 */}
        <div className="bg-white p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-gray-700">功效列表</h4>
          <div className="space-y-2 mb-3">
            {formData.benefits?.map((benefit, i) => (
              <div key={i} className="flex items-start justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="text-sm">{benefit.text}</div>
                  {benefit.references && benefit.references.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      参考文献: [{benefit.references.join(', ')}]
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeBenefit(i)}
                  className="ml-2 text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={newBenefit.text}
              onChange={(e) => setNewBenefit({ ...newBenefit, text: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="功效描述，如：提升免疫力"
            />
            <input
              type="text"
              value={newBenefit.references}
              onChange={(e) => setNewBenefit({ ...newBenefit, references: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="参考文献编号（用逗号分隔），如：1,2,3"
            />
            <button
              type="button"
              onClick={addBenefit}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              添加功效
            </button>
          </div>
        </div>

        {/* 适用场景 */}
        <div className="bg-white p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-gray-700">适用场景</h4>
          <div className="space-y-2 mb-3">
            {formData.scenarios?.map((scenario, i) => (
              <div key={i} className="p-2 bg-gray-50 rounded">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{scenario.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{scenario.description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeScenario(i)}
                    className="ml-2 text-red-600 hover:text-red-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={newScenario.title}
              onChange={(e) => setNewScenario({ ...newScenario, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="场景标题，如：你经常生病感冒"
            />
            <textarea
              value={newScenario.description}
              onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={2}
              placeholder="场景描述"
            />
            <button
              type="button"
              onClick={addScenario}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              添加场景
            </button>
          </div>
        </div>

        {/* 参考文献 */}
        <div className="bg-white p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-gray-700">参考文献</h4>
          <div className="space-y-2 mb-3">
            {formData.references?.map((ref, i) => (
              <div key={i} className="flex items-start justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1 text-sm">
                  {ref.url ? (
                    <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {ref.text}
                    </a>
                  ) : (
                    ref.text
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeReference(i)}
                  className="ml-2 text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={newReference.text}
              onChange={(e) => setNewReference({ ...newReference, text: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="参考文献文本"
            />
            <input
              type="url"
              value={newReference.url}
              onChange={(e) => setNewReference({ ...newReference, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="参考文献链接（可选）"
            />
            <button
              type="button"
              onClick={addReference}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              添加参考文献
            </button>
          </div>
        </div>

        {/* 标签 */}
        <div className="bg-white p-4 rounded-lg">
          <h4 className="font-medium mb-3 text-gray-700">标签</h4>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="输入标签后按回车"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button type="button" onClick={addTag} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">
              添加
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.tags?.map((tag, i) => (
              <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded flex items-center">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 shrink-0 bg-white">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
