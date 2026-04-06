 
import React, { useState } from 'react';
import { ChevronRight, Camera, AlertTriangle } from 'lucide-react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { supabase } from '../config/supabase';
import { kgToLbs, cmToFeetInches, calculateAge } from '../utils/bmrCalculations';
import { DrawerScreen } from './common/DrawerScreen';
import { ConfirmModal } from './common/ConfirmModal';
import { AlertDialog } from './common/AlertDialog';
import { SecondaryPageHeader } from './common/SecondaryPageHeader';
import { toLocalDateString } from '../utils/dateUtils';

interface ProfileSettingsScreenProps {
  onClose: () => void;
  onOpenOnboarding?: (resetProgress: boolean) => void;
}

interface ProfileField {
  label: string;
  value: string;
  id: string;
  isReadOnly?: boolean;
}

interface ProfileSection {
  title: string;
  fields: ProfileField[];
}

const ProfileSettingsScreen: React.FC<ProfileSettingsScreenProps> = ({ onClose, onOpenOnboarding }) => {
  void onOpenOnboarding;
  const { profile } = useUserProfile();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('error');

  const handleClose = () => {
    onClose();
  };

  const formatGender = (gender?: string) => {
    if (gender === 'male') return '男';
    if (gender === 'female') return '女';
    return '未设置';
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return '未设置';
    const d = typeof date === 'string' ? new Date(date) : date;
    return toLocalDateString(d);
  };

  const formatWeight = (weight?: number) => {
    if (!weight) return '未设置';
    return profile?.unit_preference === 'imperial'
      ? `${kgToLbs(weight).toFixed(1)} lbs`
      : `${weight.toFixed(1)} kg`;
  };

  const formatHeight = (height?: number) => {
    if (!height) return '未设置';
    if (profile?.unit_preference === 'imperial') {
      const { feet, inches } = cmToFeetInches(height);
      return `${feet}'${inches}"`;
    }
    return `${Math.round(height)} cm`;
  };

  const getAge = (): string => {
    if (profile?.birthday) {
      return `${calculateAge(profile.birthday)} 岁`;
    }
    return profile?.age ? `${profile.age} 岁` : '未设置';
  };

  const formatPhone = (phone?: string): string => {
    if (!phone) return '未设置';
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}****${phone.slice(7)}`;
    }
    return phone;
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        setAlertMessage('未找到登录用户');
        setAlertType('error');
        setShowAlert(true);
        setIsDeleting(false);
        return;
      }

      // Delete all user-related data from database tables
      const tablesToClear = [
        'health_records',
        'ai_conversations',
        'meal_plans',
        'health_assessments',
        'nutrition_plans',
        'custom_reports',
        'custom_supplements',
        'user_packages',
        'delivery_addresses',
        'user_devices',
        'emotion_statistics',
        'chat_messages',
        'user_profiles'
      ];

      for (const table of tablesToClear) {
        try {
          await supabase.from(table).delete().eq('user_id', user.id);
        } catch (err) {
          console.error(`Error deleting from ${table}:`, err);
        }
      }

      // Clear all local storage
      localStorage.clear();

      // Sign out the user
      await supabase.auth.signOut();

      // Redirect to login/onboarding
      window.location.reload();
    } catch (error) {
      console.error('Error deleting account:', error);
      setAlertMessage('账号注销失败,请稍后重试');
      setAlertType('error');
      setShowAlert(true);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const basicInfoFields: ProfileField[] = [
    {
      label: '我的昵称',
      value: profile?.nickname || '未设置',
      id: 'nickname'
    },
    {
      label: '性别',
      value: formatGender(profile?.gender),
      id: 'gender'
    },
    {
      label: '生日',
      value: formatDate(profile?.birthday),
      id: 'birthday'
    },
    {
      label: '年龄',
      value: getAge(),
      id: 'age',
      isReadOnly: true
    },
    {
      label: '身高',
      value: formatHeight(profile?.height),
      id: 'height'
    },
    {
      label: '体重',
      value: formatWeight(profile?.current_weight),
      id: 'current_weight'
    },
    {
      label: '注册手机号',
      value: formatPhone(profile?.phone),
      id: 'phone',
      isReadOnly: true
    }
  ];

  const sections: ProfileSection[] = [
    {
      title: '基本信息',
      fields: basicInfoFields
    }
  ];

  return (
    <DrawerScreen show={true} onClose={handleClose} showDragHandle={false} showMask={false}>
      <div className="flex flex-col h-full bg-gray-50">
        <SecondaryPageHeader title="编辑资料" onClose={handleClose} />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-6 scrollbar-hide">
            {/* Avatar Section */}
            <div className="flex justify-center py-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-50">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : profile?.gender === 'male' ? (
                    <img src="/nanmote.png" alt="Avatar" className="w-full h-full object-cover" />
                  ) : profile?.gender === 'female' ? (
                    <img src="/nvmote.png" alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-3xl">👤</span>
                    </div>
                  )}
                </div>
                <button className="absolute bottom-0 right-0 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-700 transition-colors">
                  <Camera className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Profile Sections */}
            <div className="px-4 space-y-3">
              {sections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  {/* Section Header */}
                  <div className="px-2 py-1.5 mb-1.5">
                    <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {section.title}
                    </h2>
                  </div>

                  {/* Section Fields */}
                  <div className="bg-white rounded-2xl overflow-hidden">
                    {section.fields.map((field, fieldIndex) => (
                      <div
                        key={field.id}
                        className={`w-full flex items-center justify-between px-4 py-3 ${
                          fieldIndex !== section.fields.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        <span className="text-sm text-gray-800">{field.label}</span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm ${field.isReadOnly ? 'text-gray-400' : 'text-gray-500'}`}>
                            {field.value}
                          </span>
                          {!field.isReadOnly && (
                            <button
                              onClick={() => {
                              }}
                              className="p-1"
                            >
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Delete Account Section */}
              <div className="mt-6">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full bg-white rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-red-50 transition-colors group"
                >
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-red-500 font-medium">注销账号</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-400 group-hover:text-red-500" />
                </button>
                <p className="text-xs text-gray-400 mt-2 px-2">
                  注销后将永久删除所有数据,此操作不可恢复
                </p>
              </div>
            </div>
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          show={showDeleteConfirm}
          title="确认注销账号?"
          message={
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-sm text-gray-600">
                此操作将永久删除您的所有数据,包括健康记录、饮食计划、运动数据等。此操作不可恢复,请谨慎操作。
              </p>
            </div>
          }
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteAccount}
          confirmText={isDeleting ? '正在注销...' : '确认注销'}
          cancelText="取消"
          zIndex={80}
        />

        {/* Alert Dialog */}
        <AlertDialog
          show={showAlert}
          type={alertType}
          title="提示"
          message={alertMessage}
          onClose={() => setShowAlert(false)}
          confirmText="确定"
        />
      </div>
    </DrawerScreen>
  );
};

export default ProfileSettingsScreen;
