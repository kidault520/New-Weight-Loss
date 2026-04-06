import { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface HealthRecord {
  id: string;
  record_type: string;
  value: number;
  unit?: string;
  recorded_at: string;
}

interface HealthDataDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordType: string;
  records: HealthRecord[];
  recordTypeLabel: string;
}

const HealthDataDetailModal: React.FC<HealthDataDetailModalProps> = ({
  isOpen,
  onClose,
  recordType,
  records,
  recordTypeLabel
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'天' | '周' | '月' | '年'>('周');
  const [currentDate, setCurrentDate] = useState(new Date());

  if (!isOpen) return null;

  // 格式化日期
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 根据时间段生成图表数据
  const chartData = useMemo(() => {
    const data: { date: string; value: number; label: string }[] = [];
    const today = new Date(currentDate);

    if (selectedPeriod === '天') {
      // 显示当天的数据
      const dayRecords = records.filter(record => {
        const recordDate = new Date(record.recorded_at);
        return recordDate.toDateString() === today.toDateString();
      });
      
      // 对于某些类型（如体重、血糖），按小时分组显示
      // 对于其他类型，直接显示所有记录
      const needsHourlyGrouping = ['weight', 'blood_glucose', 'water'].includes(recordType);
      
      if (needsHourlyGrouping && dayRecords.length > 0) {
        // 按小时分组
        const hourlyData: { [hour: number]: number[] } = {};
        dayRecords.forEach(record => {
          const hour = new Date(record.recorded_at).getHours();
          if (!hourlyData[hour]) {
            hourlyData[hour] = [];
          }
          hourlyData[hour].push(record.value);
        });

        // 生成24小时的数据
        for (let hour = 0; hour < 24; hour++) {
          const values = hourlyData[hour] || [];
          const total = values.reduce((sum, v) => sum + v, 0);
          const avg = values.length > 0 ? total / values.length : 0;
          data.push({
            date: `${hour}:00`,
            value: avg,
            label: `${hour}:00`
          });
        }
      } else {
        // 对于其他类型，显示所有记录点
        dayRecords.forEach((record) => {
          const recordDate = new Date(record.recorded_at);
          const timeStr = `${String(recordDate.getHours()).padStart(2, '0')}:${String(recordDate.getMinutes()).padStart(2, '0')}`;
          data.push({
            date: timeStr,
            value: record.value,
            label: timeStr
          });
        });
        
        // 如果没有记录，至少显示一个空数据点
        if (data.length === 0) {
          data.push({ date: '00:00', value: 0, label: '00:00' });
        }
      }
    } else if (selectedPeriod === '周') {
      // 显示最近7天的数据
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayRecords = records.filter(record => {
          const recordDate = new Date(record.recorded_at);
          return recordDate.toDateString() === date.toDateString();
        });
        
        const total = dayRecords.reduce((sum, record) => sum + record.value, 0);
        const avg = dayRecords.length > 0 ? total / dayRecords.length : 0;
        const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        data.push({ date: dateStr, value: avg, label: dateStr });
      }
    } else if (selectedPeriod === '月') {
      // 显示当前月份每天的数据
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayRecords = records.filter(record => {
          const recordDate = new Date(record.recorded_at);
          return recordDate.toDateString() === date.toDateString();
        });
        
        const total = dayRecords.reduce((sum, record) => sum + record.value, 0);
        const avg = dayRecords.length > 0 ? total / dayRecords.length : 0;
        data.push({ date: String(day), value: avg, label: String(day) });
      }
    } else if (selectedPeriod === '年') {
      // 显示12个月的数据
      const year = today.getFullYear();
      
      for (let month = 0; month < 12; month++) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        const monthRecords = records.filter(record => {
          const recordDate = new Date(record.recorded_at);
          return recordDate >= startDate && recordDate <= endDate;
        });
        
        const total = monthRecords.reduce((sum, record) => sum + record.value, 0);
        const avg = monthRecords.length > 0 ? total / monthRecords.length : 0;
        data.push({ date: `${month + 1}月`, value: avg, label: `${month + 1}月` });
      }
    }
    
    return data;
  }, [selectedPeriod, currentDate, records]);

  // 计算最大值用于图表缩放
  const maxValue = Math.max(...chartData.map(d => d.value), 1);

  // 日期导航
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (selectedPeriod) {
      case '天':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case '周':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case '月':
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case '年':
        newDate.setFullYear(currentDate.getFullYear() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  };

  // 获取日期显示文本
  const getDateDisplayText = () => {
    switch (selectedPeriod) {
      case '天':
        return formatDate(currentDate);
      case '周':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${formatDate(weekStart)} ~ ${formatDate(weekEnd)}`;
      case '月':
        return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
      case '年':
        return `${currentDate.getFullYear()}年`;
    }
  };

  // 获取单位
  const getUnit = () => {
    if (records.length > 0 && records[0].unit) {
      return records[0].unit;
    }
    const unitMap: Record<string, string> = {
      weight: 'kg',
      water: 'ml',
      steps: '步',
      calories: 'kcal',
      blood_glucose: 'mmol/L',
      sleep: '小时'
    };
    return unitMap[recordType] || '';
  };

  const unit = getUnit();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{recordTypeLabel}数据明细</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Period Selector */}
          <div className="mb-6">
            <div className="bg-gray-200 rounded-2xl p-1 flex">
              {(['天', '周', '月', '年'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                    selectedPeriod === period
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-600'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Area */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            {/* Date Navigator */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-lg font-medium text-gray-800">{getDateDisplayText()}</span>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Bar Chart */}
            <div className="mb-4">
              <div className="flex items-end justify-between h-64 mb-4">
                {/* Chart Bars */}
                <div className="flex items-end justify-between flex-1 pr-4">
                  {chartData.map((data, index) => (
                    <div key={index} className="flex flex-col items-center flex-1">
                      <div
                        className="bg-blue-500 rounded-t-sm w-full"
                        style={{
                          width: selectedPeriod === '月' ? '4px' : selectedPeriod === '年' ? '12px' : '100%',
                          height: `${data.value === 0 ? 4 : Math.max(20, (data.value / maxValue) * 240)}px`,
                          minHeight: '4px'
                        }}
                        title={`${data.label}: ${data.value.toFixed(2)} ${unit}`}
                      ></div>
                    </div>
                  ))}
                </div>

                {/* Y-axis labels */}
                <div className="flex flex-col justify-between h-64 text-xs text-gray-400 min-w-[60px]">
                  <span>{maxValue.toFixed(1)}</span>
                  <span>{(maxValue / 2).toFixed(1)}</span>
                  <span>0</span>
                </div>
              </div>

              {/* X-axis labels */}
              {selectedPeriod !== '月' && (
                <div className="flex justify-between px-1">
                  {chartData.map((data, index) => {
                    // 对于天视图，只显示部分标签
                    if (selectedPeriod === '天' && index % 3 !== 0 && index !== chartData.length - 1) {
                      return null;
                    }
                    // 对于年视图，显示所有月份
                    if (selectedPeriod === '年') {
                      return (
                        <span key={index} className="text-xs text-gray-500 flex-1 text-center">
                          {data.label}
                        </span>
                      );
                    }
                    // 对于周视图，显示所有日期
                    return (
                      <span key={index} className="text-xs text-gray-500 flex-1 text-center">
                        {data.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* X-axis labels for month view - sparse display */}
              {selectedPeriod === '月' && (
                <div className="relative h-4">
                  {chartData.map((data, index) => {
                    const shouldShowLabel = index === 0 || (index + 1) % 5 === 0 || index === chartData.length - 1;
                    if (!shouldShowLabel) return null;

                    const position = (index / (chartData.length - 1)) * 100;
                    return (
                      <span
                        key={index}
                        className="absolute text-xs text-gray-500"
                        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                      >
                        {data.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">平均值</div>
              <div className="text-2xl font-bold text-gray-900">
                {chartData.length > 0
                  ? (chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length).toFixed(2)
                  : '0.00'}
                <span className="text-sm text-gray-500 ml-1">{unit}</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">最大值</div>
              <div className="text-2xl font-bold text-gray-900">
                {chartData.length > 0
                  ? Math.max(...chartData.map(d => d.value)).toFixed(2)
                  : '0.00'}
                <span className="text-sm text-gray-500 ml-1">{unit}</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">最小值</div>
              <div className="text-2xl font-bold text-gray-900">
                {chartData.length > 0
                  ? Math.min(...chartData.map(d => d.value)).toFixed(2)
                  : '0.00'}
                <span className="text-sm text-gray-500 ml-1">{unit}</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">记录数</div>
              <div className="text-2xl font-bold text-gray-900">
                {records.length}
                <span className="text-sm text-gray-500 ml-1">条</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthDataDetailModal;

