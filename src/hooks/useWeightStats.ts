/**
 * useWeightStats - 体重统计计算Hook
 * 从WeightDetailScreen.tsx中提取的BMI和统计计算逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */

import { useMemo, useCallback } from 'react';

interface WeightRecord {
  id: string;
  value: number;
  recorded_at: string;
  notes?: string;
}

interface UserProfile {
  current_weight?: number;
  target_weight?: number;
  height?: number;
}

interface UseWeightStatsOptions {
  records: WeightRecord[];
  latestRecord: WeightRecord | null;
  userProfile?: UserProfile;
}

export function useWeightStats({
  records,
  latestRecord,
  userProfile,
}: UseWeightStatsOptions) {
  // 计算初始体重
  const initialWeight = useMemo(() => {
    const onboardingRecord = records.find(record =>
      record.notes?.includes('初始体重记录') || record.notes?.includes('引导流程')
    );

    if (onboardingRecord) {
      return onboardingRecord.value;
    }

    if (userProfile?.current_weight) {
      return userProfile.current_weight;
    }

    if (records.length > 0) {
      return records[records.length - 1].value;
    }

    return latestRecord?.value || 0;
  }, [records, userProfile, latestRecord]);

  const targetWeight = userProfile?.target_weight || 0;

  // 计算BMI
  const calculateBMI = useCallback((): {
    bmi: number;
    category: string;
    color: 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';
  } => {
    const weight = latestRecord?.value || userProfile?.current_weight;
    if (!weight || !userProfile?.height) {
      return { bmi: 0, category: '未知', color: 'gray' as const };
    }
    const heightInM = userProfile.height / 100;
    const bmi = weight / (heightInM * heightInM);

    let category = '正常';
    let color: 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'gray' = 'green';

    if (bmi < 18.5) {
      category = '偏瘦';
      color = 'blue';
    } else if (bmi >= 18.5 && bmi < 25) {
      category = '正常';
      color = 'green';
    } else if (bmi >= 25 && bmi < 30) {
      category = '超重';
      color = 'yellow';
    } else if (bmi >= 30 && bmi < 35) {
      category = '肥胖';
      color = 'orange';
    } else {
      category = '重度肥胖';
      color = 'red';
    }

    return { bmi, category, color };
  }, [latestRecord, userProfile]);

  const bmiData = useMemo(() => calculateBMI(), [calculateBMI]);

  return {
    initialWeight,
    targetWeight,
    bmiData,
  };
}




















