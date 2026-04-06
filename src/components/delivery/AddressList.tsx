/**
 * AddressList - 地址列表组件
 * 从AddDeliveryAddressPage.tsx中提取的地址列表渲染
 * 符合架构规范：单一职责，代码复用
 */

import React from 'react';
import { Lock, MapPin, Pencil } from 'lucide-react';
import { DeliveryAddress as DBDeliveryAddress } from '../../services/addressService';

const MEAL_LABELS: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', all: '全部' };

interface AddressListProps {
  addresses: DBDeliveryAddress[];
  selectedAddressId: string | null;
  manualSelectedAddressId?: string | null;
  swipedAddressId: string | null;
  lockedAddressIds?: Set<string>;
  isManagementMode: boolean;
  onAddressClick: (address: DBDeliveryAddress, e: React.MouseEvent) => void;
  onEditClick: (address: DBDeliveryAddress, e: React.MouseEvent) => void;
  onTouchStart: (addressId: string, e: React.TouchEvent) => void;
  onTouchMove: (addressId: string, e: React.TouchEvent) => void;
  onTouchEnd: (addressId: string) => void;
  onDeleteClick: (addressId: string) => void;
}

export const AddressList: React.FC<AddressListProps> = ({
  addresses,
  selectedAddressId,
  manualSelectedAddressId,
  swipedAddressId,
  lockedAddressIds,
  isManagementMode,
  onAddressClick,
  onEditClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onDeleteClick,
}) => {
  return (
    <div className="space-y-3 pb-4">
      {addresses.map((address) => (
        <div key={address.id} className="relative overflow-hidden rounded-xl">
          {(() => {
            const isDefaultAddress = !!(address.default_meal_types && Array.isArray(address.default_meal_types) && address.default_meal_types.length > 0);
            const isLockedForEdit = lockedAddressIds?.has(address.id) || false;
            const isManualSelected = !isManagementMode && selectedAddressId === address.id && manualSelectedAddressId === address.id;
            const borderClass = isManualSelected
              ? 'border-green-400'
              : isDefaultAddress
                ? 'border-gray-300'
                : 'border-gray-200';
            return (
              <>
          {/* Delete background */}
          <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6">
            <span className="text-white font-medium">删除</span>
          </div>

          {/* Address card */}
          <div
            id={`address-card-${address.id}`}
            onClick={(e) => {
              // 如果已经滑动出删除按钮，点击卡片空白处取消
              if (swipedAddressId === address.id) {
                const cardElement = document.getElementById(`address-card-${address.id}`);
                if (cardElement) {
                  cardElement.style.transform = 'translateX(0)';
                  cardElement.style.transition = 'transform 0.3s ease';
                }
                // 通过onAddressClick传递null来重置
                onAddressClick(address, e);
              } else if (!swipedAddressId) {
                onAddressClick(address, e);
              }
            }}
            onTouchStart={(e) => onTouchStart(address.id, e)}
            onTouchMove={(e) => onTouchMove(address.id, e)}
            onTouchEnd={() => onTouchEnd(address.id)}
            className={`relative w-full rounded-xl shadow-sm p-3 text-left cursor-pointer border ${borderClass} ${isLockedForEdit ? 'bg-gray-100' : 'bg-white'}`}
            style={{ transition: 'transform 0.3s ease', pointerEvents: 'auto' }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-md">
                    {address.label}
                  </span>
                  {(address.default_meal_types && Array.isArray(address.default_meal_types) && address.default_meal_types.length > 0) && (() => {
                    const dmt = address.default_meal_types;
                    const labels = dmt.includes('all') ? ['breakfast', 'lunch', 'dinner'] : dmt;
                    return (
                      <span className="text-xs text-gray-400">
                        {labels.map((m, i) => (
                          <span key={m} className="font-bold text-gray-900">
                            {MEAL_LABELS[m] || m}
                            {i < labels.length - 1 ? '、' : ''}
                          </span>
                        ))}
                        {' '}默认地址
                      </span>
                    );
                  })()}
                  {isLockedForEdit && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Lock className="w-3.5 h-3.5" />
                      不可修改
                    </span>
                  )}
                </div>
                <div className="flex items-start space-x-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {address.address} {address.door_number}
                  </p>
                </div>
                {address.contact_name && address.phone && (
                  <p className="text-gray-500 text-xs ml-6">
                    {address.contact_name} {address.phone}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => onEditClick(address, e)}
                className={`ml-2 p-2 ${isLockedForEdit ? 'text-gray-500' : 'text-gray-400'}`}
                title={isLockedForEdit ? '该地址处于今日配送锁定窗口，暂不可修改' : '编辑地址'}
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Delete button when swiped */}
          {swipedAddressId === address.id && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(address.id);
              }}
              className="absolute top-0 right-0 bottom-0 bg-red-500 flex items-center justify-center cursor-pointer rounded-r-2xl"
              style={{ width: '80px', zIndex: 5 }}
            >
              <span className="text-white font-medium text-sm">删除</span>
            </div>
          )}
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
};




















