import React, { useState, useEffect, startTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUserProfile } from '../../contexts/UserProfileContext';

const nicknamePool = [
  '细心的雪狐', '活力的熊猫', '优雅的白鹤', '勇敢的狮子', '聪明的海豚',
  '温柔的小鹿', '快乐的企鹅', '坚强的老鹰', '可爱的兔子', '灵动的猎豹',
  '沉稳的大象', '敏捷的猴子', '自信的孔雀', '友善的金毛', '独立的猫咪',
  '阳光的向日葵', '宁静的月亮', '热情的火焰', '清新的微风', '温暖的阳光'
];

const getRandomNickname = () => {
  return nicknamePool[Math.floor(Math.random() * nicknamePool.length)];
};

interface WelcomePageProps {
  onBack?: () => void;
  isReassessment?: boolean; // 标识是否为重新评测，用于显示返回按钮
}

const WelcomePage: React.FC<WelcomePageProps> = React.memo(({ onBack, isReassessment = false }) => {
  const { data, updateData, goToNextStep } = useOnboarding();
  const { isAuthenticated, user } = useAuth();
  const { profile, isLoading: profileLoading, profileFetchTimedOut } = useUserProfile();
  const [nickname, setNickname] = useState('');

  // 🔥 修复：使用用户ID作为key，防止组件重新挂载时重复执行
  const nicknameInitializedRef = React.useRef<string | null>(null);
  const lastIsAuthenticatedRef = React.useRef<boolean | undefined>(undefined);
  
  // Only log when isAuthenticated actually changes
  useEffect(() => {
    if (lastIsAuthenticatedRef.current !== isAuthenticated) {
      console.log('🏠 [WelcomePage] isAuthenticated changed:', lastIsAuthenticatedRef.current, '->', isAuthenticated);
      lastIsAuthenticatedRef.current = isAuthenticated;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const loadSavedNickname = () => {
      const currentUserId = user?.id || 'anonymous';

      const ctxNick = typeof data.nickname === 'string' ? data.nickname.trim() : '';

      // 必须放在「已为当前用户初始化」判断之前：OnboardingContext 会异步合并 DB，
      // 晚到的「彭先生」等应覆盖此前误生成的随机昵称。
      if (ctxNick) {
        setNickname(ctxNick);
        nicknameInitializedRef.current = currentUserId;
        if (import.meta.env.DEV) {
          console.log('✅ [WelcomePage] Using nickname from OnboardingContext:', ctxNick);
        }
        return;
      }

      // 已登录且档案仍在拉取：不要随机昵称，避免老用户闪「宁静的月亮」等
      if (isAuthenticated && (profileLoading || profileFetchTimedOut)) {
        return;
      }

      const rawProfileNick = typeof profile?.nickname === 'string' ? profile.nickname.trim() : '';
      if (rawProfileNick && rawProfileNick !== '用户') {
        setNickname(rawProfileNick);
        nicknameInitializedRef.current = currentUserId;
        if (import.meta.env.DEV) {
          console.log('✅ [WelcomePage] Using nickname from user profile:', rawProfileNick);
        }
        return;
      }

      if (nicknameInitializedRef.current === currentUserId) {
        return;
      }

      const randomNickname = getRandomNickname();
      setNickname(randomNickname);
      nicknameInitializedRef.current = currentUserId;
      startTransition(() => {
        updateData({ nickname: randomNickname });
      });
      if (import.meta.env.DEV) {
        console.log('🎲 [WelcomePage] Generated random nickname (no context nickname yet):', randomNickname);
      }
    };

    loadSavedNickname();
  }, [
    isReassessment,
    data.nickname,
    updateData,
    isAuthenticated,
    profileLoading,
    profileFetchTimedOut,
    profile?.nickname,
    user?.id,
  ]);

  const handleRefresh = () => {
    const newNickname = getRandomNickname();
    setNickname(newNickname);
  };

  const handleStart = () => {
    console.log('🔘 handleStart clicked! nickname:', nickname);
    if (nickname.trim()) {
      updateData({ nickname: nickname.trim() });
      goToNextStep();
    } else {
      console.log('⚠️ Nickname is empty, button should be disabled');
    }
  };


  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header with back button for reassessment flow */}
      {isReassessment && onBack && (
        <div className="flex-shrink-0 px-4 py-4">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← 返回
          </button>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 px-6 overflow-y-auto pb-24 pt-20">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-200 via-teal-100 to-teal-50 flex items-center justify-center shadow-lg">
            <div className="w-24 h-24 rounded-full bg-teal-800 flex items-center justify-center">
              <div className="flex space-x-3">
                <div className="w-2 h-2 rounded-full bg-white"></div>
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-6 bg-teal-800/20 rounded-full blur-md"></div>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center">
          我将会问几个问题来定制你<br />的个人计划
        </h1>

        <div className="w-full max-w-sm">
          <div className="relative">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="取个昵称吧～"
              className="w-full px-6 py-4 rounded-2xl border-2 border-gray-800 bg-white text-gray-800 placeholder-gray-400 text-center text-lg focus:outline-none focus:border-emerald-400 transition-colors"
            />
            <button
              onClick={handleRefresh}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors z-10"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <p className="text-sm text-gray-500 text-right mt-2 mr-2">取个昵称吧～</p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-6 pb-[env(safe-area-inset-bottom)] pb-8 pt-4">
        <div className="w-full max-w-sm mx-auto">
          <button
            onClick={handleStart}
            disabled={!nickname.trim()}
            className="w-full py-4 rounded-2xl bg-emerald-400 text-white text-lg font-medium hover:bg-emerald-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 shadow-lg -translate-y-5"
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            开始我的健康之旅
          </button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render), false if different (re-render)
  return prevProps.isReassessment === nextProps.isReassessment && prevProps.onBack === nextProps.onBack;
});

WelcomePage.displayName = 'WelcomePage';

export default WelcomePage;
