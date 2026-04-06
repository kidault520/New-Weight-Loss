import { useEffect, useState } from 'react';
import { apiClient } from '../../config/api';
import { Save } from 'lucide-react';

interface NutritionContent {
  id?: string;
  section_type: 'supplement' | 'diet' | 'lifestyle';
  content_data: {
    id: string;
    name: string;
    description: string;
    dosage?: string;
    icon?: string;
    color?: string;
    tags?: string[];
  };
  display_order: number;
  is_active: boolean;
}

export default function NutritionSolutionEditor() {
  const [content, setContent] = useState<NutritionContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const data = await apiClient.get<{ content: NutritionContent[] }>('/api/admin/content/nutrition-solutions');
      setContent(data.content);
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/admin/content/nutrition-solutions', { content });
      alert('保存成功');
    } catch (error) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateContent = (index: number, field: string, value: any) => {
    const newContent = [...content];
    if (field.startsWith('content_data.')) {
      const subField = field.replace('content_data.', '');
      newContent[index] = {
        ...newContent[index],
        content_data: {
          ...newContent[index].content_data,
          [subField]: value,
        },
      };
    } else {
      newContent[index] = {
        ...newContent[index],
        [field]: value,
      };
    }
    setContent(newContent);
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  const sections = [
    { type: 'supplement' as const, label: '补剂方案' },
    { type: 'diet' as const, label: '餐食方案' },
    { type: 'lifestyle' as const, label: '生活方式方案' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">营养方案页内容</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const sectionContent = content.find(c => c.section_type === section.type);
          const index = content.findIndex(c => c.section_type === section.type);

          return (
            <div key={section.type} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-4">{section.label}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">名称</label>
                  <input
                    type="text"
                    value={sectionContent?.content_data.name || ''}
                    onChange={(e) => updateContent(index >= 0 ? index : content.length, 'content_data.name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">描述</label>
                  <textarea
                    value={sectionContent?.content_data.description || ''}
                    onChange={(e) => updateContent(index >= 0 ? index : content.length, 'content_data.description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">用量/频率</label>
                  <input
                    type="text"
                    value={sectionContent?.content_data.dosage || ''}
                    onChange={(e) => updateContent(index >= 0 ? index : content.length, 'content_data.dosage', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">图标路径</label>
                  <input
                    type="text"
                    value={sectionContent?.content_data.icon || ''}
                    onChange={(e) => updateContent(index >= 0 ? index : content.length, 'content_data.icon', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}











