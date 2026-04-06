import { useEffect, useState } from 'react';
import { apiClient } from '../config/api';

export default function PermissionManagement() {
  const [roles, setRoles] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesData, adminsData] = await Promise.all([
        apiClient.get<{ roles: any[] }>('/api/admin/permissions/roles'),
        apiClient.get<{ admins: any[] }>('/api/admin/permissions/admins'),
      ]);
      setRoles(rolesData.roles);
      setAdmins(adminsData.admins);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">权限管理</h1>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">角色管理</h2>
          <p className="text-gray-600">角色管理功能开发中…（已加载 {roles.length} 个角色）</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">管理员管理</h2>
          <p className="text-gray-600">管理员管理功能开发中…（已加载 {admins.length} 人）</p>
        </div>
      </div>
    </div>
  );
}











