/**
 * 置顶卡片栈 - 单页主界面顶部 3 张卡
 * 今日待办、今日指标、阶段进度（骨架，后续接入真实数据）
 */

import React from 'react';
import { ListTodo, TrendingUp, BarChart3 } from 'lucide-react';

const TopCardStack: React.FC = () => {
  return (
    <div className="px-4 py-2 space-y-2 max-w-sm mx-auto">
      {/* 今日待办 */}
      <div className="bg-white/90 rounded-xl p-3 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-800">今日待办</span>
          </div>
          <span className="text-xs text-gray-500">待接入</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">配送确认 · 血糖记录 · 体重打卡</p>
      </div>

      {/* 今日指标 */}
      <div className="bg-white/90 rounded-xl p-3 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-800">今日指标</span>
          </div>
          <span className="text-xs text-gray-500">待接入</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">体重 · 血糖 · 围度</p>
      </div>

      {/* 阶段进度 */}
      <div className="bg-white/90 rounded-xl p-3 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-800">阶段进度</span>
          </div>
          <span className="text-xs text-gray-500">待接入</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">本周完成度</p>
      </div>
    </div>
  );
};

export default TopCardStack;
