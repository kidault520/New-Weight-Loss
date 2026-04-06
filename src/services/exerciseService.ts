import { supabase } from '../config/supabase';

export interface ExerciseRecord {
  id?: string;
  user_id?: string;
  exercise_name: string;
  exercise_type?: string;
  duration: number;
  calories_burned: number;
  intensity?: string;
  notes?: string;
  recorded_at: string;
  icon?: string;
  originalId?: string;
  source?: 'ai' | 'manual';
}

function buildExerciseDataPayload(exercise: ExerciseRecord): Record<string, unknown> {
  return {
    name: exercise.exercise_name,
    exercise_type: exercise.exercise_type || 'other',
    duration: exercise.duration,
    calories_burned: exercise.calories_burned,
    intensity: exercise.intensity || 'moderate',
    icon: exercise.icon,
    originalId: exercise.originalId,
    source: exercise.source || 'manual',
  };
}

const mapHealthRowToExerciseRecord = (row: any): ExerciseRecord => {
  const ed = row.exercise_data && typeof row.exercise_data === 'object' ? row.exercise_data : {};
  let parsedNotes: { icon?: string; originalId?: string } = {};
  const isLikelyJSON = (s: string) => {
    const t = s.trim();
    return t.startsWith('{') || t.startsWith('[');
  };
  if (row.notes && typeof row.notes === 'string' && isLikelyJSON(row.notes)) {
    try {
      parsedNotes = JSON.parse(row.notes);
    } catch {
      parsedNotes = {};
    }
  }

  let source: 'ai' | 'manual' = (ed.source as 'ai' | 'manual') || 'manual';
  if (ed.source !== 'ai' && ed.source !== 'manual' && row.notes) {
    const notesStr = typeof row.notes === 'string' ? row.notes : JSON.stringify(row.notes);
    if (notesStr.includes('AI记录') || notesStr.includes('AI创建') || notesStr.includes('AI识别')) {
      source = 'ai';
    }
  }

  return {
    id: row.id,
    user_id: row.user_id,
    exercise_name: (ed.name as string) || '运动',
    exercise_type: (ed.exercise_type as string) || 'other',
    duration: Number(ed.duration) || 0,
    calories_burned: Number(ed.calories_burned ?? row.value ?? 0) || 0,
    intensity: ed.intensity as string | undefined,
    notes: row.notes,
    recorded_at: row.recorded_at,
    icon: (ed.icon as string) || parsedNotes.icon,
    originalId: (ed.originalId as string) || parsedNotes.originalId,
    source,
  };
};

export const exerciseService = {
  async addExercise(exercise: ExerciseRecord) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const exerciseData = buildExerciseDataPayload({ ...exercise, source: exercise.source || 'manual' });

    const { data, error } = await supabase
      .from('health_records')
      .insert({
        user_id: user.id,
        record_type: 'exercise',
        value: exercise.calories_burned ?? 0,
        unit: 'kcal',
        exercise_data: exerciseData,
        notes:
          exercise.notes ||
          JSON.stringify({
            icon: exercise.icon,
            originalId: exercise.originalId,
          }),
        recorded_at: exercise.recorded_at,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding exercise:', error);
      throw error;
    }

    return mapHealthRowToExerciseRecord(data);
  },

  async addMultipleExercises(exercises: ExerciseRecord[]) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const rows = exercises.map((exercise) => {
      const exerciseData = buildExerciseDataPayload({ ...exercise, source: exercise.source || 'manual' });
      return {
        user_id: user.id,
        record_type: 'exercise' as const,
        value: exercise.calories_burned ?? 0,
        unit: 'kcal',
        exercise_data: exerciseData,
        notes:
          exercise.notes ||
          JSON.stringify({
            icon: exercise.icon,
            originalId: exercise.originalId,
          }),
        recorded_at: exercise.recorded_at,
      };
    });

    const { data, error } = await supabase.from('health_records').insert(rows).select();

    if (error) {
      console.error('Error adding exercises:', error);
      throw error;
    }

    return (data || []).map(mapHealthRowToExerciseRecord);
  },

  async getExercisesByDateRange(startDate: string, endDate: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('health_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('record_type', 'exercise')
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('Error fetching exercises:', error);
      throw error;
    }

    return (data || []).map(mapHealthRowToExerciseRecord);
  },

  async getExercisesByDate(date: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('health_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('record_type', 'exercise')
      .gte('recorded_at', startOfDay.toISOString())
      .lte('recorded_at', endOfDay.toISOString())
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('Error fetching exercises:', error);
      throw error;
    }

    return (data || []).map(mapHealthRowToExerciseRecord);
  },

  async deleteExercise(id: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('health_records')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('record_type', 'exercise');

    if (error) {
      console.error('Error deleting exercise:', error);
      throw error;
    }
  },

  async updateExercise(id: string, updates: Partial<ExerciseRecord>) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: existing, error: fetchError } = await supabase
      .from('health_records')
      .select('exercise_data, notes')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('record_type', 'exercise')
      .maybeSingle();

    if (fetchError) {
      console.error('Error loading exercise for update:', fetchError);
      throw fetchError;
    }
    if (!existing) {
      throw new Error('Exercise record not found');
    }

    const prev = (existing.exercise_data && typeof existing.exercise_data === 'object'
      ? existing.exercise_data
      : {}) as Record<string, unknown>;

    const next: Record<string, unknown> = { ...prev };
    if (updates.exercise_name !== undefined) next.name = updates.exercise_name;
    if (updates.exercise_type !== undefined) next.exercise_type = updates.exercise_type;
    if (updates.duration !== undefined) next.duration = updates.duration;
    if (updates.calories_burned !== undefined) next.calories_burned = updates.calories_burned;
    if (updates.intensity !== undefined) next.intensity = updates.intensity;
    if (updates.icon !== undefined) next.icon = updates.icon;
    if (updates.originalId !== undefined) next.originalId = updates.originalId;
    if (updates.source !== undefined) next.source = updates.source;

    const calories =
      updates.calories_burned !== undefined
        ? updates.calories_burned
        : Number(next.calories_burned ?? prev.calories_burned ?? 0);

    let notes = existing?.notes as string | undefined;
    if (updates.icon !== undefined || updates.originalId !== undefined) {
      notes = JSON.stringify({
        icon: updates.icon ?? next.icon,
        originalId: updates.originalId ?? next.originalId,
      });
    }
    if (updates.notes !== undefined) notes = updates.notes;

    const patch: Record<string, unknown> = {
      exercise_data: next,
      value: calories,
      unit: 'kcal',
      updated_at: new Date().toISOString(),
    };
    if (updates.recorded_at) patch.recorded_at = updates.recorded_at;
    if (notes !== undefined) patch.notes = notes;

    const { data, error } = await supabase
      .from('health_records')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('record_type', 'exercise')
      .select()
      .single();

    if (error) {
      console.error('Error updating exercise:', error);
      throw error;
    }

    return mapHealthRowToExerciseRecord(data);
  },
};
