import React, { useState, useEffect } from 'react';
import { X, Check, MapPin } from 'lucide-react';
import { addressService, DeliveryAddress } from '../services/addressService';
import { auth } from '../config/supabase';

interface AddressSelectionModalProps {
  onClose: () => void;
  onSelectAddress: (addressId: string, addressText: string) => void;
  currentAddressId?: string;
  defaultAddressId?: string;
}

const AddressSelectionModal: React.FC<AddressSelectionModalProps> = ({
  onClose,
  onSelectAddress,
  currentAddressId,
  defaultAddressId: _defaultAddressId
}) => {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(currentAddressId || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const { user } = await auth.getCurrentUser();
      const userId = user?.id || null;
      let userAddresses = await addressService.fetchUserAddresses(userId);
      
      // 在UI层面确保默认地址的唯一性
      const defaultAddresses = userAddresses.filter(addr => addr.is_default);
      if (defaultAddresses.length > 1) {
        console.log(`在UI层面检测到${defaultAddresses.length}个默认地址，进行规范化显示...`);
        
        // 只保留第一个地址为默认，其他设为非默认（仅用于UI显示）
        const firstDefaultIndex = userAddresses.findIndex(addr => addr.is_default);
        userAddresses = userAddresses.map((addr, index) => ({
          ...addr,
          is_default: addr.is_default && index === firstDefaultIndex
        }));
        
        console.log('UI层面已规范化默认地址显示');
      }
      
      setAddresses(userAddresses);
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedId) {
      const selectedAddress = addresses.find(addr => addr.id === selectedId);
      if (selectedAddress) {
        const addressText = `${selectedAddress.address} ${selectedAddress.door_number}`;
        onSelectAddress(selectedId, addressText);
      }
    }
  };

  return (
    <div className="absolute inset-0 z-[70] bg-black/50 flex items-end">
      <div className="w-full bg-white rounded-t-3xl max-h-[70vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-800">选择配送地址</h2>
          <button onClick={onClose} className="p-1">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Address List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无地址</div>
          ) : (
            <div className="space-y-3">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  onClick={() => setSelectedId(address.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedId === address.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-gray-800">{address.contact_name}</span>
                        <span className="text-sm text-gray-600">{address.phone}</span>
                        {address.label && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                            {address.label}
                          </span>
                        )}
                        {address.is_default && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded font-medium">
                            默认地址
                          </span>
                        )}
                      </div>
                      <div className="flex items-start space-x-1 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{address.address} {address.door_number}</span>
                      </div>
                    </div>
                    {selectedId === address.id && (
                      <Check className="w-5 h-5 text-purple-500 flex-shrink-0 ml-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200">
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className={`w-full py-3 rounded-xl text-base font-medium transition-colors ${
              selectedId
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            确认
          </button>
        </div>

        {/* iPhone Home Indicator */}
        <div className="flex justify-center pb-[9px]">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default AddressSelectionModal;
