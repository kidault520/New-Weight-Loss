import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { isSupabaseConfigured } from './config/supabase';
import { OrganizationStorage } from '@/features/b-sales/utils/organizationStorage';
import { RuleStorage } from '@/features/b-sales/utils/ruleStorage';
import { EvaluationStorage } from '@/features/b-sales/utils/evaluationStorage';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import UserDetail from './pages/UserDetail';
import ContentManagement from './pages/ContentManagement';
import MenuManagement from './pages/MenuManagement';
import SupplementManagementPage from './pages/SupplementManagementPage';
import ProductManagement from './pages/ProductManagement';
import OrderManagement from './pages/OrderManagement';
import { ErrorBoundary } from './components/ErrorBoundary';
import DeliveryManagement from './pages/DeliveryManagement';
import StatisticsDashboard from './pages/StatisticsDashboard';
import SystemConfig from './pages/SystemConfig';
import PermissionManagement from './pages/PermissionManagement';
import IntegrationsCenter from './pages/IntegrationsCenter';
import BSalesRules from './pages/BSalesRules';
import BSalesOrganization from './pages/BSalesOrganization';
import BSalesHeadquarters from './pages/BSalesHeadquarters';
import BSalesPerformance from './pages/BSalesPerformance';
import PrivateRoute from './components/PrivateRoute';

function App() {
  useEffect(() => {
    if (isSupabaseConfigured) {
      Promise.all([
        OrganizationStorage.initAsync(),
        RuleStorage.initAsync(),
        EvaluationStorage.initAsync(),
      ]).catch((e) => console.error('B-sales Storage init failed:', e));
    }
  }, []);

  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="content" element={<ContentManagement />} />
            <Route path="supplements" element={<SupplementManagementPage />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="orders" element={<ErrorBoundary><OrderManagement /></ErrorBoundary>} />
            <Route path="deliveries" element={<DeliveryManagement />} />
            <Route path="statistics" element={<StatisticsDashboard />} />
            <Route path="config" element={<SystemConfig />} />
            <Route path="integrations" element={<IntegrationsCenter />} />
            <Route path="permissions" element={<PermissionManagement />} />
            <Route path="b-rules" element={<BSalesRules />} />
            <Route path="b-org" element={<BSalesOrganization />} />
            <Route path="b-headquarters" element={<BSalesHeadquarters />} />
            <Route path="b-performance" element={<BSalesPerformance />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}

export default App;






