/**
 * health_records（record_type = emotion）与历史 emotion_records 行结构的互转
 */

function mapHealthRowToEmotionRecord(row) {
  if (!row) return null;
  const ed = row.emotion_data && typeof row.emotion_data === 'object' ? row.emotion_data : {};
  return {
    id: row.id,
    user_id: row.user_id,
    emotion: ed.emotion || 'neutral',
    intensity: Number(row.value ?? ed.intensity ?? 0.5),
    message: row.notes != null ? row.notes : ed.message != null ? ed.message : null,
    recorded_at: row.recorded_at,
    created_at: row.created_at,
  };
}

function mapHealthRowsToEmotionRecords(rows) {
  return (rows || []).map(mapHealthRowToEmotionRecord);
}

function buildEmotionHealthRecordInsert(userId, { emotion, intensity, message, recorded_at }) {
  const ts = recorded_at || new Date().toISOString();
  const inten = intensity != null ? Number(intensity) : 0.5;
  return {
    user_id: userId,
    record_type: 'emotion',
    value: inten,
    emotion_data: {
      emotion: emotion || 'neutral',
      intensity: inten,
      message: message != null ? message : null,
    },
    notes: message != null ? message : null,
    recorded_at: ts,
  };
}

module.exports = {
  mapHealthRowToEmotionRecord,
  mapHealthRowsToEmotionRecords,
  buildEmotionHealthRecordInsert,
};
