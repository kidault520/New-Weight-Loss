/**
 * 统一的数据模型，适用于所有健康记录
 */

export type HealthRecordType = 
  | 'weight'           // 体重
  | 'water'            // 饮水
  | 'steps'            // 步数
  | 'food'             // 食物
  | 'exercise'         // 运动
  | 'measurements'     // 围度
  | 'sleep'            // 睡眠
  | 'blood_glucose'    // 血糖
  | 'emotion'          // 情绪（health_records + emotion_data）
  | 'calories'         // 卡路里
  | 'hrv'              // 心率变异性
  | 'supplement'       // 补剂（与 health_records_record_type_check 一致）
  | 'breathing';       // 呼吸练习（breathing_data）

// 通用数据模型，适用于所有健康记录
export interface HealthRecord {
  id: string;
  user_id: string;
  record_type: HealthRecordType;
  value: number;
  unit?: string;
  recorded_at: string;
  notes?: string;
  nutrition_data?: Record<string, unknown>;      // 食物记录专用
  exercise_data?: Record<string, unknown>;       // 运动记录专用
  measurement_data?: Record<string, unknown>;    // 测量记录专用
  blood_glucose_data?: Record<string, unknown>;  // 血糖记录专用
  emotion_data?: Record<string, unknown>;       // 情绪：emotion / intensity / message
  /** 呼吸练习：mode_id、mode_label、cycles_completed、completed、duration_sec、source */
  breathing_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;            // 扩展字段，用于存储不同类型的额外数据
  _temp?: boolean;           // 临时记录标记（乐观更新）
  _synced?: boolean;         // 同步状态标记
  _localId?: string;         // 本地ID，用于离线操作
  created_at: string;
  updated_at: string;
}










