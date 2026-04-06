import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Menu, Minus, Plus, GripVertical } from 'lucide-react';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'

interface EditDashboardScreenProps {
  onClose: () => void;
  dashboardCardOrder: string[];
  hiddenDashboardCards: string[];
  onUpdateCardOrder: (newOrder: string[]) => void;
  onUpdateHiddenCards: (hiddenCards: string[]) => void;
  show?: boolean; // 添加 show prop 来控制显示/隐藏
}

const EditDashboardScreen: React.FC<EditDashboardScreenProps> = ({
  onClose,
  dashboardCardOrder,
  hiddenDashboardCards,
  onUpdateCardOrder,
  onUpdateHiddenCards,
  show = true, // 默认显示
}) => {

  // Fixed cards that cannot be hidden
  const fixedCards = useMemo(() => ['calories', 'weight'], []);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);
  
  // ✅ 使用本地 state 来立即更新 UI，避免等待父组件重新渲染
  const [localCardOrder, setLocalCardOrder] = useState<string[]>(dashboardCardOrder);
  const [localHiddenCards, setLocalHiddenCards] = useState<string[]>(hiddenDashboardCards);
  
  // 当 props 变化时，同步到本地 state
  useEffect(() => {
    setLocalCardOrder(dashboardCardOrder);
  }, [dashboardCardOrder]);
  
  useEffect(() => {
    setLocalHiddenCards(hiddenDashboardCards);
  }, [hiddenDashboardCards]);

  // 保存数据的函数（不关闭面板）
  const savePreferences = useCallback(async () => {
    try {
      // ✅ 使用本地 state 的最新值
      const uniqueCardOrder = Array.from(new Set(localCardOrder));
      if (uniqueCardOrder.length > 0) {
        await onUpdateCardOrder(uniqueCardOrder);
      }
      
      await onUpdateHiddenCards(localHiddenCards);
    } catch (error) {
      console.error('[EditDashboard] ❌ Error saving preferences:', error);
    }
  }, [localCardOrder, localHiddenCards, onUpdateCardOrder, onUpdateHiddenCards]);

  // 处理关闭的函数
  const handleClose = useCallback(async (e?: React.MouseEvent | React.TouchEvent) => {
    // 防止重复关闭
    if (isClosingRef.current) {
      return;
    }
    isClosingRef.current = true;
    
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // ✅ 先保存数据（快速保存，不等待）
    savePreferences().catch((error) => {
      console.error('[EditDashboard] ❌ Error saving on close:', error);
    });
    
    // ✅ 然后立即调用 onClose，让父组件更新状态，关闭面板
    onClose();
    
    // 延迟重置标志，确保关闭完成
    setTimeout(() => {
      isClosingRef.current = false;
    }, 600);
  }, [onClose, savePreferences]);

  const allCards = useMemo(() => [
    { id: 'calories', name: '饮食&运动', icon: '🍽️', color: 'bg-orange-100' },
    { id: 'weight', name: '体重', icon: '⚖️', color: 'bg-blue-100' },
    { id: 'nutrition', name: '营养素', icon: '🥗', color: 'bg-green-100' },
    { id: 'water', name: '喝水', icon: '💧', color: 'bg-cyan-100' },
    { id: 'steps', name: '步数', icon: '👟', color: 'bg-yellow-100' },
    { id: 'exercise', name: '运动', icon: '🏃', color: 'bg-red-100' },
    { id: 'measurements', name: '围度', icon: '📏', color: 'bg-purple-100' },
    { id: 'emotion', name: '心情', icon: '😊', color: 'bg-pink-100' },
    { id: 'sleep', name: '睡眠', icon: '😴', color: 'bg-indigo-100' },
    { id: 'bloodGlucose', name: '血糖', icon: '🩸', color: 'bg-red-100' },
    { id: 'breathing', name: '练习呼吸', icon: '🌬️', color: 'bg-violet-100' },
  ], []);

  // ✅ 使用本地 state 来计算可见和隐藏的卡片，确保立即更新 UI
  const visibleCards = useMemo(() => allCards
    .filter(card => !localHiddenCards.includes(card.id))
    .sort((a, b) => {
      const indexA = localCardOrder.indexOf(a.id);
      const indexB = localCardOrder.indexOf(b.id);
      // 如果卡片不在order中，放在最后
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }), [allCards, localHiddenCards, localCardOrder]);
  
  const hiddenCards = useMemo(() => 
    allCards.filter(card => localHiddenCards.includes(card.id)),
    [allCards, localHiddenCards]
  );
  
  const toggleCardVisibility = useCallback(async (cardId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (fixedCards.includes(cardId) && !localHiddenCards.includes(cardId)) {
      return;
    }
    
    try {
      let newHiddenCards: string[];
      let newOrder: string[];
      
      if (localHiddenCards.includes(cardId)) {
        // 显示卡片：从隐藏列表中移除
        newHiddenCards = localHiddenCards.filter(id => id !== cardId);
        // 如果卡片不在 order 中，添加到 order
        newOrder = localCardOrder.includes(cardId) 
          ? localCardOrder 
          : [...localCardOrder, cardId];
      } else {
        // 隐藏卡片：添加到隐藏列表
        newHiddenCards = [...localHiddenCards, cardId];
        // 从 order 中移除
        newOrder = localCardOrder.filter(id => id !== cardId);
      }
      
      // ✅ 立即更新本地 state，确保 UI 立即响应
      setLocalHiddenCards(newHiddenCards);
      setLocalCardOrder(newOrder);
      
      // ✅ 然后异步保存到数据库（不阻塞 UI 更新）
      try {
        await onUpdateHiddenCards(newHiddenCards);
        await onUpdateCardOrder(newOrder);
      } catch (saveError) {
        console.error('[EditDashboard] ❌ Error saving to database:', saveError);
        // 如果保存失败，恢复本地 state
        setLocalHiddenCards(localHiddenCards);
        setLocalCardOrder(localCardOrder);
      }
    } catch (error) {
      console.error('[EditDashboard] ❌ Error toggling card visibility:', error);
    }
  }, [fixedCards, localHiddenCards, localCardOrder, onUpdateHiddenCards, onUpdateCardOrder]);

  // 拖拽排序处理
  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    e.stopPropagation();
    dragItemRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  }, []);

  const handleDragOver = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(async (dropIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    
    if (dragItemRef.current === null || dragItemRef.current === dropIndex) {
      setDraggedIndex(null);
      dragItemRef.current = null;
      return;
    }

    const draggedCard = visibleCards[dragItemRef.current];
    const newOrder = [...localCardOrder];
    
    // 移除拖拽的卡片
    const draggedCardIndex = newOrder.indexOf(draggedCard.id);
    if (draggedCardIndex !== -1) {
      newOrder.splice(draggedCardIndex, 1);
    }
    
    // 插入到新位置
    const dropCard = visibleCards[dropIndex];
    const dropCardIndex = newOrder.indexOf(dropCard.id);
    if (dropCardIndex !== -1) {
      newOrder.splice(dropCardIndex, 0, draggedCard.id);
    } else {
      // 如果dropCard不在order中，插入到对应位置
      newOrder.splice(dropIndex, 0, draggedCard.id);
    }
    
    // ✅ 立即更新本地 state
    setLocalCardOrder(newOrder);
    
    // ✅ 然后异步保存到数据库
    try {
      await onUpdateCardOrder(newOrder);
    } catch (error) {
      console.error('[EditDashboard] ❌ Error saving card order:', error);
      // 如果保存失败，恢复本地 state
      setLocalCardOrder(localCardOrder);
    }
    
    setDraggedIndex(null);
    dragItemRef.current = null;
  }, [visibleCards, localCardOrder, onUpdateCardOrder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  }, []);

  // DragPanel 的 onClose 处理函数（只负责关闭，不保存）
  const handleDragPanelClose = useCallback(() => {
    // 防止重复关闭
    if (isClosingRef.current) {
      return;
    }
    isClosingRef.current = true;
    
    // 保存数据（后台执行，不阻塞）
    savePreferences().catch((error) => {
      console.error('[EditDashboard] ❌ Error saving on drag close:', error);
    });
    // 调用父组件的 onClose
    onClose();
    
    // 延迟重置标志
    setTimeout(() => {
      isClosingRef.current = false;
    }, 600);
  }, [onClose, savePreferences]);

  return (
    <DragPanel 
      show={show}
      onClose={handleDragPanelClose} 
      zIndex={70} 
      mask={{ visible: false }}
      header={
        <div 
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <DetailHeader 
            title={"编辑仪表板"} 
            leftAction={{ 
              label: '返回', 
              onClick: (e?: React.MouseEvent | React.TouchEvent) => {
                handleClose(e);
              }
            }} 
          />
        </div>
      }
    >
      <div className="px-4 space-y-1 flex-1 overflow-y-auto pb-4 scrollbar-hide">
          {/* Visible Cards Section */}
          <SectionCard className="my-1 overflow-hidden">
            {visibleCards.map((card, index) => (
              <div 
                key={card.id} 
                draggable={!fixedCards.includes(card.id)}
                onDragStart={(e) => handleDragStart(index, e)}
                onDragOver={(e) => handleDragOver(index, e)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(index, e)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 select-none transition-colors ${
                  fixedCards.includes(card.id) 
                    ? 'opacity-75 bg-gray-50' 
                    : draggedIndex === index
                    ? 'opacity-50 bg-blue-50'
                    : dragOverIndex === index
                    ? 'bg-blue-100 border-blue-300'
                    : 'hover:bg-gray-50 cursor-move'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  {!fixedCards.includes(card.id) && (
                    <div className="cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <button
                    onClick={(e) => toggleCardVisibility(card.id, e)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      fixedCards.includes(card.id) 
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                    disabled={fixedCards.includes(card.id)}
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>
                  <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <span className="text-lg">{card.icon}</span>
                  </div>
                  <span className="text-gray-800 font-medium">{card.name}</span>
                </div>
                <Menu className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </SectionCard>

          {/* Usage instruction */}
          <div className="text-center text-gray-500 text-sm mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-400 font-normal mb-1 text-xs">💡 使用提示</div>
              <div className="text-xs text-gray-400">
                拖拽卡片可调整顺序<br/>
                点击 ➖ 隐藏卡片，点击 ➕ 显示卡片
              </div>
            </div>
          </div>

          {/* Hidden Cards Section */}
          {hiddenCards.length > 0 && (
            <SectionCard className="my-1 overflow-hidden">
              {hiddenCards.map((card) => (
                <div key={card.id} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 select-none">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => toggleCardVisibility(card.id, e)}
                      className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                    <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center opacity-50`}>
                      <span className="text-lg">{card.icon}</span>
                    </div>
                    <span className="text-gray-500">{card.name}</span>
                  </div>
                  <Menu className="w-5 h-5 text-gray-300" />
                </div>
              ))}
            </SectionCard>
          )}
      </div>
    </DragPanel>
  );
};

export default EditDashboardScreen;
