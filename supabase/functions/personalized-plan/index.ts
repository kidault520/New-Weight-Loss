import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const age = new Date().getFullYear() - birthDate.getFullYear();

    const bmi = profile.weight && profile.height
      ? (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1)
      : 'N/A';

    const { data: assessments } = await supabaseClient
      .from('health_assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const latestAssessment = assessments && assessments.length > 0 ? assessments[0] : null;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const { data: glucoseRecords } = await supabaseClient
      .from('health_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('record_type', 'blood_glucose')
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString());

    let avgGlucose = 'N/A';
    let glucoseVariability = '数据不足';

    if (glucoseRecords && glucoseRecords.length > 0) {
      const glucoseValues = glucoseRecords.map(r => r.value);
      const avg = glucoseValues.reduce((sum, val) => sum + val, 0) / glucoseValues.length;
      avgGlucose = avg.toFixed(1);

      const variance = glucoseValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / glucoseValues.length;
      const sd = Math.sqrt(variance);
      const cv = (sd / avg) * 100;

      if (cv < 20) glucoseVariability = '低';
      else if (cv < 36) glucoseVariability = '中等';
      else glucoseVariability = '高';
    }

    const weightLossGoal = profile.target_weight
      ? (profile.weight - profile.target_weight).toFixed(1)
      : '未设定';

    const exerciseHabit = latestAssessment?.exercise_frequency || '未评估';
    const dietPreference = profile.diet_preference || '均衡饮食';
    const stressLevel = latestAssessment?.stress_level || '中等';
    const sleepQuality = latestAssessment?.sleep_quality || '一般';

    const prompt = `你是一位资深营养师和健康管理专家。请为用户制定一份科学、可行的28天减重方案。

用户档案:
- 基本信息: 年龄${age}岁, 性别${profile.gender === 'male' ? '男' : '女'}, 身高${profile.height}cm, 当前体重${profile.weight}kg
- 目标体重: ${profile.target_weight || '未设定'}kg
- 减重目标: ${weightLossGoal}kg
- 时间周期: 28天

健康数据:
- BMI: ${bmi}
- 体脂率: ${latestAssessment?.body_fat_percentage || '未测量'}%
- 基础代谢: ${profile.bmr || 1500} kcal/天
- 平均血糖: ${avgGlucose} mmol/L
- 血糖波动性: ${glucoseVariability}

生活方式:
- 运动习惯: ${exerciseHabit}
- 饮食偏好: ${dietPreference}
- 作息时间: ${sleepQuality === '很好' ? '规律' : sleepQuality === '较好' ? '较规律' : '不规律'}
- 压力水平: ${stressLevel}

核心动机:
- 主要动机: ${profile.goal || '健康生活'}
- 情感驱动: 改善健康状态，提升生活质量
- 成功意义: 达到理想体重，建立健康生活方式

请生成包含以下内容的方案:

1. **总体目标设定**
   - 减重目标(kg)
   - 体脂率目标(%)
   - 血糖管理目标(mmol/L)
   - 分阶段目标(每周)

2. **饮食策略**
   - 每日热量目标(kcal)
   - 宏量营养素比例(碳水/蛋白/脂肪)
   - 推荐食物清单(基于血糖友好性)
   - 需避免食物
   - 进餐时间建议

3. **运动建议**
   - 有氧运动频率和时长
   - 力量训练计划(如适用)
   - 餐后运动建议
   - 运动强度建议

4. **监测频率**
   - 体重测量频率
   - 血糖监测频率
   - 饮食记录要求
   - 其他监测指标

5. **个性化调整**
   - 基于用户动机的激励策略
   - 基于生活方式的可行性调整
   - 潜在挑战预判和应对

请用温暖、专业、鼓励的语气输出完整的文字方案，帮助用户建立信心并提供清晰可行的指导。不要使用JSON格式，使用易读的段落和列表形式。`;

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
            content: '你是一位资深营养师和健康管理专家，擅长制定个性化的减重方案。你的建议科学、可行，充满关怀和鼓励。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
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
        analysis
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Personalized plan generation error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || '生成个性化方案时出错',
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