import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiClient } from '../config/api';

interface AdminUser {
  id: string;
  email: string;
  admin: {
    id: string;
    role: string;
    roleName?: string;
    permissions: Record<string, boolean>;
    isActive: boolean;
    lastLoginAt?: string;
  };
}

interface AdminAuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiClient.get<{ user: AdminUser }>('/api/admin/auth/me');
      setUser(data.user);
    } catch (error) {
      localStorage.removeItem('admin_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await apiClient.post<{
      user: AdminUser;
      session: { access_token: string };
    }>('/api/admin/auth/login', { email, password });

    localStorage.setItem('admin_token', data.session.access_token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/admin/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // 清除管理员 token
      localStorage.removeItem('admin_token');
      
      // 清除所有可能的管理员相关缓存
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('admin') ||
          key.startsWith('admin_')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error(`Failed to remove ${key}:`, e);
        }
      });
      
      // 清除 sessionStorage 中的管理员相关数据
      try {
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (
            key.includes('admin') ||
            key.startsWith('admin_')
          )) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => {
          sessionStorage.removeItem(key);
        });
      } catch (e) {
        console.error('Failed to clear sessionStorage:', e);
      }
      
      setUser(null);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.admin.role === 'super_admin') return true;
    
    const permParts = permission.split('.');
    let current: any = user.admin.permissions;
    
    for (const part of permParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }
    
    return current === true;
  };

  return (
    <AdminAuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}


