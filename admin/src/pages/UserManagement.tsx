import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../config/api';
import { Trash2, Sparkles } from 'lucide-react';
import UserAIAnalysisModal from '../components/UserAIAnalysisModal';
import SearchFilterBar from '../components/common/SearchFilterBar';
import ListPagination from '../components/common/ListPagination';
import type { FilterCondition } from '../components/common/SearchFilterBar';

interface User {
  id: string;
  user_id: string;
  name?: string;
  nickname?: string;
  email?: string;
  last_sign_in_at?: string;
  created_at: string;
}

const USERS_CACHE_PREFIX = 'admin_users_cache:';
const USERS_CACHE_TTL_MS = 120_000;

function invalidateUsersListCaches() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(USERS_CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [filterNickname, setFilterNickname] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [aiAnalysisModalOpen, setAiAnalysisModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const tid = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(tid);
  }, [search]);

  const listQueryKey = useMemo(
    () =>
      JSON.stringify({
        page,
        limit,
        debouncedSearch,
        filterNickname,
        filterName,
        filterPhone,
      }),
    [page, limit, debouncedSearch, filterNickname, filterName, filterPhone]
  );

  const cacheStorageKey = `${USERS_CACHE_PREFIX}${listQueryKey}`;

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: String(limit),
    });
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (filterNickname) params.append('nickname', filterNickname);
    if (filterName) params.append('name', filterName);
    if (filterPhone) params.append('phone', filterPhone);
    const data = await apiClient.get<{
      users: User[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/admin/users?${params}`);
    setUsers(data.users);
    setTotal(data.pagination.total || 0);
    setTotalPages(data.pagination.totalPages);
    try {
      sessionStorage.setItem(
        cacheStorageKey,
        JSON.stringify({
          ts: Date.now(),
          users: data.users,
          total: data.pagination.total || 0,
          totalPages: data.pagination.totalPages,
        })
      );
    } catch {
      /* ignore */
    }
  }, [
    page,
    limit,
    debouncedSearch,
    filterNickname,
    filterName,
    filterPhone,
    cacheStorageKey,
  ]);

  useEffect(() => {
    let cancelled = false;
    const raw = sessionStorage.getItem(cacheStorageKey);
    let usedCache = false;
    if (raw) {
      try {
        const c = JSON.parse(raw) as {
          ts: number;
          users: User[];
          total: number;
          totalPages: number;
        };
        if (Date.now() - c.ts < USERS_CACHE_TTL_MS && Array.isArray(c.users)) {
          setUsers(c.users);
          setTotal(c.total);
          setTotalPages(c.totalPages);
          setLoading(false);
          usedCache = true;
        }
      } catch {
        /* ignore */
      }
    }
    if (!usedCache) setLoading(true);

    fetchUsers()
      .catch((error) => {
        console.error('Failed to load users:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheStorageKey, fetchUsers]);

  const handleDelete = async (userId: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可撤销。')) {
      return;
    }

    try {
      await apiClient.delete(`/api/admin/users/${userId}`);
      invalidateUsersListCaches();
      setLoading(true);
      await fetchUsers();
    } catch (error) {
      alert('删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAIAnalysis = (userId: string) => {
    setSelectedUserId(userId);
    setAiAnalysisModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
      </div>

      <div className="mb-4">
        <SearchFilterBar
          searchPlaceholder="搜索昵称、姓名、手机号..."
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          onSearch={() => {
            setDebouncedSearch(search);
            setPage(1);
          }}
          filterFields={[
            { value: 'nickname', label: '昵称' },
            { value: 'name', label: '姓名' },
            { value: 'phone', label: '手机号' },
          ]}
          filterConditions={filterConditions}
          onFilterConditionsChange={setFilterConditions}
          onFilterApply={() => {
            let n = '',
              na = '',
              p = '';
            filterConditions.forEach((c) => {
              if (c.field === 'nickname') n = c.value;
              if (c.field === 'name') na = c.value;
              if (c.field === 'phone') p = c.value;
            });
            setFilterNickname(n);
            setFilterName(na);
            setFilterPhone(p);
            setPage(1);
          }}
          onFilterClear={() => {
            setSearch('');
            setFilterConditions([]);
            setFilterNickname('');
            setFilterName('');
            setFilterPhone('');
            setDebouncedSearch('');
            setPage(1);
          }}
        />
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      用户
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      邮箱
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最近一次登录时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      注册时间
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/admin/users/${user.user_id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || user.nickname || '未命名'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleDateString('zh-CN')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAIAnalysis(user.user_id);
                            }}
                            className="text-purple-600 hover:text-purple-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                            title="数据解读"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>AI解读</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(user.user_id);
                            }}
                            className="text-red-600 hover:text-red-900"
                            title="删除用户"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <ListPagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(nextLimit) => {
                  setLimit(nextLimit);
                  setPage(1);
                }}
                className="mt-0"
              />
            </div>
          </>
        )}
      </div>

      {selectedUserId && (
        <UserAIAnalysisModal
          isOpen={aiAnalysisModalOpen}
          onClose={() => {
            setAiAnalysisModalOpen(false);
            setSelectedUserId(null);
          }}
          userId={selectedUserId}
        />
      )}
    </div>
  );
}
