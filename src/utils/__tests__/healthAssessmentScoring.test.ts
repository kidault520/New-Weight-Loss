import { describe, expect, it } from 'vitest';
import {
  calculateHealthScores,
  calculateHealthScoreBreakdown,
  getDimensionLabel,
  getImprovementGoal,
} from '../healthAssessmentScoring';

describe('healthAssessmentScoring', () => {
  it('returns deterministic overall score and improvement area', () => {
    const scores = calculateHealthScores({
      age: 30,
      height: 170,
      currentWeight: 70,
      targetWeight: 65,
      activityLevel: 'moderate',
      dietaryPreferences: ['balanced'],
      exerciseHabits: ['walking', 'yoga'],
      sleepHours: 7.5,
      waterIntake: 8,
      healthConcerns: [],
      fitnessGoal: 'weight_loss',
    });

    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.overall).toBeLessThanOrEqual(100);
    expect(['饮食', '体质', '作息', '心理', '运动']).toContain(scores.primaryImprovementArea);
  });

  it('provides explainable rule breakdown for each dimension', () => {
    const breakdown = calculateHealthScoreBreakdown({
      age: 35,
      height: 168,
      currentWeight: 88,
      activityLevel: 'light',
      dietaryPreferences: ['high_protein'],
      exerciseHabits: ['running'],
      sleepHours: 6,
      waterIntake: 5,
      healthConcerns: ['stress'],
      fitnessGoal: 'maintain_health',
    });

    expect(breakdown.diet.length).toBeGreaterThan(1);
    expect(breakdown.fitness.length).toBeGreaterThan(1);
    expect(breakdown.rest.length).toBeGreaterThan(1);
    expect(breakdown.psychology.length).toBeGreaterThan(1);
    expect(breakdown.exercise.length).toBeGreaterThan(1);
  });

  it('keeps label and goal mapping consistent', () => {
    expect(getDimensionLabel('diet')).toBe('饮食');
    expect(getImprovementGoal('饮食')).toBe('免疫力');
  });
});

