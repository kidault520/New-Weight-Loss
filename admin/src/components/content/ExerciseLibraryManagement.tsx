import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../config/api';
import { Plus, Edit, Trash2, X, Search, Tags, Activity } from 'lucide-react';
import CategoryManagement from './CategoryManagement';
import SearchableSelect from '../common/SearchableSelect';
import ListPagination from '../common/ListPagination';

interface ExerciseItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  calories: number;
  duration: number; // minutes
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

type ViewMode = 'exercises' | 'categories';

export default function ExerciseLibraryManagement() {
  const [viewMode, setViewMode] = useState<ViewMode>('exercises');
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExerciseItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    loadCategories();
    loadExercises();
  }, []);

  // 当viewMode切换回exercises时，重新加载分类（确保获取最新分类）
  useEffect(() => {
    if (viewMode === 'exercises') {
      loadCategories();
    }
  }, [viewMode]);

  const loadCategories = async () => {
    try {
      const data = await apiClient.get<{ categories: Category[] }>('/api/admin/content/exercise-categories');
      setCategories(data.categories?.filter(c => c.is_active) || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadExercises = async () => {
    try {
      const data = await apiClient.get<{ exercises: ExerciseItem[] }>('/api/admin/content/exercise-library');
      setExercises(data.exercises || []);
    } catch (error) {
      console.error('Failed to load exercises:', error);
      alert('加载运动库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: Partial<ExerciseItem>) => {
    try {
      if (editing) {
        await apiClient.put(`/api/admin/content/exercise-library/${editing.id}`, formData);
      } else {
        await apiClient.post('/api/admin/content/exercise-library', formData);
      }
      setShowForm(false);
      setEditing(null);
      loadExercises();
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.message || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此运动吗？')) return;
    try {
      await apiClient.delete(`/api/admin/content/exercise-library/${id}`);
      loadExercises();
    } catch (error: any) {
      const errorMessage = error.message || (error.response?.data?.error || '删除失败');
      const errorDetails = error.response?.data?.details || '';
      alert(errorDetails ? `${errorMessage}\n${errorDetails}` : errorMessage);
    }
  };

  const handleEdit = (exercise: ExerciseItem) => {
    setEditing(exercise);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const filteredExercises = exercises.filter(exercise => {
    const matchesSearch = searchTerm.trim() === '' || 
      exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '全部' || exercise.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const total = filteredExercises.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedExercises = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredExercises.slice(start, start + limit);
  }, [filteredExercises, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* View Mode Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setViewMode('exercises')}
              className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'exercises'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Activity className="w-5 h-5 mr-2" />
              运动管理
            </button>
            <button
              onClick={() => setViewMode('categories')}
              className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Tags className="w-5 h-5 mr-2" />
              分类管理
            </button>
          </nav>
        </div>
      </div>

      {viewMode === 'categories' ? (
        <CategoryManagement 
          type="exercise" 
          onCategoryChange={() => {
            // 当分类更新时，重新加载分类列表
            loadCategories();
          }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">运动库管理</h2>
            <button
              onClick={handleAdd}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              添加运动
            </button>
          </div>

      {/* Search and Filter */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索运动名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('全部')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              selectedCategory === '全部'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                selectedCategory === cat.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">运动</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分类</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">热量</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时长</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExercises.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    暂无运动数据
                  </td>
                </tr>
              ) : (
                paginatedExercises.map((exercise) => (
                  <tr key={exercise.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">{exercise.icon}</span>
                        <div className="text-sm font-medium text-gray-900">{exercise.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exercise.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exercise.calories} kcal</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exercise.duration} 分钟</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        exercise.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {exercise.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(exercise)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <Edit className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(exercise.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
      />

      {/* Form Modal */}
      {showForm && (
        <ExerciseForm
          exercise={editing}
          categories={categories}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
        </>
      )}
    </div>
  );
}

interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

interface ExerciseFormProps {
  exercise: ExerciseItem | null;
  categories: Category[];
  onSave: (data: Partial<ExerciseItem>) => void;
  onClose: () => void;
}

function ExerciseForm({ exercise, categories, onSave, onClose }: ExerciseFormProps) {
  const [formData, setFormData] = useState<Partial<ExerciseItem>>({
    name: exercise?.name || '',
    icon: exercise?.icon || '🏃',
    category: exercise?.category || (categories.length > 0 ? categories[0].name : '常用'),
    calories: exercise?.calories || 0,
    duration: exercise?.duration || 30,
    is_active: exercise?.is_active ?? true,
    display_order: exercise?.display_order || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.icon) {
      alert('请填写运动名称和图标');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{exercise ? '编辑运动' : '添加运动'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">运动名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">图标 *</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="🏃"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">分类 *</label>
            <SearchableSelect
              value={formData.category ?? ''}
              onChange={(value) => setFormData({ ...formData, category: value })}
              options={categories.map((cat) => ({ value: cat.name, label: cat.name }))}
              placeholder="请选择分类"
              searchPlaceholder="输入分类关键词筛选"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">热量 (kcal) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">时长 (分钟) *</label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">显示顺序</label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">启用</label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

