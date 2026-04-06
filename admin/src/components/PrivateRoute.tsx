import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAdminAuth();

  // 未登录才跳转；校验中仍渲染布局，避免整页白屏
  if (!loading && !user) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}











