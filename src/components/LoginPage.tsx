import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../services/api';

interface LoginPageProps {
  onBack?: () => void;
  onLoginSuccess?: () => void;
}

const WeChatLoginButton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex justify-center ${className}`}>
    <button className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300 shadow-sm">
      <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
      </svg>
    </button>
  </div>
);

const AgreementBlock: React.FC<{ agreed: boolean; onToggle: () => void; children: React.ReactNode; className?: string }> = ({ agreed, onToggle, children, className = '' }) => (
  <div className={`flex items-start space-x-2 ${className}`}>
    <button
      onClick={onToggle}
      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
        agreed ? 'bg-emerald-400 border-emerald-400' : 'border-gray-300'
      }`}
    >
      {agreed && <Check className="w-3 h-3 text-white" />}
    </button>
    <p className="text-xs text-gray-500 leading-relaxed">{children}</p>
  </div>
);

const LoginPage: React.FC<LoginPageProps> = ({ onBack, onLoginSuccess }) => {
  const { signInWithPhone } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('111111');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, []);

  const isValidPhone = (phone: string) => {
    return /^1[3-9]\d{9}$/.test(phone);
  };

  const handleSendCode = async () => {
    if (!isValidPhone(phoneNumber)) {
      setError('请输入正确的手机号码');
      return;
    }

    if (!agreedToTerms) {
      setError('请先同意服务协议和隐私政策');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      let data: { success?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok || data.success === false) {
        setError(typeof data.error === 'string' ? data.error : '发送验证码失败，请稍后重试');
        return;
      }

      setVerificationCode('111111');
      setCountdown(60);

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError('发送验证码失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: signInError } = await signInWithPhone(phoneNumber, verificationCode);

      if (signInError) {
        const authCode = (signInError as Error & { code?: string }).code;
        const errorMessage = signInError.message || signInError.toString();

        if (
          authCode === 'INVALID_VERIFICATION_CODE' ||
          authCode === 'INVALID_OR_EXPIRED_CODE' ||
          authCode === 'OTP_ATTEMPTS_EXCEEDED'
        ) {
          setError(errorMessage);
        } else if (
          authCode === 'OTP_IP_RATE_LIMIT' ||
          authCode === 'OTP_SEND_COOLDOWN' ||
          authCode === 'VALIDATION_ERROR'
        ) {
          setError(errorMessage);
        } else if (
          authCode === 'SIGN_UP_FAILED' ||
          authCode === 'NO_USER_AFTER_SIGNUP' ||
          authCode === 'NO_SESSION_AFTER_SIGNUP'
        ) {
          setError(errorMessage);
        } else if (
          authCode === 'SUPABASE_UNREACHABLE' ||
          authCode === 'NETWORK_UNAVAILABLE' ||
          authCode === 'LOGIN_TIMEOUT' ||
          authCode === 'LOGIN_ABORTED'
        ) {
          setError(errorMessage);
        } else if (authCode === 'SMS_SEND_FAILED') {
          setError('短信发送失败，请稍后重试');
        } else if (authCode === 'AUTH_FAILED') {
          setError('登录失败，请稍后重试');
        } else if (errorMessage.includes('Invalid login credentials')) {
          setError('验证码错误，请重试');
        } else {
          setError(`登录失败：${errorMessage}`);
        }
      } else {
        if (onLoginSuccess) {
          void Promise.resolve(onLoginSuccess()).catch((err: unknown) => {
            console.error('❌ [LoginPage] Error in onLoginSuccess callback:', err);
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登录失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 max-w-[448px] mx-auto">
      {onBack && (
        <div className="pt-4 pb-4 px-5">
          <button
            onClick={onBack}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-7 h-7 text-gray-900" strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center px-8 pt-24">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight mt-16">手机号登录</h1>
        <p className="text-gray-400 text-xs mb-8">
          未注册的手机号登录成功后将自动注册
        </p>

        <div className="w-full space-y-4 mb-8">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-900 text-sm font-medium">
              +86
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11));
                setError('');
              }}
              placeholder="请输入手机号码"
              maxLength={11}
              className="w-full pl-14 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-emerald-400 focus:outline-none text-sm placeholder:text-gray-400"
            />
          </div>

          <div className="relative">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              placeholder="请输入验证码"
              maxLength={6}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-emerald-400 focus:outline-none text-sm placeholder:text-gray-400"
            />
            <button
              onClick={handleSendCode}
              disabled={!isValidPhone(phoneNumber) || countdown > 0 || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-medium hover:text-emerald-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {countdown > 0 ? `${countdown}s` : '发送验证码'}
            </button>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 mt-auto pb-[30px]">
        <WeChatLoginButton className="mb-3" />

        <button
          onClick={handleLogin}
          disabled={!isValidPhone(phoneNumber) || verificationCode.length !== 6 || !agreedToTerms || isLoading}
          className={`w-full py-3 rounded-full text-white text-sm font-medium transition-all duration-300 mb-3 ${
            isValidPhone(phoneNumber) && verificationCode.length === 6 && agreedToTerms && !isLoading
              ? 'bg-emerald-500 hover:bg-emerald-600'
              : 'bg-gray-200 cursor-not-allowed'
          }`}
        >
          {isLoading ? '登录中...' : '登录'}
        </button>

        <AgreementBlock
          agreed={agreedToTerms}
          onToggle={() => setAgreedToTerms(!agreedToTerms)}
          className="mt-2"
        >
          <>
            我已阅读并同意
            <a href="#" className="text-emerald-500">《用户协议》</a>
            <a href="#" className="text-emerald-500">《隐私政策》</a>
          </>
        </AgreementBlock>
      </div>
    </div>
  );
};

export default LoginPage;
