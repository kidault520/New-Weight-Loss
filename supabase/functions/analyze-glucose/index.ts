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

    const { period = 'daily' } = await req.json();

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

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('无法获取用户档案');
    }

    const endDate = new Date();
    const startDate = new Date();

    let periodText = '每日';
    if (period === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
      periodText = '每周';
    } else if (period === 'monthly') {
      startDate.setDate(startDate.getDate() - 30);
      periodText = '每月';
    } else {
      startDate.setDate(startDate.getDate() - 1);
    }

    const { data: glucoseRecords } = await supabaseClient
      .from('health_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('record_type', 'blood_glucose')
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });

    const { data: foodRecords } = await supabaseClient
      .from('health_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('record_type', 'food')
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });

    const totalReadings = glucoseRecords?.length || 0;

    if (totalReadings === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          analysis: '暂时还没有足够的血糖数据进行分析。建议继续记录血糖数据，积累一段时间后再来查看详细分析哦！'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const glucoseValues = glucoseRecords.map(r => r.value);
    const avgGlucose = glucoseValues.reduce((sum, val) => sum + val, 0) / totalReadings;

    const variance = glucoseValues.reduce((sum, val) => sum + Math.pow(val - avgGlucose, 2), 0) / totalReadings;
    const glucoseSd = Math.sqrt(variance);
    const cv = (glucoseSd / avgGlucose) * 100;

    const inRange = glucoseValues.filter(v => v >= 3.9 && v <= 7.8).length;
    const slightlyHigh = glucoseValues.filter(v => v > 7.8 && v <= 10.0).length;
    const high = glucoseValues.filter(v => v > 10.0).length;
    const low = glucoseValues.filter(v => v < 3.9).length;

    const inRangePercent = ((inRange / totalReadings) * 100).toFixed(1);
    const slightlyHighPercent = ((slightlyHigh / totalReadings) * 100).toFixed(1);
    const highPercent = ((high / totalReadings) * 100).toFixed(1);
    const lowPercent = ((low / totalReadings) * 100).toFixed(1);

    const fastingRecords = glucoseRecords.filter(r => {
      const hour = new Date(r.recorded_at).getHours();
      return hour >= 6 && hour <= 8;
    });
    const fastingAvg = fastingRecords.length > 0
      ? (fastingRecords.reduce((sum, r) => sum + r.value, 0) / fastingRecords.length).toFixed(1)
      : 'N/A';

    const breakfastRecords = glucoseRecords.filter(r => {
      const hour = new Date(r.recorded_at).getHours();
      return hour >= 8 && hour <= 11;
    });
    const breakfastPeak = breakfastRecords.length > 0
      ? Math.max(...breakfastRecords.map(r => r.value)).toFixed(1)
      : 'N/A';

    const lunchRecords = glucoseRecords.filter(r => {
      const hour = new Date(r.recorded_at).getHours();
      return hour >= 12 && hour <= 15;
    });
    const lunchPeak = lunchRecords.length > 0
      ? Math.max(...lunchRecords.map(r => r.value)).toFixed(1)
      : 'N/A';

    const dinnerRecords = glucoseRecords.filter(r => {
      const hour = new Date(r.recorded_at).getHours();
      return hour >= 18 && hour <= 21;
    });
    const dinnerPeak = dinnerRecords.length > 0
      ? Math.max(...dinnerRecords.map(r => r.value)).toFixed(1)
      : 'N/A';

    const nightRecords = glucoseRecords.filter(r => {
      const hour = new Date(r.recorded_at).getHours();
      return hour >= 0 && hour < 6;
    });
    const nightAvg = nightRecords.length > 0
      ? (nightRecords.reduce((sum, r) => sum + r.value, 0) / nightRecords.length).toFixed(1)
      : 'N/A';

    const mealResponses = foodRecords?.slice(0, 5).map(food => {
      const mealTime = new Date(food.recorded_at);
      const mealHour = mealTime.getHours();
      let mealType = '加餐';
      if (mealHour >= 6 && mealHour < 10) mealType = '早餐';
      else if (mealHour >= 11 && mealHour < 14) mealType = '午餐';
      else if (mealHour >= 17 && mealHour < 21) mealType = '晚餐';

      const postMealEnd = new Date(mealTime.getTime() + 2 * 60 * 60 * 1000);
      const postMealGlucose = glucoseRecords.filter(g => {
        const gTime = new Date(g.recorded_at);
        return gTime > mealTime && gTime <= postMealEnd;
      });

      const peak = postMealGlucose.length > 0
        ? Math.max(...postMealGlucose.map(g => g.value))
        : null;

      return {
        meal: mealType,
        foods: food.nutrition_data?.name || '未知食物',
        peak: peak ? peak.toFixed(1) : 'N/A',
        time_to_peak: peak ? '45-60分钟' : 'N/A',
        auc: peak && peak < 7.8 ? '良好' : peak && peak < 10 ? '偏高' : '需改进'
      };
    }) || [];

    const birthDate = new Date(profile.birth_date);
    const age = new Date().getFullYear() - birthDate.getFullYear();

    const daysOnProgram = profile.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const prompt = `你是一位AI内分泌专家。请分析用户的血糖数据,提供深度洞察和建议。

分析周期: ${periodText}

用户基本信息:
- 年龄: ${age}
- 性别: ${profile.gender === 'male' ? '男' : '女'}
- 减重天数: ${daysOnProgram}

CGM数据(最近${period === 'daily' ? '24小时' : period === 'weekly' ? '7天' : '30天'}):
- 数据点总数: ${totalReadings}
- 平均血糖: ${avgGlucose.toFixed(1)} mmol/L
- 血糖标准差: ${glucoseSd.toFixed(2)}
- 变异系数: ${cv.toFixed(1)}%

血糖分布:
- 理想区域(3.9-7.8): ${inRangePercent}%
- 轻度升高(7.8-10.0): ${slightlyHighPercent}%
- 需关注(>10.0): ${highPercent}%
- 低血糖(<3.9): ${lowPercent}%

时间段分析:
- 空腹血糖(6:00-8:00): ${fastingAvg} mmol/L
- 早餐后峰值: ${breakfastPeak} mmol/L
- 午餐后峰值: ${lunchPeak} mmol/L
- 晚餐后峰值: ${dinnerPeak} mmol/L
- 夜间血糖(0:00-6:00): ${nightAvg} mmol/L

餐后血糖反应:
${JSON.stringify(mealResponses, null, 2)}

请生成以下JSON格式的分析报告,包含:

1. **总体评估** (overall_assessment)
   - 血糖控制水平(优秀/良好/一般/需改进)
   - 评分(0-100)
   - 与上周期对比
   - 关键改善点

2. **深度洞察** (insights) - 数组格式
   - 血糖模式识别
   - 食物-血糖关联发现
   - 时间规律发现

3. **个性化发现** (personalized_discoveries)
   - 最佳食物TOP3
   - 需注意食物TOP3
   - 最佳进餐时间
   - 运动效果验证

4. **可操作建议** (actionable_recommendations) - 数组格式
   - 饮食调整建议
   - 进餐时间优化
   - 运动时机建议

5. **下周重点关注** (next_week_focus) - 数组格式

请以纯文本形式输出分析结果，用友好、专业的语气，帮助用户理解血糖数据并提供实用建议。`;

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
            content: '你是一位专业的AI内分泌专家，擅长血糖数据分析和提供个性化的健康建议。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2500,
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
    console.error('Glucose analysis error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || '生成血糖分析时出错',
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