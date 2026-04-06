 
import { supabase } from '../config/supabase';
import { OnboardingData } from '../contexts/OnboardingContext';
import { calculateHealthScores } from '../utils/healthAssessmentScoring';

export interface HealthAssessmentData {
  id?: string;
  user_id: string;
  assessment_date: string;
  diet_score: number;
  fitness_score: number;
  rest_score: number;
  psychology_score: number;
  exercise_score: number;
  overall_score: number;
  primary_improvement_area: string;
  questionnaire_data: OnboardingData;
}

export const healthAssessmentService = {
  /**
   * CRITICAL: Creates a NEW health assessment record (NEVER updates existing)
   * Each assessment is an independent snapshot at a specific point in time
   * - First-time onboarding: Creates initial assessment
   * - Reassessment: Creates NEW independent record (old records remain unchanged)
   *
   * @param data - The onboarding questionnaire data from current session
   * @param isReassessment - Optional flag to indicate this is a reassessment (for logging)
   * @returns Promise with new assessment data or error
   */
  async createAssessment(
    data: OnboardingData,
    isReassessment: boolean = false
  ): Promise<{ data: HealthAssessmentData | null; error: any }> {
    try {
      console.log('🔷 [healthAssessmentService] createAssessment called', {
        isReassessment,
        hasData: !!data,
        dataKeys: Object.keys(data || {})
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ [healthAssessmentService] No authenticated user');
        return { data: null, error: new Error('User not authenticated') };
      }

      console.log('👤 [healthAssessmentService] User:', user.id);

      // Validate required data fields
      if (!data.nickname || !data.age || !data.currentWeight || !data.height) {
        console.error('❌ [healthAssessmentService] Missing required fields:', {
          hasNickname: !!data.nickname,
          hasAge: !!data.age,
          hasCurrentWeight: !!data.currentWeight,
          hasHeight: !!data.height
        });
        return {
          data: null,
          error: new Error('Missing required assessment data')
        };
      }

      // Calculate scores from questionnaire data
      const scores = calculateHealthScores(data);
      console.log('📊 [healthAssessmentService] Calculated scores:', scores);

      // CRITICAL: Create immutable snapshot of questionnaire data
      // This prevents future modifications to the context from affecting this record
      const questionnaireSnapshot = JSON.parse(JSON.stringify(data));
      console.log('📸 [healthAssessmentService] Created immutable data snapshot');

      const assessmentData: Omit<HealthAssessmentData, 'id'> = {
        user_id: user.id,
        assessment_date: new Date().toISOString(),
        diet_score: scores.diet,
        fitness_score: scores.fitness,
        rest_score: scores.rest,
        psychology_score: scores.psychology,
        exercise_score: scores.exercise,
        overall_score: scores.overall,
        primary_improvement_area: scores.primaryImprovementArea,
        questionnaire_data: questionnaireSnapshot,
      };

      console.log('📤 [healthAssessmentService] Inserting NEW assessment record (NEVER updating)...');
      console.log('📝 [healthAssessmentService] Assessment type:', isReassessment ? 'REASSESSMENT' : 'FIRST_TIME');

      // CRITICAL: This is ALWAYS an INSERT, NEVER an UPDATE
      // Each assessment creates a completely independent record
      const { data: result, error } = await supabase
        .from('health_assessments')
        .insert(assessmentData)
        .select()
        .single();

      if (error) {
        console.error('❌ [healthAssessmentService] Insert failed:', error);
        return { data: null, error };
      }

      console.log('✅ [healthAssessmentService] NEW assessment record created successfully!');
      console.log('🆔 [healthAssessmentService] New Assessment ID:', result.id);
      console.log('📅 [healthAssessmentService] Assessment Date:', result.assessment_date);
      console.log('📊 [healthAssessmentService] Overall Score:', result.overall_score);

      return { data: result, error: null };
    } catch (error) {
      console.error('❌ [healthAssessmentService] FATAL: Error creating health assessment:', error);
      return { data: null, error };
    }
  },

  async getLatestAssessment(): Promise<{ data: HealthAssessmentData | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: new Error('User not authenticated') };
      }

      const { data, error } = await supabase
        .from('health_assessments')
        .select('*')
        .eq('user_id', user.id)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      return { data, error };
    } catch (error) {
      console.error('Error fetching latest assessment:', error);
      return { data: null, error };
    }
  },

  async getAllAssessments(): Promise<{ data: HealthAssessmentData[] | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: new Error('User not authenticated') };
      }

      const { data, error } = await supabase
        .from('health_assessments')
        .select('*')
        .eq('user_id', user.id)
        .order('assessment_date', { ascending: false });

      return { data, error };
    } catch (error) {
      console.error('Error fetching all assessments:', error);
      return { data: null, error };
    }
  },

  async getAssessmentById(id: string): Promise<{ data: HealthAssessmentData | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: new Error('User not authenticated') };
      }

      const { data, error } = await supabase
        .from('health_assessments')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      return { data, error };
    } catch (error) {
      console.error('Error fetching assessment by ID:', error);
      return { data: null, error };
    }
  },

  async deleteAssessment(id: string): Promise<{ error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { error: new Error('User not authenticated') };
      }

      const { error } = await supabase
        .from('health_assessments')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      return { error };
    } catch (error) {
      console.error('Error deleting assessment:', error);
      return { error };
    }
  },
};
