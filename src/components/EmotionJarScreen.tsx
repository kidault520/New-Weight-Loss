import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Heart, ChevronRight } from 'lucide-react';
import { DragPanel } from './common/DragPanel'
import { DetailHeader } from './common/DetailHeader'
import { SectionCard } from './common/SectionCard'
import emotionService, { EmotionStatistics, EmotionRecord, HRVRecord } from '../services/emotionService';
import { supabase } from '../config/supabase';
import { getEmotionEmoji } from '../utils/emotionEmoji';

function emotionRecordToDisplayEmoji(r: EmotionRecord): string {
  const em = r.emotion?.trim() || '';
  if (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(em)) return em;
  return getEmotionEmoji(em) || '😐';
}

interface EmotionJarScreenProps {
  onClose: () => void;
}

type PeriodType = 'weekly' | 'monthly' | 'yearly';

interface MoodStatisticsViewProps {
  userId: string;
}

const MoodStatisticsView: React.FC<MoodStatisticsViewProps> = ({ userId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statistics, setStatistics] = useState<EmotionStatistics | null>(null);
  const [hrvData, setHRVData] = useState<HRVRecord | null>(null);

  const loadStatistics = useCallback(async () => {
    try {
      const stats = await emotionService.getOrCreateStatistics(userId, selectedPeriod, currentDate);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }, [userId, selectedPeriod, currentDate]);

  const loadHRVData = useCallback(async () => {
    try {
      const hrv = await emotionService.getLatestHRV(userId);
      setHRVData(hrv);
    } catch (error) {
      console.error('Error loading HRV data:', error);
    }
  }, [userId]);

  useEffect(() => {
    loadStatistics();
    loadHRVData();
  }, [loadStatistics, loadHRVData]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    if (selectedPeriod === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (selectedPeriod === 'monthly') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    }

    setCurrentDate(newDate);
  };

  const getDateLabel = () => {
    if (selectedPeriod === 'weekly') {
      const weekNum = emotionService.getWeekNumber(currentDate);
      return `${currentDate.getFullYear()}年第${weekNum}周`;
    } else if (selectedPeriod === 'monthly') {
      return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
    } else {
      return `${currentDate.getFullYear()}年`;
    }
  };

  const getPeriodLabel = () => {
    if (selectedPeriod === 'weekly') return '本周';
    if (selectedPeriod === 'monthly') return '本月';
    return '本年';
  };

  const getHRVStatusText = (status?: string) => {
    switch (status) {
      case 'excellent': return '优秀';
      case 'good': return '良好';
      case 'fair': return '一般';
      case 'poor': return '较差';
      default: return '良好';
    }
  };

  const getHRVStatusColor = (status?: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-green-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-green-600';
    }
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'improving') return '↗ 改善';
    if (trend === 'declining') return '↘ 下降';
    return '→ 稳定';
  };

  const getTrendColor = (trend?: string) => {
    if (trend === 'improving') return 'text-green-600';
    if (trend === 'declining') return 'text-red-600';
    return 'text-gray-600';
  };

  const emotionCounts = statistics?.emotion_counts || {};
  const emotionTypes = Object.keys(emotionCounts).length;
  const totalRecords = statistics?.total_records || 0;
  const dopamineMoments = statistics?.dopamine_moments || 0;

  return (
    <div className="pb-24">
      <div className="bg-gray-50 px-4 py-3 mb-2">
        <div className="flex items-center justify-center space-x-4 mb-3">
          <button
            onClick={() => setSelectedPeriod('weekly')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedPeriod === 'weekly'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600'
            }`}
          >
            本周
          </button>
          <button
            onClick={() => setSelectedPeriod('monthly')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedPeriod === 'monthly'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600'
            }`}
          >
            月度
          </button>
          <button
            onClick={() => setSelectedPeriod('yearly')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedPeriod === 'yearly'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600'
            }`}
          >
            年度
          </button>
        </div>

        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => navigatePeriod('prev')}
            className="p-1 text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-800 min-w-[140px] text-center">
            {getDateLabel()}
          </span>
          <button
            onClick={() => navigatePeriod('next')}
            className="p-1 text-gray-600 hover:text-gray-800"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="pb-6">
        <div className="px-4 pt-2">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <SectionCard className="my-1">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800 mb-1">{totalRecords}</div>
                <div className="text-sm text-gray-600 mb-2">心情</div>
                <div className="flex justify-center">
                  <div className="w-8 h-6 bg-pink-200 rounded-lg flex items-center justify-center">
                    <span className="text-lg">💖</span>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard className="my-1">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800 mb-1">{emotionTypes}</div>
                <div className="text-sm text-gray-600 mb-2">心情种类</div>
                <div className="flex justify-center space-x-1">
                  <div className="w-3 h-3 bg-orange-200 rounded"></div>
                  <div className="w-3 h-3 bg-orange-300 rounded"></div>
                  <div className="w-3 h-3 bg-orange-400 rounded"></div>
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="px-4 space-y-1 pb-6">
          <SectionCard className="my-1">
            <h3 className="text-lg font-bold text-gray-800 mb-3">心率变异性</h3>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className={`text-2xl font-bold ${getHRVStatusColor(hrvData?.status)}`}>
                  {getHRVStatusText(hrvData?.status)}
                </div>
                <div className="text-sm text-gray-500">HRV 指数</div>
              </div>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-2xl">💚</span>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              您的心率变异性表现良好，说明身心状态比较平衡。
            </div>
          </SectionCard>

          <SectionCard className="my-1">
            <h3 className="text-lg font-bold text-gray-800 mb-3">心情趋势</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{getPeriodLabel()}平均</span>
                <span className="text-lg">😊</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">上期对比</span>
                <span className={`text-sm font-medium ${getTrendColor(statistics?.trend_direction)}`}>
                  {getTrendIcon(statistics?.trend_direction)}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="my-1">
            <h3 className="text-lg font-bold text-gray-800 mb-3">情感洞察</h3>
            <div className="space-y-3">
              {statistics?.insights && statistics.insights.length > 0 ? (
                statistics.insights.map((insight, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <span className="text-xl">💡</span>
                    <div>
                      <div className="font-medium text-gray-800">情绪模式识别</div>
                      <div className="text-sm text-gray-600">{insight}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start space-x-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <div className="font-medium text-gray-800">情绪模式识别</div>
                    <div className="text-sm text-gray-600">继续记录心情以获取更多洞察</div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard className="my-1">
            <div className="flex items-center space-x-2 mb-4">
              <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">多巴胺时刻</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-4xl">😄</div>
                <span className="text-lg text-gray-700">{getPeriodLabel()}有 {dopamineMoments} 次开心</span>
              </div>
              <button className="bg-green-500 text-white px-6 py-2 rounded-full text-sm font-medium">
                去回忆
              </button>
            </div>
          </SectionCard>

          <SectionCard className="my-1">
            <div className="flex items-center space-x-2 mb-4">
              <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">心情波动</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-3xl font-bold text-green-600">{totalRecords}</span>
                <span className="text-gray-600">条心情</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="text-sm text-gray-500 mb-4">{getDateLabel()}</div>

            <div className="relative h-32 mb-4">
              <div className="absolute left-0 top-0 flex flex-col justify-between h-full text-xs">
                <span>😊</span>
                <span>😐</span>
                <span>😢</span>
              </div>

              <div className="ml-8 h-full flex items-end justify-between">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-1 h-16 bg-gradient-to-t from-blue-400 to-green-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-1 h-8 bg-gradient-to-t from-purple-400 to-blue-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-1 h-24 bg-gradient-to-t from-red-400 to-orange-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-1 h-20 bg-gradient-to-t from-blue-400 to-green-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="ml-8 flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>5</span>
              <span>10</span>
              <span>15</span>
              <span>20</span>
              <span>25</span>
              <span>30</span>
            </div>
          </SectionCard>

          <SectionCard className="my-1">
            <div className="flex items-center space-x-2 mb-6">
              <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">心情统计</span>
            </div>

            <div className="flex items-center space-x-8">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="8"
                          strokeDasharray="75 251" strokeDashoffset="0"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#06b6d4" strokeWidth="8"
                          strokeDasharray="50 251" strokeDashoffset="-75"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="8"
                          strokeDasharray="25 251" strokeDashoffset="-125"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#8b5cf6" strokeWidth="8"
                          strokeDasharray="25 251" strokeDashoffset="-150"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#a855f7" strokeWidth="8"
                          strokeDasharray="25 251" strokeDashoffset="-175"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#9ca3af" strokeWidth="8"
                          strokeDasharray="75 251" strokeDashoffset="-200"/>
                </svg>
              </div>

              <div className="flex-1 space-y-2">
                {Object.entries(emotionCounts).map(([emotion, count]) => (
                  <div key={emotion} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <span className="text-sm text-gray-600">{emotion}</span>
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

/** 心情罐右上角快捷：常用 5 个表情，点选即写入当天 health_records（record_type = emotion） */
const QUICK_MOOD_EMOJIS: { emoji: string; intensity: number }[] = [
  { emoji: '😊', intensity: 4 },
  { emoji: '😢', intensity: 2 },
  { emoji: '😌', intensity: 3 },
  { emoji: '😤', intensity: 2 },
  { emoji: '🥰', intensity: 5 },
];

const EmotionJarScreen: React.FC<EmotionJarScreenProps> = ({ onClose }) => {
  const [isViewingStatistics, setIsViewingStatistics] = useState(false);
  const [quickMoodOpen, setQuickMoodOpen] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [emotionRefreshTick, setEmotionRefreshTick] = useState(0);
  const [monthRecords, setMonthRecords] = useState<EmotionRecord[]>([]);
  const [jarShaking, setJarShaking] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    let cancelled = false;
    void emotionService.getEmotionRecords(userId, start, end).then((rows) => {
      if (!cancelled) setMonthRecords(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, currentYear, currentMonth, emotionRefreshTick]);

  const dayEmojiMap = useMemo(() => {
    const map: Record<number, string> = {};
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    const byDay = new Map<number, EmotionRecord[]>();
    for (const r of monthRecords) {
      const d = new Date(r.recorded_at);
      if (d < start || d > end) continue;
      const dom = d.getDate();
      const arr = byDay.get(dom) ?? [];
      arr.push(r);
      byDay.set(dom, arr);
    }
    byDay.forEach((arr, dom) => {
      arr.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      map[dom] = emotionRecordToDisplayEmoji(arr[0]);
    });
    return map;
  }, [monthRecords, currentYear, currentMonth]);

  /** 当前展示月内全部心情记录（含同日多条），按时间顺序叠放在罐内 */
  const jarMoodItems = useMemo(() => {
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    return monthRecords
      .filter((r) => {
        const d = new Date(r.recorded_at);
        return d >= start && d <= end;
      })
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((r, i) => ({
        key: r.id || `mood-${r.recorded_at}-${i}`,
        emoji: emotionRecordToDisplayEmoji(r),
      }));
  }, [monthRecords, currentYear, currentMonth]);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const firstDow = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDow, daysInMonth]);

  const handleQuickMoodPick = async (emoji: string, intensity: number) => {
    if (!userId || quickSaving) return;
    setQuickSaving(true);
    try {
      const rec = await emotionService.addEmotionRecord(userId, emoji, intensity, '心情罐快捷');
      if (rec) {
        setEmotionRefreshTick((t) => t + 1);
        setQuickMoodOpen(false);
      }
    } catch (e) {
      console.error('Quick mood save failed:', e);
    } finally {
      setQuickSaving(false);
    }
  };

  return (
    <DragPanel show={true} onClose={onClose} zIndex={60} mask={{ visible: false }}
      header={<DetailHeader title={isViewingStatistics ? '心情统计' : `${currentYear}年${currentMonth}月`} leftAction={{ label: '返回', onClick: onClose }} rightAction={isViewingStatistics ? undefined : { icon: <Heart className="w-5 h-5 text-pink-500" />, onClick: () => setQuickMoodOpen((v) => !v) }} />}
    >
        {!isViewingStatistics && quickMoodOpen && (
          <div className="px-4 py-3 bg-pink-50/95 border-b border-pink-100 flex flex-wrap items-center justify-center gap-2 shrink-0">
            <span className="text-xs text-pink-700 w-full text-center mb-0.5">点选投送进当天心情罐</span>
            {QUICK_MOOD_EMOJIS.map(({ emoji, intensity }) => (
              <button
                key={emoji}
                type="button"
                disabled={quickSaving}
                onClick={() => void handleQuickMoodPick(emoji, intensity)}
                className="text-3xl w-12 h-12 rounded-2xl bg-white shadow-sm border border-pink-100 active:scale-95 disabled:opacity-50"
                aria-label={`记录心情 ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="px-4 space-y-1 flex-1 overflow-y-auto pb-4 scrollbar-hide">
          {isViewingStatistics ? (
            <MoodStatisticsView userId={userId} />
          ) : (
            <div className="pb-24">
              <div className="mb-2 px-2 pt-1">
                <div className="mx-auto w-full max-w-[min(300px,90vw)]">
                  <div
                    className="relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 rounded-2xl"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setJarShaking(true);
                      window.setTimeout(() => setJarShaking(false), 600);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setJarShaking(true);
                        window.setTimeout(() => setJarShaking(false), 600);
                      }
                    }}
                    aria-label="心情罐"
                  >
                    <div className="relative mx-auto aspect-square w-full">
                      <div
                        className={`absolute left-[11%] right-[11%] top-[20%] bottom-[28%] z-0 flex flex-wrap content-end justify-center gap-0.5 overflow-hidden px-0.5 pb-0.5 ${
                          jarShaking ? 'emotion-jar-shake' : ''
                        }`}
                      >
                        {jarMoodItems.map(({ key, emoji }) => (
                          <span
                            key={key}
                            className="select-none text-[clamp(0.85rem,3.6vw,1.45rem)] leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
                          >
                            {emoji}
                          </span>
                        ))}
                      </div>
                      <img
                        src="/jimeng-guanzi3.png"
                        alt=""
                        className="pointer-events-none relative z-10 h-full w-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 mb-3">
                <div className="bg-white/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="text-lg font-bold text-gray-800 shrink-0">心情日历</h3>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button
                        type="button"
                        className="text-xs text-pink-600 shrink-0 px-2 py-1 rounded-full bg-pink-50"
                        onClick={() => setIsViewingStatistics(true)}
                      >
                        统计
                      </button>
                      <div className="flex items-center space-x-2">
                      <button
                        className="p-1 text-gray-500 hover:text-gray-700"
                        onClick={() => {
                          if (currentMonth === 1) {
                            setCurrentMonth(12);
                            setCurrentYear(currentYear - 1);
                          } else {
                            setCurrentMonth(currentMonth - 1);
                          }
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-700 font-medium">{currentYear}年{currentMonth}月</span>
                      <button
                        className="p-1 text-gray-500 hover:text-gray-700"
                        onClick={() => {
                          if (currentMonth === 12) {
                            setCurrentMonth(1);
                            setCurrentYear(currentYear + 1);
                          } else {
                            setCurrentMonth(currentMonth + 1);
                          }
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-2 mb-3">
                    {weekDays.map((day) => (
                      <div key={day} className="text-center text-xs text-gray-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {calendarCells.map((day, idx) => (
                      <div
                        key={`c-${idx}-${day ?? 'x'}`}
                        className="flex min-h-[2.75rem] flex-col items-center justify-end pb-0.5"
                      >
                        {day == null ? (
                          <span className="text-xs text-transparent">.</span>
                        ) : (
                          <>
                            {dayEmojiMap[day] ? (
                              <div className="text-lg leading-none" aria-hidden>
                                {dayEmojiMap[day]}
                              </div>
                            ) : (
                              <span className="h-5" aria-hidden />
                            )}
                            <span className="mt-0.5 text-[11px] text-gray-500">{day}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes emotion-jar-shake-kf {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            18% { transform: translate(-3px, 1px) rotate(-3deg); }
            36% { transform: translate(3px, -1px) rotate(3deg); }
            54% { transform: translate(-2px, 2px) rotate(-2deg); }
            72% { transform: translate(2px, -2px) rotate(2deg); }
            88% { transform: translate(-1px, 0) rotate(-1deg); }
          }
          .emotion-jar-shake {
            animation: emotion-jar-shake-kf 0.55s ease-in-out;
          }
        `}</style>
    </DragPanel>
  );
};

export default EmotionJarScreen;
