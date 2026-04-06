/**
 * useHealthReportSave - 健康报告保存逻辑Hook
 * 从HealthReportPage.tsx中提取的保存逻辑
 */
 

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { useHealthAssessmentQuery } from './useHealthAssessmentQuery';
import { useWeightRecordsQuery } from './useWeightRecordsQuery';
import { setUserStorageItem } from '../utils/userStorage';

interface UseHealthReportSaveOptions {
  questionnaireData: any;
  isFirstTimeOnboarding: boolean;
  isReassessment: boolean;
  previousUserId: string | null;
}

export function useHealthReportSave({
  questionnaireData,
  isFirstTimeOnboarding,
  isReassessment,
  previousUserId,
}: UseHealthReportSaveOptions) {
  const queryClient = useQueryClient();
  const { createAssessment } = useHealthAssessmentQuery();
  const { addRecord: addWeightRecord } = useWeightRecordsQuery();
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const hasAttemptedSave = useRef(false);
  const saveRetryCount = useRef(0);
  const MAX_RETRY_ATTEMPTS = 3;

  const saveDataToDatabase = async (): Promise<boolean> => {
    // Only save in first-time onboarding or reassessment mode
    if (!isFirstTimeOnboarding && !isReassessment) {
      return true; // Return success for viewing mode
    }

    // Prevent duplicate saves
    if (hasAttemptedSave.current) {
      return true;
    }
    hasAttemptedSave.current = true;
    setIsSaving(true);
    setSaveError('');

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // CRITICAL: Validate that we have a user and it matches the tracked user
      if (!currentUser) {
        console.error('❌ [useHealthReportSave] No authenticated user - cannot save to database');
        const errorMessage = '用户未登录，无法保存健康报告。请先登录后再继续。';
        setSaveError(errorMessage);
        return false;
      }

      // Validate user ID matches to prevent cross-user data contamination
      if (previousUserId && previousUserId !== currentUser.id) {
        console.error('❌ [useHealthReportSave] User ID mismatch detected:', {
          tracked: previousUserId,
          current: currentUser.id
        });
        const errorMessage = '用户会话异常，请重新登录。';
        setSaveError(errorMessage);
        return false;
      }

      // CRITICAL: 验证 user_profiles 记录是否存在
      // Retry up to 3 times with delay to handle race conditions
      let existingProfile = null;
      let profileCheckError = null;
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (!existingProfile && retryCount < MAX_RETRIES) {
        const result = await supabase
          .from('user_profiles')
          .select('id, nickname, age, gender, height, current_weight')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        existingProfile = result.data;
        profileCheckError = result.error;

        if (profileCheckError) {
          console.error(`❌ [useHealthReportSave] Error checking user profile (attempt ${retryCount + 1}/${MAX_RETRIES}):`, profileCheckError);
        }

        if (!existingProfile && !profileCheckError) {
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          break;
        }
      }

      if (profileCheckError) {
        console.error('❌ [useHealthReportSave] Error checking user profile after all retries:', profileCheckError);
        const errorMessage = `无法检查用户档案：${profileCheckError.message}`;
        setSaveError(errorMessage);
        return false;
      }

      if (!existingProfile) {
        console.error('❌ [useHealthReportSave] User profile does not exist after all retries');
        const errorMessage = '用户档案不存在。请返回引导页重新保存数据。';
        setSaveError(errorMessage);
        return false;
      }

      // 验证档案中的必需字段
      const missingProfileFields = [];
      if (!existingProfile.nickname) missingProfileFields.push('nickname');
      if (!existingProfile.age) missingProfileFields.push('age');
      if (!existingProfile.gender) missingProfileFields.push('gender');
      if (!existingProfile.height) missingProfileFields.push('height');
      if (!existingProfile.current_weight) missingProfileFields.push('current_weight');

      if (missingProfileFields.length > 0) {
        console.error('❌ [useHealthReportSave] User profile missing required fields:', missingProfileFields);
        const profileFieldLabel: Record<string, string> = {
          nickname: '昵称',
          gender: '性别',
          age: '年龄',
          height: '身高',
          current_weight: '当前体重',
        };
        const errorMessage = `用户档案数据不完整，缺少：${missingProfileFields.map((k) => profileFieldLabel[k] || k).join('、')}。请返回上一步（健康问题页）重新保存后再试。`;
        setSaveError(errorMessage);
        return false;
      }

      // Step 1: Calculate and save health assessment FIRST
      // CRITICAL: Always create a NEW record - never update existing assessments
      try {
        const result = await createAssessment({ data: questionnaireData, isReassessment });
        
        if (result.error) {
          console.error('❌ [useHealthReportSave] Error saving health assessment:', result.error);
          throw new Error(`创建健康评估失败: ${result.error.message || 'Unknown error'}`);
        }

        if (!result.data) {
          throw new Error('创建健康评估失败：未返回数据');
        }

        // React Query hook 会自动使相关查询失效，无需手动派发事件
        queryClient.invalidateQueries({ queryKey: ['health-assessment'] });
        queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      } catch (assessmentError) {
        console.error('❌ [useHealthReportSave] CRITICAL: Error with health assessment:', assessmentError);
        const errorMsg = assessmentError instanceof Error ? assessmentError.message : 'Unknown error';
        setSaveError(`健康评估保存失败：${errorMsg}`);
        throw assessmentError; // Re-throw to fail the entire save operation
      }

      // Step 2: Mark as successfully saved AFTER health assessment is saved
      await setUserStorageItem('health_report_saved', 'true');

      // Step 3: Try to save initial weight record (non-blocking)
      // This is optional - if it fails, we still consider the onboarding successful
      if (isFirstTimeOnboarding && questionnaireData.currentWeight) {
        try {
          await addWeightRecord({
            weight: questionnaireData.currentWeight,
            date: new Date(),
            notes: '初始体重记录（来自引导流程）'
          });
          // React Query 会自动刷新体重记录，无需派发事件
          queryClient.invalidateQueries({ queryKey: ['weight-records'] });
        } catch (weightError) {
          // Log error but don't fail the entire save operation
          console.warn('⚠️ [useHealthReportSave] Weight record creation failed (non-critical):', weightError);
        }
      }

      // Step 4: 使用 React Query 的 invalidateQueries 替代事件通知
      queryClient.invalidateQueries({ queryKey: ['health-assessment'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['weight-records'] });
      
      return true; // Indicate success
    } catch (error) {
      console.error('❌ [useHealthReportSave] FATAL: Failed to save data:', error);
      console.error('❌ [useHealthReportSave] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // 构造用户友好的错误消息
      let userErrorMsg = '保存失败：';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          userErrorMsg += '网络连接失败，请检查网络后重试。';
        } else if (error.message.includes('permission') || error.message.includes('RLS')) {
          userErrorMsg += '没有数据写入权限，请联系客服。';
        } else if (error.message.includes('constraint') || error.message.includes('duplicate')) {
          userErrorMsg += '数据已存在或格式错误，请检查后重试。';
        } else if (error.message.includes('timeout')) {
          userErrorMsg += '保存超时，请检查网络连接后重试。';
        } else {
          userErrorMsg += error.message;
        }
      } else {
        userErrorMsg += '未知错误，请重试或联系客服。';
      }

      setSaveError(userErrorMsg);
      // 不重置 hasAttemptedSave，防止立即重试
      return false; // Indicate failure
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    saveError,
    saveDataToDatabase,
    hasAttemptedSave,
    saveRetryCount,
    MAX_RETRY_ATTEMPTS,
  };
}




