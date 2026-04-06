/**
 * useAppMealPlan - 餐食计划状态管理Hook
 * 从App.tsx中提取的餐食计划相关状态管理逻辑
 * 符合架构规范：提取状态管理逻辑，减少App.tsx复杂度
 */

import { useState } from 'react';
import type { DeliveryPlanConfirmationData } from '../components/delivery/DeliveryPlanConfirmationModal';

export interface AppMealPlanState {
  // 临时状态（用于配置流程）
  tempSelectedAddressId: string;
  tempSelectedDates: Date[];
  tempExcludedDates: Date[];
  tempSelectedMealTypes: string[];
  
  // 已确认的状态
  selectedOrderDates: Date[];
  selectedMealTypes: string[];
  selectedDeliveryAddressId: string;
  
  // 配送计划状态
  deliveryPlanStartDate: Date | undefined;
  deliveryPlanEndDate: Date | undefined;
  deliveryPlanDates: Date[];
  
  // 其他状态
  mealTypeToOpenFoodDetailWith: string | undefined;
  isOpenedFromDeliveryPlan: boolean;
  isOpenedFromOrders: boolean;
  mealAddresses: Record<string, string>;
  
  // Modal状态
  showMealPlanConfirmationModal: boolean;
  showDateSelectionPage: boolean;
  showAddDeliveryAddressPage: boolean;
  showDeliveryPlanPage: boolean;
  showDeliveryPlanConfirmationModal: boolean;
  pendingDeliveryPlanConfirmation: DeliveryPlanConfirmationData | null;
}

export interface AppMealPlanActions {
  // 临时状态设置
  setTempSelectedAddressId: (id: string) => void;
  setTempSelectedDates: (dates: Date[]) => void;
  setTempExcludedDates: (dates: Date[]) => void;
  setTempSelectedMealTypes: (types: string[]) => void;
  
  // 已确认状态设置
  setSelectedOrderDates: (dates: Date[]) => void;
  setSelectedMealTypes: (types: string[]) => void;
  setSelectedDeliveryAddressId: (id: string) => void;
  
  // 配送计划状态设置
  setDeliveryPlanStartDate: (date: Date | undefined) => void;
  setDeliveryPlanEndDate: (date: Date | undefined) => void;
  setDeliveryPlanDates: (dates: Date[]) => void;
  
  // 其他状态设置
  setMealTypeToOpenFoodDetailWith: (type: string | undefined) => void;
  setIsOpenedFromDeliveryPlan: (opened: boolean) => void;
  setIsOpenedFromOrders: (opened: boolean) => void;
  setMealAddresses: (addresses: Record<string, string>) => void;
  
  // Modal状态设置
  setShowMealPlanConfirmationModal: (show: boolean) => void;
  setShowDateSelectionPage: (show: boolean) => void;
  setShowAddDeliveryAddressPage: (show: boolean) => void;
  setShowDeliveryPlanPage: (show: boolean) => void;
  setShowDeliveryPlanConfirmationModal: (show: boolean) => void;
  setPendingDeliveryPlanConfirmation: (data: DeliveryPlanConfirmationData | null) => void;
  
  // 重置临时状态
  resetTempState: () => void;
}

export function useAppMealPlan() {
  const [tempSelectedAddressId, setTempSelectedAddressId] = useState<string>('');
  const [tempSelectedDates, setTempSelectedDates] = useState<Date[]>([]);
  const [tempExcludedDates, setTempExcludedDates] = useState<Date[]>([]);
  const [tempSelectedMealTypes, setTempSelectedMealTypes] = useState<string[]>([]);
  const [selectedOrderDates, setSelectedOrderDates] = useState<Date[]>([]);
  const [selectedMealTypes, setSelectedMealTypes] = useState<string[]>([]);
  const [selectedDeliveryAddressId, setSelectedDeliveryAddressId] = useState<string>('');
  const [deliveryPlanStartDate, setDeliveryPlanStartDate] = useState<Date | undefined>(undefined);
  const [deliveryPlanEndDate, setDeliveryPlanEndDate] = useState<Date | undefined>(undefined);
  const [deliveryPlanDates, setDeliveryPlanDates] = useState<Date[]>([]);
  const [mealTypeToOpenFoodDetailWith, setMealTypeToOpenFoodDetailWith] = useState<string | undefined>(undefined);
  const [isOpenedFromDeliveryPlan, setIsOpenedFromDeliveryPlan] = useState(false);
  const [isOpenedFromOrders, setIsOpenedFromOrders] = useState(false);
  const [mealAddresses, setMealAddresses] = useState<Record<string, string>>({});
  const [showMealPlanConfirmationModal, setShowMealPlanConfirmationModal] = useState(false);
  const [showDateSelectionPage, setShowDateSelectionPage] = useState(false);
  const [showAddDeliveryAddressPage, setShowAddDeliveryAddressPage] = useState(false);
  const [showDeliveryPlanPage, setShowDeliveryPlanPage] = useState(false);
  const [showDeliveryPlanConfirmationModal, setShowDeliveryPlanConfirmationModal] = useState(false);
  const [pendingDeliveryPlanConfirmation, setPendingDeliveryPlanConfirmation] = useState<DeliveryPlanConfirmationData | null>(null);

  const resetTempState = () => {
    setTempSelectedAddressId('');
    setTempSelectedDates([]);
    setTempExcludedDates([]);
    setTempSelectedMealTypes([]);
  };

  return {
    // State
    tempSelectedAddressId,
    tempSelectedDates,
    tempExcludedDates,
    tempSelectedMealTypes,
    selectedOrderDates,
    selectedMealTypes,
    selectedDeliveryAddressId,
    deliveryPlanStartDate,
    deliveryPlanEndDate,
    deliveryPlanDates,
    mealTypeToOpenFoodDetailWith,
    isOpenedFromDeliveryPlan,
    isOpenedFromOrders,
    mealAddresses,
    showMealPlanConfirmationModal,
    showDateSelectionPage,
    showAddDeliveryAddressPage,
    showDeliveryPlanPage,
    showDeliveryPlanConfirmationModal,
    pendingDeliveryPlanConfirmation,
    
    // Actions
    setTempSelectedAddressId,
    setTempSelectedDates,
    setTempExcludedDates,
    setTempSelectedMealTypes,
    setSelectedOrderDates,
    setSelectedMealTypes,
    setSelectedDeliveryAddressId,
    setDeliveryPlanStartDate,
    setDeliveryPlanEndDate,
    setDeliveryPlanDates,
    setMealTypeToOpenFoodDetailWith,
    setIsOpenedFromDeliveryPlan,
    setIsOpenedFromOrders,
    setMealAddresses,
    setShowMealPlanConfirmationModal,
    setShowDateSelectionPage,
    setShowAddDeliveryAddressPage,
    setShowDeliveryPlanPage,
    setShowDeliveryPlanConfirmationModal,
    setPendingDeliveryPlanConfirmation,
    resetTempState,
  };
}

















