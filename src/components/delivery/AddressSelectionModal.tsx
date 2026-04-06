/**
 * AddressSelectionModal - 地址选择模态框组件
 * 从DeliveryPlanPage.tsx中提取的地址选择模态框
 * 符合架构规范：单一职责，代码复用
 */

import React from 'react';
import { Plus, Check, X } from 'lucide-react';
import { DeliveryAddress } from '../../services/addressService';
import { getMealTypeLabel, getDateLabelFull } from '../../utils/deliveryPlanUtils';
import { toLocalDateString } from '../../utils/dateUtils';

interface DateMealConfig {
  date: Date;
  mealType: string;
  addressId: string;
}

interface AddressSelectionModalProps {
  show: boolean;
  editingConfig: { date: Date; mealType: string } | null;
  addresses: DeliveryAddress[];
  dateMealConfigs: DateMealConfig[];
  onAddressChange: (date: Date, mealType: string, addressId: string) => void;
  onClose: () => void;
  onAddAddress: () => void;
}

export const AddressSelectionModal: React.FC<AddressSelectionModalProps> = ({
  show,
  editingConfig,
  addresses,
  dateMealConfigs,
  onAddressChange,
  onClose,
  onAddAddress,
}) => {
  if (!show || !editingConfig) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[340px] w-full max-h-[80vh] overflow-hidden flex flex-col mx-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">选择配送地址</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {getMealTypeLabel(editingConfig.mealType)} · {getDateLabelFull(editingConfig.date)}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onAddAddress}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="添加新地址"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Address List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {addresses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">暂无地址</p>
              <button
                onClick={onAddAddress}
                className="mt-4 text-yellow-500 hover:text-yellow-600 text-sm font-medium"
              >
                添加地址
              </button>
            </div>
          ) : (
            addresses.map(address => {
              const currentConfig = dateMealConfigs.find(c =>
                toLocalDateString(c.date) === toLocalDateString(editingConfig.date) &&
                c.mealType === editingConfig.mealType
              );
              const isSelected = currentConfig?.addressId === address.id;

              return (
                <button
                  key={address.id}
                  onClick={() => {
                    onAddressChange(editingConfig.date, editingConfig.mealType, address.id);
                    onClose(); // 🔥 修复：选择地址后自动关闭弹窗
                  }}
                  className={`w-full px-4 py-3 mb-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        【{address.label}】
                      </div>
                      <div className={`text-xs mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                        {address.address} {address.door_number}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="ml-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};













