const axios = require('axios');

class AIService {
  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || 'sk-66bac68d9702455fa1d232f5d1c9c9bf';
    this.deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com';
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.claudeApiKey = process.env.CLAUDE_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;

    console.log('AIService initialized with DeepSeek API:', this.deepseekApiKey ? 'Configured ✓' : 'Not configured');
  }

  // DeepSeek Chat integration (Primary)
  async chatWithDeepSeek(messages, options = {}) {
    if (!this.deepseekApiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    try {
      const apiUrl = this.deepseekApiUrl.endsWith('/chat/completions')
        ? this.deepseekApiUrl
        : `${this.deepseekApiUrl}/chat/completions`;

      console.log('Calling DeepSeek API:', apiUrl);
      console.log('Request options:', {
        model: options.model || 'deepseek-chat',
        max_tokens: options.maxTokens || 500,
        timeout: options.timeout || 120000
      });

      const response = await axios.post(apiUrl, {
        model: options.model || 'deepseek-chat',
        messages,
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
        ...options
      }, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 120000 // 120 seconds timeout
      });

      console.log('DeepSeek API success! Response length:', response.data.choices[0]?.message?.content?.length || 0);
      return response.data.choices[0].message.content;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.error('DeepSeek API timeout:', error.message);
        throw new Error('DeepSeek API请求超时，请稍后重试');
      } else if (error.response) {
        console.error('DeepSeek API error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        throw new Error(`DeepSeek API错误: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error('DeepSeek API no response:', error.message);
        throw new Error('无法连接到DeepSeek API，请检查网络连接');
      } else {
        console.error('DeepSeek API error:', error.message);
        throw new Error(`DeepSeek API调用失败: ${error.message}`);
      }
    }
  }

  // OpenAI GPT integration (Fallback)
  async chatWithGPT(messages, options = {}) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: options.model || 'gpt-3.5-turbo',
        messages,
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
        ...options
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error.response?.data || error.message);
      throw new Error('Failed to get response from OpenAI');
    }
  }

  // Universal chat method that tries DeepSeek first, then falls back to OpenAI
  async chat(messages, options = {}) {
    try {
      if (this.deepseekApiKey) {
        return await this.chatWithDeepSeek(messages, options);
      } else if (this.openaiApiKey) {
        return await this.chatWithGPT(messages, options);
      } else {
        throw new Error('No AI API key configured');
      }
    } catch (error) {
      console.error('AI chat error:', error.message);
      throw error;
    }
  }

  // Analyze food from image using OpenAI Vision
  async analyzeFoodImage(imageUrl, description = '') {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `请分析这张食物图片，提供以下信息（用JSON格式返回）：
              {
                "food_name": "食物名称",
                "calories": 估算卡路里,
                "nutrition": {
                  "protein": 蛋白质克数,
                  "carbs": 碳水化合物克数,
                  "fat": 脂肪克数,
                  "fiber": 纤维克数
                },
                "portion_size": "份量描述",
                "confidence": 识别置信度(0-1)
              }
              ${description ? `额外描述：${description}` : ''}`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ];

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4-vision-preview',
        messages,
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response.data.choices[0].message.content;
      
      // Try to parse JSON response
      try {
        return JSON.parse(content);
      } catch {
        // If not JSON, return structured response
        return {
          food_name: "识别的食物",
          calories: 200,
          nutrition: { protein: 10, carbs: 30, fat: 8, fiber: 3 },
          portion_size: "1份",
          confidence: 0.7,
          raw_response: content
        };
      }
    } catch (error) {
      console.error('Food analysis error:', error.response?.data || error.message);
      throw new Error('Failed to analyze food image');
    }
  }

  // Generate personalized health advice
  async generateHealthAdvice(userProfile, healthData) {
    const prompt = `基于以下用户信息和健康数据，提供个性化的健康建议：

用户信息：
- 年龄：${userProfile.age}
- 性别：${userProfile.gender}
- 身高：${userProfile.height}cm
- 目标体重：${userProfile.target_weight}kg
- 活动水平：${userProfile.activity_level}

最近健康数据：
${JSON.stringify(healthData, null, 2)}

请提供简洁、实用的健康建议，包括饮食、运动和生活方式方面的建议。`;

    const messages = [
      {
        role: 'system',
        content: '你是一个专业的健康顾问，提供基于科学的个性化健康建议。'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    return await this.chat(messages);
  }

  // Analyze emotion from text
  analyzeEmotion(text) {
    const emotionKeywords = {
      happy: {
        keywords: ['开心', '高兴', '快乐', '兴奋', '愉快', '满足', '幸福', '喜悦'],
        intensity: 0.8
      },
      sad: {
        keywords: ['难过', '伤心', '不开心', '心情不好', '沮丧', '失落', '悲伤', '郁闷'],
        intensity: 0.7
      },
      angry: {
        keywords: ['生气', '愤怒', '烦躁', '气愤', '恼火', '暴躁', '愤慨'],
        intensity: 0.9
      },
      worried: {
        keywords: ['担心', '焦虑', '紧张', '不安', '忧虑', '恐惧', '害怕'],
        intensity: 0.6
      },
      tired: {
        keywords: ['累', '疲惫', '困', '乏力', '疲劳', '疲倦', '筋疲力尽'],
        intensity: 0.5
      },
      excited: {
        keywords: ['激动', '兴奋', '期待', '振奋', '热情', '充满活力'],
        intensity: 0.9
      }
    };

    for (const [emotion, data] of Object.entries(emotionKeywords)) {
      for (const keyword of data.keywords) {
        if (text.includes(keyword)) {
          return {
            detected: true,
            type: emotion,
            intensity: data.intensity + (Math.random() * 0.2 - 0.1), // Add some variation
            keyword: keyword
          };
        }
      }
    }

    return { detected: false, type: 'neutral', intensity: 0.5 };
  }

  // Generate meal plan
  async generateMealPlan(userProfile, preferences = {}) {
    const prompt = `为以下用户生成7天健康餐食计划：

用户信息：
- 年龄：${userProfile.age}
- 性别：${userProfile.gender}
- 身高：${userProfile.height}cm
- 目标体重：${userProfile.target_weight}kg
- 活动水平：${userProfile.activity_level}

偏好设置：
${JSON.stringify(preferences, null, 2)}

请生成包含早餐、午餐、晚餐的7天餐食计划，每餐包含营养信息和制作建议。以JSON格式返回。`;

    const messages = [
      {
        role: 'system',
        content: '你是一个专业的营养师，能够制定科学合理的餐食计划。'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    return await this.chat(messages, { maxTokens: 1500 });
  }
}

module.exports = new AIService();