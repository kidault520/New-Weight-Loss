/**
 * QuickEntryModals - Dashboard快速录入模态框组件
 * 从Dashboard.tsx中提取的所有快速录入模态框
 * 符合架构规范：单一职责，减少Dashboard.tsx复杂度
 */

import React from 'react';
import { DragPanel } from '../common/DragPanel';
import WeightRulerSlider from '../WeightRulerSlider';
import { DayData } from '../../utils/mockData';

interface QuickEntryModalsProps {
  // Modal states
  showWeightModal: boolean;
  showWaterModal: boolean;
  showStepsModal: boolean;
  showSleepModal: boolean;
  showBloodGlucoseModal: boolean;
  
  // Modal close handlers
  onCloseWeightModal: () => void;
  onCloseWaterModal: () => void;
  onCloseStepsModal: () => void;
  onCloseSleepModal: () => void;
  onCloseBloodGlucoseModal: () => void;
  
  // Input values
  weightInput: string;
  waterAmount: number;
  stepsAmount: number;
  sleepHours: number;
  sleepMinutes: number;
  glucoseValue: number;
  
  // Input change handlers
  onWeightInputChange: (value: string) => void;
  onWaterAmountChange: (value: number) => void;
  onStepsAmountChange: (value: number) => void;
  onSleepHoursChange: (value: number) => void;
  onSleepMinutesChange: (value: number) => void;
  onGlucoseValueChange: (value: number) => void;
  
  // Submit handlers
  onWeightSubmit: () => void;
  onWaterAdd: () => void;
  onStepsAdd: () => void;
  onSleepAdd: () => void;
  onBloodGlucoseAdd: () => void;
  
  // Data
  data: DayData;
  latestWeightValue?: number;
  defaultWeight?: number;
}

export const QuickEntryModals: React.FC<QuickEntryModalsProps> = ({
  showWeightModal,
  showWaterModal,
  showStepsModal,
  showSleepModal,
  showBloodGlucoseModal,
  onCloseWeightModal,
  onCloseWaterModal,
  onCloseStepsModal,
  onCloseSleepModal,
  onCloseBloodGlucoseModal,
  weightInput,
  waterAmount,
  stepsAmount,
  sleepHours,
  sleepMinutes,
  glucoseValue,
  onWeightInputChange,
  onWaterAmountChange,
  onStepsAmountChange,
  onSleepHoursChange,
  onSleepMinutesChange,
  onGlucoseValueChange,
  onWeightSubmit,
  onWaterAdd,
  onStepsAdd,
  onSleepAdd,
  onBloodGlucoseAdd,
  data,
  latestWeightValue,
  defaultWeight = 60,
}) => {
  return (
    <>
      {/* Weight Recording Modal */}
      <DragPanel 
        show={showWeightModal} 
        onClose={onCloseWeightModal} 
        zIndex={70} 
        mask={{ visible: true, clickable: true }} 
        maxHeight="70vh" 
        maxWidth="max-w-xs" 
        header={<div className="px-4 py-2 text-center text-sm text-gray-600">记录体重</div>}
      >
        <div className="px-5">
          <div className="mb-4">
            <WeightRulerSlider
              value={parseFloat(weightInput) || latestWeightValue || defaultWeight}
              onChange={(newValue) => onWeightInputChange(newValue.toFixed(1))}
              min={30}
              max={150}
              step={0.1}
            />
          </div>
          <div className="flex space-x-3 pb-4">
            <button 
              onClick={() => { 
                onCloseWeightModal(); 
                onWeightInputChange(''); 
              }} 
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              取消
            </button>
            <button 
              onClick={onWeightSubmit} 
              className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors text-sm"
            >
              确定
            </button>
          </div>
        </div>
      </DragPanel>

      {/* Water Recording Modal */}
      <DragPanel 
        show={showWaterModal} 
        onClose={onCloseWaterModal} 
        zIndex={70} 
        mask={{ visible: true, clickable: true }} 
        maxHeight="70vh" 
        maxWidth="max-w-xs" 
        header={<div className="px-4 py-2 text-center text-sm text-gray-600">添加饮水</div>}
      >
        <div className="px-5">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-blue-500">{waterAmount}</span>
              <span className="text-lg text-gray-600">ml</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[100, 200, 250, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => onWaterAmountChange(amount)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    waterAmount === amount
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {amount}ml
                </button>
              ))}
            </div>
            <div className="mb-3">
              <input 
                type="number" 
                min="0" 
                max="5000" 
                step="50" 
                value={waterAmount} 
                onChange={(e) => onWaterAmountChange(parseInt(e.target.value, 10) || 250)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <div className="text-center text-sm text-gray-500">
              今日已饮水: {data.water.current}ml / {data.water.target}ml
            </div>
          </div>
          <div className="flex space-x-3 pb-4">
            <button 
              onClick={() => { 
                onCloseWaterModal(); 
                onWaterAmountChange(250); 
              }} 
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              取消
            </button>
            <button 
              onClick={onWaterAdd} 
              className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors text-sm"
            >
              添加
            </button>
          </div>
        </div>
      </DragPanel>

      {/* Steps Recording Modal */}
      <DragPanel 
        show={showStepsModal} 
        onClose={onCloseStepsModal} 
        zIndex={70} 
        mask={{ visible: true, clickable: true }} 
        maxHeight="70vh" 
        maxWidth="max-w-xs" 
        header={<div className="px-4 py-2 text-center text-sm text-gray-600">添加步数记录</div>}
      >
        <div className="px-5">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-yellow-500">{stepsAmount}</span>
              <span className="text-lg text-gray-600">步</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[1000, 3000, 5000, 10000].map((amount) => (
                <button 
                  key={amount} 
                  onClick={() => onStepsAmountChange(amount)} 
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    stepsAmount === amount 
                      ? 'bg-yellow-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {amount}步
                </button>
              ))}
            </div>
            <div className="mb-3">
              <input 
                type="number" 
                min="0" 
                max="100000" 
                step="100" 
                value={stepsAmount} 
                onChange={(e) => onStepsAmountChange(parseInt(e.target.value, 10) || 1000)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500" 
              />
            </div>
          </div>
          <div className="flex space-x-3 pb-4">
            <button 
              onClick={() => { 
                onCloseStepsModal(); 
                onStepsAmountChange(1000); 
              }} 
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              取消
            </button>
            <button 
              onClick={onStepsAdd} 
              className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition-colors text-sm"
            >
              添加
            </button>
          </div>
        </div>
      </DragPanel>

      {/* Sleep Recording Modal */}
      <DragPanel 
        show={showSleepModal} 
        onClose={onCloseSleepModal} 
        zIndex={70} 
        mask={{ visible: true, clickable: true }} 
        maxHeight="70vh" 
        maxWidth="max-w-xs" 
        header={<div className="px-4 py-2 text-center text-sm text-gray-600">添加睡眠记录</div>}
      >
        <div className="px-5">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-indigo-500">{sleepHours}</span>
              <span className="text-lg text-gray-600">小时</span>
              <span className="text-xl font-bold text-indigo-500">{sleepMinutes}</span>
              <span className="text-lg text-gray-600">分钟</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">小时</label>
                <div className="grid grid-cols-4 gap-2">
                  {[6, 7, 8, 9].map((hour) => (
                    <button 
                      key={hour} 
                      onClick={() => onSleepHoursChange(hour)} 
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center ${
                        sleepHours === hour 
                          ? 'bg-indigo-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
                <input 
                  type="number" 
                  min="0" 
                  max="24" 
                  value={sleepHours} 
                  onChange={(e) => onSleepHoursChange(parseInt(e.target.value, 10) || 0)} 
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">分钟</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 15, 30, 45].map((minute) => (
                    <button 
                      key={minute} 
                      onClick={() => onSleepMinutesChange(minute)} 
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center ${
                        sleepMinutes === minute 
                          ? 'bg-indigo-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {minute}
                    </button>
                  ))}
                </div>
                <input 
                  type="number" 
                  min="0" 
                  max="59" 
                  value={sleepMinutes} 
                  onChange={(e) => onSleepMinutesChange(parseInt(e.target.value, 10) || 0)} 
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
            </div>
          </div>
          <div className="flex space-x-3 pb-4">
            <button 
              onClick={() => { 
                onCloseSleepModal(); 
                onSleepHoursChange(7); 
                onSleepMinutesChange(30); 
              }} 
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              取消
            </button>
            <button 
              onClick={onSleepAdd} 
              className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors text-sm"
            >
              添加
            </button>
          </div>
        </div>
      </DragPanel>

      {/* Blood Glucose Recording Modal */}
      <DragPanel 
        show={showBloodGlucoseModal} 
        onClose={onCloseBloodGlucoseModal} 
        zIndex={90} 
        mask={{ visible: true, clickable: true }} 
        maxHeight="70vh" 
        maxWidth="max-w-xs" 
        header={<div className="px-4 py-2 text-center text-sm text-gray-600">添加血糖记录</div>}
      >
        <div className="px-5">
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-xl font-bold text-red-500">{glucoseValue.toFixed(1)}</span>
              <span className="text-lg text-gray-600">mmol/L</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[4.0, 5.0, 6.0, 7.0].map((value) => (
                <button 
                  key={value} 
                  onClick={() => onGlucoseValueChange(value)} 
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    Math.abs(glucoseValue - value) < 0.1 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="mb-3">
              <input 
                type="number" 
                min="2.0" 
                max="20.0" 
                step="0.1" 
                value={glucoseValue} 
                onChange={(e) => onGlucoseValueChange(parseFloat(e.target.value) || 5.5)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-red-500" 
              />
            </div>
            <div className="text-center text-xs text-gray-500">
              正常范围: 3.9 - 7.8 mmol/L
            </div>
          </div>
          <div className="flex space-x-3 pb-4">
            <button 
              onClick={() => { 
                onCloseBloodGlucoseModal(); 
                onGlucoseValueChange(5.5); 
              }} 
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              取消
            </button>
            <button 
              onClick={onBloodGlucoseAdd} 
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors text-sm"
            >
              添加
            </button>
          </div>
        </div>
      </DragPanel>
    </>
  );
};




