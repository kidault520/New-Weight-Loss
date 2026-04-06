import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UserHealthData {
  age: number;
  gender: string;
  height: number;
  weight: number;
  bmi: number;
  body_fat?: number;
  visceral_fat?: number;
  bmr: number;
  avg_glucose?: number;
  glucose_variability?: string;
  fasting_glucose?: number;
  diet_score?: number;
  exercise_freq?: string;
  sleep_quality?: string;
  stress_level?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('未提供认证信息');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('用户认证失败');
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('无法获取用户档案数据');
    }

    const birthDate = new Date(profile.birth_date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    const { data: healthRecords } = await supabaseClient
      .from('health_records')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(100);

    const { data: assessments } = await supabaseClient
      .from('health_assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const latestAssessment = assessments && assessments.length > 0 ? assessments[0] : null;

    const glucoseRecords = healthRecords?.filter(r => r.record_type === 'blood_glucose') || [];
    const avgGlucose = glucoseRecords.length > 0
      ? glucoseRecords.reduce((sum, r) => sum + r.value, 0) / glucoseRecords.length
      : undefined;

    const fastingGlucose = glucoseRecords.find(r => {
      const hour = new Date(r.recorded_at).getHours();
      return hour >= 6 && hour <= 8;
    })?.value;

    let glucoseVariability = '稳定';
    if (glucoseRecords.length > 1) {
      const values = glucoseRecords.map(r => r.value);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const range = max - min;
      if (range > 3) glucoseVariability = '波动较大';
      else if (range > 2) glucoseVariability = '中度波动';
    }

    const healthData: UserHealthData = {
      age,
      gender: profile.gender === 'male' ? '男' : '女',
      height: profile.height || 170,
      weight: profile.weight || 65,
      bmi: profile.weight && profile.height
        ? Number((profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1))
        : 22,
      body_fat: latestAssessment?.body_fat_percentage,
      visceral_fat: latestAssessment?.visceral_fat_level,
      bmr: profile.bmr || 1500,
      avg_glucose: avgGlucose ? Number(avgGlucose.toFixed(1)) : undefined,
      glucose_variability: glucoseVariability,
      fasting_glucose: fastingGlucose ? Number(fastingGlucose.toFixed(1)) : undefined,
      diet_score: latestAssessment?.diet_score,
      exercise_freq: latestAssessment?.exercise_frequency,
      sleep_quality: latestAssessment?.sleep_quality,
      stress_level: latestAssessment?.stress_level,
    };

    const prompt = `你是一位专业的健康数据分析师。请根据以下用户体检数据,生成一份易懂的健康基线报告:

用户信息:
- 年龄: ${healthData.age}
- 性别: ${healthData.gender}
- 身高: ${healthData.height}cm
- 体重: ${healthData.weight}kg

体检数据:
- BMI: ${healthData.bmi}
- 体脂率: ${healthData.body_fat ? healthData.body_fat + '%' : '未测量'}
- 内脏脂肪等级: ${healthData.visceral_fat || '未测量'}
- 基础代谢: ${healthData.bmr} kcal/天
- 平均血糖: ${healthData.avg_glucose ? healthData.avg_glucose + ' mmol/L' : '未测量'}
- 血糖波动: ${healthData.glucose_variability}
- 空腹血糖: ${healthData.fasting_glucose ? healthData.fasting_glucose + ' mmol/L' : '未测量'}

生活方式问卷:
- 饮食习惯评分: ${healthData.diet_score ? healthData.diet_score + '/100' : '未评估'}
- 运动频率: ${healthData.exercise_freq || '未评估'}
- 睡眠质量: ${healthData.sleep_quality || '未评估'}
- 压力水平: ${healthData.stress_level || '未评估'}

请生成包含以下内容的报告:
1. 基础数据解读(用通俗语言解释各项指标)
2. 核心问题诊断(识别2-3个主要健康风险)
3. 可能原因分析(结合生活方式数据)
4. 改善空间预估(量化改善潜力)
5. 个性化建议(3-5条具体可行的建议)

请用友好、关怀的语气输出一份完整的文字报告，不要使用JSON格式。报告应该易于理解，充满关怀，帮助用户了解自己的健康状况并提供实用建议。`;

    const deepseekApiKey = Deno.env.get('DeepSeek_API_KEY');
    if (!deepseekApiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位专业且富有同理心的健康数据分析师，擅长用通俗易懂的语言解释复杂的健康数据。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorData = await deepseekResponse.json();
      console.error('DeepSeek API error:', errorData);
      throw new Error('AI分析服务暂时不可用');
    }

    const deepseekData = await deepseekResponse.json();
    const analysis = deepseekData.choices[0].message.content;

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        healthData
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Health report generation error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || '生成健康报告时出错',
        success: false
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});