import { useEffect, useState } from 'react';
import { apiClient } from '../config/api';

export default function SystemConfig() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await apiClient.get<{ configs: any[] }>('/api/admin/config');
      setConfigs(data.configs);
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">系统配置</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">系统配置管理功能开发中…（已拉取 {configs.length} 项）</p>
      </div>
    </div>
  );
}


