/**
 * useHealthScores - 健康评分计算Hook
 * 从HealthReportPage.tsx中提取的评分计算逻辑
 */

import { useMemo } from 'react';
import { calculateHealthScores, getImprovementGoal } from '../utils/healthAssessmentScoring';

interface SavedAssessmentData {
  diet_score: number;
  fitness_score: number;
  rest_score: number;
  psychology_score: number;
  exercise_score: number;
  overall_score: number;
  primary_improvement_area: string;
}

interface UseHealthScoresOptions {
  questionnaireData: any;
  savedAssessment: SavedAssessmentData | null;
  isReassessment: boolean;
  isViewingMode: boolean;
}

export function useHealthScores({
  questionnaireData,
  savedAssessment,
  isReassessment,
  isViewingMode,
}: UseHealthScoresOptions) {
  // OPTIMIZATION: Memoize scores calculation to prevent unnecessary recalculations
  // CRITICAL: In reassessment mode, ALWAYS calculate fresh scores from new data
  const scores = useMemo(() => {
    // In reassessment mode, ignore savedAssessment and always calculate fresh
    if (isReassessment) {
      return calculateHealthScores(questionnaireData);
    }

    // In viewing mode with saved assessment, use saved scores
    if (savedAssessment && isViewingMode) {
      return {
        diet: savedAssessment.diet_score,
        fitness: savedAssessment.fitness_score,
        rest: savedAssessment.rest_score,
        psychology: savedAssessment.psychology_score,
        exercise: savedAssessment.exercise_score,
        overall: savedAssessment.overall_score,
        primaryImprovementArea: savedAssessment.primary_improvement_area,
      };
    }

    // First-time onboarding or no saved data - calculate fresh
    return calculateHealthScores(questionnaireData);
  }, [savedAssessment, questionnaireData, isReassessment, isViewingMode]);

  // OPTIMIZATION: Memoize radar data to prevent unnecessary recalculations and re-renders
  const radarData = useMemo(() => [
    { dimension: '饮食', score: scores.diet, fullMark: 100 },
    { dimension: '作息', score: scores.rest, fullMark: 100 },
    { dimension: '体质', score: scores.fitness, fullMark: 100 },
    { dimension: '心理', score: scores.psychology, fullMark: 100 },
    { dimension: '运动', score: scores.exercise, fullMark: 100 },
  ], [scores]);

  const improvementGoal = getImprovementGoal(scores.primaryImprovementArea);

  return {
    scores,
    radarData,
    improvementGoal,
  };
}




