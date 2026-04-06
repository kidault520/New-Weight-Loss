import React, { useState } from 'react';
import { RefreshCw, LogOut, Trash2, Settings, ChevronDown, LogIn } from 'lucide-react';
import { isTestMode } from '../config/testMode';
import { testUserService } from '../services/testUserService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { ConfirmModal } from './common/ConfirmModal';
import { AlertDialog } from './common/AlertDialog';
import { removeUserStorageItem } from '../utils/userStorage';

const DevToolsPanel: React.FC = () => {
  const { signOut, user, hasActiveSession } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showResetToLoginConfirm, setShowResetToLoginConfirm] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  // Only show in development environment
  if (import.meta.env.PROD) {
    return null;
  }

  const handleResetTestData = async () => {
    setShowResetConfirm(true);
  };

  const handleConfirmResetTestData = async () => {
    setShowResetConfirm(false);
    setIsResetting(true);
    try {
      console.log('🧹 [DevTools] Starting test data reset...');

      // Clear test user data
      await testUserService.clearTestUserData();

      // Reload the page to reset all state
      console.log('✅ [DevTools] Test data reset complete, reloading page...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('❌ [DevTools] Error resetting test data:', error);
      setAlertMessage('重置数据失败，请查看控制台了解详情');
      setShowAlert(true);
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      await signOut();
      window.location.reload();
    } catch (error) {
      console.error('❌ [DevTools] Error logging out:', error);
    }
  };

  const handleClearAllData = async () => {
    setShowClearAllConfirm(true);
  };

  const handleConfirmClearAllData = async () => {
    setShowClearAllConfirm(false);
    setIsResetting(true);
    try {
      console.log('🧹 [DevTools] Clearing all data and logging out...');

      // Clear all data
      await testUserService.clearTestUserData();

      // Sign out
      await signOut();

      // Clear all localStorage
      localStorage.clear();

      console.log('✅ [DevTools] All data cleared, reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('❌ [DevTools] Error clearing all data:', error);
      setAlertMessage('清除数据失败，请查看控制台了解详情');
      setShowAlert(true);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetToLogin = async () => {
    setShowResetToLoginConfirm(true);
  };

  const handleConfirmResetToLogin = async () => {
    setShowResetToLoginConfirm(false);
    setIsResetting(true);
    try {
      console.log('🔄 [DevTools] Resetting to login page...');

      // Clear all onboarding-related user-isolated storage
      console.log('🧹 [DevTools] Clearing onboarding state...');
      await Promise.all([
        removeUserStorageItem('onboarding_step'),
        removeUserStorageItem('onboarding_data'),
        removeUserStorageItem('onboarding_completed'),
        removeUserStorageItem('onboarding_skipped'),
        removeUserStorageItem('health_report_saved'),
        removeUserStorageItem('step14_profile_saved')
      ]);
      // has_seen_onboarding is stored in database, not localStorage

      // Sign out from Supabase
      console.log('🚪 [DevTools] Signing out...');
      await supabase.auth.signOut();

      console.log('✅ [DevTools] Reset complete, reloading to login page...');
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (error) {
      console.error('❌ [DevTools] Error resetting to login:', error);
      setAlertMessage('重置失败，请查看控制台了解详情');
      setShowAlert(true);
    } finally {
      setIsResetting(false);
    }
  };

  const getUserInfo = () => {
    if (!user) return '未登录';
    return user.email?.split('@')[0] || user.id.slice(0, 8);
  };

  return (
    <div className="fixed bottom-20 right-4 z-[99999]">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-2 w-12 h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all"
        title="开发工具"
      >
        <Settings className="w-6 h-6" />
      </button>

      {/* Panel */}
      {isExpanded && (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-2.5 w-[248px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-800">开发工具</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Status Info */}
          <div className="mb-2 p-2 bg-gray-50 rounded-md space-y-1 text-[11px] leading-tight">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500 shrink-0">登录</span>
              <span className={`font-medium text-right ${hasActiveSession ? 'text-green-600' : 'text-red-600'}`}>
                {hasActiveSession ? '已登录' : '未登录'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500 shrink-0">用户</span>
              <span className="font-medium text-gray-800 truncate max-w-[140px] text-right">{getUserInfo()}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500 shrink-0">测试</span>
              <span className={`font-medium ${isTestMode() ? 'text-purple-600' : 'text-gray-400'}`}>
                {isTestMode() ? '开' : '关'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1">
            <button
              onClick={handleResetToLogin}
              disabled={isResetting}
              className="w-full py-1.5 px-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md flex items-center justify-center gap-1.5 text-[11px] font-medium"
            >
              <LogIn className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? '…' : '重置到登录页'}</span>
            </button>

            <button
              onClick={handleResetTestData}
              disabled={isResetting || !hasActiveSession}
              className="w-full py-1.5 px-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md flex items-center justify-center gap-1.5 text-[11px] font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? '…' : '重置测试数据'}</span>
            </button>

            {hasActiveSession && (
              <button
                onClick={handleLogout}
                className="w-full py-1.5 px-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md flex items-center justify-center gap-1.5 text-[11px] font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>退出登录</span>
              </button>
            )}

            <button
              onClick={handleClearAllData}
              disabled={isResetting}
              className="w-full py-1.5 px-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md flex items-center justify-center gap-1.5 text-[11px] font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清除所有数据</span>
            </button>
          </div>

          <p className="mt-1.5 text-[10px] text-gray-400 text-center leading-tight">仅开发环境可见</p>
        </div>
      )}

      {/* Confirm Modals */}
      <ConfirmModal
        show={showResetConfirm}
        title="确认重置"
        message="确定要重置所有测试数据吗？这将清除所有健康记录、新手引导状态等数据。"
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={handleConfirmResetTestData}
        confirmText="确认重置"
        cancelText="取消"
        zIndex={100000}
      />

      <ConfirmModal
        show={showLogoutConfirm}
        title="确认退出"
        message="确定要退出登录吗？"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        confirmText="确认退出"
        cancelText="取消"
        zIndex={100000}
      />

      <ConfirmModal
        show={showClearAllConfirm}
        title="危险操作"
        message="⚠️ 危险操作！将清除所有数据并退出登录。若当前正在点「登录」，会打断登录流程并可能长时间卡在「登录中」。请等登录完成后再操作，或刷新页面后重试。确定要继续吗？"
        onCancel={() => setShowClearAllConfirm(false)}
        onConfirm={handleConfirmClearAllData}
        confirmText="确认清除"
        cancelText="取消"
        confirmColor="red"
        zIndex={100000}
      />

      <ConfirmModal
        show={showResetToLoginConfirm}
        title="确认重置"
        message="确定要重置到登录页吗？这将清除所有认证状态和引导流程。"
        onCancel={() => setShowResetToLoginConfirm(false)}
        onConfirm={handleConfirmResetToLogin}
        confirmText="确认重置"
        cancelText="取消"
        zIndex={100000}
      />

      {/* Alert Dialog */}
      <AlertDialog
        show={showAlert}
        type="error"
        title="错误"
        message={alertMessage}
        onClose={() => setShowAlert(false)}
        confirmText="确定"
        zIndex={100001}
      />
    </div>
  );
};

export default DevToolsPanel;
