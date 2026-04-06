import { useEffect, useState } from 'react';
import { apiClient } from '../../config/api';

export default function TemplateEditor() {
  const [, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await apiClient.get<{ templates: any[] }>('/api/admin/content/templates');
      setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">内容模板</h2>
      <p className="text-gray-600">内容模板管理功能开发中...</p>
    </div>
  );
}











