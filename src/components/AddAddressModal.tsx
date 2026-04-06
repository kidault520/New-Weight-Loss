import React, { useState, useEffect } from 'react';
import { X, Check, Plus } from 'lucide-react';
import { addressService, DeliveryAddress } from '../services/addressService';
import { CenterModal } from './common/CenterModal';
import { AlertDialog } from './common/AlertDialog';

interface AddAddressModalProps {
  onClose: () => void;
  onSave: (address: DeliveryAddress) => void;
  editingAddress?: DeliveryAddress | null;
  userId: string | null;
  existingAddresses?: DeliveryAddress[]; // 添加现有地址列表属性
}

export interface FormData {
  name: string;
  phone: string;
  address: string;
  doorNumber: string;
  tag: string;
  gender: 'male' | 'female';
}

const AddAddressModal: React.FC<AddAddressModalProps> = ({
  onClose,
  onSave,
  editingAddress,
  userId,
  existingAddresses = [] // 设置默认值为空数组
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: editingAddress?.contact_name || '',
    phone: editingAddress?.phone || '',
    address: editingAddress?.address || '',
    doorNumber: editingAddress?.door_number || '',
    tag: editingAddress?.tag || '',
    gender: editingAddress?.gender || 'male'
  });
  const [isDefault, setIsDefault] = useState(editingAddress?.is_default || false);
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('warning');
  
  // Handle click outside to close custom tag input
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if the click is outside the custom tag input area
      if (showCustomTagInput && 
          !target.closest('.relative') && 
          !target.closest('button') &&
          !target.closest('input')) {
        setShowCustomTagInput(false);
        setCustomTagInput('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomTagInput]);

  // Load custom tags from localStorage on component mount (用户隔离)
  useEffect(() => {
    const loadCustomTags = async () => {
      try {
        const { getUserStorageItem } = await import('../utils/userStorage');
        const saved = await getUserStorageItem<string[]>('addressCustomTags');
        if (saved) {
          setCustomTags(saved);
        }
      } catch (error) {
        console.warn('Failed to load addressCustomTags from localStorage:', error);
      }
    };
    loadCustomTags();
  }, []);

  // Save custom tags to localStorage whenever they change (用户隔离)
  useEffect(() => {
    if (customTags.length > 0) {
      import('../utils/userStorage').then(({ setUserStorageItem }) => {
        setUserStorageItem('addressCustomTags', customTags).catch(error => {
          console.error('Failed to save addressCustomTags to localStorage:', error);
        });
      });
    }
  }, [customTags]);

  const handleInputChange = (field: keyof FormData, value: string | 'male' | 'female') => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 处理标签选择
  const handleTagSelect = (tag: string) => {
    // Only select if not already selected and not in use by other addresses
    if (formData.tag !== tag && !isTagInUse(tag)) {
      setFormData(prev => ({ ...prev, tag }));
    }
  };

  const isFormValid = () => {
    return formData.name.trim() !== '' &&
           formData.phone.trim() !== '' &&
           formData.address.trim() !== '' &&
           formData.doorNumber.trim() !== '' &&
           formData.tag.trim() !== '';
  };

  const handleSaveAddress = async () => {
    if (!isFormValid()) return;

    try {
      setLoading(true);
      const normalizedTag = formData.tag.trim();
      if (!normalizedTag) {
        setAlertMessage('标签为必填项，请先选择或新增标签');
        setAlertType('warning');
        setShowAlert(true);
        return;
      }
      
      // 创建保存数据，确保包含is_default字段
      const saveData = {
        label: normalizedTag,
        address: formData.address,
        door_number: formData.doorNumber,
        contact_name: formData.name,
        phone: formData.phone,
        gender: formData.gender,
        tag: normalizedTag,
        is_default: isDefault // 确保正确传递is_default状态
      };
      
      // 尝试使用当前配置保存地址
      let savedAddress = null;
      
      if (editingAddress) {
        // Update existing address
        savedAddress = await addressService.updateAddress({
          id: editingAddress.id,
          expected_updated_at: editingAddress.updated_at,
          ...saveData
        });
      } else {
        // Create new address
        savedAddress = await addressService.createAddress(userId, saveData);
      }

      if (savedAddress) {
        onSave(savedAddress);
        onClose();
        return;
      }
      
      // 如果保存失败（返回null），尝试使用本地存储模式
      console.warn('Primary save method failed, falling back to localStorage mode');
      
      // 对于编辑模式，如果是本地地址，直接尝试更新
      if (editingAddress && editingAddress.id.startsWith('local_')) {
        // 确保使用本地模式更新
        savedAddress = await addressService.updateAddress({
          ...editingAddress,
          expected_updated_at: editingAddress.updated_at,
          ...saveData
        });
      } else {
        // 对于创建或非本地编辑，使用null userId强制本地存储模式
        savedAddress = await addressService.createAddress(null, saveData);
      }
      
      if (savedAddress) {
        setAlertMessage('地址已保存到本地');
        setAlertType('success');
        setShowAlert(true);
        onSave(savedAddress);
        onClose();
      } else {
        console.error('Fallback save method also failed');
        setAlertMessage('保存地址失败，请重试');
        setAlertType('error');
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error saving address:', error);
      
      // 即使捕获到错误，也尝试使用本地存储作为后备
      try {
        console.warn('API call failed, trying localStorage fallback');
        const normalizedTag = formData.tag.trim();

        // 创建后备保存数据，确保包含is_default字段
        const fallbackData = {
          label: normalizedTag,
          address: formData.address,
          door_number: formData.doorNumber,
          contact_name: formData.name,
          phone: formData.phone,
          gender: formData.gender,
          tag: normalizedTag,
          is_default: isDefault // 确保正确传递is_default状态
        };
        
        // 使用null userId强制本地存储模式
        const fallbackAddress = await addressService.createAddress(null, fallbackData);
        
        if (fallbackAddress) {
          setAlertMessage('网络连接问题，地址已保存到本地');
          setAlertType('warning');
          setShowAlert(true);
          onSave(fallbackAddress);
          onClose();
          return;
        }
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
      }
      
      // 如果所有方法都失败，显示错误信息
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage === 'ADDRESS_UPDATE_CONFLICT') {
        setAlertMessage('地址刚被其他操作更新，请刷新后重试');
        setAlertType('warning');
        setShowAlert(true);
        return;
      }
      setAlertMessage(`保存地址失败: ${errorMessage || '请重试'}`);
      setAlertType('error');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  // 检查标签是否已被其他地址使用
  const isTagInUse = (tag: string): boolean => {
    // 如果是编辑模式，排除当前正在编辑的地址
    if (editingAddress) {
      return existingAddresses.some(addr => 
        addr.id !== editingAddress.id && addr.tag === tag
      );
    }
    // 新增模式，检查所有现有地址
    return existingAddresses.some(addr => addr.tag === tag);
  };

  const handleCustomTagSubmit = () => {
    if (customTagInput.trim()) {
      // Check if tag already exists
      if (!['家', '公司', ...customTags].includes(customTagInput.trim())) {
        setCustomTags(prev => [...prev, customTagInput.trim()]);
        setFormData(prev => ({ ...prev, tag: customTagInput.trim() }));
      }
      setCustomTagInput('');
      setShowCustomTagInput(false);
    }
  };

  const handleDeleteCustomTag = (tagToDelete: string) => {
    // 检查标签是否在使用中
    if (isTagInUse(tagToDelete)) {
      setAlertMessage('该标签正在使用中，无法删除');
      setAlertType('warning');
      setShowAlert(true);
      return;
    }
    
    setCustomTags(prev => prev.filter(tag => tag !== tagToDelete));
    // If the deleted tag was selected, clear the selection
    if (formData.tag === tagToDelete) {
      setFormData(prev => ({ ...prev, tag: '' }));
    }
  };

  return (
    <>
      <CenterModal
        show={true}
        onClose={onClose}
        title={editingAddress ? '编辑地址' : '添加地址'}
        zIndex={80}
        maxWidth="max-w-sm"
      >
        {/* Form */}
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
          {/* Address Input */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="请输入收货地址"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              className="w-full px-0 py-2 border-b-2 border-gray-200 text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          {/* Door Number Input */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 border-b-2 border-gray-200 focus-within:border-yellow-400 transition-colors">
              <span className="text-gray-800 text-base font-medium whitespace-nowrap">门牌号</span>
              <input
                type="text"
                placeholder="详细地址，例1层B101室"
                value={formData.doorNumber}
                onChange={(e) => handleInputChange('doorNumber', e.target.value)}
                className="flex-1 px-2 py-2 text-base text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <div className="border-b-2 border-gray-200 pb-2">
              <div className="flex items-center space-x-2 mb-2">
                  <span className="text-gray-800 text-base font-medium whitespace-nowrap">标签</span>
                  <div className="flex flex-wrap gap-2">
                    {/* Show predefined tags (家 and 公司) */}
                    {['家', '公司'].map((tag) => {
                      const tagInUse = isTagInUse(tag);
                      const isCurrentTag = formData.tag === tag;
                      const isDisabled = !isCurrentTag && tagInUse;
                       
                      return (
                        <button
                          key={tag}
                          onClick={() => !isDisabled && handleTagSelect(tag)}
                          disabled={isDisabled}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${isCurrentTag
                            ? 'bg-yellow-100 text-yellow-700'
                            : isDisabled
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                    {/* Show custom tags with delete button */}
                    {customTags.map((tag, index) => {
                      const tagInUse = isTagInUse(tag);
                      return (
                        <div key={index} className="relative">
                          <button
                            onClick={() => handleTagSelect(tag)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${formData.tag === tag
                              ? 'bg-yellow-100 text-yellow-700 pr-7'
                              : tagInUse
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed pr-7'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 pr-7'
                            }`}
                            disabled={tagInUse && formData.tag !== tag}
                          >
                            {tag}
                          </button>
                          {!tagInUse && (
                            <button
                              onClick={() => handleDeleteCustomTag(tag)}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 hover:text-red-500"
                              title="删除标签"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {!showCustomTagInput && (
                      <button
                        onClick={() => setShowCustomTagInput(true)}
                        className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>新增</span>
                      </button>
                    )}
                    {showCustomTagInput && (
                      <div className="custom-tag-input-container flex items-center space-x-1">
                        <input
                          type="text"
                          placeholder="自定义标签"
                          value={customTagInput}
                          onChange={(e) => setCustomTagInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCustomTagSubmit();
                            } else if (e.key === 'Escape') {
                              setShowCustomTagInput(false);
                              setCustomTagInput('');
                            }
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
                          autoFocus
                        />
                        <button
                          onClick={handleCustomTagSubmit}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          title="确认"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setShowCustomTagInput(false);
                            setCustomTagInput('');
                          }}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          title="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </div>

          {/* Contact Name Input with Gender Selection */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 border-b-2 border-gray-200 focus-within:border-yellow-400 transition-colors">
              <span className="text-gray-800 text-base font-medium whitespace-nowrap">联系人</span>
              <input
                type="text"
                placeholder="请输入联系人姓名"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="flex-1 max-w-[150px] px-2 py-2 text-base text-gray-800 placeholder-gray-400 focus:outline-none"
              />
              {/* Gender Selection - Further adjusted to ensure both options are visible */}
                <div className="flex flex-row items-center space-x-2 ml-[-25px] flex-shrink-0">
                  <button
                    onClick={() => handleInputChange('gender', 'male')}
                    className="flex flex-row items-center space-x-0.5 whitespace-nowrap"
                  >
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 ${formData.gender === 'male' ? 'border-yellow-400' : 'border-gray-300'}`}>
                      {formData.gender === 'male' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>}
                    </span>
                    <span className="text-[10px] text-gray-700">先生</span>
                  </button>
                  <button
                    onClick={() => handleInputChange('gender', 'female')}
                    className="flex flex-row items-center space-x-0.5 whitespace-nowrap"
                  >
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 ${formData.gender === 'female' ? 'border-yellow-400' : 'border-gray-300'}`}>
                      {formData.gender === 'female' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>}
                    </span>
                    <span className="text-[10px] text-gray-700">女士</span>
                  </button>
                </div>
            </div>
          </div>

          {/* Phone Input */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 border-b-2 border-gray-200 focus-within:border-yellow-400 transition-colors">
              <span className="text-gray-800 text-base font-medium whitespace-nowrap">手机号</span>
              <input
                type="tel"
                placeholder="请输入手机号"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="flex-1 px-2 py-2 text-base text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>
          
          {/* Default Address Checkbox */}
          <div className="mb-6">
            <button
              onClick={() => setIsDefault(!isDefault)}
              className="flex items-center space-x-2 w-full py-2"
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isDefault ? 'border-yellow-400 bg-yellow-400' : 'border-gray-300'}`}>
                {isDefault && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-gray-700">设为默认地址</span>
              {!editingAddress && existingAddresses.some(addr => addr.is_default) && (
                <span className="text-gray-500 text-sm ml-auto">设置新默认地址会取消当前默认地址</span>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleSaveAddress}
            disabled={!isFormValid() || loading}
            className={`w-full py-3 rounded-full font-medium transition-colors ${!isFormValid() || loading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-yellow-400 text-white hover:bg-yellow-500'
            }`}
          >
            {loading ? '保存中...' : (editingAddress ? '更新地址' : '保存地址')}
          </button>
        </div>
      </CenterModal>

      {/* Alert Dialog */}
      <AlertDialog
        show={showAlert}
        type={alertType}
        title="提示"
        message={alertMessage}
        onClose={() => setShowAlert(false)}
        confirmText="确定"
        zIndex={81}
      />
    </>
  );
};

export default AddAddressModal;