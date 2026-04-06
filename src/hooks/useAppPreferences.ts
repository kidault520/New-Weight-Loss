/**
 * useAppPreferences - 用户偏好状态管理Hook
 * 从App.tsx中提取的用户偏好相关状态管理逻辑
 * 符合架构规范：提取状态管理逻辑，减少App.tsx复杂度
 */

import React, { useState, useEffect, useRef } from 'react';
import { getUserPreferences, saveUserPreferences } from '../services/userPreferencesService';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { SUPABASE_TABLE_QUERY_TIMEOUT_MS } from '../constants/authTimeouts';

export interface AppPreferencesState {
  dashboardCardOrder: string[];
  hiddenDashboardCards: string[];
}

export interface AppPreferencesActions {
  setDashboardCardOrder: (order: string[]) => void;
  setHiddenDashboardCards: (cards: string[]) => void;
  updateCardOrder: (order: string[]) => void;
  updateHiddenCards: (cards: string[]) => void;
}

export function useAppPreferences(userId: string | null, isAuthenticated: boolean, authLoading: boolean) {
  // ✅ 初始值使用默认值，加载完成后会被实际值覆盖
  const [dashboardCardOrder, setDashboardCardOrder] = useState<string[]>(['calories', 'weight']);
  const [hiddenDashboardCards, setHiddenDashboardCards] = useState<string[]>([
    'nutrition', 'water', 'steps', 'exercise', 'measurements', 'emotion', 'sleep', 'bloodGlucose', 'breathing',
  ]);
  const [isLoading, setIsLoading] = useState(true); // 添加加载状态

  const hasLoadedPreferencesRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);
  const lastSavedCardOrderRef = useRef<string>('');
  const lastSavedHiddenCardsRef = useRef<string>('');

  // 加载用户偏好配置（优先从数据库，备用localStorage）
  useEffect(() => {
    const loadUserPreferences = async () => {
      // 如果未认证或正在加载认证状态，使用默认值
      if (!isAuthenticated || authLoading) {
        if (!isAuthenticated && !authLoading) {
          // 未登录用户，尝试从 localStorage 加载
          try {
            const [cardOrder, hiddenCards] = await Promise.all([
              getUserStorageItem<string[]>('dashboardCardOrder'),
              getUserStorageItem<string[]>('hiddenDashboardCards')
            ]);
            
            let unauthenticatedCardOrder: string[];
            let unauthenticatedHiddenCards: string[];
            
            if (cardOrder && cardOrder.length > 0) {
              unauthenticatedCardOrder = Array.from(new Set(cardOrder));
              setDashboardCardOrder(unauthenticatedCardOrder);
            } else {
              // 未登录且没有保存的数据，使用默认值
              unauthenticatedCardOrder = ['calories', 'weight'];
              setDashboardCardOrder(unauthenticatedCardOrder);
            }
            
            if (hiddenCards && Array.isArray(hiddenCards)) {
              unauthenticatedHiddenCards = hiddenCards;
              setHiddenDashboardCards(unauthenticatedHiddenCards);
            } else {
              // 未登录且没有保存的数据，使用默认值
              unauthenticatedHiddenCards = ['nutrition', 'water', 'steps', 'exercise', 'measurements', 'emotion', 'sleep', 'bloodGlucose', 'breathing'];
              setHiddenDashboardCards(unauthenticatedHiddenCards);
            }
            
            // ✅ 立即更新 ref，防止自动保存覆盖刚加载的数据
            lastSavedCardOrderRef.current = JSON.stringify(unauthenticatedCardOrder);
            lastSavedHiddenCardsRef.current = JSON.stringify(unauthenticatedHiddenCards);
            
            setIsLoading(false);
          } catch (error) {
            console.error('[useAppPreferences] Error loading from localStorage for unauthenticated user:', error);
            // 出错时使用默认值
            const defaultCardOrder = ['calories', 'weight'];
            const defaultHiddenCards = ['nutrition', 'water', 'steps', 'exercise', 'measurements', 'emotion', 'sleep', 'bloodGlucose', 'breathing'];
            setDashboardCardOrder(defaultCardOrder);
            setHiddenDashboardCards(defaultHiddenCards);
            
            // ✅ 立即更新 ref
            lastSavedCardOrderRef.current = JSON.stringify(defaultCardOrder);
            lastSavedHiddenCardsRef.current = JSON.stringify(defaultHiddenCards);
            
            setIsLoading(false);
          }
        }
        return;
      }

      if (!userId) {
        setIsLoading(false);
        return;
      }

      // 如果用户切换了，重置加载标记
      if (lastUserIdRef.current !== userId) {
        hasLoadedPreferencesRef.current = false;
        lastUserIdRef.current = userId;
        setIsLoading(true);
      }
      
      // 防止重复加载
      if (hasLoadedPreferencesRef.current) {
        setIsLoading(false);
        return;
      }

      try {
        if (import.meta.env.DEV) {
          console.log('[useAppPreferences] 🔄 Loading dashboard preferences from database...', { userId });
        }
        
        let preferencesTimedOut = false;
        const dbPreferences = await Promise.race([
          getUserPreferences(userId),
          new Promise<null>((resolve) => {
            setTimeout(() => {
              preferencesTimedOut = true;
              resolve(null);
            }, SUPABASE_TABLE_QUERY_TIMEOUT_MS);
          }),
        ]);
        if (preferencesTimedOut && import.meta.env.DEV) {
          console.warn(
            '[useAppPreferences] user_preferences 超时，已改用本地/默认布局（可检查网络/VPN、RLS；或在 .env 设 VITE_SUPABASE_CLIENT_TIMEOUT_MS=60000）'
          );
        }
        
        if (dbPreferences) {
          // 从数据库加载成功
          const uniqueCardOrder = Array.from(new Set(dbPreferences.dashboard_card_order || []));
          const hiddenCards = dbPreferences.hidden_dashboard_cards || [];
          
          // ✅ 确保至少有两个默认卡片（calories 和 weight）
          if (uniqueCardOrder.length === 0) {
            uniqueCardOrder.push('calories', 'weight');
          } else if (!uniqueCardOrder.includes('calories')) {
            uniqueCardOrder.unshift('calories');
          } else if (!uniqueCardOrder.includes('weight')) {
            const caloriesIndex = uniqueCardOrder.indexOf('calories');
            uniqueCardOrder.splice(caloriesIndex + 1, 0, 'weight');
          }
          
          setDashboardCardOrder(uniqueCardOrder);
          setHiddenDashboardCards(hiddenCards);
          
          // ✅ 立即更新 ref，防止自动保存覆盖刚加载的数据
          lastSavedCardOrderRef.current = JSON.stringify(uniqueCardOrder);
          lastSavedHiddenCardsRef.current = JSON.stringify(hiddenCards);
          
          // 同步到localStorage作为缓存
          await Promise.all([
            setUserStorageItem('dashboardCardOrder', uniqueCardOrder),
            setUserStorageItem('hiddenDashboardCards', hiddenCards)
          ]);
          
          if (import.meta.env.DEV) {
            console.log('[useAppPreferences] ✅ Loaded preferences from database:', {
              cardOrder: uniqueCardOrder,
              hiddenCards: hiddenCards,
              cardOrderLength: uniqueCardOrder.length,
              hiddenCardsLength: hiddenCards.length
            });
          }
          
          hasLoadedPreferencesRef.current = true;
          setIsLoading(false);
          return;
        }
        
        // 数据库没有，尝试从localStorage加载
        if (import.meta.env.DEV) {
          console.log('[useAppPreferences] ⚠️ No database preferences, loading from localStorage...');
        }
        const [cardOrder, hiddenCards] = await Promise.all([
          getUserStorageItem<string[]>('dashboardCardOrder'),
          getUserStorageItem<string[]>('hiddenDashboardCards')
        ]);
        
        let finalCardOrder: string[];
        let finalHiddenCards: string[];
        
        if (cardOrder && cardOrder.length > 0) {
          finalCardOrder = Array.from(new Set(cardOrder));
          setDashboardCardOrder(finalCardOrder);
          console.log('[useAppPreferences] ✅ Loaded dashboardCardOrder from localStorage:', finalCardOrder);
        } else {
          // 没有保存的数据，使用默认值
          finalCardOrder = ['calories', 'weight'];
          console.log('[useAppPreferences] ⚠️ No saved dashboardCardOrder found, using defaults');
          setDashboardCardOrder(finalCardOrder);
        }
        
        if (hiddenCards && Array.isArray(hiddenCards)) {
          finalHiddenCards = hiddenCards;
          setHiddenDashboardCards(finalHiddenCards);
          console.log('[useAppPreferences] ✅ Loaded hiddenDashboardCards from localStorage:', finalHiddenCards);
        } else {
          // 没有保存的数据，使用默认值
          finalHiddenCards = ['nutrition', 'water', 'steps', 'exercise', 'measurements', 'emotion', 'sleep', 'bloodGlucose', 'breathing'];
          console.log('[useAppPreferences] ⚠️ No saved hiddenDashboardCards found, using defaults');
          setHiddenDashboardCards(finalHiddenCards);
        }
        
        // ✅ 立即更新 ref，防止自动保存覆盖刚加载的数据
        lastSavedCardOrderRef.current = JSON.stringify(finalCardOrder);
        lastSavedHiddenCardsRef.current = JSON.stringify(finalHiddenCards);
        
        hasLoadedPreferencesRef.current = true;
        setIsLoading(false);
      } catch (error) {
        console.error('[useAppPreferences] ❌ Error loading user preferences:', error);
        // 出错时尝试从localStorage加载
        try {
          const [cardOrder, hiddenCards] = await Promise.all([
            getUserStorageItem<string[]>('dashboardCardOrder'),
            getUserStorageItem<string[]>('hiddenDashboardCards')
          ]);
          
          let fallbackCardOrder: string[];
          let fallbackHiddenCards: string[];
          
          if (cardOrder && cardOrder.length > 0) {
            fallbackCardOrder = Array.from(new Set(cardOrder));
            setDashboardCardOrder(fallbackCardOrder);
          } else {
            fallbackCardOrder = ['calories', 'weight'];
            setDashboardCardOrder(fallbackCardOrder);
          }
          
          if (hiddenCards && Array.isArray(hiddenCards)) {
            fallbackHiddenCards = hiddenCards;
            setHiddenDashboardCards(fallbackHiddenCards);
          } else {
            fallbackHiddenCards = ['nutrition', 'water', 'steps', 'exercise', 'measurements', 'emotion', 'sleep', 'bloodGlucose', 'breathing'];
            setHiddenDashboardCards(fallbackHiddenCards);
          }
          
          // ✅ 立即更新 ref，防止自动保存覆盖刚加载的数据
          lastSavedCardOrderRef.current = JSON.stringify(fallbackCardOrder);
          lastSavedHiddenCardsRef.current = JSON.stringify(fallbackHiddenCards);
          
          hasLoadedPreferencesRef.current = true;
          setIsLoading(false);
        } catch (localError) {
          console.error('[useAppPreferences] ❌ Error loading from localStorage fallback:', localError);
          // 最后的后备：使用默认值
          const defaultCardOrder = ['calories', 'weight'];
          const defaultHiddenCards = ['nutrition', 'water', 'steps', 'exercise', 'measurements', 'emotion', 'sleep', 'bloodGlucose', 'breathing'];
          setDashboardCardOrder(defaultCardOrder);
          setHiddenDashboardCards(defaultHiddenCards);
          
          // ✅ 立即更新 ref
          lastSavedCardOrderRef.current = JSON.stringify(defaultCardOrder);
          lastSavedHiddenCardsRef.current = JSON.stringify(defaultHiddenCards);
          
          hasLoadedPreferencesRef.current = true;
          setIsLoading(false);
        }
      }
    };

    loadUserPreferences();
  }, [isAuthenticated, authLoading, userId]);

  // 自动保存用户偏好（监听状态变化）
  useEffect(() => {
    // 跳过初始挂载时的保存（避免覆盖刚加载的数据）
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedCardOrderRef.current = JSON.stringify(dashboardCardOrder);
      lastSavedHiddenCardsRef.current = JSON.stringify(hiddenDashboardCards);
      return;
    }

    // 如果没有用户ID，只保存到localStorage
    if (!userId || !isAuthenticated) {
      const uniqueCardOrder = Array.from(new Set(dashboardCardOrder));
      const cardOrderString = JSON.stringify(uniqueCardOrder);
      
      if (cardOrderString !== lastSavedCardOrderRef.current) {
        setUserStorageItem('dashboardCardOrder', uniqueCardOrder).catch(error => {
          console.error('[useAppPreferences] Error saving dashboardCardOrder to localStorage:', error);
        });
        lastSavedCardOrderRef.current = cardOrderString;
      }
      return;
    }

    // 去重：确保保存时清理重复的卡片ID
    const uniqueCardOrder = Array.from(new Set(dashboardCardOrder));
    const cardOrderString = JSON.stringify(uniqueCardOrder);
    const hiddenCardsString = JSON.stringify(hiddenDashboardCards);
    
    // 如果和上次保存的值相同，跳过保存
    if (cardOrderString === lastSavedCardOrderRef.current && 
        hiddenCardsString === lastSavedHiddenCardsRef.current) {
      return;
    }

    const savePreferences = async () => {
      try {
        // 同时保存到数据库和localStorage
        await Promise.allSettled([
          saveUserPreferences(userId, {
            dashboard_card_order: uniqueCardOrder,
            hidden_dashboard_cards: hiddenDashboardCards,
          }),
          setUserStorageItem('dashboardCardOrder', uniqueCardOrder),
          setUserStorageItem('hiddenDashboardCards', hiddenDashboardCards),
        ]);

        lastSavedCardOrderRef.current = cardOrderString;
        lastSavedHiddenCardsRef.current = hiddenCardsString;
        
        // 如果去重后数组长度发生变化，更新state
        if (uniqueCardOrder.length !== dashboardCardOrder.length) {
          setDashboardCardOrder(uniqueCardOrder);
        }
      } catch (error) {
        console.error('[useAppPreferences] Error saving preferences:', error);
        // 即使数据库保存失败，也尝试保存到localStorage
        try {
          await Promise.all([
            setUserStorageItem('dashboardCardOrder', uniqueCardOrder),
            setUserStorageItem('hiddenDashboardCards', hiddenDashboardCards),
          ]);
        } catch (localError) {
          console.error('[useAppPreferences] Error saving to localStorage fallback:', localError);
        }
      }
    };

    savePreferences();
  }, [dashboardCardOrder, hiddenDashboardCards, userId, isAuthenticated]);

  // ✅ 使用 ref 保存最新的值，避免竞态条件
  const currentCardOrderRef = useRef<string[]>(dashboardCardOrder);
  const currentHiddenCardsRef = useRef<string[]>(hiddenDashboardCards);
  
  // 同步 ref 和 state
  React.useEffect(() => {
    currentCardOrderRef.current = dashboardCardOrder;
  }, [dashboardCardOrder]);
  
  React.useEffect(() => {
    currentHiddenCardsRef.current = hiddenDashboardCards;
  }, [hiddenDashboardCards]);

  // 更新卡片顺序（自动保存到数据库）
  const updateCardOrder = async (order: string[]) => {
    const uniqueOrder = Array.from(new Set(order));
    
    // ✅ 关键修复：先更新 ref，防止自动保存的 useEffect 使用过时的值
    const orderString = JSON.stringify(uniqueOrder);
    lastSavedCardOrderRef.current = orderString;
    
    // 然后更新 state（这会触发自动保存的 useEffect，但由于 ref 已更新，会被跳过）
    setDashboardCardOrder(uniqueOrder);
    currentCardOrderRef.current = uniqueOrder;
    
    if (userId) {
      try {
        // ✅ 使用 ref 获取最新的 hiddenDashboardCards 值，避免使用过时的 state
        const currentHiddenCards = currentHiddenCardsRef.current;
        const success = await saveUserPreferences(userId, {
          dashboard_card_order: uniqueOrder,
          hidden_dashboard_cards: currentHiddenCards,
        });
        
        if (success) {
          await setUserStorageItem('dashboardCardOrder', uniqueOrder);
        } else {
          await setUserStorageItem('dashboardCardOrder', uniqueOrder);
        }
      } catch (error) {
        console.error('[useAppPreferences] ❌ Error saving card order:', error);
        // 即使数据库保存失败，也保存到 localStorage
        try {
          await setUserStorageItem('dashboardCardOrder', uniqueOrder);
        } catch (localError) {
          console.error('[useAppPreferences] ❌ Error saving to localStorage:', localError);
        }
      }
    } else {
      // 未登录用户，只保存到 localStorage
      try {
        await setUserStorageItem('dashboardCardOrder', uniqueOrder);
      } catch (error) {
        console.error('[useAppPreferences] Error saving card order to localStorage:', error);
      }
    }
  };

  // 更新隐藏卡片（自动保存到数据库）
  const updateHiddenCards = async (cards: string[]) => {
    // ✅ 关键修复：先更新 ref，防止自动保存的 useEffect 使用过时的值
    const cardsString = JSON.stringify(cards);
    lastSavedHiddenCardsRef.current = cardsString;
    
    // 然后更新 state（这会触发自动保存的 useEffect，但由于 ref 已更新，会被跳过）
    setHiddenDashboardCards(cards);
    currentHiddenCardsRef.current = cards;
    
    if (userId) {
      try {
        // ✅ 使用 ref 获取最新的 dashboardCardOrder 值，避免使用过时的 state
        const currentCardOrder = currentCardOrderRef.current;
        const success = await saveUserPreferences(userId, {
          dashboard_card_order: currentCardOrder,
          hidden_dashboard_cards: cards,
        });
        
        if (success) {
          await setUserStorageItem('hiddenDashboardCards', cards);
        } else {
          await setUserStorageItem('hiddenDashboardCards', cards);
        }
      } catch (error) {
        console.error('[useAppPreferences] ❌ Error saving hidden cards:', error);
        // 即使数据库保存失败，也保存到 localStorage
        try {
          await setUserStorageItem('hiddenDashboardCards', cards);
        } catch (localError) {
          console.error('[useAppPreferences] ❌ Error saving to localStorage:', localError);
        }
      }
    } else {
      // 未登录用户，只保存到 localStorage
      try {
        await setUserStorageItem('hiddenDashboardCards', cards);
      } catch (error) {
        console.error('[useAppPreferences] Error saving hidden cards to localStorage:', error);
      }
    }
  };

  return {
    // State
    dashboardCardOrder, // 加载中时显示默认值，加载完成后显示实际值
    hiddenDashboardCards,
    isLoadingPreferences: isLoading, // 导出加载状态（可选，用于显示加载指示器）
    
    // Actions
    setDashboardCardOrder,
    setHiddenDashboardCards,
    updateCardOrder,
    updateHiddenCards,
  };
}

