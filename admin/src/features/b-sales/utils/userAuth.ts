/**
 * 用户认证和权限管理（Admin 面板简化版）
 * 管理后台上下文下，isAdmin() 始终返回 true
 */

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export class UserAuth {
  static isAdmin(): boolean {
    return true;
  }

  static canManageRules(): boolean {
    return true;
  }

  static getCurrentUser(): User {
    return {
      id: 'admin',
      name: '管理员',
      role: 'admin',
    };
  }
}
