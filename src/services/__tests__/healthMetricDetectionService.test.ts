import { describe, it, expect } from 'vitest';
import { CONFIDENCE_SCORE } from '../../config/healthMetricDetectionConfig';
import {
  healthMetricDetectionService,
  sortDetectionResultsByPriority,
} from '../healthMetricDetectionService';

describe('healthMetricDetectionService.detectMultipleMetrics', () => {
  it('识别「一杯」短答为饮水（中文数字转阿拉伯后）', () => {
    const r = healthMetricDetectionService.detectMultipleMetrics('一杯');
    expect(r.length).toBeGreaterThanOrEqual(1);
    const w = r.find((x) => x.data?.metricType === 'water');
    expect(w?.detected).toBe(true);
    expect(w?.data?.value).toBe(250);
    expect(w?.data?.unit).toBe('ml');
    expect(w?.confidence).toBe(CONFIDENCE_SCORE.low);
  });

  it('识别 500ml 饮水', () => {
    const r = healthMetricDetectionService.detectMultipleMetrics('喝了500ml水');
    const w = r.find((x) => x.data?.metricType === 'water');
    expect(w?.data?.value).toBe(500);
    expect(w?.confidence).toBe(CONFIDENCE_SCORE.high);
  });

  it('纯问句「今天吃了什么」不产生饮食卡片', () => {
    const r = healthMetricDetectionService.detectMultipleMetrics('今天吃了什么');
    const food = r.filter((x) => x.data?.metricType === 'food');
    expect(food.length).toBe(0);
  });

  it('显式血糖数值建卡', () => {
    const r = healthMetricDetectionService.detectMultipleMetrics('血糖5.6');
    const bg = r.find((x) => x.data?.metricType === 'blood_glucose');
    expect(bg?.detected).toBe(true);
    expect(bg?.data?.value).toBe(5.6);
    expect(bg?.confidence).toBe(CONFIDENCE_SCORE.high);
  });

  it('多指标拆句：包子与水分开', () => {
    const r = healthMetricDetectionService.detectMultipleMetrics('吃了两个包子，还有500毫升的水');
    const types = new Set(r.map((x) => x.data?.metricType).filter(Boolean));
    expect(types.has('food')).toBe(true);
    expect(types.has('water')).toBe(true);
  });
});

describe('sortDetectionResultsByPriority', () => {
  it('饮水排在饮食之前', () => {
    const a = {
      detected: true as const,
      confidence: 0.85,
      data: { metricType: 'food' as const, value: 1, foodName: '包子', calories: 200, mealType: '早餐', quantity: 1, unit: '个', date: new Date() },
    };
    const b = {
      detected: true as const,
      confidence: 0.85,
      data: { metricType: 'water' as const, value: 250, unit: 'ml' as const, date: new Date() },
    };
    const sorted = sortDetectionResultsByPriority([a, b]);
    expect(sorted[0].data?.metricType).toBe('water');
    expect(sorted[1].data?.metricType).toBe('food');
  });
});
