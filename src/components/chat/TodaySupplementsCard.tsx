/**
 * 今日补剂卡片 - 待办形式展示补剂明细
 * 格式：○ 补剂名 X片/颗/袋（与定制补剂页一致）
 * 无 custom_supplements 时显示订单补剂（与定制补剂页 INFORMATIONAL_CARDS 一致）
 * 摄入状态持久化到 userStorage，与餐食一致，避免关闭重开后恢复
 */

import { useState, useEffect } from 'react';
import { X, Pill, Circle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useChatContext } from '../../contexts/ChatContext';
import { useExecutionProgram } from '../../hooks/useExecutionProgram';
import { useBeijingDateKey } from '../../hooks/useBeijingDateKey';
import { getUserStorageItem, setUserStorageItem } from '../../utils/userStorage';
import { supabase } from '../../config/supabase';
import { supplementStageService } from '../../services/supplementStageService';
import { buildCurrentStageSupplementItems } from '../../utils/supplementStageUtils';
import { DEFAULT_AI_COMPANION_NAME } from '../../services/aiSettingsService';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { INTAKE_PLAN_INACTIVE_USER_MESSAGE } from '../../utils/intakePlanGate';

const SUPPLEMENTS_INGESTED_KEY = 'today-supplements-ingested';
const CARD_FEEDBACK_DELAY_MS = 2000;
const TODAY_SUPPLEMENTS_STAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const todaySupplementsStageCache = new Map<
  string,
  {
    ts: number;
    items: Array<{ id: string; name: string; dosage: string }>;
    fetchInfo: { loaded: boolean; hasPlan: boolean; stagesCount: number } | null;
  }
>();

interface CustomSupplement {
  id: string;
  supplement_name: string;
  dosage: string;
  frequency: string;
  status: string;
}

/** 从 dosage 或 frequency 解析出用量文案，如 "×2片" "×1颗" "×1袋"（与定制补剂页一致） */
function parseDosageDisplay(dosage: string, frequency: string): string {
  const d = dosage?.trim();
  if (d) {
    const m = d.match(/(\d+)\s*[片颗粒袋]/);
    if (m) return `×${m[1]}${m[0].replace(m[1], '').trim()}`;
    const numOnly = d.match(/^(\d+)$/);
    if (numOnly) return `×${numOnly[1]}片`;
    return d;
  }
  const m = frequency?.match(/(\d+)\s*[片颗粒袋]/);
  if (m) return `×${m[1]}${m[0].replace(m[1], '').trim()}`;
  if (frequency?.trim()) return frequency.trim();
  return '×1片';
}

export interface TodaySupplementsCardProps {
  onClose: () => void;
}

export default function TodaySupplementsCard({ onClose }: TodaySupplementsCardProps) {
  const { user } = useAuth();
  const { intakePlanActive } = useUserProfile();
  const { addFeedbackMessage, ownerName, aiName } = useChatContext();
  const { hasOrder, isLoadingOrder } = useExecutionProgram();
  const hasActiveOrder = !isLoadingOrder && !!hasOrder;
  const [ingestedIds, setIngestedIds] = useState<Set<string>>(new Set());
  const [stageItems, setStageItems] = useState<Array<{ id: string; name: string; dosage: string }>>([]);
  const [stageLoading, setStageLoading] = useState(false);
  /** 订单补剂接口返回摘要，用于区分「无方案 / 未配阶段 / 当前阶段无明细」 */
  const [stageFetchInfo, setStageFetchInfo] = useState<{
    loaded: boolean;
    hasPlan: boolean;
    stagesCount: number;
  } | null>(null);
  const todayKey = useBeijingDateKey();
  /** 有有效订单即视为已接入，避免执行计划同步延迟导致“有单却显示暂无补剂” */
  const isJourneyStarted = !isLoadingOrder && !!hasOrder;

  // 从 userStorage 恢复今日已摄入状态（跨关闭重开保持）
  useEffect(() => {
    getUserStorageItem<{ dateKey: string; ingestedIds: string[] }>(SUPPLEMENTS_INGESTED_KEY).then(
      (saved) => {
        if (saved?.dateKey === todayKey && Array.isArray(saved.ingestedIds)) {
          setIngestedIds(new Set(saved.ingestedIds));
        }
      }
    );
  }, [todayKey]);

  useEffect(() => {
    let mounted = true;
    if (!isJourneyStarted) {
      setStageItems([]);
      setStageFetchInfo(null);
      setStageLoading(false);
      return;
    }

    const cacheKey = `${user?.id || 'anon'}:${todayKey}`;
    const cached = todaySupplementsStageCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TODAY_SUPPLEMENTS_STAGE_CACHE_TTL_MS) {
      setStageItems(cached.items);
      setStageFetchInfo(cached.fetchInfo);
      setStageLoading(false);
      return () => {
        mounted = false;
      };
    }

    setStageLoading(true);
    // 起算日以订单 payment_time/start_time 为准（北京日），避免仅买补剂时误用餐食配置的 startDate
    supplementStageService.getActiveSupplementStage()
      .then((resp) => {
        if (!mounted) {
          return;
        }
        setStageFetchInfo({
          loaded: true,
          hasPlan: !!resp?.has_plan,
          stagesCount: Array.isArray(resp?.stages) ? resp.stages.length : 0,
        });
        const mapped = buildCurrentStageSupplementItems(resp);
        const nextItems = mapped.length > 0 ? mapped : [];
        const nextFetchInfo = {
          loaded: true,
          hasPlan: !!resp?.has_plan,
          stagesCount: Array.isArray(resp?.stages) ? resp.stages.length : 0,
        };
        setStageItems(nextItems);
        todaySupplementsStageCache.set(cacheKey, {
          ts: Date.now(),
          items: nextItems,
          fetchInfo: nextFetchInfo,
        });
      })
      .catch(() => {
        if (!mounted) return;
        const nextFetchInfo = { loaded: true, hasPlan: false, stagesCount: 0 };
        setStageFetchInfo(nextFetchInfo);
        setStageItems([]);
        todaySupplementsStageCache.set(cacheKey, {
          ts: Date.now(),
          items: [],
          fetchInfo: nextFetchInfo,
        });
      })
      .finally(() => {
        if (!mounted) return;
        setStageLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isJourneyStarted, user?.id, todayKey]);

  const { data: supplements = [], isLoading } = useQuery({
    queryKey: ['today-supplements', user?.id, todayKey],
    queryFn: async (): Promise<CustomSupplement[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('custom_supplements')
        .select('id, supplement_name, dosage, frequency, status')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return (data || []) as CustomSupplement[];
    },
    enabled: !!user?.id && isJourneyStarted,
  });

  const activeSupplements = supplements.filter((s) => s.status === 'active');
  const displayItems = !isJourneyStarted
    ? []
    : activeSupplements.length > 0
      ? activeSupplements.map((s) => ({
          id: s.id,
          name: s.supplement_name,
          dosage: parseDosageDisplay(s.dosage, s.frequency),
        }))
      : stageItems;

  const handleIngested = async (id: string, name: string) => {
    setIngestedIds((prev) => {
      const next = new Set(prev).add(id);
      setUserStorageItem(SUPPLEMENTS_INGESTED_KEY, {
        dateKey: todayKey,
        ingestedIds: Array.from(next),
      }).catch(() => {});
      return next;
    });
    await new Promise((resolve) => setTimeout(resolve, CARD_FEEDBACK_DELAY_MS));
    await addFeedbackMessage(`${aiName || DEFAULT_AI_COMPANION_NAME}已完成[补剂：${name}]摄入记录，${ownerName || '主人'}加油！`);
  };

  return (
    <div className="mb-3 rounded-2xl bg-white shadow-lg overflow-hidden">
      <div className="px-3 py-2.5 flex items-center justify-between bg-gradient-to-r from-teal-50 via-teal-50 to-teal-50/90 border-b border-teal-200/50">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600/85" strokeWidth={1.75} />
          <span className="font-semibold text-stone-800">今日补剂</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-teal-100/80">
          <X className="w-4 h-4 text-stone-500" />
        </button>
      </div>
      <div className="px-3 py-3">
        {!isJourneyStarted ? (
          <p className="text-sm text-gray-500 py-4 text-center">今日暂无补剂计划</p>
        ) : hasActiveOrder && !intakePlanActive ? (
          <p className="text-sm text-gray-600 py-4 text-center px-2 leading-relaxed">{INTAKE_PLAN_INACTIVE_USER_MESSAGE}</p>
        ) : (isLoading || stageLoading) ? (
          <p className="text-sm text-gray-500 py-4 text-center">正在同步今日补剂...</p>
        ) : displayItems.length === 0 ? (
          <div className="py-4 px-3 text-center">
            {stageFetchInfo?.loaded && stageFetchInfo.hasPlan && stageFetchInfo.stagesCount === 0 ? (
              <>
                <p className="text-sm text-gray-500">补剂方案尚未配置阶段</p>
                <p className="text-xs text-gray-400 mt-1">请联系运营配置，或稍后在「定制补剂」查看</p>
              </>
            ) : stageFetchInfo?.loaded && stageFetchInfo.hasPlan && stageFetchInfo.stagesCount > 0 ? (
              <>
                <p className="text-sm text-gray-500">当前阶段暂无补剂明细</p>
                <p className="text-xs text-gray-400 mt-1">请稍后再试或前往定制补剂查看</p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">今日补剂暂未生成</p>
                <p className="text-xs text-gray-400 mt-1">请稍后重试或前往定制补剂查看方案</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {displayItems.map((item) => {
              const isIngested = ingestedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 py-2 px-2 rounded-lg ${
                    isIngested ? 'bg-stone-50/90 opacity-75' : 'bg-white'
                  }`}
                >
                  {isIngested ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-teal-600/70 shrink-0" strokeWidth={2} />
                  )}
                  <span className={`font-medium flex-1 ${isIngested ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                    {item.name}
                  </span>
                  <span className="text-sm text-gray-600 shrink-0">{item.dosage}</span>
                  {!isIngested && (
                    <button
                      onClick={() => handleIngested(item.id, item.name)}
                      className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg bg-teal-600 text-white shadow-sm hover:bg-teal-700 active:bg-teal-800"
                    >
                      已摄入
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
