import React, { useEffect, useState } from 'react';
import { Watch, Smartphone, Activity, WifiOff, Plus, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import { DrawerScreen } from './common/DrawerScreen';
import { LoadingState } from './common/LoadingState';
import { EmptyState } from './common/EmptyState';
import { ConfirmModal } from './common/ConfirmModal';
import { SecondaryPageHeader } from './common/SecondaryPageHeader';

interface DeviceInfo {
  id: string;
  device_name: string;
  device_type: string;
  brand?: string;
  model?: string;
  connection_status: 'connected' | 'disconnected' | 'error';
  last_sync_at?: string;
  connected_at: string;
  sync_frequency: string;
  synced_metrics: string[];
}

interface MyDevicesScreenProps {
  onClose: () => void;
}

const MyDevicesScreen: React.FC<MyDevicesScreenProps> = ({ onClose }) => {
  const deviceSyncProvider = String(import.meta.env.VITE_DEVICE_SYNC_PROVIDER || '').trim();
  const isDemoMode = !deviceSyncProvider;
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', user.id)
        .order('connected_at', { ascending: false });

      if (error) throw error;

      setDevices(data || []);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDevice = async (deviceId: string) => {
    setSyncing(deviceId);
    try {
      if (isDemoMode) {
        setSyncMessage('当前为演示模式，设备同步结果仅用于界面演示，不代表真实三方同步。');
      }
      const { error } = await supabase
        .from('user_devices')
        .update({
          last_sync_at: new Date().toISOString(),
          connection_status: 'connected'
        })
        .eq('id', deviceId);

      if (error) throw error;

      await loadDevices();
    } catch (error) {
      console.error('Failed to sync device:', error);
    } finally {
      setSyncing(null);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('user_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      await loadDevices();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return '从未同步';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 30) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN');
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'smart_watch':
        return Watch;
      case 'fitness_tracker':
        return Activity;
      case 'smart_scale':
        return Activity;
      default:
        return Smartphone;
    }
  };

  const getDeviceTypeName = (deviceType: string) => {
    switch (deviceType) {
      case 'smart_watch':
        return '智能手表';
      case 'fitness_tracker':
        return '健身追踪器';
      case 'smart_scale':
        return '智能体重秤';
      default:
        return '智能设备';
    }
  };

  const getMetricName = (metric: string) => {
    const names: Record<string, string> = {
      'steps': '步数',
      'heart_rate': '心率',
      'sleep': '睡眠',
      'weight': '体重',
      'blood_pressure': '血压',
      'blood_glucose': '血糖',
      'calories': '卡路里',
      'distance': '距离',
    };
    return names[metric] || metric;
  };

  return (
    <DrawerScreen show={true} onClose={onClose} showDragHandle={false} showMask={false}>
      <div className="flex flex-col h-full bg-gray-50">
        <SecondaryPageHeader title="我的设备" onClose={onClose} />

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <LoadingState />
          ) : (
            <>
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-3 mb-4">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">设备同步</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {isDemoMode
                        ? '当前为演示模式：界面可体验设备管理流程，真实三方设备同步尚未接通。'
                        : '连接您的健康设备，自动同步运动、睡眠、体重等数据，让健康管理更轻松'}
                    </p>
                  </div>
                </div>
              </div>
              {syncMessage && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {syncMessage}
                </div>
              )}

              {devices.length === 0 ? (
                <EmptyState 
                  icon={<Watch className="w-10 h-10 text-gray-400" />} 
                  title="暂无连接设备"
                  description={isDemoMode ? '演示模式下可查看设备入口，真实设备接入后可自动同步数据' : '连接设备以自动同步您的健康数据'}
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {devices.map((device) => {
                const DeviceIcon = getDeviceIcon(device.device_type);
                const isConnected = device.connection_status === 'connected';
                const isSyncing = syncing === device.id;

                return (
                  <div key={device.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isConnected ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            <DeviceIcon className={`w-6 h-6 ${
                              isConnected ? 'text-green-600' : 'text-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-base font-semibold text-gray-800">
                                {device.device_name}
                              </h3>
                              {isConnected ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <WifiOff className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {getDeviceTypeName(device.device_type)}
                              {device.brand && ` · ${device.brand}`}
                              {device.model && ` ${device.model}`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">连接状态</span>
                          <span className={`font-medium ${
                            isConnected ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {isConnected ? '已连接' : '未连接'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">上次同步</span>
                          <span className="text-gray-800 font-medium">
                            {formatLastSync(device.last_sync_at)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">同步频率</span>
                          <span className="text-gray-800 font-medium">
                            {device.sync_frequency === 'automatic' ? '自动同步' : '手动同步'}
                          </span>
                        </div>
                      </div>

                      {/* Synced Metrics */}
                      {device.synced_metrics && device.synced_metrics.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-600 mb-2">同步数据</p>
                          <div className="flex flex-wrap gap-1.5">
                            {device.synced_metrics.map((metric, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg"
                              >
                                {getMetricName(metric)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSyncDevice(device.id)}
                          disabled={isSyncing}
                          className="flex-1 py-2.5 rounded-xl border-2 border-gray-900 text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? '同步中...' : (isDemoMode ? '模拟同步' : '立即同步')}</span>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(device.id)}
                          className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

                  {/* Add New Device Button */}
                  <button className="w-full mt-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>添加新设备</span>
                  </button>
                </>
              )}
            </>
          )}

          <div className="mt-4 bg-white rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">使用提示</h4>
            <div className="space-y-2 text-xs text-gray-600">
              {isDemoMode && <p>• 当前处于演示模式，设备数据不会从第三方平台真实拉取。</p>}
              <p>• 设备首次连接时会自动同步历史数据</p>
              <p>• 建议开启自动同步以获取最新健康数据</p>
              <p>• 确保设备蓝牙已开启并保持在连接范围内</p>
              <p>• 如遇到同步问题，请尝试重新连接设备</p>
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          <ConfirmModal
            show={!!showDeleteConfirm}
            title="确认移除设备？"
            message="移除设备后，将停止同步该设备的健康数据。历史数据不会被删除。"
            onCancel={() => setShowDeleteConfirm(null)}
            onConfirm={() => showDeleteConfirm && handleDeleteDevice(showDeleteConfirm)}
            confirmText="确认移除"
            zIndex={65}
          />

          <div className="flex-shrink-0 h-4"></div>
        </div>
      </div>
    </DrawerScreen>
  );
};

export default MyDevicesScreen;
