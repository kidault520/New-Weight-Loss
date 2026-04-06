import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  UtensilsCrossed,
  BarChart3, 
  Settings, 
  Shield,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Pill,
  Network,
  Building2,
  Plug
} from 'lucide-react';
import { useState, useEffect } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'admin_sidebar_collapsed';

export default function AdminLayout() {
  const { user, logout, hasPermission } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);


  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const menuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: '仪表盘', permission: 'view_statistics' },
    { path: '/admin/users', icon: Users, label: '用户管理', permission: 'manage_users' },
    { path: '/admin/content', icon: FileText, label: '内容管理', permission: 'manage_content' },
    { path: '/admin/supplements', icon: Pill, label: '补剂管理', permission: 'manage_content' },
    { path: '/admin/menu', icon: UtensilsCrossed, label: '餐食管理', permission: 'manage_menu' },
    { path: '/admin/products', icon: ShoppingBag, label: '商品管理', permission: 'manage_menu' },
    { path: '/admin/orders', icon: ShoppingCart, label: '订单管理', permission: 'manage_orders' },
    { path: '/admin/deliveries', icon: Truck, label: '配送管理', permission: 'manage_deliveries' },
    { path: '/admin/statistics', icon: BarChart3, label: '数据统计', permission: 'view_statistics' },
    { path: '/admin/config', icon: Settings, label: '系统配置', permission: 'manage_config' },
    { path: '/admin/integrations', icon: Plug, label: '三方集成中心', permission: 'manage_config' },
    { path: '/admin/permissions', icon: Shield, label: '权限管理', permission: 'manage_admins' },
    { path: '/admin/b-headquarters', icon: Building2, label: 'B端-总部仪表板', permission: 'manage_config' },
    { path: '/admin/b-rules', icon: Settings, label: 'B端-规则管理', permission: 'manage_config' },
    { path: '/admin/b-org', icon: Network, label: 'B端-组织配置', permission: 'manage_config' },
    { path: '/admin/b-performance', icon: BarChart3, label: 'B端-销售业绩', permission: 'manage_config' },
  ].filter(item => hasPermission(item.permission));

  const isNarrow = sidebarCollapsed;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - 折叠时 w-14，展开时 w-48；悬停展开 */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen transition-all duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 bg-white border-r border-gray-200 lg:z-40 ${
          isNarrow ? 'lg:w-14' : 'lg:w-48'
        } w-48`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <div className={`flex items-center gap-2 shrink-0 px-3 py-4 border-b border-gray-200 h-[57px] ${isNarrow ? 'justify-center' : ''}`}>
            {!isNarrow && <h1 className="text-xl font-bold text-gray-900 truncate flex-1">管理后台</h1>}
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden lg:flex items-center justify-center w-9 h-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              title={sidebarCollapsed ? '展开菜单' : '折叠菜单'}
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700 shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || 
                (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={isNarrow ? item.label : undefined}
                  className={`flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${isNarrow ? 'justify-center px-2' : 'px-3'}`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!isNarrow && <span className="ml-3 truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content - 统一间隙 px-6 */}
      <div className={`lg:transition-all duration-200 ${isNarrow ? 'lg:pl-14' : 'lg:pl-48'}`}>
        {/* Top bar - 与内容区统一 padding */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-[57px] flex items-center shrink-0">
          <div className="flex items-center justify-between px-6 py-3 gap-4 w-full">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1 min-w-0" />
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 truncate">
                <span className="font-medium">{user?.email}</span>
                <span className="ml-2 text-gray-400">({user?.admin.roleName || user?.admin.role})</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出
              </button>
            </div>
          </div>
        </header>

        {/* Page content - 统一最大宽度，与顶栏、侧边栏统一 24px 间隙 */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}


