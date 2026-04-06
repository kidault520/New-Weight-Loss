import { useEffect, useState } from 'react';
import { apiClient } from '../config/api';

export default function StatisticsDashboard() {
  const [userStats, setUserStats] = useState<any>(null);
  const [healthStats, setHealthStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [userData, healthData] = await Promise.all([
        apiClient.get('/api/admin/statistics/users?period=month'),
        apiClient.get('/api/admin/statistics/health-data?period=month'),
      ]);
      setUserStats(userData);
      setHealthStats(healthData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">数据统计</h1>
      <div className="space-y-6">
        {userStats && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">用户统计</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">总用户数</p>
                <p className="text-2xl font-bold">{userStats.totalUsers}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">完成引导率</p>
                <p className="text-2xl font-bold">{userStats.onboardingCompletionRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}
        {healthStats && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">健康数据统计</h2>
            <p className="text-gray-600">详细统计图表开发中...</p>
          </div>
        )}
      </div>
    </div>
  );
}











