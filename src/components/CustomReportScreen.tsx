 
import React, { useEffect, useState } from 'react';
import { FileText, Calendar, Share2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import { DrawerScreen } from './common/DrawerScreen';
import { LoadingState } from './common/LoadingState';
import { EmptyState } from './common/EmptyState';
import { SecondaryPageHeader } from './common/SecondaryPageHeader';
import { formatDate } from '../utils/dateFormatters';

interface CustomReport {
  id: string;
  report_type: string;
  title: string;
  generation_date: string;
  status: string;
  report_data: any;
}

interface CustomReportScreenProps {
  onClose: () => void;
}

const CustomReportScreen: React.FC<CustomReportScreenProps> = ({ onClose }) => {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkHasSeenReports = async () => {
      try {
        const { getUserStorageItem, setUserStorageItem } = await import('../utils/userStorage');
        const hasSeenReports = await getUserStorageItem<string>('has_seen_reports');
        if (!hasSeenReports) {
          setLoading(true);
          await setUserStorageItem('has_seen_reports', 'true');
        }
      } catch (error) {
        console.warn('Failed to check has_seen_reports:', error);
      }
      loadReports();
    };
    checkHasSeenReports();
  }, []);

  const loadReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('custom_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('generation_date', { ascending: false });

      if (error) throw error;

      setReports(data || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };


  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { bg: 'bg-green-100', text: 'text-green-700', label: '使用中' },
      expired: { bg: 'bg-gray-100', text: 'text-gray-600', label: '已过期' },
      archived: { bg: 'bg-gray-100', text: 'text-gray-500', label: '已归档' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    return (
      <span className={`${config.bg} ${config.text} px-3 py-1 rounded-full text-xs font-medium`}>
        {config.label}
      </span>
    );
  };

  const getReportTypeLabel = (type: string) => {
    const typeLabels: { [key: string]: string } = {
      health: '健康报告',
      nutrition: '营养报告',
      fitness: '运动报告',
      comprehensive: '综合报告'
    };
    return typeLabels[type] || '健康报告';
  };

  return (
    <DrawerScreen show={true} onClose={onClose} showDragHandle={false} showMask={false}>
      <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
        <div className="sticky top-0 z-20 flex-shrink-0">
          <SecondaryPageHeader title="我的定制报告" onClose={onClose} />
        </div>

        <div className="px-4 py-4 flex-1">
        {loading ? (
          <LoadingState spinnerColor="text-blue-400" />
        ) : (
        <>
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-800">专属健康报告</h2>
              <p className="text-sm text-gray-600">基于您的健康数据生成</p>
            </div>
          </div>
        </div>

        {reports.length === 0 ? (
          <EmptyState 
            icon={<FileText className="w-10 h-10 text-gray-400" />} 
            title="暂无定制报告"
            description="完成健康评估后将自动生成报告"
          />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-800 mb-1">{report.title}</h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(report.generation_date)}</span>
                        </div>
                        <div className="mt-2">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                            {getReportTypeLabel(report.report_type)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      {getStatusBadge(report.status)}
                    </div>
                  </div>

                  {report.report_data && Object.keys(report.report_data).length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        {report.report_data.overall_score && (
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="text-xs text-gray-500 mb-1">综合评分</div>
                            <div className="text-2xl font-bold text-gray-800">
                              {report.report_data.overall_score}
                              <span className="text-sm text-gray-500 ml-1">/100</span>
                            </div>
                          </div>
                        )}
                        {report.report_data.improvement_rate && (
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="text-xs text-gray-500 mb-1">改善率</div>
                            <div className="text-2xl font-bold text-green-600">
                              +{report.report_data.improvement_rate}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2 mt-4">
                    <button className="flex-1 py-2.5 rounded-xl border-2 border-gray-900 text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors">
                      查看详情
                    </button>
                    <button className="p-2.5 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 bg-white rounded-2xl p-5">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 leading-relaxed">
                定制报告每月更新一次，帮助您跟踪健康改善进展。建议结合补剂方案和饮食计划使用，以获得最佳效果。
              </p>
            </div>
          </div>
        </div>
        
        </>
        )}
        </div>

        <div className="h-20"></div>
      </div>
    </DrawerScreen>
  );
};

export default CustomReportScreen;
