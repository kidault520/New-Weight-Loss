import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../config/api';
import SearchableSelect from '../common/SearchableSelect';
import ImageUpload from '../menu/ImageUpload';

interface Supplement {
  id: string;
  name: string;
  description?: string;
  dosage?: string;
  frequency?: string;
  supplement_type: string;
  icon_path: string;
  is_active: boolean;
}

interface PackageItem {
  id?: string;
  supplement_id: string;
  quantity: number;
  sort_order: number;
  supplement?: Supplement;
}

interface SupplementPackage {
  id?: string;
  package_code: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  is_active: boolean;
  created_at?: string;
  items?: PackageItem[];
}

interface SupplementPackageFormProps {
  package: SupplementPackage | null;
  onSave: (data: Partial<SupplementPackage> & { items: PackageItem[] }) => void;
  onCancel: () => void;
}

export default function SupplementPackageForm({ package: packageData, onSave, onCancel }: SupplementPackageFormProps) {
  const [formData, setFormData] = useState<Partial<SupplementPackage>>({
    package_code: packageData?.package_code || undefined,
    name: packageData?.name || '',
    description: packageData?.description || '',
    cover_image_url: packageData?.cover_image_url || '',
    is_active: packageData?.is_active ?? true,
  });

  const [items, setItems] = useState<PackageItem[]>(
    (packageData?.items && Array.isArray(packageData.items))
      ? packageData.items.map(item => ({
          id: item.id,
          supplement_id: item.supplement_id,
          quantity: item.quantity || 1,
          sort_order: item.sort_order || 0,
          supplement: item.supplement,
        }))
      : []
  );

  const [availableSupplements, setAvailableSupplements] = useState<Supplement[]>([]);
  const [loadingSupplements, setLoadingSupplements] = useState(true);
  const [selectedSupplementId, setSelectedSupplementId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  useEffect(() => {
    loadAvailableSupplements();
  }, []);

  useEffect(() => {
    if (packageData) {
      setFormData({
        package_code: packageData.package_code || undefined,
        name: packageData.name || '',
        description: packageData.description || '',
        cover_image_url: packageData.cover_image_url || '',
        is_active: packageData.is_active ?? true,
      });
      setItems(
        (packageData.items && Array.isArray(packageData.items))
          ? packageData.items.map(item => ({
              id: item.id,
              supplement_id: item.supplement_id,
              quantity: item.quantity || 1,
              sort_order: item.sort_order || 0,
              supplement: item.supplement,
            }))
          : []
      );
    }
  }, [packageData]);

  const loadAvailableSupplements = async () => {
    try {
      const data = await apiClient.get<{ supplements: Supplement[] }>('/api/admin/content/supplements?limit=1000');
      setAvailableSupplements((data.supplements || []).filter(s => s.is_active));
    } catch (error) {
      console.error('Failed to load supplements:', error);
    } finally {
      setLoadingSupplements(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedSupplementId) {
      alert('请选择补剂');
      return;
    }

    const selectedSupplement = availableSupplements.find(s => s.id === selectedSupplementId);
    if (!selectedSupplement) {
      alert('补剂不存在');
      return;
    }

    // Check if already added
    if (items.some(item => item.supplement_id === selectedSupplementId)) {
      alert('该补剂已添加到套餐中');
      return;
    }

    const newItem: PackageItem = {
      supplement_id: selectedSupplementId,
      quantity: selectedQuantity,
      sort_order: items.length,
      supplement: selectedSupplement,
    };

    setItems([...items, newItem]);
    setSelectedSupplementId('');
    setSelectedQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      sort_order: i
    })));
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    if (quantity < 1) return;
    const newItems = [...items];
    newItems[index].quantity = quantity;
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert('请输入套餐名称');
      return;
    }

    onSave({
      ...formData,
      items: items.map((item, index) => ({
        supplement_id: item.supplement_id,
        quantity: item.quantity,
        sort_order: index
      }))
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{packageData ? '编辑补剂疗程' : '添加补剂疗程'}</h3>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              套餐编号 {!packageData && <span className="text-gray-500 text-xs">(自动生成)</span>}
            </label>
            <input
              type="text"
              value={formData.package_code || ''}
              disabled={!packageData}
              onChange={(e) => setFormData({ ...formData, package_code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="sp0001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">套餐名称 *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="如：基础营养套餐"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">套餐描述</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="套餐的简要描述"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">套餐封面图</label>
          <ImageUpload
            value={formData.cover_image_url}
            folder="supplement-packages"
            onChange={(url) => setFormData((prev) => ({ ...prev, cover_image_url: url }))}
          />
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

        {packageData?.created_at && (
          <div className="text-sm text-gray-500">
            创建时间：{new Date(packageData.created_at).toLocaleString('zh-CN')}
          </div>
        )}

        {/* Add supplements section */}
        <div className="hidden border-t border-gray-200 pt-4">
          <h4 className="font-medium mb-3">添加补剂</h4>
          <div className="flex gap-2 mb-4">
            <SearchableSelect
              value={selectedSupplementId}
              onChange={(value) => setSelectedSupplementId(value)}
              options={[
                { value: '', label: '选择补剂' },
                ...availableSupplements
                  .filter(s => !items.some(item => item.supplement_id === s.id))
                  .map((supplement) => ({
                    value: supplement.id,
                    label: supplement.name,
                    keywords: [supplement.name, supplement.id],
                  })),
              ]}
              placeholder="选择补剂"
              searchPlaceholder="输入补剂名称模糊搜索"
              disabled={loadingSupplements}
              emptyText="没有匹配补剂"
              className="flex-1"
            />
            <input
              type="number"
              min="1"
              value={selectedQuantity}
              onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="数量"
            />
            <button
              type="button"
              onClick={handleAddItem}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium">套餐包含的补剂：</h5>
              {items.map((item, index) => {
                const supplement = item.supplement || availableSupplements.find(s => s.id === item.supplement_id);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{supplement?.name || '未知补剂'}</div>
                      {supplement?.dosage && (
                        <div className="text-sm text-gray-500">用量: {supplement.dosage}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm text-gray-600">件</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={!formData.name}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          title={!formData.name ? '请输入疗程名称' : ''}
        >
          保存
        </button>
      </div>
    </form>
  );
}





