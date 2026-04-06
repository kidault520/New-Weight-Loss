import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../config/api';
import SearchableSelect, { type SearchableSelectOption } from '../common/SearchableSelect';
import { OrganizationStorage } from '../../features/b-sales/utils/organizationStorage';

interface Order {
  id?: string;
  user_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  delivery_address_id?: string;
  notes?: string;
  salesperson_id?: string;
}

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  price: number;
}

interface User {
  user_id: string;
  id?: string;
  email?: string;
  nickname?: string;
  phone?: string;
  invited_by_salesperson_id?: string;
}

interface SalesPerson {
  id: string;
  code?: string;
  display_id?: string;
  name: string;
  level?: string;
}

interface OrderFormProps {
  order: Order | null;
  onSave: (data: Partial<Order>) => void | Promise<void>;
  onCancel: () => void;
  /** 防止重复提交（连点「保存」生成多条订单） */
  isSubmitting?: boolean;
}

export default function OrderForm({ order: orderData, onSave, onCancel, isSubmitting = false }: OrderFormProps) {
  const [formData, setFormData] = useState<Partial<Order>>({
    user_id: orderData?.user_id || '',
    product_id: orderData?.product_id || '',
    quantity: orderData?.quantity || 1,
    unit_price: orderData?.unit_price || 0,
    total_amount: orderData?.total_amount || 0,
    payment_method: orderData?.payment_method || '微信支付',
    delivery_address_id: orderData?.delivery_address_id || undefined,
    notes: orderData?.notes || '',
    salesperson_id: orderData?.salesperson_id || undefined,
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productContent, setProductContent] = useState<string>('');

  const userOptions = useMemo<SearchableSelectOption[]>(
    () =>
      users.map((user) => {
        const id = user.user_id || user.id || '';
        const nickname = user.nickname || '用户';
        const email = user.email || '';
        const phone = user.phone || '';
        return {
          value: id,
          label: `${nickname}${email ? ` (${email})` : ''}${phone ? ` - ${phone}` : ''}`,
          keywords: [nickname, email, phone, id],
        };
      }),
    [users]
  );

  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.product_name} (${product.product_code}) - ¥${product.price.toFixed(2)}`,
        keywords: [product.product_name, product.product_code, String(product.price)],
      })),
    [products]
  );

  const salesPersonOptions = useMemo<SearchableSelectOption[]>(
    () =>
      salesPersons.map((sp) => ({
        value: sp.id,
        label: `${sp.name}${sp.code ? ` (${sp.code})` : ''}${sp.display_id ? ` - ${sp.display_id}` : ''}`,
        keywords: [sp.name, sp.code || '', sp.display_id || '', sp.id],
      })),
    [salesPersons]
  );

  useEffect(() => {
    loadData();
  }, []);

  // 新增订单时：选择用户后，若该用户由某销售员推荐，自动关联销售员（可手动覆盖）
  useEffect(() => {
    if (!formData.user_id || orderData) return;
    const user = users.find(u => (u.user_id || u.id) === formData.user_id);
    if (user?.invited_by_salesperson_id) {
      setFormData(prev => ({
        ...prev,
        salesperson_id: user.invited_by_salesperson_id,
      }));
    }
  }, [formData.user_id, users, orderData]);

  useEffect(() => {
    if (formData.product_id && products.length > 0) {
      const product = products.find(p => p.id === formData.product_id);
      if (product) {
        setSelectedProduct(product);
        setFormData(prev => ({
          ...prev,
          unit_price: product.price,
          total_amount: product.price * (prev.quantity || 1)
        }));
        (async () => {
          try {
            const data = await apiClient.get<{ product: any }>(`/api/admin/products/${product.id}`);
            const meal = data.product?.meal_plans?.plan_name ? `${data.product.meal_plans.plan_name}` : '';
            const supp = data.product?.supplement_plans?.plan_name ? `${data.product.supplement_plans.plan_name}` : '';
            const parts = [];
            if (meal) parts.push(`餐食计划：${meal}`);
            if (supp) parts.push(`补剂疗程：${supp}`);
            setProductContent(parts.length ? parts.join('；') : '该商品未配置明细');
          } catch (e) {
            setProductContent('无法加载商品明细');
          }
        })();
      }
    }
  }, [formData.product_id, products]);

  useEffect(() => {
    if (selectedProduct && formData.quantity) {
      setFormData(prev => ({
        ...prev,
        total_amount: selectedProduct.price * formData.quantity!
      }));
    }
  }, [formData.quantity, selectedProduct]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 并行加载，任一失败不影响其他（使用 allSettled 避免整体失败）
      const results = await Promise.allSettled([
        apiClient.get<{ products: Product[]; pagination: any }>(
          '/api/admin/products?is_active=true&limit=1000'
        ),
        apiClient.get<{ users: User[]; pagination: any }>(
          '/api/admin/users?limit=1000&c_end_only=1&skip_email=1'
        ),
        apiClient.get<{ salesPersons: SalesPerson[] }>(
          '/api/admin/sales-persons?limit=500'
        ),
      ]);

      const [productsRes, usersRes, spRes] = results;
      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value?.products || []);
      } else {
        console.error('Products load failed:', productsRes.reason);
      }
      if (usersRes.status === 'fulfilled') {
        const list = usersRes.value?.users || [];
        setUsers(
          list.map((user) => ({
            user_id: user.user_id || user.id || '',
            id: user.user_id || user.id || '',
            email: user.email || '',
            nickname: user.nickname || '',
            phone: user.phone || '',
            invited_by_salesperson_id: user.invited_by_salesperson_id || undefined,
          }))
        );
      } else {
        console.error('Users load failed:', usersRes.reason);
      }
      const loadSalesFromFallback = (): SalesPerson[] => {
        const orgData = OrganizationStorage.loadOrganizationData();
        if (orgData?.persons?.size) {
          return Array.from(orgData.persons.values()).map((p) => ({
            id: p.id,
            code: p.code,
            display_id: p.displayId,
            name: p.name,
            level: p.level,
          }));
        }
        // 销售人员可能仅在 localStorage（组织配置）中，尚未同步到 sales_persons 表
        try {
          const raw = localStorage.getItem('organization-persons');
          if (raw) {
            const entries: [string, { id: string; code?: string; displayId?: string; name: string; level?: string }][] = JSON.parse(raw);
            return entries.map(([, p]) => ({
              id: p.id,
              code: p.code,
              display_id: p.displayId,
              name: p.name,
              level: p.level,
            }));
          }
        } catch (e) {
          console.warn('Parse organization-persons failed:', e);
        }
        return [];
      };

      if (spRes.status === 'fulfilled') {
        const fromApi = spRes.value?.salesPersons || [];
        if (fromApi.length > 0) {
          setSalesPersons(fromApi);
        } else {
          setSalesPersons(loadSalesFromFallback());
        }
      } else {
        console.error('Sales persons load failed:', spRes.reason);
        setSalesPersons(loadSalesFromFallback());
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.user_id) {
      alert('请选择用户');
      return;
    }

    if (!formData.product_id) {
      alert('请选择商品');
      return;
    }

    if (!formData.quantity || formData.quantity < 1) {
      alert('请填写有效的数量');
      return;
    }

    if (!formData.total_amount || formData.total_amount < 0) {
      alert('请填写有效的总金额');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto overscroll-contain my-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {orderData ? '编辑订单' : '添加订单'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                用户 <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.user_id || ''}
                onChange={(nextUserId) =>
                  setFormData({ ...formData, user_id: nextUserId })
                }
                options={userOptions}
                placeholder="请选择用户"
                searchPlaceholder="可输入昵称/邮箱/手机号进行模糊搜索"
                disabled={loading}
                required
                loading={loading}
                emptyText="没有匹配的用户"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                销售 <span className="text-amber-600 text-xs">（建议选择，订单创建后不可修改）</span>
              </label>
              <SearchableSelect
                value={formData.salesperson_id || ''}
                onChange={(nextId) =>
                  setFormData({ ...formData, salesperson_id: nextId || undefined })
                }
                options={salesPersonOptions}
                placeholder="请选择销售（可选）"
                searchPlaceholder="可输入姓名/工号搜索"
                disabled={loading}
                loading={loading}
                emptyText="没有匹配的销售"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                商品 <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.product_id || ''}
                onChange={(nextProductId) =>
                  setFormData({ ...formData, product_id: nextProductId })
                }
                options={productOptions}
                placeholder="请选择商品"
                searchPlaceholder="可输入商品名/编码进行模糊搜索"
                disabled={loading}
                required
                loading={loading}
                emptyText="没有匹配的商品"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                数量 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.quantity || ''}
                onChange={(e) =>
                  setFormData({ 
                    ...formData, 
                    quantity: parseInt(e.target.value) || 1 
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                单价（元）
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.unit_price || ''}
                onChange={(e) =>
                  setFormData({ 
                    ...formData, 
                    unit_price: parseFloat(e.target.value) || 0,
                    total_amount: (parseFloat(e.target.value) || 0) * (formData.quantity || 1)
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                readOnly={!!selectedProduct}
              />
              {selectedProduct && (
                <p className="mt-1 text-xs text-gray-500">商品价格：¥{selectedProduct.price.toFixed(2)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                总金额（元） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.total_amount || ''}
                onChange={(e) =>
                  setFormData({ 
                    ...formData, 
                    total_amount: parseFloat(e.target.value) || 0 
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                商品内容
              </label>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm">
                {productContent || '请选择商品以查看明细'}
              </div>
            </div>
            

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                备注
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="输入订单备注信息..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
