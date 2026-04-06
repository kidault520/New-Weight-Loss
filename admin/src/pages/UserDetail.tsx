import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../config/api';
import { ArrowLeft, Plus, BarChart3, Eye } from 'lucide-react';
import HealthDataDetailModal from '../components/HealthDataDetailModal';
import SearchableSelect from '../components/common/SearchableSelect';

interface UserData {
  user: {
    id: string;
    user_id: string;
    name?: string;
    nickname?: string;
    email?: string;
    phone?: string;
    age?: number;
    gender?: string;
    height?: number;
    current_weight?: number;
    target_weight?: number;
    activity_level?: string;
    fitness_goal?: string;
    bmr?: number;
    created_at: string;
    last_sign_in_at?: string;
  };
}

interface HealthRecord {
  id: string;
  record_type: string;
  value: number;
  unit?: string;
  nutrition_data?: any;
  exercise_data?: any;
  measurement_data?: any;
  emotion_data?: { emotion?: string; intensity?: number; message?: string | null };
  notes?: string;
  recorded_at: string;
}

interface DeliveryAddress {
  id: string;
  label: string;
  address: string;
  door_number: string;
  contact_name: string;
  phone: string;
  gender: string;
  is_default: boolean;
}

interface UserDevice {
  id: string;
  device_name: string;
  device_type: string;
  brand?: string;
  model?: string;
  connection_status: string;
  last_sync_at?: string;
}

interface Order {
  id: string;
  order_number: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  products?: {
    id: string;
    product_name: string;
    product_code: string;
    duration_days: number;
  };
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserData['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'reports' | 'health' | 'orders' | 'addresses' | 'delivery' | 'devices'>('profile');
  
  // Health data
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthFilter, setHealthFilter] = useState({ type: '', startDate: '', endDate: '' });
  const [showAddHealthRecord, setShowAddHealthRecord] = useState(false);
  const [selectedRecordType, setSelectedRecordType] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Addresses
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  
  // Devices
  const [devices, setDevices] = useState<UserDevice[]>([]);
  
  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Delivery schedules
  const [deliverySchedules, setDeliverySchedules] = useState<{
    config?: {
      start_date?: string;
      end_date?: string;
      selected_dates?: string[];
      selected_meal_types?: string[];
      delivery_address_id?: string;
    };
    schedules?: any[];
    statistics?: {
      total_meals: number;
      locked_meals: number;
      pending_meals: number;
    };
  } | null>(null);
  
  // Health reports (assessments)
  const [healthReports, setHealthReports] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setUser(null);
    setActiveTab('profile');
    loadUser();
  }, [id]);

  useEffect(() => {
    if (id && activeTab === 'health') {
      loadHealthData();
    } else if (id && activeTab === 'addresses') {
      loadAddresses();
    } else if (id && activeTab === 'devices') {
      loadDevices();
    } else if (id && activeTab === 'orders') {
      loadOrders();
    } else if (id && activeTab === 'delivery') {
      loadDeliverySchedules();
    } else if (id && activeTab === 'reports') {
      loadHealthReports();
    }
  }, [id, activeTab]);

  const loadUser = async () => {
    try {
      const data = await apiClient.get<UserData>(`/api/admin/users/${id}`);
      setUser(data.user);
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHealthData = async () => {
    setHealthLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('type', 'health_records'); // 总是请求健康记录类型
      if (healthFilter.type) params.append('recordType', healthFilter.type);
      if (healthFilter.startDate) params.append('startDate', healthFilter.startDate);
      if (healthFilter.endDate) params.append('endDate', healthFilter.endDate);
      
      const data = await apiClient.get<{ userData: { health_records: HealthRecord[] } }>(
        `/api/admin/users/${id}/data?${params}`
      );
      setHealthRecords(data.userData.health_records || []);
    } catch (error) {
      console.error('Failed to load health data:', error);
    } finally {
      setHealthLoading(false);
    }
  };

  const loadAddresses = async () => {
    try {
      console.log('Loading addresses for user:', id);
      const data = await apiClient.get<{ userData: { addresses: DeliveryAddress[] } }>(
        `/api/admin/users/${id}/data?type=addresses`
      );
      console.log('Addresses data received:', data);
      console.log('Addresses array:', data.userData?.addresses);
      const addressesList = data.userData?.addresses || [];
      console.log('Setting addresses, count:', addressesList.length);
      console.log('Addresses details:', addressesList);
      setAddresses(addressesList);
      console.log('Addresses state updated');
    } catch (error: any) {
      console.error('Failed to load addresses:', error);
      console.error('Error details:', error?.response?.data);
      alert(`加载地址失败: ${error?.response?.data?.error || error?.message || '未知错误'}`);
    }
  };

  const loadDevices = async () => {
    try {
      const data = await apiClient.get<{ userData: { devices: UserDevice[] } }>(
        `/api/admin/users/${id}/data?type=devices`
      );
      setDevices(data.userData.devices || []);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await apiClient.get<{ userData: { orders: Order[] } }>(
        `/api/admin/users/${id}/data?type=orders`
      );
      setOrders(data.userData.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const loadDeliverySchedules = async () => {
    try {
      console.log('Loading delivery schedules for user:', id);
      const data = await apiClient.get<{ userData: { delivery_schedules: any } }>(
        `/api/admin/users/${id}/data?type=delivery_schedules`
      );
      console.log('Delivery schedules data received:', data);
      console.log('Delivery schedules object:', data.userData?.delivery_schedules);
      const schedulesData = data.userData?.delivery_schedules || null;
      
      // 对配送计划进行排序：先按日期，再按餐型（早餐 -> 午餐 -> 晚餐）
      if (schedulesData && schedulesData.schedules && Array.isArray(schedulesData.schedules)) {
        const mealTypeOrder: Record<string, number> = { 'breakfast': 1, 'lunch': 2, 'dinner': 3 };
        schedulesData.schedules.sort((a: any, b: any) => {
          // 先按日期排序
          const dateA = new Date(a.delivery_date).getTime();
          const dateB = new Date(b.delivery_date).getTime();
          if (dateA !== dateB) {
            return dateA - dateB;
          }
          // 同一天内，按餐型排序
          const mealTypeA = a.item_name?.includes('午餐') ? 'lunch' : 
                           a.item_name?.includes('晚餐') ? 'dinner' : 
                           a.item_name?.includes('早餐') ? 'breakfast' : 
                           a.delivery_type === 'meal' ? (a.delivery_time?.includes('11:30') ? 'lunch' : 'dinner') : 'other';
          const mealTypeB = b.item_name?.includes('午餐') ? 'lunch' : 
                           b.item_name?.includes('晚餐') ? 'dinner' : 
                           b.item_name?.includes('早餐') ? 'breakfast' : 
                           b.delivery_type === 'meal' ? (b.delivery_time?.includes('11:30') ? 'lunch' : 'dinner') : 'other';
          return (mealTypeOrder[mealTypeA] || 99) - (mealTypeOrder[mealTypeB] || 99);
        });
      }
      
      console.log('Setting delivery schedules:', schedulesData);
      setDeliverySchedules(schedulesData);
      console.log('Delivery schedules state updated');
    } catch (error: any) {
      console.error('Failed to load delivery schedules:', error);
      console.error('Error details:', error?.response?.data);
      alert(`加载配送计划失败: ${error?.response?.data?.error || error?.message || '未知错误'}`);
    }
  };

  const loadHealthReports = async () => {
    try {
      const data = await apiClient.get<{ userData: { assessments: any[]; reports: any[] } }>(
        `/api/admin/users/${id}/data?type=assessments`
      );
      // 合并健康评估和自定义报告
      const assessments = data.userData.assessments || [];
      const customReports = data.userData.reports || [];
      setHealthReports([...assessments, ...customReports].sort((a, b) => {
        const dateA = new Date(a.assessment_date || a.generation_date || 0).getTime();
        const dateB = new Date(b.assessment_date || b.generation_date || 0).getTime();
        return dateB - dateA;
      }));
    } catch (error) {
      console.error('Failed to load health reports:', error);
    }
  };

  const handleAddHealthRecord = async (recordData: Partial<HealthRecord>) => {
    try {
      await apiClient.post(`/api/admin/users/${id}/health-records`, recordData);
      setShowAddHealthRecord(false);
      loadHealthData();
    } catch (error) {
      console.error('Failed to add health record:', error);
      alert('添加失败');
    }
  };

  const getRecordTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      weight: '体重',
      water: '饮水',
      steps: '步数',
      calories: '卡路里缺口',
      exercise: '运动',
      sleep: '睡眠',
      blood_glucose: '血糖',
      measurements: '围度',
      food: '营养素',
      hrv: '心率变异性',
      emotion: '心情',
      supplement: '补剂',
    };
    return labels[type] || type;
  };

  // 定义所有健康数据类型（按指定顺序排列）
  const allHealthRecordTypes = [
    // 第一排
    'calories',      // 卡路里缺口
    'weight',        // 体重
    'measurements',  // 围度
    // 第二排
    'food',          // 营养素
    'water',         // 饮水
    'blood_glucose', // 血糖
    // 第三排
    'sleep',         // 睡眠
    'emotion',       // 心情
    'hrv',           // 心率变异性
    'exercise',      // 运动
    'steps',         // 步数
    'supplement',    // 补剂
  ];

  // 获取每个类型的默认单位
  const getDefaultUnit = (type: string) => {
    const unitMap: Record<string, string> = {
      weight: 'kg',
      water: 'ml',
      steps: '步',
      calories: 'kcal',
      blood_glucose: 'mmol/L',
      sleep: '小时',
      emotion: '强度(0-1)',
    };
    return unitMap[type] || '';
  };

  // 按类型分组健康数据
  const groupedHealthRecords = useMemo(() => {
    const groups: Record<string, HealthRecord[]> = {};
    healthRecords.forEach(record => {
      if (!groups[record.record_type]) {
        groups[record.record_type] = [];
      }
      groups[record.record_type].push(record);
    });
    return groups;
  }, [healthRecords]);

  // 处理查看明细
  const handleViewDetail = (recordType: string) => {
    const records = groupedHealthRecords[recordType] || [];
    // 如果没有数据，不打开明细弹窗
    if (records.length === 0) {
      return;
    }
    setSelectedRecordType(recordType);
    setShowDetailModal(true);
  };

  // 获取当前选中类型的记录
  const selectedRecords = useMemo(() => {
    if (!selectedRecordType) return [];
    return groupedHealthRecords[selectedRecordType] || [];
  }, [selectedRecordType, groupedHealthRecords]);

  const formatValue = (record: HealthRecord) => {
    // 围度数据格式化
    if (record.record_type === 'measurements' && record.measurement_data) {
      try {
        const data = typeof record.measurement_data === 'string' 
          ? JSON.parse(record.measurement_data) 
          : record.measurement_data;
        
        const parts: string[] = [];
        if (data.chest) parts.push(`胸围${data.chest}cm`);
        if (data.waist) parts.push(`腰围${data.waist}cm`);
        if (data.hips) parts.push(`臀围${data.hips}cm`);
        if (data.upperArm) parts.push(`上臂${data.upperArm}cm`);
        if (data.thigh) parts.push(`大腿${data.thigh}cm`);
        if (data.calf) parts.push(`小腿${data.calf}cm`);
        
        return parts.length > 0 ? parts.join(' | ') : '无数据';
      } catch (e) {
        return `${record.value || 0} ${record.unit || ''}`.trim();
      }
    }
    
    // 营养素数据格式化
    if (record.record_type === 'food' && record.nutrition_data) {
      try {
        const data = typeof record.nutrition_data === 'string' 
          ? JSON.parse(record.nutrition_data) 
          : record.nutrition_data;
        
        const parts: string[] = [];
        if (data.name) {
          const quantity = data.quantity || 1;
          const unit = data.unit || '份';
          if (quantity > 1) {
            parts.push(`${data.name} ${quantity}${unit}`);
          } else {
            parts.push(data.name);
          }
        }
        
        const nutritionParts: string[] = [];
        if (data.calories) nutritionParts.push(`${data.calories}kcal`);
        if (data.protein) nutritionParts.push(`蛋白质${data.protein}g`);
        if (data.carbs) nutritionParts.push(`碳水${data.carbs}g`);
        if (data.fat) nutritionParts.push(`脂肪${data.fat}g`);
        if (data.fiber) nutritionParts.push(`纤维${data.fiber}g`);
        
        if (nutritionParts.length > 0) {
          parts.push(nutritionParts.join(' '));
        }
        
        if (data.mealType) {
          parts.push(`(${data.mealType})`);
        }
        
        return parts.length > 0 ? parts.join(' | ') : '无数据';
      } catch (e) {
        return `${record.value || 0} ${record.unit || ''}`.trim();
      }
    }
    
    // 运动数据格式化
    if (record.record_type === 'exercise' && record.exercise_data) {
      try {
        const data = typeof record.exercise_data === 'string' 
          ? JSON.parse(record.exercise_data) 
          : record.exercise_data;
        
        const parts: string[] = [];
        if (data.exercise_name) parts.push(data.exercise_name);
        if (data.duration) parts.push(`${data.duration}分钟`);
        if (data.calories) parts.push(`${data.calories}kcal`);
        if (data.distance) parts.push(`${data.distance}km`);
        
        return parts.length > 0 ? parts.join(' | ') : '无数据';
      } catch (e) {
        return `${record.value || 0} ${record.unit || ''}`.trim();
      }
    }

    if (record.record_type === 'emotion') {
      const ed =
        record.emotion_data && typeof record.emotion_data === 'object'
          ? record.emotion_data
          : {};
      const emo = typeof ed.emotion === 'string' ? ed.emotion : '—';
      const inten = Number(record.value ?? ed.intensity ?? 0);
      return `${emo} | 强度 ${Number.isFinite(inten) ? inten.toFixed(2) : '—'}`;
    }
    
    // 其他类型直接显示数值和单位
    return `${record.value || 0} ${record.unit || ''}`.trim();
  };

  if (!loading && !user) {
    return (
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回用户列表
        </Link>
        <p className="text-gray-600">用户不存在</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/admin/users"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回用户列表
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">用户详情</h1>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={loading || !user}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            重置密码
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'profile', label: '个人资料' },
              { id: 'reports', label: '报告' },
              { id: 'health', label: '健康数据' },
              { id: 'orders', label: '订单' },
              { id: 'addresses', label: '地址' },
              { id: 'delivery', label: '配送计划' },
              { id: 'devices', label: '设备' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={loading || !user}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 text-sm font-medium border-b-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-gray-600">加载用户资料中…</p>
        </div>
      )}

      {/* Tab Content */}
      {!loading && user && activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">账号邮箱</label>
              <p className="text-sm text-gray-900">{user.email || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
              <p className="text-sm text-gray-900">{user.phone || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <p className="text-sm text-gray-900">{user.name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
              <p className="text-sm text-gray-900">{user.nickname || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年龄</label>
              <p className="text-sm text-gray-900">{user.age || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
              <p className="text-sm text-gray-900">
                {user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : user.gender || '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">身高 (cm)</label>
              <p className="text-sm text-gray-900">{user.height || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">当前体重 (kg)</label>
              <p className="text-sm text-gray-900">{user.current_weight || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目标体重 (kg)</label>
              <p className="text-sm text-gray-900">{user.target_weight || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">活动水平</label>
              <p className="text-sm text-gray-900">{user.activity_level || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">健身目标</label>
              <p className="text-sm text-gray-900">{user.fitness_goal || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">基础代谢率 (BMR)</label>
              <p className="text-sm text-gray-900">{user.bmr || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">注册时间</label>
              <p className="text-sm text-gray-900">
                {new Date(user.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最后登录</label>
              <p className="text-sm text-gray-900">
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('zh-CN') : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && user && activeTab === 'health' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">数据类型</label>
                <SearchableSelect
                  value={healthFilter.type}
                  onChange={(value) => {
                    setHealthFilter({ ...healthFilter, type: value });
                    setTimeout(loadHealthData, 100);
                  }}
                  options={[
                    { value: '', label: '全部' },
                    { value: 'weight', label: '体重' },
                    { value: 'water', label: '饮水' },
                    { value: 'steps', label: '步数' },
                    { value: 'calories', label: '卡路里缺口' },
                    { value: 'exercise', label: '运动' },
                    { value: 'sleep', label: '睡眠' },
                    { value: 'emotion', label: '心情' },
                    { value: 'blood_glucose', label: '血糖' },
                    { value: 'measurements', label: '围度' },
                    { value: 'food', label: '营养素' },
                    { value: 'hrv', label: '心率变异性' },
                    { value: 'supplement', label: '补剂' },
                  ]}
                  placeholder="全部"
                  searchPlaceholder="输入数据类型关键词筛选"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                <input
                  type="date"
                  value={healthFilter.startDate}
                  onChange={(e) => {
                    setHealthFilter({ ...healthFilter, startDate: e.target.value });
                    setTimeout(loadHealthData, 100);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                <input
                  type="date"
                  value={healthFilter.endDate}
                  onChange={(e) => {
                    setHealthFilter({ ...healthFilter, endDate: e.target.value });
                    setTimeout(loadHealthData, 100);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setHealthFilter({ type: '', startDate: '', endDate: '' });
                    setTimeout(loadHealthData, 100);
                  }}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  清除筛选
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAddHealthRecord(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加记录
              </button>
            </div>
          </div>

          {/* Health Data by Category */}
          {healthLoading ? (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allHealthRecordTypes.map((recordType) => {
                const records = groupedHealthRecords[recordType] || [];
                const latestRecord = records.length > 0 ? records[records.length - 1] : null;
                const avgValue = records.length > 0 
                  ? records.reduce((sum, r) => sum + (r.value || 0), 0) / records.length 
                  : 0;
                const unit = latestRecord?.unit || getDefaultUnit(recordType);
                const hasData = records.length > 0;

                return (
                  <div
                    key={recordType}
                    className={`bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-lg transition-shadow ${
                      hasData ? 'cursor-pointer' : 'cursor-default opacity-75'
                    }`}
                    onClick={() => hasData && handleViewDetail(recordType)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className={`w-5 h-5 ${hasData ? 'text-blue-500' : 'text-gray-400'}`} />
                        <h3 className={`text-lg font-semibold ${hasData ? 'text-gray-900' : 'text-gray-500'}`}>
                          {getRecordTypeLabel(recordType)}
                        </h3>
                      </div>
                      {hasData && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(recordType);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="查看明细"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">最新记录</div>
                        <div className={`text-2xl font-bold ${hasData ? 'text-gray-900' : 'text-gray-400'}`}>
                          {latestRecord?.value?.toFixed(2) || '0.00'}
                          {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {latestRecord?.recorded_at
                            ? new Date(latestRecord.recorded_at).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">平均值</span>
                          <span className={`font-medium ${hasData ? 'text-gray-900' : 'text-gray-400'}`}>
                            {avgValue.toFixed(2)}
                            {unit && <span className="text-gray-500 ml-1">{unit}</span>}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span className="text-gray-500">记录数</span>
                          <span className={`font-medium ${hasData ? 'text-gray-900' : 'text-gray-400'}`}>
                            {records.length} 条
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Health Records Table (Optional - can be hidden or shown via toggle) */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">详细记录列表</h3>
            </div>
            {healthLoading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">加载中...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">数值</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">记录时间</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">备注</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {healthRecords.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      healthRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {getRecordTypeLabel(record.record_type)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatValue(record)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(record.recorded_at).toLocaleString('zh-CN')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {record.notes || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && user && activeTab === 'addresses' && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">配送地址</h2>
            {!addresses || addresses.length === 0 ? (
              <p className="text-gray-500">暂无地址</p>
            ) : (
              <div className="space-y-4">
                {addresses.map((address) => (
                  <div key={address.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{address.label || '未命名地址'}</span>
                          {address.is_default && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">默认</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{address.address || '-'}</p>
                        <p className="text-sm text-gray-600">{address.door_number || '-'}</p>
                        <p className="text-sm text-gray-600 mt-2">
                          联系人：{address.contact_name || '-'} | {address.phone || '-'}
                        </p>
                        {address.gender && (
                          <p className="text-xs text-gray-500 mt-1">
                            性别：{address.gender === 'male' ? '男' : '女'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && user && activeTab === 'devices' && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">设备</h2>
            {devices.length === 0 ? (
              <p className="text-gray-500">暂无设备</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">品牌/型号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">连接状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最后同步</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {devices.map((device) => (
                      <tr key={device.id}>
                        <td className="px-6 py-4 text-sm text-gray-900">{device.device_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{device.device_type}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {device.brand} {device.model}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{device.connection_status}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {device.last_sync_at ? new Date(device.last_sync_at).toLocaleString('zh-CN') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && user && activeTab === 'orders' && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">订单</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500">暂无订单</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">数量</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">支付方式</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">支付状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{order.order_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>{order.products?.product_name || '-'}</div>
                          <div className="text-xs text-gray-500">{order.products?.product_code || '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">×{order.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{order.payment_method}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                            order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.payment_status === 'paid' ? '已支付' :
                             order.payment_status === 'pending' ? '待支付' :
                             order.payment_status === 'refunded' ? '已退款' : '已取消'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded ${
                            order.order_status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.order_status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            order.order_status === 'processing' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.order_status === 'pending' ? '待确认' :
                             order.order_status === 'confirmed' ? '已确认' :
                             order.order_status === 'processing' ? '处理中' :
                             order.order_status === 'completed' ? '已完成' : '已取消'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-red-600">¥{order.total_amount.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && user && activeTab === 'delivery' && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">配送计划</h2>
            
            {(() => {
              console.log('🔍 Rendering delivery schedules tab');
              console.log('deliverySchedules state:', deliverySchedules);
              console.log('deliverySchedules?.schedules:', deliverySchedules?.schedules);
              console.log('deliverySchedules?.schedules?.length:', deliverySchedules?.schedules?.length);
              
              if (!deliverySchedules) {
                console.log('❌ No delivery schedules data');
                return <p className="text-gray-500">加载中...</p>;
              }
              
              if (!deliverySchedules.schedules || deliverySchedules.schedules.length === 0) {
                console.log('⚠️ No schedules found');
                console.log('Config:', deliverySchedules.config);
                console.log('Statistics:', deliverySchedules.statistics);
                return <p className="text-gray-500">暂无配送计划</p>;
              }
              
              console.log('✅ Rendering schedules, count:', deliverySchedules.schedules.length);
              return null; // Will be replaced by actual content below
            })()}
            {deliverySchedules && deliverySchedules.schedules && deliverySchedules.schedules.length > 0 && (
              <div className="space-y-6">
                {/* 配送计划配置信息 */}
                {deliverySchedules.config && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">配送计划配置</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 mb-1">开始日期</div>
                        <div className="font-medium text-gray-900">
                          {deliverySchedules.config.start_date 
                            ? new Date(deliverySchedules.config.start_date).toLocaleDateString('zh-CN')
                            : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">结束日期</div>
                        <div className="font-medium text-gray-900">
                          {deliverySchedules.config.end_date 
                            ? new Date(deliverySchedules.config.end_date).toLocaleDateString('zh-CN')
                            : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">包含餐型</div>
                        <div className="font-medium text-gray-900">
                          {deliverySchedules.config.selected_meal_types?.map((type: string) => {
                            const typeMap: Record<string, string> = {
                              'breakfast': '早餐',
                              'lunch': '午餐',
                              'dinner': '晚餐'
                            };
                            return typeMap[type] || type;
                          }).join('、') || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">配送地址ID</div>
                        <div className="font-medium text-gray-900">
                          {deliverySchedules.config.delivery_address_id || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 统计信息 */}
                {deliverySchedules.statistics && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">统计信息</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-blue-600 mb-1">总餐数</div>
                        <div className="text-lg font-bold text-blue-900">
                          {deliverySchedules.statistics.total_meals}
                        </div>
                      </div>
                      <div>
                        <div className="text-yellow-600 mb-1">已锁定</div>
                        <div className="text-lg font-bold text-yellow-900">
                          {deliverySchedules.statistics.locked_meals}
                        </div>
                      </div>
                      <div>
                        <div className="text-green-600 mb-1">待配送</div>
                        <div className="text-lg font-bold text-green-900">
                          {deliverySchedules.statistics.pending_meals}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 配送计划明细表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">配送日期</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">餐型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">配送时间</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">配送地址</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">锁定状态</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deliverySchedules.schedules.map((schedule) => {
                        // 判断是否锁定（优先使用is_locked字段，如果没有则根据配送时间判断）
                        const isLocked = (() => {
                          if (schedule.is_locked === true) {
                            return true;
                          }
                          if (schedule.delivery_date && schedule.delivery_time) {
                            const deliveryTimeStr = schedule.delivery_time.split('-')[0]; // 获取开始时间
                            const deliveryDateTime = new Date(`${schedule.delivery_date}T${deliveryTimeStr}`);
                            const lockTime = new Date(deliveryDateTime.getTime() - 60 * 60 * 1000);
                            return new Date() >= lockTime;
                          }
                          return false;
                        })();

                        const mealTypeMap: Record<string, string> = {
                          'breakfast': '早餐',
                          'lunch': '午餐',
                          'dinner': '晚餐',
                          'meal': schedule.item_name || '餐食'
                        };

                        return (
                          <tr key={schedule.id} className={isLocked ? 'bg-yellow-50' : ''}>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {new Date(schedule.delivery_date).toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                weekday: 'short'
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {mealTypeMap[schedule.delivery_type] || schedule.delivery_type || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {schedule.delivery_time || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              <div className="max-w-xs truncate" title={schedule.delivery_address || ''}>
                                {schedule.delivery_address || '-'}
                              </div>
                              {schedule.delivery_address_label && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {schedule.delivery_address_label}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-gray-500">
                              {schedule.orders?.order_number || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {schedule.orders?.products?.product_name || '-'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 text-xs rounded ${
                                schedule.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                schedule.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                                schedule.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {schedule.status === 'pending' ? '待配送' :
                                 schedule.status === 'in_transit' ? '配送中' :
                                 schedule.status === 'delivered' ? '已送达' :
                                 schedule.status === 'cancelled' ? '已取消' : schedule.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {isLocked ? (
                                <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800 flex items-center">
                                  <span className="mr-1">🔒</span>
                                  已锁定
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                                  可修改
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && user && activeTab === 'reports' && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">健康报告</h2>
            {healthReports.length === 0 ? (
              <p className="text-gray-500">暂无健康报告</p>
            ) : (
              <div className="space-y-4">
                {healthReports.map((report) => {
                  const isAssessment = !!report.assessment_date;
                  const reportDate = report.assessment_date || report.generation_date;
                  const overallScore = report.overall_score || report.score;
                  
                  return (
                    <div key={report.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-base font-semibold text-gray-800">
                              {isAssessment ? '健康综合评估' : '自定义报告'}
                            </h3>
                            {report.overall_score !== undefined && (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">使用中</span>
                            )}
                          </div>
                          {overallScore !== undefined && (
                            <div className="mb-2">
                              <span className="text-2xl font-bold text-gray-900">
                                {overallScore}/100分
                              </span>
                            </div>
                          )}
                          {report.questionnaire_data && (
                            <div className="text-sm text-gray-600 space-y-1">
                              {report.questionnaire_data.targetWeight && report.questionnaire_data.currentWeight && (
                                <div>
                                  <span className="font-medium">体重目标：</span>
                                  {report.questionnaire_data.currentWeight}kg → {report.questionnaire_data.targetWeight}kg
                                </div>
                              )}
                              {report.questionnaire_data.fitnessGoal && (
                                <div>
                                  <span className="font-medium">健康目标：</span>
                                  {report.questionnaire_data.fitnessGoal === 'maintain' ? '保持健康' :
                                   report.questionnaire_data.fitnessGoal === 'lose_weight' ? '减脂' :
                                   report.questionnaire_data.fitnessGoal === 'gain_weight' ? '增重' :
                                   report.questionnaire_data.fitnessGoal === 'build_muscle' ? '增肌' :
                                   report.questionnaire_data.fitnessGoal}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500 mb-1">评测日期</div>
                          <div className="text-sm text-gray-900">
                            {new Date(reportDate).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {isAssessment && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div>
                              <div className="text-gray-500">饮食</div>
                              <div className="font-semibold text-gray-900">{report.diet_score || '-'}分</div>
                            </div>
                            <div>
                              <div className="text-gray-500">运动</div>
                              <div className="font-semibold text-gray-900">{report.exercise_score || '-'}分</div>
                            </div>
                            <div>
                              <div className="text-gray-500">休息</div>
                              <div className="font-semibold text-gray-900">{report.rest_score || '-'}分</div>
                            </div>
                            <div>
                              <div className="text-gray-500">心理</div>
                              <div className="font-semibold text-gray-900">{report.psychology_score || '-'}分</div>
                            </div>
                            <div>
                              <div className="text-gray-500">体能</div>
                              <div className="font-semibold text-gray-900">{report.fitness_score || '-'}分</div>
                            </div>
                          </div>
                          {report.primary_improvement_area && (
                            <div className="mt-3 text-sm">
                              <span className="text-gray-500">主要改善领域：</span>
                              <span className="font-medium text-gray-900">{report.primary_improvement_area}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Health Record Modal */}
      {showAddHealthRecord && (
        <AddHealthRecordModal
          onClose={() => setShowAddHealthRecord(false)}
          onSave={handleAddHealthRecord}
        />
      )}

      {/* Health Data Detail Modal */}
      {selectedRecordType && (
        <HealthDataDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedRecordType(null);
          }}
          recordType={selectedRecordType}
          records={selectedRecords}
          recordTypeLabel={getRecordTypeLabel(selectedRecordType)}
        />
      )}
    </div>
  );
}

const EMOTION_KIND_OPTIONS = [
  { value: 'happy', label: '开心' },
  { value: 'sad', label: '难过' },
  { value: 'angry', label: '生气' },
  { value: 'worried', label: '焦虑' },
  { value: 'tired', label: '疲惫' },
  { value: 'excited', label: '兴奋' },
  { value: 'neutral', label: '平静' },
];

function AddHealthRecordModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Partial<HealthRecord>) => void }) {
  const [formData, setFormData] = useState({
    record_type: 'weight',
    value: '',
    unit: '',
    notes: '',
    emotion_subtype: 'neutral',
    recorded_at: new Date().toISOString().slice(0, 16),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(formData.value);
    const recordedAtIso = new Date(formData.recorded_at).toISOString();
    const base: Partial<HealthRecord> = {
      record_type: formData.record_type,
      value,
      unit: formData.unit || undefined,
      notes: formData.notes || undefined,
      recorded_at: recordedAtIso,
    };
    if (formData.record_type === 'emotion') {
      const inten = Number.isFinite(value) ? value : 0.5;
      base.value = inten;
      base.emotion_data = {
        emotion: formData.emotion_subtype || 'neutral',
        intensity: inten,
        message: formData.notes || null,
      };
    }
    onSave(base);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">添加健康记录</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
            <SearchableSelect
              value={formData.record_type}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  record_type: value,
                  value: value === 'emotion' && !prev.value ? '0.5' : prev.value,
                }))
              }
              options={[
                { value: 'weight', label: '体重' },
                { value: 'water', label: '饮水' },
                { value: 'steps', label: '步数' },
                { value: 'calories', label: '卡路里缺口' },
                { value: 'exercise', label: '运动' },
                { value: 'sleep', label: '睡眠' },
                { value: 'emotion', label: '心情' },
                { value: 'blood_glucose', label: '血糖' },
                { value: 'measurements', label: '围度' },
                { value: 'food', label: '营养素' },
                { value: 'hrv', label: '心率变异性' },
                { value: 'supplement', label: '补剂' },
              ]}
              placeholder="请选择类型"
              searchPlaceholder="输入记录类型关键词筛选"
              required
            />
          </div>
          {formData.record_type === 'emotion' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">情绪类型</label>
              <SearchableSelect
                value={formData.emotion_subtype}
                onChange={(value) => setFormData({ ...formData, emotion_subtype: value })}
                options={EMOTION_KIND_OPTIONS}
                placeholder="选择情绪"
                searchPlaceholder="筛选情绪"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {formData.record_type === 'emotion' ? '强度 (0–1)' : '数值'}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="如：kg, ml, 步"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">记录时间</label>
            <input
              type="datetime-local"
              value={formData.recorded_at}
              onChange={(e) => setFormData({ ...formData, recorded_at: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
