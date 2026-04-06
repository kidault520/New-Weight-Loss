const express = require('express');
const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/aiService');
const { toBeijingDateString, toBeijingDayRangeISO } = require('../utils/timezone');
const router = express.Router();

// Parse health metrics from text
router.post('/parse-health-metrics', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Use pattern matching to detect health metrics
    const detected = detectHealthMetrics(message);

    res.json({
      detected: detected.detected,
      metrics: detected.metrics || [],
      confidence: detected.confidence || 0
    });

  } catch (error) {
    console.error('Parse health metrics error:', error);
    res.status(500).json({ error: 'Failed to parse health metrics' });
  }
});

// AI Chat endpoint
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, conversation_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get conversation history if conversation_id is provided
    let conversationHistory = [];
    if (conversation_id) {
      const { data } = await supabaseAdmin
        .from('ai_conversations')
        .select('messages')
        .eq('id', conversation_id)
        .eq('user_id', req.user.id)
        .single();
      
      conversationHistory = data?.messages || [];
    }

    // Prepare messages for AI
    const messages = [
      {
        role: 'system',
        content: `你是小瑞，一个专业的健康助手。你需要：
1. 用温暖、友好的语气与用户交流
2. 提供专业的健康建议
3. 帮助用户分析饮食、运动和健康数据
4. 识别用户的情绪状态并给予适当回应
5. 保持简洁但有用的回答`
      },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Call AI API (DeepSeek or OpenAI)
    let aiResponse;
    try {
      aiResponse = await aiService.chat(messages, { maxTokens: 500 });
    } catch (error) {
      console.error('AI API error:', error);
      // Fallback response if API fails
      aiResponse = "小瑞在这里陪着你呢～有什么想聊的都可以告诉我哦！";
    }

    // Analyze emotion from user message
    const emotion = analyzeEmotion(message);

    // Save conversation
    const newMessages = [...conversationHistory, 
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
    ];

    let savedConversationId = conversation_id;
    if (!conversation_id) {
      // Create new conversation
      const { data } = await supabaseAdmin
        .from('ai_conversations')
        .insert({
          user_id: req.user.id,
          messages: newMessages,
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      savedConversationId = data.id;
    } else {
      // Update existing conversation
      await supabaseAdmin
        .from('ai_conversations')
        .update({
          messages: newMessages,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversation_id)
        .eq('user_id', req.user.id);
    }

    // Save emotion if detected（统一写入 health_records）
    if (emotion.detected) {
      const { buildEmotionHealthRecordInsert } = require('../utils/mapEmotionHealthRecord');
      await supabaseAdmin.from('health_records').insert(
        buildEmotionHealthRecordInsert(req.user.id, {
          emotion: emotion.type,
          intensity: emotion.intensity,
          message,
          recorded_at: new Date().toISOString(),
        })
      );
    }

    res.json({
      response: aiResponse,
      conversation_id: savedConversationId,
      emotion: emotion.detected ? emotion : null
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ error: 'AI chat failed' });
  }
});

// Analyze food from image or text
router.post('/analyze-food', authenticateToken, async (req, res) => {
  try {
    const { image_url, description } = req.body;

    if (!image_url && !description) {
      return res.status(400).json({ error: 'Image URL or description is required' });
    }

    // Mock food analysis (replace with actual AI service)
    const mockAnalysis = {
      food_name: description || "识别的食物",
      calories: Math.floor(Math.random() * 500) + 100,
      nutrition: {
        protein: Math.floor(Math.random() * 30) + 5,
        carbs: Math.floor(Math.random() * 50) + 10,
        fat: Math.floor(Math.random() * 20) + 2,
        fiber: Math.floor(Math.random() * 10) + 1
      },
      confidence: 0.85
    };

    res.json({ analysis: mockAnalysis });

  } catch (error) {
    console.error('Food analysis error:', error);
    res.status(500).json({ error: 'Food analysis failed' });
  }
});

// Get emotion statistics
router.get('/emotions/stats', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'emotion');

    if (start_date) {
      query = query.gte('recorded_at', start_date);
    }
    if (end_date) {
      query = query.lte('recorded_at', end_date);
    }

    const { data: rawRows, error } = await query;

    if (error) {
      throw error;
    }

    const { mapHealthRowsToEmotionRecords } = require('../utils/mapEmotionHealthRecord');
    const data = mapHealthRowsToEmotionRecords(rawRows || []);

    // Calculate emotion statistics
    const stats = data.reduce((acc, record) => {
      acc[record.emotion] = (acc[record.emotion] || 0) + 1;
      return acc;
    }, {});

    res.json({ 
      total_records: data.length,
      emotions: stats,
      records: data 
    });

  } catch (error) {
    console.error('Emotion stats error:', error);
    res.status(500).json({ error: 'Failed to get emotion statistics' });
  }
});

// Quick action: Analyze today's diet
router.post('/analyze-diet', authenticateToken, async (req, res) => {
  try {
    const { date, conversation_id } = req.body;
    const targetDate = date || toBeijingDateString(new Date());
    const dayRange = toBeijingDayRangeISO(targetDate);
    if (!dayRange) {
      return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
    }

    // Fetch today's food records
    const { data: foodRecords, error: foodError } = await supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'food')
      .gte('recorded_at', dayRange.start)
      .lte('recorded_at', dayRange.end)
      .order('recorded_at', { ascending: true });

    if (foodError) {
      throw foodError;
    }

    // Get user profile for personalized recommendations
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    let analysisMessage;

    if (!foodRecords || foodRecords.length === 0) {
      analysisMessage = `今天还没有记录任何饮食呢～要不要添加一下今天吃了什么呀？这样小瑞才能帮你分析营养状况哦！`;
    } else {
      // Calculate nutrition totals
      const totals = foodRecords.reduce((acc, record) => {
        const nutrition = record.nutrition_data || {};
        acc.calories += nutrition.calories || 0;
        acc.protein += nutrition.protein || 0;
        acc.carbs += nutrition.carbs || 0;
        acc.fat += nutrition.fat || 0;
        acc.fiber += nutrition.fiber || 0;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

      // Group by meal type
      const mealBreakdown = {};
      foodRecords.forEach(record => {
        const mealType = record.nutrition_data?.mealType || '其他';
        if (!mealBreakdown[mealType]) {
          mealBreakdown[mealType] = { foods: [], calories: 0 };
        }
        mealBreakdown[mealType].foods.push(record.nutrition_data?.name || '未知食物');
        mealBreakdown[mealType].calories += record.nutrition_data?.calories || 0;
      });

      // Create detailed context for AI
      const dietContext = `
今日饮食数据分析：
- 日期：${targetDate}
- 总热量：${Math.round(totals.calories)} 千卡
- 蛋白质：${Math.round(totals.protein)}g
- 碳水化合物：${Math.round(totals.carbs)}g
- 脂肪：${Math.round(totals.fat)}g
- 膳食纤维：${Math.round(totals.fiber)}g

餐次详情：
${Object.entries(mealBreakdown).map(([meal, data]) =>
  `${meal}：${data.foods.join('、')} (${Math.round(data.calories)}千卡)`
).join('\n')}

用户信息：
- 体重：${profile?.current_weight || '未知'} kg
- 目标：${profile?.goal || '健康生活'}
`;

      // Get conversation history if needed
      let conversationHistory = [];
      if (conversation_id) {
        const { data } = await supabaseAdmin
          .from('ai_conversations')
          .select('messages')
          .eq('id', conversation_id)
          .eq('user_id', req.user.id)
          .maybeSingle();

        conversationHistory = data?.messages || [];
      }

      // Prepare AI messages
      const messages = [
        {
          role: 'system',
          content: `你是小瑞，一个专业的营养健康助手。请基于用户的饮食数据，用温暖友好的语气提供：
1. 今日饮食的整体评价（热量是否合理、营养是否均衡）
2. 三大营养素（蛋白质、碳水、脂肪）的比例分析
3. 具体的改进建议（如果有的话）
4. 鼓励和正面的反馈

保持简洁但有用，用"owner"称呼用户，语气要像朋友一样亲切。`
        },
        ...conversationHistory.slice(-4),
        { role: 'user', content: `请帮我分析一下今天的饮食：\n${dietContext}` }
      ];

      // Call AI API (DeepSeek or OpenAI)
      try {
        analysisMessage = await aiService.chat(messages, { maxTokens: 600 });
      } catch (apiError) {
        console.error('AI API error:', apiError);
        analysisMessage = generateFallbackDietAnalysis(totals, mealBreakdown);
      }
    }

    res.json({
      analysis: analysisMessage,
      hasData: foodRecords && foodRecords.length > 0,
      recordCount: foodRecords?.length || 0
    });

  } catch (error) {
    console.error('Diet analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze diet' });
  }
});

// Quick action: Analyze today's HRV
router.post('/analyze-hrv', authenticateToken, async (req, res) => {
  try {
    const { date, conversation_id } = req.body;
    const targetDate = date || toBeijingDateString(new Date());
    const dayRange = toBeijingDayRangeISO(targetDate);
    if (!dayRange) {
      return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
    }

    // Fetch today's HRV records
    const { data: hrvRecords, error: hrvError } = await supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'hrv')
      .gte('recorded_at', dayRange.start)
      .lte('recorded_at', dayRange.end)
      .order('recorded_at', { ascending: false });

    if (hrvError) {
      throw hrvError;
    }

    // Fetch recent HRV records for comparison (last 7 days)
    const sevenDaysAgo = new Date(targetDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentHrvRecords } = await supabaseAdmin
      .from('health_records')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('record_type', 'hrv')
      .gte('recorded_at', sevenDaysAgo.toISOString())
      .order('recorded_at', { ascending: false });

    let analysisMessage;

    if (!hrvRecords || hrvRecords.length === 0) {
      analysisMessage = `今天还没有HRV数据呢～\n\nHRV（心率变异性）是反映身体压力和恢复状况的重要指标哦。如果owner有智能手表或健康设备，可以同步一下数据，小瑞就能帮你分析啦！`;
    } else {
      const currentHRV = hrvRecords[0].value;

      // Calculate average HRV from recent records
      let avgHRV = currentHRV;
      if (recentHrvRecords && recentHrvRecords.length > 1) {
        avgHRV = recentHrvRecords.reduce((sum, r) => sum + r.value, 0) / recentHrvRecords.length;
      }

      const hrvContext = `
今日HRV数据分析：
- 日期：${targetDate}
- 当前HRV值：${currentHRV} ms
- 7天平均值：${Math.round(avgHRV)} ms
- 变化趋势：${currentHRV > avgHRV ? '高于平均' : currentHRV < avgHRV ? '低于平均' : '接近平均'}
- 测量次数：${hrvRecords.length}
`;

      // Get conversation history if needed
      let conversationHistory = [];
      if (conversation_id) {
        const { data } = await supabaseAdmin
          .from('ai_conversations')
          .select('messages')
          .eq('id', conversation_id)
          .eq('user_id', req.user.id)
          .maybeSingle();

        conversationHistory = data?.messages || [];
      }

      // Prepare AI messages
      const messages = [
        {
          role: 'system',
          content: `你是小瑞，一个专业的健康助手。请基于用户的HRV数据，用温暖友好的语气提供：
1. HRV值的含义解释（较高通常表示身体恢复良好，较低可能表示疲劳或压力）
2. 与近期数据的对比分析
3. 生活建议（如休息、运动强度调整等）
4. 鼓励和正面的反馈

保持简洁但有用，用"owner"称呼用户，语气要像朋友一样亲切。`
        },
        ...conversationHistory.slice(-4),
        { role: 'user', content: `请帮我分析一下今天的HRV数据：\n${hrvContext}` }
      ];

      // Call AI API (DeepSeek or OpenAI)
      try {
        analysisMessage = await aiService.chat(messages, { maxTokens: 600 });
      } catch (apiError) {
        console.error('AI API error:', apiError);
        analysisMessage = generateFallbackHRVAnalysis(currentHRV, avgHRV);
      }
    }

    res.json({
      analysis: analysisMessage,
      hasData: hrvRecords && hrvRecords.length > 0,
      recordCount: hrvRecords?.length || 0
    });

  } catch (error) {
    console.error('HRV analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze HRV' });
  }
});

// Helper function: Generate fallback diet analysis when OpenAI is unavailable
function generateFallbackDietAnalysis(totals, mealBreakdown) {
  const totalCalories = Math.round(totals.calories);
  const mealCount = Object.keys(mealBreakdown).length;

  let analysis = `小瑞看了一下owner今天的饮食记录呢～\n\n`;
  analysis += `📊 今日摄入：${totalCalories}千卡\n`;
  analysis += `🍽️ 记录了${mealCount}个餐次\n\n`;

  if (totalCalories < 1200) {
    analysis += `owner今天吃得有点少呢，要注意营养充足哦！建议适当增加健康食物的摄入。`;
  } else if (totalCalories > 2500) {
    analysis += `今天的热量摄入偏高了一些呢～不过偶尔放纵一下也没关系啦！明天注意控制一下就好～`;
  } else {
    analysis += `热量摄入看起来还不错哦！营养三大元素的比例也比较均衡呢。继续保持这样的饮食习惯吧！`;
  }

  return analysis;
}

// Helper function: Generate fallback HRV analysis when OpenAI is unavailable
function generateFallbackHRVAnalysis(currentHRV, avgHRV) {
  let analysis = `小瑞看到owner今天的HRV数据啦～\n\n`;
  analysis += `💓 当前HRV：${currentHRV}ms\n`;
  analysis += `📈 7天平均：${Math.round(avgHRV)}ms\n\n`;

  if (currentHRV > avgHRV * 1.1) {
    analysis += `太棒了！owner的HRV值明显高于近期平均水平，说明身体恢复得很好呢～这是进行训练的好时机哦！`;
  } else if (currentHRV < avgHRV * 0.9) {
    analysis += `owner的HRV值比平时低一些，可能是身体需要更多休息的信号呢。建议今天降低运动强度，多注意休息哦～`;
  } else {
    analysis += `HRV值保持在正常范围内，身体状态不错呢！继续保持规律的作息和适度运动吧～`;
  }

  return analysis;
}

// Helper function to analyze emotion from text
function analyzeEmotion(text) {
  const emotionKeywords = {
    happy: ['开心', '高兴', '快乐', '兴奋', '愉快', '满足'],
    sad: ['难过', '伤心', '不开心', '心情不好', '沮丧', '失落'],
    angry: ['生气', '愤怒', '烦躁', '气愤', '恼火'],
    worried: ['担心', '焦虑', '紧张', '不安', '忧虑'],
    tired: ['累', '疲惫', '困', '乏力', '疲劳'],
    excited: ['激动', '兴奋', '期待', '振奋']
  };

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return {
          detected: true,
          type: emotion,
          intensity: Math.random() * 0.5 + 0.5 // 0.5-1.0
        };
      }
    }
  }

  return { detected: false };
}

// Helper function to detect health metrics from text
function detectHealthMetrics(text) {
  const patterns = [
    // 食物相关
    {
      keywords: ['吃了', '吃', '喝了', '早餐', '午餐', '晚餐', '加餐', '包子', '米饭', '面条', '油条', '豆浆', '食物'],
      patterns: [
        /吃了?(\d+)个?(.+?)(?:，|。|$|\s)/,
        /(?:早餐|午餐|晚餐|加餐)[吃喝了]*(.+?)(?:，|。|$)/,
        /(.+?)(\d+)元/,
        /(\d+)块.*?(包子|油条|饼|蛋|饺子)/
      ],
      type: 'food'
    },
    // 喝水相关
    {
      keywords: ['喝水', '喝了', '杯水', '毫升', 'ml'],
      patterns: [
        /喝了?(\d+)(?:杯|瓶)?水?/,
        /(\d+)(?:ml|毫升|ML)/,
        /水.*?(\d+)/
      ],
      type: 'water'
    },
    // 运动相关
    {
      keywords: ['运动', '跑步', '走路', '游泳', '骑车', '健身', '锻炼', '分钟', '小时'],
      patterns: [
        /(跑步|走路|游泳|骑车|健身|瑜伽|球类|跳绳).*?(\d+)(?:分钟|min)/,
        /运动.*?(\d+)(?:分钟|min)/,
        /(\d+)分钟.*?(跑步|走路|游泳|骑车|健身)/
      ],
      type: 'exercise'
    },
    // 步数相关
    {
      keywords: ['步', '走了', '步数'],
      patterns: [
        /(?:走了|步数|今天).*?(\d+)步/,
        /(\d{3,})步/
      ],
      type: 'steps'
    },
    // 体重相关
    {
      keywords: ['体重', '重了', '轻了', '称重', '斤', 'kg'],
      patterns: [
        /体重.*?(\d+\.?\d*)(?:kg|公斤|千克)/,
        /(\d+\.?\d*)(?:kg|公斤|千克)/,
        /重了?(\d+\.?\d*)斤/
      ],
      type: 'weight'
    },
    // 睡眠相关
    {
      keywords: ['睡了', '睡眠', '睡觉', '小时'],
      patterns: [
        /睡了?(\d+\.?\d*)(?:个)?小时/,
        /睡眠.*?(\d+\.?\d*)小时/
      ],
      type: 'sleep'
    },
    // 血糖相关
    {
      keywords: ['血糖'],
      patterns: [
        /血糖.*?(\d+\.?\d*)/,
        /(\d+\.?\d*)(?:mmol|毫摩尔)/
      ],
      type: 'blood_glucose'
    }
  ];

  for (const pattern of patterns) {
    const hasKeyword = pattern.keywords.some(keyword => text.includes(keyword));

    if (hasKeyword) {
      for (const regex of pattern.patterns) {
        const match = text.match(regex);

        if (match) {
          return {
            detected: true,
            metrics: [{
              type: pattern.type,
              match: match[0],
              groups: match.slice(1)
            }],
            confidence: 0.85
          };
        }
      }
    }
  }

  return { detected: false, metrics: [], confidence: 0 };
}

module.exports = router;