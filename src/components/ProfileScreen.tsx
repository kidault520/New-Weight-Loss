 
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MapPin, Package, Watch, Settings, Shield, HelpCircle, FileText, Copy, Check, LogOut, CalendarClock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';
import { useProfileBadges, dismissProfileBadge } from '../hooks/useProfileBadges';
import LoginPage from './LoginPage';
import { ConfirmModal } from './common/ConfirmModal';
import { AlertDialog } from './common/AlertDialog';
import { useAlert } from '../hooks/useAlert';

interface ProfileScreenProps {
  onClose: () => void;
  onOpenPersonalInfo?: () => void;
  onOpenMyProfile?: () => void;
  onOpenAddress?: () => void;
  onOpenOrders?: () => void;
  onOpenDeliveryPlan?: () => void;
  onOpenReports?: () => void;
  onOpenDevices?: () => void;
  onOpenSettings?: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onClose,
  onOpenPersonalInfo,
  onOpenMyProfile,
  onOpenAddress,
  onOpenOrders,
  onOpenDeliveryPlan,
  onOpenReports,
  onOpenDevices,
  onOpenSettings
}) => {
  void onClose;
  void onOpenMyProfile;
  const { isAuthenticated, signOut } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { ordersBadge, deliveryPlanBadge } = useProfileBadges();
  const queryClient = useQueryClient();
  const { alertState, showInfo, hideAlert } = useAlert();

  useEffect(() => {
    dismissProfileBadge('profile').then(() =>
      queryClient.invalidateQueries({ queryKey: ['profile-badges'] })
    );
  }, [queryClient]);

  const [showLoginPage, setShowLoginPage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleCopyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const menuSections = [
    {
      items: [
        { id: 'orders', label: '我的订单', icon: Package, badge: ordersBadge },
        { id: 'delivery-plan', label: '我的配送计划', icon: CalendarClock, badge: deliveryPlanBadge },
        { id: 'address', label: '收货地址', icon: MapPin },
      ]
    },
    {
      items: [
        { id: 'reports', label: '我的报告', icon: FileText },
        { id: 'devices', label: '我的设备', icon: Watch },
      ]
    },
    {
      items: [
        { id: 'settings', label: '设置', icon: Settings },
        { id: 'privacy', label: '隐私管理', icon: Shield },
        { id: 'help', label: '帮助与客服', icon: HelpCircle },
      ]
    },
    ...(isAuthenticated ? [{
      items: [
        { id: 'logout', label: '退出登录', icon: LogOut },
      ]
    }] : [])
  ];

  const handleMenuClick = async (itemId: string) => {
    switch (itemId) {
      case 'address':
        if (onOpenAddress) onOpenAddress();
        break;
      case 'orders':
        if (onOpenOrders) onOpenOrders();
        break;
      case 'delivery-plan':
        if (onOpenDeliveryPlan) onOpenDeliveryPlan();
        break;
      case 'reports':
        if (onOpenReports) onOpenReports();
        break;
      case 'devices':
        if (onOpenDevices) onOpenDevices();
        break;
      case 'settings':
        if (onOpenSettings) onOpenSettings();
        else showInfo('设置', '当前入口未连接设置页，请从个人资料进入。');
        break;
      case 'privacy':
        showInfo(
          '隐私管理',
          '我们按最小必要原则处理健康与账号数据。详细说明与导出/删除等能力将在后续版本提供；如需帮助请联系客服。'
        );
        break;
      case 'help':
        showInfo('帮助与客服', '使用中遇到问题可反馈给运营或技术支持；App 内智能助手也可协助日常健康问答。');
        break;
      case 'logout':
        setShowLogoutConfirm(true);
        break;
      default:
        if (import.meta.env.DEV) console.warn('[ProfileScreen] Unhandled menu:', itemId);
        showInfo('提示', '该功能即将开放。');
    }
  };

  if (showLoginPage) {
    return <LoginPage onBack={() => setShowLoginPage(false)} />;
  }

  return (
    <div className="flex flex-col bg-white">
      {/* Header - 已由App.tsx统一导航栏处理 */}
      {/* Scrollable Content */}
      <div className="px-6 pt-3 space-y-4 pb-4">
        {/* Profile Card */}
        <div
          className="bg-gray-100 rounded-xl p-3 shadow-sm cursor-pointer"
          onClick={() => {
            if (!isAuthenticated) {
              setShowLoginPage(true);
            } else if (onOpenPersonalInfo) {
              onOpenPersonalInfo();
            }
          }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
              {profile?.gender === 'male' ? (
                <img src="/nanmote.png" alt="Profile" className="w-full h-full object-cover" />
              ) : profile?.gender === 'female' ? (
                <img src="/nvmote.png" alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <img
                  src="https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100"
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-800">
                {isAuthenticated ? (profile?.nickname || '用户') : '用户昵称'}
              </h2>
              {isAuthenticated ? (
                profile?.display_user_id ? (
                  <div className="flex items-center space-x-1">
                    <p className="text-xs text-gray-500">
                      ID:{profile.display_user_id}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyUserId(profile.display_user_id!);
                      }}
                      className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                  </div>
                ) : profileLoading ? (
                  <p className="text-xs text-gray-500">加载中...</p>
                ) : (
                  <p className="text-xs text-gray-500">
                    点击查看个人信息{profile === null ? '（未找到档案）' : ''}
                  </p>
                )
              ) : (
                <p className="text-xs text-gray-500">点击登录</p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Menu Content */}
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-2">
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                {section.items.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    onClick={() => handleMenuClick(item.id)}
                    className={`
                      w-full flex items-center justify-between px-4 py-4
                      hover:bg-gray-50 active:bg-gray-100 transition-colors
                      ${itemIndex !== section.items.length - 1 ? 'border-b border-gray-100' : ''}
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5 text-gray-600" />
                      <span className="text-base text-gray-800">{item.label}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {item.badge && (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

      {/* Logout Confirmation Modal */}
      <AlertDialog
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={hideAlert}
        zIndex={75}
      />

      <ConfirmModal
        show={showLogoutConfirm}
        title="确认退出登录？"
        message="退出登录后，您需要重新登录才能使用相关功能。"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          try {
            setShowLogoutConfirm(false); // 先关闭模态框，避免用户重复点击
            await signOut();
            // signOut 成功后，App.tsx 会通过 onAuthStateChange 自动跳转到登录页
          } catch (error) {
            console.error('Failed to logout:', error);
            // 即使出错，也尝试关闭模态框
            setShowLogoutConfirm(false);
            // 可以在这里显示错误提示（如果需要）
            alert('退出登录失败，请重试');
          }
        }}
        confirmText="确认退出"
        zIndex={65}
      />
    </div>
  );
};

export default ProfileScreen;
