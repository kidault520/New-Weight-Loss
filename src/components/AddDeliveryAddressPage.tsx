import React, { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { addressService, AddressEditGuardResult, DeliveryAddress as DBDeliveryAddress } from '../services/addressService';
import { DrawerScreen } from './common/DrawerScreen';
import { SecondaryPageHeader } from './common/SecondaryPageHeader';
import { LoadingState } from './common/LoadingState';
import { EmptyState } from './common/EmptyState';
import { ConfirmModal } from './common/ConfirmModal';
import { AlertDialog } from './common/AlertDialog';
import { useAddressSwipe } from '../hooks/useAddressSwipe';
import { useAddressManagement } from '../hooks/useAddressManagement';
import { AddressList } from './delivery/AddressList';
import { AddressForm, DeliveryAddress } from './delivery/AddressForm';
import { MapPickResult } from './map/AmapAddressMapEmbed';
import { setUserStorageItem } from '../utils/userStorage';
import { getMealPlanConfig } from '../services/mealPlanConfigService';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';

const CN_PHONE_REGEX = /^1[3-9]\d{9}$/;

const normalizePhone = (value: string): string => value.replace(/\D/g, '').slice(0, 11);

const normalizeMealType = (mealType: string): string | null => {
  const value = String(mealType || '').trim().toLowerCase();
  if (value === 'breakfast' || value === '早餐') return 'breakfast';
  if (value === 'lunch' || value === '午餐') return 'lunch';
  if (value === 'dinner' || value === '晚餐') return 'dinner';
  return null;
};

const normalizeMealTypes = (mealTypes?: string[]): string[] => {
  if (!mealTypes || mealTypes.length === 0) return [];
  return Array.from(new Set(
    mealTypes
      .map(normalizeMealType)
      .filter((item): item is string => !!item)
  ));
};

const mealTypeToLabel = (mealType?: string): string => {
  const value = String(mealType || '').toLowerCase();
  if (value === 'breakfast' || value === '早餐') return '早餐';
  if (value === 'lunch' || value === '午餐') return '午餐';
  if (value === 'dinner' || value === '晚餐') return '晚餐';
  return value || '该餐次';
};

type AddressSyncMeta = {
  updatedCount?: number;
  skippedLockedCount?: number;
};

interface AddDeliveryAddressPageProps {
  onClose: () => void;
  onComplete: (deliveryAddressId: string, meta?: {
    hasDefaultMealTypes: boolean;
    fromQuickAdd?: boolean;
    label?: string;
    address?: string;
    doorNumber?: string;
    contactName?: string;
    phone?: string;
  }) => void;
  show?: boolean; // 控制 DrawerScreen 的显示/隐藏
  initialDeliveryAddressId?: string;
  selectedDates?: Date[];
  excludedDates?: Date[];
  showCompleteButton?: boolean; // 是否显示底部"确定"按钮，用于地址选择场景
  openAddFormDirectly?: boolean;
  /** 订单中的餐次，用于默认地址的餐次选择范围；不传则显示全部 */
  orderMealTypes?: string[];
  /** 更新默认配送地址后，建议前往配送计划重新生成；传入则显示「前往配送计划」按钮 */
  onOpenDeliveryPlan?: () => void;
}


const AddDeliveryAddressPage: React.FC<AddDeliveryAddressPageProps> = ({
  onClose,
  onComplete,
  show = true, // 添加 show prop，默认 true 保持向后兼容
  initialDeliveryAddressId,
  selectedDates: _selectedDates, // 预留参数，暂时未使用
  excludedDates: _excludedDates = [], // 预留参数，暂时未使用
  showCompleteButton = true, // 默认显示，用于配送计划场景
  openAddFormDirectly = false,
  orderMealTypes,
  onOpenDeliveryPlan,
}) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [formData, setFormData] = useState<DeliveryAddress>({
    name: '',
    phone: '',
    address: '',
    doorNumber: '',
    tag: '',
    gender: 'male'
  });
  const [isDefaultAddress, setIsDefaultAddress] = useState(false);
  const [defaultMealTypes, setDefaultMealTypes] = useState<'all' | string[]>('all');
  const [editingAddress, setEditingAddress] = useState<DBDeliveryAddress | null>(null);
  const [isSaving, setIsSaving] = useState(false); // 🔥 修复：添加保存状态，防止重复提交
  const [manualSelectedAddressId, setManualSelectedAddressId] = useState<string | null>(null);
  const [pendingSwipeResetId, setPendingSwipeResetId] = useState<string | null>(null);
  const [effectiveOrderMealTypes, setEffectiveOrderMealTypes] = useState<string[]>(normalizeMealTypes(orderMealTypes));
  const [showRegenerateSuggestModal, setShowRegenerateSuggestModal] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [tagError, setTagError] = useState('');
  const [pendingEditAddress, setPendingEditAddress] = useState<DBDeliveryAddress | null>(null);
  const [pendingEditUsageCount, setPendingEditUsageCount] = useState(0);
  const [editGuardsByAddressId, setEditGuardsByAddressId] = useState<Record<string, AddressEditGuardResult>>({});
  const registeredPhone = normalizePhone(profile?.phone || '');

  const getMissingDefaultMealTypes = (addresses: DBDeliveryAddress[]): string[] => {
    const requiredMealTypes = normalizeMealTypes(effectiveOrderMealTypes);
    if (requiredMealTypes.length === 0) return [];

    const covered = new Set<string>();
    addresses.forEach((addr) => {
      const dmt = normalizeMealTypes((addr.default_meal_types || []) as string[]);
      if (dmt.includes('all')) {
        requiredMealTypes.forEach((meal) => covered.add(meal));
        return;
      }
      dmt.forEach((meal) => {
        if (requiredMealTypes.includes(meal)) {
          covered.add(meal);
        }
      });
    });

    return requiredMealTypes.filter((meal) => !covered.has(meal));
  };

  // 使用提取的Hook
  const {
    savedAddresses,
    selectedAddressId,
    setSelectedAddressId,
    loading,
    customTags,
    setCustomTags,
    saveAddress,
    deleteAddress,
    refreshAddresses,
  } = useAddressManagement({
    initialDeliveryAddressId,
    currentUserId: user?.id ?? null,
    onAlert: setAlertState,
  });

  const {
    swipedAddressId,
    setSwipedAddressId,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetSwipe,
  } = useAddressSwipe();

  const handleClose = () => {
    onClose();
  };

  const getTagErrorMessage = (rawTag: string): string => {
    const normalized = rawTag.trim();
    if (!normalized) return '请选择或输入标签';
    const hasDuplicate = savedAddresses.some(addr => {
      if (addr.id === editingAddress?.id) return false;
      const existing = String(addr.tag || addr.label || '').trim();
      return existing !== '' && existing === normalized;
    });
    return hasDuplicate ? '标签不能重复' : '';
  };

  const isTagInUse = (rawTag: string): boolean => {
    const normalized = rawTag.trim();
    if (!normalized) return false;
    return savedAddresses.some(addr => String(addr.tag || addr.label || '').trim() === normalized);
  };

  const handleMapLocationPick = (r: MapPickResult) => {
    setFormData((prev) => ({
      ...prev,
      address: r.address,
      longitude: r.lng,
      latitude: r.lat,
    }));
  };

  const handleInputChange = (field: keyof DeliveryAddress, value: string | 'male' | 'female') => {
    if (field === 'address' && typeof value === 'string') {
      setFormData((prev) => ({
        ...prev,
        address: value,
        longitude: undefined,
        latitude: undefined,
      }));
      return;
    }
    if (field === 'phone' && typeof value === 'string') {
      const normalized = normalizePhone(value);
      setFormData(prev => ({ ...prev, phone: normalized }));

      if (!normalized) {
        setPhoneError('');
      } else if (normalized.length < 11) {
        setPhoneError('手机号需为 11 位数字');
      } else if (!CN_PHONE_REGEX.test(normalized)) {
        setPhoneError('请输入有效的手机号码');
      } else {
        setPhoneError('');
      }
      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (field === 'tag' && typeof value === 'string') {
      setTagError(getTagErrorMessage(value));
    }
  };

  const isFormValid = () => {
    const currentTagError = getTagErrorMessage(formData.tag);
    return formData.name.trim() !== '' &&
           CN_PHONE_REGEX.test(formData.phone.trim()) &&
           formData.address.trim() !== '' &&
           formData.doorNumber.trim() !== '' &&
           formData.tag.trim() !== '' &&
           !currentTagError &&
           !phoneError;
  };

  const handleSaveAddress = async () => {
    if (!isFormValid() || isSaving) return; // 🔥 修复：防止重复提交
    if (!CN_PHONE_REGEX.test(formData.phone.trim())) {
      setPhoneError('请输入有效的手机号码');
      return;
    }
    const tagErrorMessage = getTagErrorMessage(formData.tag);
    if (tagErrorMessage) {
      setTagError(tagErrorMessage);
      return;
    }

    try {
      setIsSaving(true); // 🔥 修复：设置保存状态
      const effectiveDefaultMealTypes: 'all' | string[] =
        isDefaultAddress && defaultMealTypes === 'all' && effectiveOrderMealTypes.length > 0
          ? effectiveOrderMealTypes
          : defaultMealTypes;

      const payload: DeliveryAddress = {
        ...formData,
        tag: formData.tag.trim(),
      };
      const savedAddress = await saveAddress(payload, isDefaultAddress, effectiveDefaultMealTypes, editingAddress);

      if (savedAddress) {
        const normalizedSavedTag = payload.tag.trim();
        // Save custom tag if it's new
        if (
          normalizedSavedTag &&
          !['家', '公司'].includes(normalizedSavedTag) &&
          !customTags.map(t => t.trim()).includes(normalizedSavedTag)
        ) {
          const updatedCustomTags = Array.from(new Set([...customTags.map(t => t.trim()), normalizedSavedTag]));
          setCustomTags(updatedCustomTags);
          await setUserStorageItem('addressCustomTags', updatedCustomTags);
        }

        // Reset form
        setFormData({
          name: '',
          phone: '',
          address: '',
          doorNumber: '',
          tag: '',
          gender: 'male',
          longitude: undefined,
          latitude: undefined,
        });
        setPhoneError('');
        setTagError('');
        setIsDefaultAddress(false);
        setDefaultMealTypes('all');
        setShowAddForm(false);
        setEditingAddress(null);

        // 配送计划里的“选择配送地址 +”：
        // 新增保存后直接返回“选择配送地址”弹窗（不进入地址列表中间页）。
        const savedDefaultMealTypes = savedAddress.default_meal_types || [];
        const hasDefaultMealTypes = Array.isArray(savedDefaultMealTypes) && savedDefaultMealTypes.length > 0;
        if (!isManagementMode && !editingAddress && openAddFormDirectly) {
          onComplete(savedAddress.id, {
            hasDefaultMealTypes,
            fromQuickAdd: true,
            label: savedAddress.label || savedAddress.tag || '',
            address: savedAddress.address,
            doorNumber: savedAddress.door_number,
            contactName: savedAddress.contact_name,
            phone: savedAddress.phone,
          });
          return;
        }

        // 管理模式下，保存后检查默认餐次覆盖完整性：
        // 若当前订单餐次存在缺口，明确提示先补地址，否则后续生成计划会被拦截。
        let missingMealTypes: string[] = [];
        if (isManagementMode && user?.id) {
          const latestAddresses = await addressService.fetchUserAddresses(user.id);
          missingMealTypes = getMissingDefaultMealTypes(latestAddresses);
        }

        if (isManagementMode && missingMealTypes.length > 0) {
          setAlertState({
            show: true,
            type: 'warning',
            title: '地址已保存，但餐次未覆盖完整',
            message:
              `当前缺少默认地址的餐次：${missingMealTypes.map(mealTypeToLabel).join('、')}。` +
              '请新增地址并补齐对应餐次；否则生成配送计划时会被拦截。'
          });
        // 管理模式下仅“新增了带默认餐次的新地址”时建议重配。
        // 编辑地址已做未来可修改餐次同步，不应每次都强制打断去重配。
        } else if (isManagementMode && !editingAddress && hasDefaultMealTypes && onOpenDeliveryPlan) {
          setShowRegenerateSuggestModal(true);
        } else {
          const syncMeta = (savedAddress as DBDeliveryAddress & { __syncMeta?: AddressSyncMeta }).__syncMeta;
          const successMessage = editingAddress
            ? (syncMeta
              ? `地址已更新，已同步 ${syncMeta.updatedCount} 个可修改餐次（跳过 ${syncMeta.skippedLockedCount} 个锁定餐次）`
              : '地址已更新')
            : '地址已添加';
          setAlertState({
            show: true,
            type: 'success',
            title: '保存成功',
            message: successMessage
          });
        }
      }
    } catch (error) {
      console.error('Error saving address:', error);
      setAlertState({
        show: true,
        type: 'error',
        title: '保存失败',
        message: '保存地址时发生错误，请重试'
      });
    } finally {
      setIsSaving(false); // 🔥 修复：重置保存状态
    }
  };

  const handleSelectAddress = async (addressId: string) => {
    setSelectedAddressId(addressId);
    // 区分“自动选中”和“用户手动选中”
    setManualSelectedAddressId(addressId);
  };

  const openAddressEditForm = (address: DBDeliveryAddress) => {
    setEditingAddress(address);
    setFormData({
      name: address.contact_name,
      phone: address.phone,
      address: address.address,
      doorNumber: address.door_number,
      tag: String(address.tag || address.label || '').trim(),
      gender: address.gender,
      longitude: address.longitude ?? undefined,
      latitude: address.latitude ?? undefined,
    });
    const dmt = address.default_meal_types;
    const hasDefaultMeals = dmt && Array.isArray(dmt) && dmt.length > 0;
    setIsDefaultAddress(hasDefaultMeals || address.is_default);
    const normalizedDmt = (dmt || []).map(item => normalizeMealType(item)).filter((item): item is string => !!item);
    const filteredByOrderMeals = effectiveOrderMealTypes.length > 0
      ? normalizedDmt.filter(item => effectiveOrderMealTypes.includes(item))
      : normalizedDmt;
    setDefaultMealTypes(
      !dmt || dmt.length === 0 || dmt.includes('all') ? 'all' : (filteredByOrderMeals.length > 0 ? filteredByOrderMeals : 'all')
    );
    setPhoneError('');
    setTagError('');
    setShowAddForm(true);
  };

  const openCreateAddressForm = () => {
    setEditingAddress(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      doorNumber: '',
      tag: '',
      gender: 'male',
      longitude: undefined,
      latitude: undefined,
    });
    setIsDefaultAddress(false);
    setDefaultMealTypes('all');
    setPhoneError('');
    setTagError('');
    setShowAddForm(true);
  };

  const handleCancelAddressForm = () => {
    // 配送计划“选择配送地址 +”场景：取消后直接回选择地址弹窗
    if (!isManagementMode && openAddFormDirectly && !editingAddress) {
      handleClose();
      return;
    }
    setShowAddForm(false);
    setEditingAddress(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      doorNumber: '',
      tag: '',
      gender: 'male',
      longitude: undefined,
      latitude: undefined,
    });
    setIsDefaultAddress(false);
    setDefaultMealTypes('all');
    setPhoneError('');
    setTagError('');
  };

  const handleEditAddress = async (address: DBDeliveryAddress, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const guard = editGuardsByAddressId[address.id] || await addressService.getAddressEditGuard(address.id);

      if (guard.blockedByTodayWindow) {
        const blockedLabel = mealTypeToLabel(guard.blockedMealInfo?.mealType);
        const deliveryStart = guard.blockedMealInfo?.deliveryTimeStart || '—';
        const lockStart = guard.blockedMealInfo?.lockStartTime || '—';
        const now = guard.blockedMealInfo?.currentTime || '—';
        setAlertState({
          show: true,
          type: 'warning',
          title: '当前不可修改',
          message:
            `该地址已用于今日${blockedLabel}配送，且已进入配送前1小时锁定窗口，暂不支持修改。` +
            `\n命中餐次：${blockedLabel}；配送开始：${deliveryStart}；锁定起始：${lockStart}；当前时间：${now}。`,
        });
        return;
      }

      if (guard.inPlan) {
        setPendingEditUsageCount(guard.inPlanCount || 0);
        setPendingEditAddress(address);
        return;
      }
    } catch (error) {
      console.warn('[AddDeliveryAddressPage] 编辑前校验失败，回退为直接编辑:', error);
    }

    openAddressEditForm(address);
  };

  const handleDeleteAddress = async (addressId: string) => {
    const success = await deleteAddress(addressId);
    if (success) {
      resetSwipe(addressId);
      setPendingSwipeResetId(null);
      return;
    }

    // 删除失败（例如“地址在使用中”）时，等用户点弹窗“确定”后再回正
    setPendingSwipeResetId(addressId);
  };

  const handleDeleteAttempt = async (addressId: string) => {
    try {
      const { inUse, upcomingDeliveries } = await addressService.checkAddressInUse(addressId);
      if (inUse) {
        if (swipedAddressId === addressId) {
          resetSwipe(addressId);
        }
        setAlertState({
          show: true,
          type: 'warning',
          title: '无法删除',
          message: `该地址正在配送计划中使用（约 ${upcomingDeliveries.length} 个餐次），当前不可删除。`,
        });
        return;
      }
      setDeleteConfirmId(addressId);
    } catch (error) {
      console.error('[AddDeliveryAddressPage] delete precheck failed:', error);
      setAlertState({
        show: true,
        type: 'error',
        title: '删除校验失败',
        message: '无法确认地址使用状态，请稍后重试',
      });
    }
  };

  const isAddressValid = () => {
    return selectedAddressId !== null;
  };

  const handleComplete = () => {
    if (isAddressValid() && selectedAddressId) {
      // React Query 会自动处理地址数据更新，无需派发事件
      // 直接调用 onComplete，让父组件通过 show prop 控制关闭
      onComplete(selectedAddressId);
    }
  };

  // 判断是否为管理模式（从"我的"进入，showCompleteButton=false）
  const isManagementMode = !showCompleteButton;

  // 每次打开地址页时先刷新，确保与其它入口（聊天/配送计划/我的）数据一致
  useEffect(() => {
    if (!show) return;
    refreshAddresses().catch(console.error);
  }, [show, refreshAddresses]);

  useEffect(() => {
    if (!show || savedAddresses.length === 0) {
      setEditGuardsByAddressId({});
      return;
    }

    let cancelled = false;
    const loadEditGuards = async () => {
      const guardEntries = await Promise.all(
        savedAddresses.map(async (addr) => {
          const guard = await addressService.getAddressEditGuard(addr.id);
          return [addr.id, guard] as const;
        })
      );
      if (cancelled) return;
      setEditGuardsByAddressId(Object.fromEntries(guardEntries));
    };

    loadEditGuards().catch((error) => {
      console.warn('[AddDeliveryAddressPage] Failed to load address edit guards:', error);
      if (!cancelled) setEditGuardsByAddressId({});
    });

    return () => {
      cancelled = true;
    };
  }, [show, savedAddresses]);

  useEffect(() => {
    if (show && !isManagementMode && openAddFormDirectly && !editingAddress) {
      setEditingAddress(null);
      setFormData({
        name: '',
        phone: '',
        address: '',
        doorNumber: '',
        tag: '',
        gender: 'male',
        longitude: undefined,
        latitude: undefined,
      });
      setIsDefaultAddress(false);
      setDefaultMealTypes('all');
      setPhoneError('');
      setTagError('');
      setShowAddForm(true);
    }
  }, [show, isManagementMode, openAddFormDirectly, editingAddress, registeredPhone]);

  useEffect(() => {
    if (!show) return;

    const directMealTypes = normalizeMealTypes(orderMealTypes);
    if (directMealTypes.length > 0) {
      setEffectiveOrderMealTypes(directMealTypes);
      return;
    }

    getMealPlanConfig(user?.id || null)
      .then((config) => {
        const fallbackMealTypes = normalizeMealTypes(config?.selectedMealTypes || []);
        setEffectiveOrderMealTypes(fallbackMealTypes);
      })
      .catch(() => setEffectiveOrderMealTypes([]));
  }, [show, orderMealTypes, user?.id]);

  // 选择模式：用于配送计划场景，使用SecondaryPageHeader
  const headerContent = !isManagementMode ? (
    <SecondaryPageHeader
      title={showAddForm ? (editingAddress ? '编辑地址' : '新增地址') : '收货地址'}
      onClose={showAddForm ? handleCancelAddressForm : handleClose}
      rightAction={
        showAddForm ? undefined : (
          <button
            type="button"
            onClick={openCreateAddressForm}
            className="p-0.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="新增地址"
          >
            <Plus className="w-6 h-6" />
          </button>
        )
      }
    />
  ) : undefined;

  const footerContent = showCompleteButton && !showAddForm && savedAddresses.length > 0 ? (
    <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
      <button
        onClick={handleComplete}
        disabled={!isAddressValid()}
        className={`
          w-full py-3 rounded-xl font-medium text-base transition-all
          ${isAddressValid()
            ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-600'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        下一步
      </button>
    </div>
  ) : undefined;

  // 渲染主内容区域（不包括外层容器）
  const renderMainContent = () => (
    <>
      {loading ? (
        <LoadingState />
      ) : (
        <>
          {savedAddresses.length === 0 && !showAddForm && (
            <div className="py-12">
              <EmptyState 
                icon={<MapPin className="w-12 h-12 text-gray-400" />}
                title="还没有配送地址"
                description="添加您的第一个配送地址，让健康餐准时送达"
              />
            </div>
          )}

          {savedAddresses.length > 0 && !showAddForm && (
            <AddressList
              addresses={savedAddresses}
              selectedAddressId={selectedAddressId}
              manualSelectedAddressId={manualSelectedAddressId}
              swipedAddressId={swipedAddressId}
              lockedAddressIds={new Set(
                Object.entries(editGuardsByAddressId)
                  .filter(([, guard]) => guard.blockedByTodayWindow)
                  .map(([addressId]) => addressId)
              )}
              isManagementMode={isManagementMode}
              onAddressClick={(address, _e) => {
                if (swipedAddressId === address.id) {
                  resetSwipe(address.id);
                } else if (!swipedAddressId) {
                  if (isManagementMode) {
                    // 管理模式：点击卡片本身不触发编辑，仅铅笔按钮可编辑
                    return;
                  } else {
                    handleSelectAddress(address.id);
                  }
                }
              }}
              onEditClick={handleEditAddress}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDeleteClick={handleDeleteAttempt}
            />
          )}

              {showAddForm && (
                <AddressForm
                  formData={formData}
                  isDefaultAddress={isDefaultAddress}
                  defaultMealTypes={defaultMealTypes}
                  orderMealTypes={effectiveOrderMealTypes}
                  showCustomTagInput={showCustomTagInput}
                  customTagInput={customTagInput}
                  customTags={customTags}
                  savedAddresses={savedAddresses}
                  editingAddress={editingAddress}
                  onInputChange={handleInputChange}
                  preferredContactName={(profile?.nickname || '').trim()}
                  registeredPhone={registeredPhone}
                  phoneError={phoneError}
                  tagError={tagError}
                  onUseRegisteredPhone={() => {
                    if (!registeredPhone) {
                      setAlertState({
                        show: true,
                        type: 'info',
                        title: '暂无注册手机号',
                        message: '当前账号未绑定手机号，请手动填写。'
                      });
                      return;
                    }
                    setFormData(prev => ({ ...prev, phone: registeredPhone }));
                    setPhoneError('');
                  }}
                  onMapLocationPick={handleMapLocationPick}
                  onDefaultChange={setIsDefaultAddress}
                  onDefaultMealTypesChange={setDefaultMealTypes}
                  onCustomTagInputChange={setCustomTagInput}
                  onShowCustomTagInput={setShowCustomTagInput}
                  onAddCustomTag={(tag) => {
                    const normalizedTag = tag.trim();
                    const updatedCustomTags = Array.from(new Set([...customTags, normalizedTag]));
                    setCustomTags(updatedCustomTags);
                    handleInputChange('tag', normalizedTag);
                    setTagError('');
                    setCustomTagInput('');
                    setShowCustomTagInput(false);
                  }}
                  onRemoveCustomTag={(tag) => {
                    if (isTagInUse(tag)) {
                      setAlertState({
                        show: true,
                        type: 'warning',
                        title: '无法删除标签',
                        message: '该标签正在地址中使用，不能删除。'
                      });
                      return;
                    }
                    setCustomTags(customTags.filter(t => t !== tag));
                    if (formData.tag === tag) {
                      handleInputChange('tag', '');
                    }
                  }}
                  onSave={handleSaveAddress}
                  isSaving={isSaving} // 🔥 修复：传递保存状态
                  onCancel={handleCancelAddressForm}
                  displayMode="page"
                  isFormValid={isFormValid}
                />
              )}
        </>
      )}
    </>
  );

  // 管理模式：使用 DrawerScreen（与其他"我的"二级页面一致）
  if (isManagementMode) {
    return (
      <DrawerScreen show={show} onClose={handleClose} showDragHandle={false} showMask={false}>
        <div className="flex flex-col h-full bg-gray-50">
          <SecondaryPageHeader 
            title={showAddForm ? (editingAddress ? '编辑地址' : '新增地址') : '收货地址'} 
            onClose={showAddForm ? handleCancelAddressForm : handleClose}
            rightAction={
              !showAddForm ? (
                <button
                  type="button"
                  onClick={openCreateAddressForm}
                  className="p-0.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="新增地址"
                >
                  <Plus className="w-6 h-6" />
                </button>
              ) : undefined
            }
          />
          
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {renderMainContent()}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteConfirmId}
        title="确定要删除这个地址吗？"
        message="删除后将无法恢复，请谨慎操作。"
        onCancel={() => {
          // 恢复卡片到原位
          if (deleteConfirmId && swipedAddressId === deleteConfirmId) {
            const cardElement = document.getElementById(`address-card-${deleteConfirmId}`);
            if (cardElement) {
              cardElement.style.transform = 'translateX(0)';
              cardElement.style.transition = 'transform 0.3s ease';
            }
            setSwipedAddressId(null);
          }
          setDeleteConfirmId(null);
        }}
        onConfirm={async () => {
          if (deleteConfirmId) {
            await handleDeleteAddress(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        confirmText="确定删除"
        zIndex={80}
      />

      {/* 更新默认地址后，建议重新生成配送计划 */}
      <ConfirmModal
        show={showRegenerateSuggestModal}
        title="地址已更新"
        message="您已更新默认配送地址，建议前往「我的配送计划」重新生成配送计划，以确保新地址生效。"
        cancelText="稍后"
        confirmText="前往配送计划"
        confirmColor="blue"
        onCancel={() => setShowRegenerateSuggestModal(false)}
        onConfirm={() => {
          setShowRegenerateSuggestModal(false);
          onClose();
          onOpenDeliveryPlan?.();
        }}
        zIndex={80}
      />

      {/* 地址编辑前确认：该地址已在配送计划中使用 */}
      <ConfirmModal
        show={!!pendingEditAddress}
        title="地址正在配送计划中使用"
        message={`高风险提醒：该地址已在配送计划中被引用（约 ${pendingEditUsageCount} 个餐次）。继续修改后，将同步影响“未来且可修改”的已排期餐次（已过期/锁定窗口内餐次不会变更）。确定继续吗？`}
        cancelText="取消"
        confirmText="继续修改"
        confirmColor="blue"
        onCancel={() => {
          setPendingEditAddress(null);
          setPendingEditUsageCount(0);
        }}
        onConfirm={() => {
          if (pendingEditAddress) {
            openAddressEditForm(pendingEditAddress);
          }
          setPendingEditAddress(null);
          setPendingEditUsageCount(0);
        }}
        zIndex={80}
      />

      {/* Alert Dialog */}
      <AlertDialog
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => {
          if (pendingSwipeResetId) {
            resetSwipe(pendingSwipeResetId);
            setPendingSwipeResetId(null);
          }
          setAlertState(prev => ({ ...prev, show: false }));
        }}
        zIndex={70}
      />

      </DrawerScreen>
    );
  }

  // 选择模式：使用 DrawerScreen（配送计划场景）
  return (
    <DrawerScreen show={show} onClose={handleClose} showDragHandle={false}>
      <div className={`flex flex-col h-full bg-gray-50 ${showAddForm ? 'overflow-hidden' : ''}`}>
        {/* Header */}
        {headerContent}
        
        {/* Main Content */}
        <div className={`flex-1 overflow-y-auto px-4 py-3 ${showAddForm ? 'overflow-hidden' : ''}`}>
          {renderMainContent()}
        </div>

        {/* Footer */}
        {footerContent}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          show={!!deleteConfirmId}
          title="确定要删除这个地址吗？"
          message="删除后将无法恢复，请谨慎操作。"
          onCancel={() => {
            // 恢复卡片到原位
            if (deleteConfirmId && swipedAddressId === deleteConfirmId) {
              const cardElement = document.getElementById(`address-card-${deleteConfirmId}`);
              if (cardElement) {
                cardElement.style.transform = 'translateX(0)';
                cardElement.style.transition = 'transform 0.3s ease';
              }
              setSwipedAddressId(null);
            }
            setDeleteConfirmId(null);
          }}
          onConfirm={async () => {
            if (deleteConfirmId) {
              await handleDeleteAddress(deleteConfirmId);
              setDeleteConfirmId(null);
            }
          }}
          confirmText="确定删除"
          zIndex={80}
        />

        {/* Alert Dialog */}
        <AlertDialog
          show={alertState.show}
          type={alertState.type}
          title={alertState.title}
          message={alertState.message}
          onClose={() => {
            if (pendingSwipeResetId) {
              resetSwipe(pendingSwipeResetId);
              setPendingSwipeResetId(null);
            }
            setAlertState(prev => ({ ...prev, show: false }));
          }}
          zIndex={70}
        />

        {/* 地址编辑前确认：该地址已在配送计划中使用 */}
        <ConfirmModal
          show={!!pendingEditAddress}
          title="地址正在配送计划中使用"
          message={`高风险提醒：该地址已在配送计划中被引用（约 ${pendingEditUsageCount} 个餐次）。继续修改后，将同步影响“未来且可修改”的已排期餐次（已过期/锁定窗口内餐次不会变更）。确定继续吗？`}
          cancelText="取消"
          confirmText="继续修改"
          confirmColor="blue"
          onCancel={() => {
            setPendingEditAddress(null);
            setPendingEditUsageCount(0);
          }}
          onConfirm={() => {
            if (pendingEditAddress) {
              openAddressEditForm(pendingEditAddress);
            }
            setPendingEditAddress(null);
            setPendingEditUsageCount(0);
          }}
          zIndex={80}
        />

      </div>
    </DrawerScreen>
  );
};

export default AddDeliveryAddressPage;
