import { useEffect, useState } from 'react';
import { apiClient } from '../config/api';
import { Users, FileText, BarChart3, Activity } from 'lucide-react';

interface OverviewStats {
  totalUsers: number;
  newUsersLast30Days: number;
  completedOnboarding: number;
  totalHealthRecords: number;
  totalAssessments: number;
  totalMealPlans: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiClient.get<{ overview: OverviewStats }>('/api/admin/statistics/overview');
      setStats(data.overview);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: '总用户数',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: '近30天新用户',
      value: stats?.newUsersLast30Days || 0,
      icon: Activity,
      color: 'bg-green-500',
    },
    {
      title: '完成引导',
      value: stats?.completedOnboarding || 0,
      icon: FileText,
      color: 'bg-yellow-500',
    },
    {
      title: '健康记录',
      value: stats?.totalHealthRecords || 0,
      icon: BarChart3,
      color: 'bg-purple-500',
    },
    {
      title: '健康评估',
      value: stats?.totalAssessments || 0,
      icon: BarChart3,
      color: 'bg-indigo-500',
    },
    {
      title: '餐食计划',
      value: stats?.totalMealPlans || 0,
      icon: FileText,
      color: 'bg-pink-500',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">仪表盘</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-lg shadow p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{card.value.toLocaleString()}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}











