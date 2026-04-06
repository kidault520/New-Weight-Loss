/**
 * AddressForm - 地址表单组件
 * 从AddDeliveryAddressPage.tsx中提取的地址表单
 * 符合架构规范：单一职责，代码复用
 */
import React, { useMemo, useState } from 'react';
import { Plus, Check, X, ChevronDown } from 'lucide-react';
import { DeliveryAddress as DBDeliveryAddress } from '../../services/addressService';
import { AmapAddressMapEmbed, MapPickResult } from '../map/AmapAddressMapEmbed';

export interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  doorNumber: string;
  tag: string;
  gender: 'male' | 'female';
  /** 地图选点经度 */
  longitude?: number | null;
  /** 地图选点纬度 */
  latitude?: number | null;
}

/** 订单中可能的餐次，用于默认地址的餐次选择 */
export const MEAL_TYPE_OPTIONS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
] as const;

interface AddressFormProps {
  formData: DeliveryAddress;
  isDefaultAddress: boolean;
  /** 默认应用于的餐次：'all' | ['lunch','dinner'] 等 */
  defaultMealTypes: 'all' | string[];
  showCustomTagInput: boolean;
  customTagInput: string;
  customTags: string[];
  savedAddresses: DBDeliveryAddress[];
  editingAddress: DBDeliveryAddress | null;
  /** 订单中实际包含的餐次，用于限制可选范围；不传则显示全部 */
  orderMealTypes?: string[];
  onInputChange: (field: keyof DeliveryAddress, value: string | 'male' | 'female') => void;
  onDefaultChange: (isDefault: boolean) => void;
  onDefaultMealTypesChange: (value: 'all' | string[]) => void;
  onCustomTagInputChange: (value: string) => void;
  onShowCustomTagInput: (show: boolean) => void;
  onAddCustomTag: (tag: string) => void;
  onRemoveCustomTag: (tag: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isFormValid: () => boolean;
  isSaving?: boolean; // 🔥 修复：添加保存状态
  registeredPhone?: string;
  preferredContactName?: string;
  phoneError?: string;
  tagError?: string;
  onUseRegisteredPhone?: () => void;
  /** 已废弃：改用 onMapLocationPick 内嵌地图 */
  onOpenMapPicker?: () => void;
  /** 地图选点结果回填（内嵌地图，非全屏） */
  onMapLocationPick?: (result: MapPickResult) => void;
  displayMode?: 'modal' | 'page';
}

export const AddressForm: React.FC<AddressFormProps> = ({
  formData,
  isDefaultAddress,
  defaultMealTypes,
  showCustomTagInput,
  customTagInput,
  customTags,
  savedAddresses,
  editingAddress,
  orderMealTypes,
  onInputChange,
  onDefaultChange,
  onDefaultMealTypesChange,
  onCustomTagInputChange,
  onShowCustomTagInput,
  onAddCustomTag,
  onRemoveCustomTag,
  onSave,
  onCancel,
  isFormValid,
  isSaving = false, // 🔥 修复：添加保存状态，默认 false
  registeredPhone,
  preferredContactName,
  phoneError,
  tagError,
  onUseRegisteredPhone,
  onOpenMapPicker,
  onMapLocationPick,
  displayMode = 'modal',
}) => {
  const normalizeTag = (value: string) => value.trim();
  const currentTag = normalizeTag(formData.tag || '');
  const normalizedOrderMealTypes = (orderMealTypes || []).map(t => String(t).toLowerCase());
  const mealOptions = normalizedOrderMealTypes.length
    ? MEAL_TYPE_OPTIONS.filter(o => normalizedOrderMealTypes.includes(o.key))
    : MEAL_TYPE_OPTIONS;
  const effectiveMealKeys = mealOptions.map(o => o.key);
  const isAll = defaultMealTypes === 'all';
  const selectedMeals = defaultMealTypes === 'all' ? [] : defaultMealTypes;
  const isPageMode = displayMode === 'page';

  // 餐次排他性：选了第1个地址的餐次，第2个就不能再选；若第1个选了全部，第2个无可选
  const takenMealTypes = new Set<string>();
  savedAddresses.forEach((addr) => {
    if (addr.id === editingAddress?.id) return;
    const dmt = addr.default_meal_types;
    if (!dmt || !Array.isArray(dmt)) {
      if (addr.is_default) effectiveMealKeys.forEach((key) => takenMealTypes.add(key));
      return;
    }
    if (dmt.includes('all')) {
      effectiveMealKeys.forEach((key) => takenMealTypes.add(key));
    } else {
      dmt.forEach((m) => {
        if (effectiveMealKeys.some((key) => key === m)) takenMealTypes.add(m);
      });
    }
  });
  const isAllTaken = effectiveMealKeys.length > 0 && effectiveMealKeys.every((key) => takenMealTypes.has(key));
  const isAllOptionDisabled = takenMealTypes.size > 0;
  const [showPhonePicker, setShowPhonePicker] = useState(false);
  const [showNamePicker, setShowNamePicker] = useState(false);
  const isTagUsedByAnyAddress = (tag: string) => {
    const target = normalizeTag(tag);
    if (!target) return false;
    return savedAddresses.some(addr => normalizeTag(String(addr.tag || addr.label || '')) === target);
  };
  const displayCustomTags = useMemo(() => {
    const set = new Set(customTags.map((tag) => normalizeTag(tag)).filter(Boolean));
    if (currentTag && !['家', '公司'].includes(currentTag)) {
      set.add(currentTag);
    }
    return Array.from(set);
  }, [customTags, currentTag]);
  const phoneCandidates = useMemo(() => {
    const values = [
      registeredPhone || '',
      ...savedAddresses.map((addr) => String(addr.phone || '')),
    ]
      .map((v) => v.replace(/\D/g, '').slice(0, 11))
      .filter((v) => v.length === 11);
    return Array.from(new Set(values));
  }, [registeredPhone, savedAddresses]);
  const contactCandidates = useMemo(() => {
    const values = [
      preferredContactName || '',
      ...savedAddresses.map((addr) => String(addr.contact_name || '')),
    ]
      .map((v) => v.trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [preferredContactName, savedAddresses]);

  if (isPageMode) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
          {onMapLocationPick ? (
            <AmapAddressMapEmbed
              longitude={formData.longitude}
              latitude={formData.latitude}
              onPick={onMapLocationPick}
            />
          ) : (
            <button
              type="button"
              onClick={() => onOpenMapPicker?.()}
              className="w-full h-56 relative bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 text-left"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm border border-gray-200">
                  地图未配置
                </div>
              </div>
            </button>
          )}

          <div className="px-3 pb-3 -mt-4 relative z-10">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
              <div className="border-b border-gray-100 py-2.5">
                <div className="text-xs text-gray-500 mb-0.5">地址</div>
                <textarea
                  rows={2}
                  placeholder="输入收货地址或在上方地图选点"
                  value={formData.address}
                  onChange={(e) => onInputChange('address', e.target.value)}
                  className="w-full min-h-[2.75rem] max-h-28 overflow-y-auto resize-none text-sm sm:text-base font-semibold text-gray-900 placeholder:text-sm placeholder:font-medium placeholder:text-gray-300 focus:outline-none leading-snug break-words"
                />
              </div>

              <div className="border-b border-gray-100 py-2.5 flex items-center gap-3">
                <div className="text-base text-gray-800 w-16 shrink-0">门牌号</div>
                <input
                  type="text"
                  placeholder="输入详细地址，例1单元101"
                  value={formData.doorNumber}
                  onChange={(e) => onInputChange('doorNumber', e.target.value)}
                  className="flex-1 text-base text-gray-800 placeholder:text-sm placeholder:font-normal placeholder:text-gray-300 focus:outline-none"
                />
              </div>

              <div className="border-b border-gray-100 py-2.5 flex items-center gap-3 relative">
                <div className="text-base text-gray-800 w-16 shrink-0">联系人</div>
                <input
                  type="text"
                  placeholder="输入收货人姓名"
                  value={formData.name}
                  onChange={(e) => onInputChange('name', e.target.value)}
                  className="flex-1 text-base text-gray-800 placeholder:text-sm placeholder:font-normal placeholder:text-gray-300 focus:outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={() => setShowNamePicker(prev => !prev)}
                  disabled={contactCandidates.length === 0}
                  className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center disabled:text-gray-300 disabled:cursor-not-allowed"
                  aria-label="选择联系人"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showNamePicker && contactCandidates.length > 0 && (
                  <div className="absolute right-28 top-10 z-40 bg-black/80 rounded-xl px-2 py-2 min-w-[140px] max-w-[60vw] shadow-lg">
                    {contactCandidates.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          onInputChange('name', name);
                          setShowNamePicker(false);
                        }}
                        className="block w-full text-left px-2 py-1 text-white text-sm hover:bg-white/10 rounded truncate"
                        title={name}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => onInputChange('gender', 'male')}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.gender === 'male' ? 'border-yellow-400' : 'border-gray-300'}`}>
                      {formData.gender === 'male' && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
                    </span>
                    <span className="text-gray-700">先生</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInputChange('gender', 'female')}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.gender === 'female' ? 'border-yellow-400' : 'border-gray-300'}`}>
                      {formData.gender === 'female' && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
                    </span>
                    <span className="text-gray-700">女士</span>
                  </button>
                </div>
              </div>

              <div className="border-b border-gray-100 py-2.5">
                <div className="flex items-center gap-3 relative">
                  <div className="text-base text-gray-800 w-16 shrink-0">手机号</div>
                  <div className="text-base text-gray-800 shrink-0">+86</div>
                  <input
                    type="tel"
                    placeholder="输入收货人手机号"
                    value={formData.phone}
                    onChange={(e) => onInputChange('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
                    maxLength={11}
                    inputMode="numeric"
                    className="flex-1 min-w-0 pr-7 text-base text-gray-800 placeholder:text-sm placeholder:font-normal placeholder:text-gray-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPhonePicker(prev => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-10 text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center bg-transparent border-0 p-0"
                    aria-label="选择手机号"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showPhonePicker && phoneCandidates.length > 0 && (
                    <div className="absolute right-0 top-10 z-40 bg-black/80 rounded-xl px-2 py-2 min-w-[140px] shadow-lg">
                      {phoneCandidates.map((phone) => (
                        <button
                          key={phone}
                          type="button"
                          onClick={() => {
                            onInputChange('phone', phone);
                            setShowPhonePicker(false);
                          }}
                          className="block w-full text-left px-2 py-1 text-white text-sm hover:bg-white/10 rounded"
                        >
                          {phone}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {phoneError && (
                  <div className="text-xs font-normal text-orange-500 mt-1 pl-[76px]">{phoneError}</div>
                )}
              </div>

              <div className="pt-2.5">
                <div className="flex items-start gap-3">
                  <div className="text-base text-gray-800 w-16 shrink-0 pt-1">标签</div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {['家', '公司'].map((tag) => {
                      const normalizedTag = normalizeTag(tag);
                      const isCurrentTag = currentTag === normalizedTag;
                      const isUsed = isTagUsedByAnyAddress(tag);
                      const isDisabled = !isCurrentTag && isUsed;
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            if (!isDisabled) onInputChange('tag', isCurrentTag ? '' : tag);
                          }}
                          disabled={isDisabled}
                          className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                            isCurrentTag
                              ? 'bg-yellow-400 text-white'
                              : isDisabled
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                    {displayCustomTags.map((tag) => {
                      const normalizedTag = normalizeTag(tag);
                      const isCurrentTag = currentTag === normalizedTag;
                      const isUsed = isTagUsedByAnyAddress(tag);
                      const isDisabled = !isCurrentTag && isUsed;
                      return (
                        <div key={tag} className="relative group">
                          <button
                            onClick={() => {
                              if (!isDisabled) onInputChange('tag', isCurrentTag ? '' : tag);
                            }}
                            disabled={isDisabled}
                            className={`px-2.5 py-1 pr-5 rounded-md text-xs transition-colors ${
                              isCurrentTag
                                ? 'bg-yellow-400 text-white'
                                : isDisabled
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {tag}
                          </button>
                          {!isUsed && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveCustomTag(tag);
                                if (isCurrentTag) onInputChange('tag', '');
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`删除标签${tag}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {!showCustomTagInput && (
                      <button
                        onClick={() => onShowCustomTagInput(true)}
                        className="px-2.5 py-1 rounded-md text-xs bg-green-100 text-green-600 hover:bg-green-200 transition-colors inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        新增
                      </button>
                    )}
                  </div>
                </div>
                {showCustomTagInput && (
                  <div className="flex items-center gap-1.5 mt-2 pl-[76px]">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={(e) => onCustomTagInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const trimmedTag = customTagInput.trim();
                          if (trimmedTag && !['家', '公司', ...customTags].includes(trimmedTag)) {
                            onAddCustomTag(trimmedTag);
                          }
                        } else if (e.key === 'Escape') {
                          onCustomTagInputChange('');
                          onShowCustomTagInput(false);
                        }
                      }}
                      placeholder="请输入自定义标签"
                      className="w-36 max-w-[45vw] px-2.5 py-1 border border-gray-300 rounded-md text-sm placeholder:text-xs placeholder:text-gray-300 focus:outline-none focus:border-yellow-400"
                      maxLength={10}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const trimmedTag = customTagInput.trim();
                        if (trimmedTag && !['家', '公司', ...customTags].includes(trimmedTag)) {
                          onAddCustomTag(trimmedTag);
                        }
                      }}
                      disabled={!customTagInput.trim()}
                      className="w-7 h-7 rounded-md text-xs font-semibold bg-yellow-400 text-white hover:bg-yellow-500 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex items-center justify-center"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </button>
                    <button
                      onClick={() => {
                        onCustomTagInputChange('');
                        onShowCustomTagInput(false);
                      }}
                      type="button"
                      className="w-7 h-7 rounded-md text-xs font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                )}
                {tagError && (
                  <div className="text-xs font-normal text-orange-500 mt-1 pl-[76px]">{tagError}</div>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100">
                <div className="text-gray-700 text-sm mb-2">设为默认配送地址（全部/餐次）</div>
                <div className="flex flex-wrap gap-2">
                  {mealOptions.length > 0 && (
                    <button
                      onClick={() => {
                        if (isAllOptionDisabled) return;
                        if (isDefaultAddress && isAll) {
                          onDefaultChange(false);
                          onDefaultMealTypesChange('all');
                          return;
                        }
                        onDefaultChange(true);
                        onDefaultMealTypesChange('all');
                      }}
                      disabled={isAllOptionDisabled}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isAllOptionDisabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                        (isDefaultAddress && isAll) ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      全部
                    </button>
                  )}
                  {mealOptions.map(({ key, label }) => {
                    const isTaken = takenMealTypes.has(key);
                    const isSelected = isDefaultAddress && (isAll || selectedMeals.includes(key));
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          if (isTaken) return;
                          if (!isDefaultAddress) {
                            onDefaultChange(true);
                            onDefaultMealTypesChange([key]);
                            return;
                          }
                          if (isAll) {
                            onDefaultMealTypesChange([key]);
                            return;
                          }
                          const next = selectedMeals.includes(key)
                            ? selectedMeals.filter(m => m !== key)
                            : [...selectedMeals, key];
                          if (next.length === 0) {
                            onDefaultChange(false);
                            onDefaultMealTypesChange('all');
                            return;
                          }
                          onDefaultMealTypesChange(next);
                        }}
                        disabled={isTaken}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          isTaken ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                          isSelected ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5 flex items-center justify-between">
              <span className="text-gray-300 text-base">粘贴文本，智能识别地址信息</span>
              <button type="button" className="text-gray-700 font-medium text-sm">粘贴</button>
            </div>

            <button
              onClick={onSave}
              disabled={!isFormValid() || isSaving}
              className={`w-full mt-3 py-3 rounded-full font-medium text-lg transition-all ${
                isFormValid() && !isSaving
                  ? 'bg-yellow-400 text-white hover:bg-yellow-500'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? '保存中...' : (editingAddress ? '更新地址' : '保存地址')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[75] px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="px-4 py-3">
          {onMapLocationPick && (
            <div className="mb-3 -mt-1 rounded-xl overflow-hidden border border-gray-100">
              <AmapAddressMapEmbed
                longitude={formData.longitude}
                latitude={formData.latitude}
                onPick={onMapLocationPick}
                mapHeightClass="h-40"
              />
            </div>
          )}
          <div className="mb-3">
            <div className="text-gray-700 text-sm mb-1">收货地址</div>
            <textarea
              rows={2}
              placeholder="请输入收货地址或在上方地图选点"
              value={formData.address}
              onChange={(e) => onInputChange('address', e.target.value)}
              className="w-full min-h-[2.75rem] max-h-28 overflow-y-auto resize-none px-0 py-2 border-b-2 border-gray-200 text-sm sm:text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors leading-snug break-words"
            />
          </div>

          <div className="mb-3">
            <div className="flex items-center space-x-2 border-b-2 border-gray-200 focus-within:border-yellow-400 transition-colors">
              <span className="text-gray-800 text-base font-medium whitespace-nowrap">门牌号</span>
              <input
                type="text"
                placeholder="详细地址，例1层B101室1"
                value={formData.doorNumber}
                onChange={(e) => onInputChange('doorNumber', e.target.value)}
                className="flex-1 px-2 py-2.5 text-base text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center space-x-2 border-b-2 border-gray-200 focus-within:border-yellow-400 transition-colors relative">
              <span className="text-gray-800 text-base font-medium whitespace-nowrap">联系人</span>
              <input
                type="text"
                placeholder="姓名"
                value={formData.name}
                onChange={(e) => onInputChange('name', e.target.value)}
                className="flex-1 px-2 py-2.5 text-base text-gray-800 placeholder-gray-400 focus:outline-none min-w-0"
              />
              <button
                type="button"
                onClick={() => setShowNamePicker(prev => !prev)}
                disabled={contactCandidates.length === 0}
                className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center disabled:text-gray-300 disabled:cursor-not-allowed"
                aria-label="选择联系人"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              {showNamePicker && contactCandidates.length > 0 && (
                <div className="absolute left-16 right-20 top-11 z-40 bg-black/80 rounded-xl px-2 py-2 shadow-lg">
                  {contactCandidates.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onInputChange('name', name);
                        setShowNamePicker(false);
                      }}
                      className="block w-full text-left px-2 py-1 text-white text-sm hover:bg-white/10 rounded truncate"
                      title={name}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={() => onInputChange('gender', 'male')}
                  className="flex flex-row items-center space-x-1"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    formData.gender === 'male' ? 'border-yellow-400' : 'border-gray-300'
                  }`}>
                    {formData.gender === 'male' && (
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 whitespace-nowrap">先生</span>
                </button>
                <button
                  onClick={() => onInputChange('gender', 'female')}
                  className="flex flex-row items-center space-x-1"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    formData.gender === 'female' ? 'border-yellow-400' : 'border-gray-300'
                  }`}>
                    {formData.gender === 'female' && (
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 whitespace-nowrap">女士</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="text-gray-800 text-base font-medium">手机号</div>
              {!!registeredPhone && formData.phone !== registeredPhone && (
                <button
                  onClick={() => onUseRegisteredPhone?.()}
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  使用注册手机号
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2 border-b-2 border-gray-200 focus-within:border-yellow-400 transition-colors">
              <input
                type="tel"
                placeholder="请填写收货手机号码"
                value={formData.phone}
                onChange={(e) => onInputChange('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
                maxLength={11}
                inputMode="numeric"
                className="flex-1 px-2 py-2.5 text-base text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>
            {phoneError ? (
              <div className="text-xs text-red-500 mt-1">{phoneError}</div>
            ) : (
              <div className="text-xs text-gray-400 mt-1">仅支持中国大陆 11 位手机号</div>
            )}
          </div>

          <div className="mb-3">
            <div className="border-b-2 border-gray-200 pb-2">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-gray-800 text-base font-medium whitespace-nowrap">标签</span>
                <div className="flex flex-wrap gap-2">
                    {['家', '公司'].map((tag) => {
                    const normalizedTag = normalizeTag(tag);
                    const isCurrentTag = currentTag === normalizedTag;
                    const isUsed = isTagUsedByAnyAddress(tag);
                    const isDisabled = !isCurrentTag && isUsed;

                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          if (!isDisabled) {
                            onInputChange('tag', isCurrentTag ? '' : tag);
                          }
                        }}
                        disabled={isDisabled}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          isCurrentTag
                            ? 'bg-yellow-400 text-white'
                            : isDisabled
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  {displayCustomTags.map((tag) => {
                    const normalizedTag = normalizeTag(tag);
                    const isCurrentTag = currentTag === normalizedTag;
                    const isUsed = isTagUsedByAnyAddress(tag);
                    const isDisabled = !isCurrentTag && isUsed;

                    return (
                      <div key={tag} className="relative group">
                        <button
                          onClick={() => {
                            if (!isDisabled) {
                              onInputChange('tag', isCurrentTag ? '' : tag);
                            }
                          }}
                          disabled={isDisabled}
                          className={`px-4 py-1.5 pr-8 rounded-md text-sm font-medium transition-colors ${
                            isCurrentTag
                              ? 'bg-yellow-400 text-white'
                              : isDisabled
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {tag}
                        </button>
                        <button
                          onClick={(e) => {
                            if (!isUsed) {
                              e.stopPropagation();
                              onRemoveCustomTag(tag);
                              if (isCurrentTag) {
                                onInputChange('tag', '');
                              }
                            }
                          }}
                          disabled={isUsed}
                          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center transition-colors text-xs ${
                            isUsed
                              ? 'bg-gray-400 cursor-not-allowed opacity-50'
                              : 'bg-red-500 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  {!showCustomTagInput && (
                    <button
                      onClick={() => onShowCustomTagInput(true)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-600 hover:bg-green-200 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      新增
                    </button>
                  )}
                </div>
              </div>
              {showCustomTagInput && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => onCustomTagInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmedTag = customTagInput.trim();
                        if (trimmedTag && !['家', '公司', ...customTags].includes(trimmedTag)) {
                          onAddCustomTag(trimmedTag);
                        }
                      } else if (e.key === 'Escape') {
                        onCustomTagInputChange('');
                        onShowCustomTagInput(false);
                      }
                    }}
                    placeholder="请输入自定义标签"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-yellow-400"
                    maxLength={10}
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      const trimmedTag = customTagInput.trim();
                      if (trimmedTag && !['家', '公司', ...customTags].includes(trimmedTag)) {
                        onAddCustomTag(trimmedTag);
                      }
                    }}
                    disabled={!customTagInput.trim()}
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-yellow-400 text-white hover:bg-yellow-500 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
                  >
                    确定
                  </button>
                  <button
                    onClick={() => {
                      onCustomTagInputChange('');
                      onShowCustomTagInput(false);
                    }}
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}
              {tagError && (
                <div className="text-xs text-orange-500 mt-1">{tagError}</div>
              )}
            </div>
          </div>

          {/* Default Address Checkbox */}
          <div className="mb-2">
            <button
              onClick={() => onDefaultChange(!isDefaultAddress)}
              className="flex items-center space-x-2 py-1"
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                isDefaultAddress ? 'border-yellow-400 bg-yellow-400' : 'border-gray-300'
              }`}>
                {isDefaultAddress && (
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                )}
              </div>
              <span className="text-gray-700 text-sm">设为默认地址</span>
            </button>
          </div>

          {/* 默认地址的餐次选择：仅当设为默认地址时显示 */}
          {isDefaultAddress && (
            <div className="mb-3 pl-7">
              <div className="text-gray-600 text-xs mb-1.5">应用于配送计划的餐次</div>
              <div className="flex flex-wrap gap-2">
                {mealOptions.length > 0 && (
                  <button
                    onClick={() => !isAllTaken && onDefaultMealTypesChange('all')}
                    disabled={isAllTaken}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isAllTaken ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                      isAll ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    全部
                  </button>
                )}
                {mealOptions.map(({ key, label }) => {
                  const isSelected = isAll || selectedMeals.includes(key);
                  const isTaken = takenMealTypes.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (isTaken) return;
                        if (isAll) {
                          onDefaultMealTypesChange([key]);
                        } else {
                          const next = selectedMeals.includes(key)
                            ? selectedMeals.filter(m => m !== key)
                            : [...selectedMeals, key];
                          onDefaultMealTypesChange(next.length ? next : 'all');
                        }
                      }}
                      disabled={isTaken}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isTaken ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                        isSelected ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {mealOptions.length === 0 ? '当前订单暂无可配置餐次' :
                 isAllTaken ? '所有餐次已被其他地址占用' :
                 isAll ? '配送计划中当前订单餐次均使用此地址' : `仅${selectedMeals.map(k => mealOptions.find(o => o.key === k)?.label).filter(Boolean).join('、')}使用此地址`}
              </p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl font-medium text-base bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all mt-2"
            >
              取消
            </button>
            <button
              onClick={onSave}
              disabled={!isFormValid() || isSaving} // 🔥 修复：保存时禁用按钮
              className={`
                flex-1 py-2.5 rounded-xl font-medium text-base transition-all mt-2
                ${isFormValid() && !isSaving
                  ? 'bg-yellow-400 text-white hover:bg-yellow-500'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isSaving ? '保存中...' : (editingAddress ? '更新地址' : '保存地址')} {/* 🔥 修复：显示加载状态 */}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};













