import React, { useEffect, useState } from 'react';
import { ChevronRight, Pill } from 'lucide-react';
import { supabase } from '../config/supabase';
import { useUserProfile } from '../contexts/UserProfileContext';
import { getPackageSupplementName } from '../services/packageService';
import { useActiveSupplementStage } from '../hooks/useActiveSupplementStage';
import { useExecutionProgram } from '../hooks/useExecutionProgram';

interface CustomSupplement {
  id: string;
  supplement_name: string;
  supplement_type: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  status: string;
  icon_path: string;
}

interface CustomSupplementCardProps {
  onOpenSupplements: () => void;
}

const CustomSupplementCard: React.FC<CustomSupplementCardProps> = ({ onOpenSupplements }) => {
  const { userPackage, intakePlanActive } = useUserProfile();
  const { hasOrder } = useExecutionProgram();
  const [activeSupplements, setActiveSupplements] = useState<CustomSupplement[]>([]);
  const [loading, setLoading] = useState(false);
  const { data: stageSummary } = useActiveSupplementStage();

  const packageDuration = userPackage?.package_duration || 31;
  const supplementPlanName = getPackageSupplementName(packageDuration);

  useEffect(() => {
    loadActiveSupplements();
  }, []);

  const loadActiveSupplements = async () => {
    console.log('🔍 CustomSupplementCard - Starting data load...');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('❌ Error getting user:', userError);
        setLoading(false);
        return;
      }

      if (!user) {
        console.warn('⚠️ No authenticated user found');
        setLoading(false);
        return;
      }

      console.log('✅ User authenticated:', user.id);

      const { data, error } = await supabase
        .from('custom_supplements')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('start_date', { ascending: false });

      if (error) {
        console.error('❌ Error loading supplements:', error);
        throw error;
      }

      console.log('✅ Loaded supplements:', data?.length || 0);
      setActiveSupplements(data || []);
    } catch (error) {
      console.error('❌ Failed to load active supplements:', error);
    } finally {
      console.log('🏁 CustomSupplementCard - Data load complete');
      setLoading(false);
    }
  };

  const hasActiveSupplements = activeSupplements.length > 0;
  const hasStage = !!stageSummary?.has_plan && !!stageSummary?.current_stage;
  const servicePackageGated = hasOrder && !intakePlanActive;
  const showProgressBadge = !servicePackageGated && (hasStage || hasActiveSupplements);

  return (
    <button
      className="w-full bg-white rounded-2xl p-3 text-gray-800 relative overflow-hidden mb-4 text-left shadow-sm border border-gray-300"
      onClick={onOpenSupplements}
    >
      {!loading && showProgressBadge && (
        <div className="absolute top-3 right-3 bg-orange-100 backdrop-blur-sm px-2 py-1 rounded-full">
          <span className="text-xs font-medium text-gray-700">
            {hasStage ? `第${stageSummary?.current_stage?.index}阶段` : '使用中'}
          </span>
        </div>
      )}

      <div className="flex items-center space-x-3">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
          {loading ? (
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          ) : (
            <Pill className="w-8 h-8 text-orange-600" />
          )}
        </div>
        <div className="flex-1">
          {loading ? (
            <>
              <div className="h-5 bg-gray-200 rounded animate-pulse mb-2 w-32"></div>
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2 w-48"></div>
              <div className="h-3 bg-gray-100 rounded animate-pulse w-24"></div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold mb-1">{supplementPlanName}</h3>
              {servicePackageGated ? (
                <>
                  <p className="text-sm text-gray-600 mb-2">完成「我的配送计划」配置后，将展示补剂阶段与进度</p>
                  <div className="text-xs text-gray-500">与摄入托管开通状态同步</div>
                </>
              ) : hasStage ? (
                <>
                  <p className="text-sm text-gray-600 mb-1">
                    当前阶段：{stageSummary?.current_stage?.stage_name || '-'}
                  </p>
                  <p className="text-xs text-gray-500 mb-1">
                    当前补剂：{stageSummary?.current_stage?.supplement?.name || '待配置'}
                  </p>
                  <div className="text-xs text-gray-500">
                    当前进度：第 {stageSummary?.current_day || 0}/{stageSummary?.total_days || 0} 天
                  </div>
                </>
              ) : hasActiveSupplements ? (
                <>
                  <p className="text-sm text-gray-600 mb-2">根据您的健康状况定制的补剂方案</p>
                  <div className="text-xs text-gray-500">当前使用：{activeSupplements.length} 种补剂</div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-2">根据您的健康状况定制的补剂方案</p>
                  <div className="text-xs text-gray-500">暂无补剂方案</div>
                </>
              )}
            </>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
};

export default CustomSupplementCard;
