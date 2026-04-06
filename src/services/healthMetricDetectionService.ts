import { QuickEntryData } from '../components/QuickEntryCard';
import { replaceChineseNumbers } from '../utils/chineseNumberConverter';
import {
  supplementDetection,
  foodDetection,
  waterDetection,
  exerciseDetection,
  stepsDetection,
  weightDetection,
  sleepDetection,
  bloodGlucoseDetection,
  emotionDetection,
  measurementsDetection,
  confidenceScoreForTier,
  type ConfidenceTier,
} from '../config/healthMetricDetectionConfig';

interface DetectionPattern {
  keywords: string[];
  patterns: RegExp[];
  /** 与 patterns 等长；缺省按 medium */
  patternConfidenceTiers?: ConfidenceTier[];
  metricType: QuickEntryData['metricType'];
  extractValue: (match: RegExpMatchArray, text: string) => Partial<QuickEntryData>;
}

interface DetectionResult {
  detected: boolean;
  data?: QuickEntryData;
  confidence: number;
}

/**
 * 用户只是在问「今天吃了什么/吃了啥」等咨询，并非在录入餐食。
 * 此类句子不应生成饮食 quickEntry 卡片（由 AI 结合服务端快照回答即可）。
 */
function isFoodQuestionOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // 已含阿拉伯数字的更像「吃了2个包子」等陈述（片段经 replaceChineseNumbers 后中文数字也会变成数字）
  if (/\d/.test(t)) return false;
  return (
    /(今天|今儿|今早|今晚|刚才|刚刚)?\s*吃[了过]?\s*(什么|啥|哪些|几样|什么东西)/.test(t) ||
    /吃\s*啥/.test(t) ||
    /食[了过]?\s*(什么|啥)/.test(t)
  );
}

/**
 * 询问配送/送餐地址，不是饮食录入（避免出现「会送到哪里 + 200kcal」卡片）
 */
function isDeliveryLogisticsQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /送到\s*(哪里|哪儿|去哪|什么地方)/.test(t) ||
    /(配送|送餐|取餐|外卖).*?(哪里|哪儿|地址)/.test(t) ||
    /(哪里|哪儿).*?(送|配送)/.test(t) ||
    /(收货|收件).*?(地址|哪里|哪儿)/.test(t) ||
    /(餐|饭|早餐|午餐|晚餐|加餐).*?送到/.test(t)
  );
}

/** 是否像疑问句（咨询而非陈述录入） */
function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[？?]\s*$/.test(t)) return true;
  if (/(?:吗|嘛|么)[？!！\s]*$/i.test(t)) return true;
  if (/(?:吧)[？!！\s]*$/i.test(t) && /(?:是|对|好|行)/.test(t)) return true;
  if (
    /(?:什么|啥|多少|几多|为啥|为什么|怎么|如何|是否|有没有|对不对|行不行|好不|哪|哪儿|哪里|哪天|谁|几|怎样|怎么样|多大|多高|多重|是不是)/.test(
      t,
    )
  ) {
    return true;
  }
  if (/[呢呐][？!！\s]*$/i.test(t)) {
    if (/^(好的|行|可以|嗯|哦|啊|噢|哈)/.test(t)) return false;
    return true;
  }
  return false;
}

/** 是否与可建档的健康指标/档案相关（命中才可能触发「疑问句不建卡」） */
function mentionsHealthArchiveTopic(text: string): boolean {
  const hints = [
    "体重",
    "称重",
    "血糖",
    "血压",
    "心率",
    "饮水",
    "喝水",
    "毫升",
    "步数",
    "走路",
    "走了",
    "睡眠",
    "睡觉",
    "睡了",
    "运动",
    "锻炼",
    "健身",
    "跑步",
    "慢跑",
    "游泳",
    "骑车",
    "骑行",
    "跳绳",
    "瑜伽",
    "热量",
    "千卡",
    "卡路里",
    "大卡",
    "摄入",
    "补剂",
    "维生素",
    "蛋白粉",
    "钙片",
    "鱼油",
    "益生菌",
    "胶囊",
    "腰围",
    "围度",
    "胸围",
    "臀围",
    "上臂",
    "大腿",
    "小腿",
    "心情",
    "情绪",
    "感觉",
    "压力",
    "焦虑",
    "开心",
    "难过",
    "健康档案",
    "档案",
    "记录",
    "早餐",
    "午餐",
    "晚餐",
    "加餐",
    "餐食",
    "吃饭",
    "吃了",
    "配送",
    "送餐",
    "外卖",
    "送到",
    "收货",
  ];
  if (hints.some((h) => text.includes(h))) return true;
  if (/(?:早|午|晚)餐|加餐/.test(text)) return true;
  if (/(?:配送|送餐|送到|外卖|收货)/.test(text)) return true;
  if (/(?:喝|饮).{0,8}?(?:多少|几多)|多少.{0,8}?(?:毫升|ml|ML|水)/i.test(text)) return true;
  return false;
}

/** 明显是在报数/录入（仍应生成待确认卡片） */
function hasExplicitMetricRecordingIntent(text: string): boolean {
  const t = text.replace(/\s/g, "");
  if (
    /\d+\.?\d*\s*(?:ml|毫升|ML|L|l|升|千卡|kcal|大卡|步|分钟|min|小时|kg|公斤|千克|斤|克|g|mmol|毫摩尔)/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\d{3,}\s*步/.test(t)) return true;
  if (/(?:吃了|喝了|走了|跑了|睡了)\s*\d/.test(t)) return true;
  if (/(?:体重|血糖|血压|腰围|胸围|臀围|睡眠)[\s：:]*\d+\.?\d*/.test(text)) return true;
  if (/\d+\s*(?:个|碗|杯|份|块|片|条|根|只|袋|包)/.test(text) && /(?:吃|喝|包子|米饭|面条|粥|苹果|香蕉|鸡蛋)/.test(text)) {
    return true;
  }
  return false;
}

/**
 * 健康/档案类咨询问句：不生成 quickEntry 待确认卡片，交给对话与快照回答。
 * （与 isFoodQuestionOnly / isDeliveryLogisticsQuestion 叠加；显式报数时仍走录入。）
 */
function isHealthArchiveQueryQuestion(text: string): boolean {
  if (!looksLikeQuestion(text)) return false;
  if (!mentionsHealthArchiveTopic(text)) return false;
  if (hasExplicitMetricRecordingIntent(text)) return false;
  return true;
}

/**
 * Detection patterns for health metrics（关键词/正则见 config/healthMetricDetectionConfig.ts）
 */
const detectionPatterns: DetectionPattern[] = [
    // 补剂相关
    {
      ...supplementDetection,
      metricType: 'supplement',
      extractValue: (match) => {
        let supplementName = '补剂';
        let dosage = '1粒';

        if (match[1] && match[2]) {
          if (!isNaN(parseFloat(match[1]))) {
            dosage = `${match[1]}粒`;
            supplementName = match[2];
          } else {
            supplementName = match[1];
            dosage = `${match[2]}粒`;
          }
        } else if (match[1]) {
          supplementName = match[1];
        }

        return {
          metricType: 'supplement',
          value: 1,
          supplementName,
          dosage,
          unit: '次',
          date: new Date()
        };
      }
    },
    // 食物相关
    {
      ...foodDetection,
      metricType: 'food',
      extractValue: (match, text) => {
        const getMealType = () => {
          // 优先：用户明确说的餐次，避免时间推断覆盖
          if (text.includes('加餐')) return '加餐';
          if (text.includes('早餐')) return '早餐';
          if (text.includes('午餐')) return '午餐';
          if (text.includes('晚餐')) return '晚餐';
          const hour = new Date().getHours();
          if (hour >= 6 && hour < 11.5) return '早餐';
          if (hour >= 11.5 && hour < 18) return '午餐';
          if (hour >= 18 && hour <= 22) return '晚餐';
          return '加餐';
        };

        let foodName = '';
        let quantity = 1;
        let unit = '份';

        // Detect weight unit from original text
        const weightUnitMatch = text.match(/(\d+\.?\d*)(斤|两|克|千克|kg|公斤|g)/);

        if (weightUnitMatch) {
          // This is a weight-based pattern (e.g., "吃了3斤牛肉")
          quantity = parseFloat(weightUnitMatch[1]);
          unit = weightUnitMatch[2];

          // Extract food name after the unit - improved to capture complete food names
          const foodMatch = text.match(/(?:斤|两|克|千克|kg|公斤|g)([^，。\s,]+)/);
          if (foodMatch && foodMatch[1]) {
            foodName = foodMatch[1].trim();
          } else if (match[2]) {
            foodName = match[2].trim();
          }

          // Remove any trailing punctuation or special chars
          foodName = foodName.replace(/[，。、！？;；:：]+$/g, '');
        } else {
          // Standard pattern matching (e.g., "吃了3个包子")
          if (match[1] && match[2]) {
            if (!isNaN(parseFloat(match[1]))) {
              quantity = parseFloat(match[1]);
              foodName = match[2].trim();

              // Detect and extract unit from text
              const unitMatch = text.match(/\d+(?:个|碗|盘|杯|份|块|条|根|片|只|袋|包)/);
              if (unitMatch) {
                const detectedUnit = unitMatch[0].replace(/\d+/, '');
                unit = detectedUnit;
              } else {
                unit = '个';
              }
            } else if (
              match[2] &&
              /^(吃(?:了|过)?|喝(?:了|过)?)$/.test(String(match[1] ?? "").trim())
            ) {
              // Pattern 3：餐次 + 吃/喝 + 食物名（match[1] 为动词，match[2] 为食物）
              foodName = String(match[2]).trim();
              quantity = 1;
              unit = "份";
            } else {
              foodName = match[1].trim();
              quantity = 1;
            }
          } else if (match[1]) {
            foodName = match[1].trim();
            quantity = 1;
          }

          // Clean up food name: remove leading measure words only if the food name
          // is exactly the measure word (e.g., if user just says "个" as food name)
          // This prevents removing characters from actual food names like "包子" (steamed bun)
          const measureWords = ['个', '碗', '盘', '杯', '份', '块', '条', '根', '片', '只', '袋', '包'];
          // Only remove if food name is exactly a single measure word (not part of a food name)
          if (foodName.length === 1 && measureWords.includes(foodName)) {
            foodName = '';
          }

          // Remove any trailing punctuation or special chars
          foodName = foodName.replace(/[，。、！？;；:：]+$/g, '');
        }

        // Estimate calories based on common foods and units (per 100g or per piece)
        const calorieEstimates: { [key: string]: number } = {
          // 主食类 (per 100g)
          '包子': 220, '油条': 270, '米饭': 116, '白米饭': 116, '大米饭': 116,
          '面条': 138, '馒头': 221, '花卷': 200, '烙饼': 255, '炒饭': 180,
          '炒面': 160, '方便面': 470, '小米粥': 46, '粥': 46, '面包': 260,
          // 肉类 (per 100g)
          '牛肉': 125, '猪肉': 143, '鸡肉': 167, '鱼肉': 104, '鱼': 104,
          '羊肉': 203, '鸭肉': 240, '火腿': 330, '香肠': 508, '培根': 541, '虾': 93,
          // 蔬菜类 (per 100g)
          '白菜': 17, '菠菜': 24, '西兰花': 36, '胡萝卜': 39, '土豆': 81,
          '西红柿': 19, '黄瓜': 16, '茄子': 25, '青菜': 15, '蔬菜': 30,
          // 水果类 (per 100g)
          '苹果': 52, '香蕉': 89, '橙子': 48, '葡萄': 69, '西瓜': 30,
          '草莓': 32, '水果': 50,
          // 零食类 (per 100g)
          '薯片': 548, '饼干': 433, '蛋糕': 347, '巧克力': 589, '糖果': 400,
          // 其他常见 (per piece or per 100g)
          '饺子': 40, '蛋': 70, '鸡蛋': 144, '饼': 250
        };

        let estimatedCalories = 200; // Default

        // Calculate based on food name
        let baseCalorie = 200;
        for (const [food, cal] of Object.entries(calorieEstimates)) {
          if (foodName.includes(food)) {
            baseCalorie = cal;
            break;
          }
        }

        // Adjust for weight units
        if (unit === '斤') {
          estimatedCalories = baseCalorie * quantity; // per 100g, 1斤=500g, so multiply by quantity
        } else if (unit === '两') {
          estimatedCalories = baseCalorie * quantity * 0.1; // 1两=50g
        } else if (unit === 'g' || unit === '克') {
          estimatedCalories = (baseCalorie / 100) * quantity; // per 100g
        } else if (unit === 'kg' || unit === '千克' || unit === '公斤') {
          estimatedCalories = baseCalorie * quantity * 10; // 1kg=1000g
        } else {
          // For pieces/servings
          estimatedCalories = baseCalorie * quantity;
        }

        return {
          metricType: 'food',
          value: quantity,
          foodName: foodName || '食物',
          calories: Math.round(estimatedCalories),
          mealType: getMealType(),
          quantity: quantity,
          unit: unit,
          date: new Date()
        };
      }
    },

    // 喝水相关（包括饮品）
    {
      ...waterDetection,
      metricType: 'water',
      extractValue: (match, text) => {
        let value = parseFloat(match[1]);
        let drinkName = '';

        // 🔥 修复：扩展饮品识别，支持更多饮品类型
        if (text.includes('茶水') || text.includes('茶')) {
          drinkName = '茶水';
        } else if (text.includes('咖啡')) {
          drinkName = '咖啡';
        } else if (text.includes('奶茶')) {
          drinkName = '奶茶';
        } else if (text.includes('豆浆')) {
          drinkName = '豆浆';
        } else if (text.includes('牛奶')) {
          drinkName = '牛奶';
        } else if (text.includes('果汁')) {
          drinkName = '果汁';
        } else if (text.includes('饮料')) {
          drinkName = '饮料';
        }

        // Convert liters to ml（「毫升/ml」已是毫升，禁止把「毫升」里的「升」当升）
        const raw = match[0];
        if (raw.includes('毫升') || /ml/i.test(raw)) {
          // 已是 ml
        } else if (!raw.includes('毫') && (raw.includes('升') || /\d+\.?\d*\s*(?:L|l)(?:\s|$|水)/i.test(raw))) {
          value = value * 1000;
        }
        // If the number seems like cups (typically 1-10), convert to ml
        else if (value <= 20 && !raw.includes('ml') && !raw.includes('毫升')) {
          value = value * 250; // Assume 250ml per cup
        }

        return {
          metricType: 'water',
          value: value,
          unit: 'ml',
          notes: drinkName ? `喝了${drinkName}` : '',
          date: new Date()
        };
      }
    },

    // 运动相关
    {
      ...exerciseDetection,
      metricType: 'exercise',
      extractValue: (match, text) => {
        let exerciseName = '运动';
        let duration = 0;

        // 配速映射（分钟/公里）
        const paceMap: { [key: string]: number } = {
          '跑步': 6, '慢跑': 7, '跑': 6,
          '快走': 10, '走路': 12, '走': 12,
          '游泳': 20, '骑车': 4, '骑行': 4
        };

        // 先检测是否是距离单位（公里）
        const kmMatch = text.match(/(跑步|慢跑|跑|快走|走路|走|游泳|骑车|骑行)了?(\d+\.?\d*)(?:公里|km|千米)/i);

        if (kmMatch) {
          // 距离模式（公里）
          exerciseName = kmMatch[1];
          const distanceInKm = parseFloat(kmMatch[2]);
          const pace = paceMap[exerciseName] || 6;
          duration = Math.round(distanceInKm * pace);

          // 标准化运动名称
          if (exerciseName === '跑') exerciseName = '跑步';
          if (exerciseName === '走') exerciseName = '走路';
        } else {
          // 检测是否是距离单位（米）
          const meterMatch = text.match(/(跑步|慢跑|跑|快走|走路|走|游泳|骑车|骑行)了?(\d+\.?\d*)(?:米|m)(?!l)/i);

          if (meterMatch) {
            // 距离模式（米）
            exerciseName = meterMatch[1];
            const distanceInMeters = parseFloat(meterMatch[2]);
            const distanceInKm = distanceInMeters / 1000;
            const pace = paceMap[exerciseName] || 6;
            duration = Math.round(distanceInKm * pace);

            // 标准化运动名称
            if (exerciseName === '跑') exerciseName = '跑步';
            if (exerciseName === '走') exerciseName = '走路';
          } else {
            // 时间模式
            if (match[1] && match[2]) {
              if (!isNaN(parseFloat(match[1]))) {
                duration = parseFloat(match[1]);
                exerciseName = match[2];
              } else {
                exerciseName = match[1];
                duration = parseFloat(match[2]);
              }
            } else if (match[1]) {
              if (!isNaN(parseFloat(match[1]))) {
                duration = parseFloat(match[1]);
              } else {
                exerciseName = match[1];
                duration = 30; // Default duration
              }
            }
          }
        }

        // Estimate calories burned (per minute)
        const calorieRates: { [key: string]: number } = {
          // 有氧运动
          '跑步': 10, '慢跑': 8, '快走': 5, '走路': 4, '游泳': 11, '骑车': 7, '骑行': 7,
          '跳绳': 12, '爬楼梯': 9, '爬山': 8, '登山': 8,
          // 力量训练
          '俯卧撑': 8, '深蹲': 8, '举哑铃': 6, '哑铃': 6, '引体向上': 10, '平板支撑': 5,
          // 球类运动
          '篮球': 8, '足球': 9, '羽毛球': 7, '乒乓球': 5, '网球': 8, '排球': 6,
          // 其他运动
          '健身': 6, '瑜伽': 3, '普拉提': 4, '舞蹈': 5, '拳击': 10, '太极': 3, '广场舞': 4
        };

        let calorieRate = 6; // Default
        for (const [exercise, rate] of Object.entries(calorieRates)) {
          if (exerciseName.includes(exercise)) {
            calorieRate = rate;
            break;
          }
        }

        return {
          metricType: 'exercise',
          value: duration,
          exerciseName: exerciseName,
          duration: duration,
          calories: duration * calorieRate,
          unit: '分钟',
          exerciseType: 'cardio',
          date: new Date()
        };
      }
    },

    // 步数相关
    {
      ...stepsDetection,
      metricType: 'steps',
      extractValue: (match) => {
        return {
          metricType: 'steps',
          value: parseFloat(match[1]),
          unit: '步',
          date: new Date()
        };
      }
    },

    // 体重相关
    {
      ...weightDetection,
      metricType: 'weight',
      extractValue: (match) => {
        let value = parseFloat(match[1]);

        // Convert 斤 to kg if needed
        if (match[0].includes('斤')) {
          value = value / 2; // 1kg = 2斤
        }

        return {
          metricType: 'weight',
          value: value,
          unit: 'kg',
          date: new Date()
        };
      }
    },

    // 睡眠相关
    {
      ...sleepDetection,
      metricType: 'sleep',
      extractValue: (match) => {
        return {
          metricType: 'sleep',
          value: parseFloat(match[1]),
          unit: '小时',
          date: new Date()
        };
      }
    },

    // 血糖相关
    {
      ...bloodGlucoseDetection,
      metricType: 'blood_glucose',
      extractValue: (match) => {
        return {
          metricType: 'blood_glucose',
          value: parseFloat(match[1]),
          unit: 'mmol/L',
          date: new Date()
        };
      }
    },

    // 心情相关
    {
      ...emotionDetection,
      metricType: 'emotion',
      extractValue: (match, text) => {
        // 心情类型映射
        const emotionMap: { [key: string]: string } = {
          // 积极情绪 -> happy
          '开心': 'happy', '高兴': 'happy', '快乐': 'happy', '愉快': 'happy', '满足': 'happy', '幸福': 'happy', '喜悦': 'happy',
          // 兴奋 -> excited
          '兴奋': 'excited', '激动': 'excited', '振奋': 'excited', '充满活力': 'excited',
          // 消极情绪 -> sad
          '难过': 'sad', '伤心': 'sad', '不开心': 'sad', '沮丧': 'sad', '失落': 'sad', '悲伤': 'sad', '郁闷': 'sad',
          // 生气 -> angry
          '生气': 'angry', '愤怒': 'angry', '烦躁': 'angry', '气愤': 'angry', '恼火': 'angry', '暴躁': 'angry', '愤慨': 'angry',
          // 担心 -> worried
          '担心': 'worried', '焦虑': 'worried', '紧张': 'worried', '不安': 'worried', '忧虑': 'worried', '恐惧': 'worried', '害怕': 'worried',
          // 疲惫 -> tired
          '累': 'tired', '疲惫': 'tired', '困': 'tired', '乏力': 'tired', '疲劳': 'tired', '疲倦': 'tired', '筋疲力尽': 'tired',
          // 平静 -> neutral
          '平静': 'neutral', '放松': 'neutral'
        };

        // 提取心情关键词
        let emotionType = 'neutral';
        const matchedText = match[1] || text;
        const searchText = matchedText || text;
        
        // 🔥 修复：优先检查否定词（如"不开心"），避免被错误识别为"开心"
        if (text.includes('不开心') || text.includes('不 开心') || matchedText === '不开心') {
          emotionType = 'sad';
        } else {
          // 🔥 修复：按长度降序排序，优先匹配更长的词（如"心情不好"优先于"心情"）
          const sortedEmotions = Object.entries(emotionMap).sort((a, b) => b[0].length - a[0].length);
          
          for (const [chinese, english] of sortedEmotions) {
            // 检查文本中是否包含该情绪词
            if (searchText.includes(chinese)) {
              emotionType = english;
              break;
            }
          }
        }

        // 根据情绪类型设置强度
        const intensityMap: { [key: string]: number } = {
          'happy': 0.8,
          'excited': 0.9,
          'sad': 0.7,
          'angry': 0.9,
          'worried': 0.6,
          'tired': 0.5,
          'neutral': 0.5
        };

        return {
          metricType: 'emotion',
          value: 1,
          emotionType: emotionType,
          intensity: intensityMap[emotionType] || 0.5,
          unit: '次',
          date: new Date()
        };
      }
    },
    // 围度相关
    {
      ...measurementsDetection,
      metricType: 'measurements',
      extractValue: (match, text) => {
        const measurements: {
          chest?: number;
          waist?: number;
          upperArm?: number;
          hips?: number;
          thigh?: number;
          calf?: number;
        } = {};

        // 提取所有匹配的围度值
        // Pattern 1-6: 单个围度
        if (match[1] && match[2]) {
          const type = match[1];
          const value = parseFloat(match[2]);
          
          if (type.includes('胸')) {
            measurements.chest = value;
          } else if (type.includes('腰')) {
            measurements.waist = value;
          } else if (type.includes('臀')) {
            measurements.hips = value;
          } else if (type.includes('上臂') || type.includes('臂围')) {
            measurements.upperArm = value;
          } else if (type.includes('大腿')) {
            measurements.thigh = value;
          } else if (type.includes('小腿')) {
            measurements.calf = value;
          }
        }

        // Pattern 7: 两个围度
        if (match[1] && match[2] && match[3] && match[4]) {
          const type1 = match[1];
          const value1 = parseFloat(match[2]);
          const type2 = match[3];
          const value2 = parseFloat(match[4]);
          
          if (type1.includes('胸')) measurements.chest = value1;
          if (type1.includes('腰')) measurements.waist = value1;
          if (type1.includes('臀')) measurements.hips = value1;
          
          if (type2.includes('胸')) measurements.chest = value2;
          if (type2.includes('腰')) measurements.waist = value2;
          if (type2.includes('臀')) measurements.hips = value2;
        }

        // Pattern 8: 六个围度一起
        if (match.length >= 11) {
          measurements.chest = parseFloat(match[2]);
          measurements.waist = parseFloat(match[4]);
          measurements.hips = parseFloat(match[6]);
          measurements.upperArm = parseFloat(match[8]);
          measurements.thigh = parseFloat(match[10]);
          measurements.calf = parseFloat(match[12]);
        }

        // Pattern 9: 简写格式
        if (match[1] && match[2] && match[3] && !match[4]) {
          measurements.chest = parseFloat(match[1]);
          measurements.waist = parseFloat(match[2]);
          measurements.hips = parseFloat(match[3]);
        }

        // 如果从文本中还能提取其他围度值，也提取出来
        const allPatterns = [
          { pattern: /(胸围|胸).*?(\d+\.?\d*)/, key: 'chest' },
          { pattern: /(腰围|腰).*?(\d+\.?\d*)/, key: 'waist' },
          { pattern: /(臀围|臀).*?(\d+\.?\d*)/, key: 'hips' },
          { pattern: /(上臂围|上臂|臂围).*?(\d+\.?\d*)/, key: 'upperArm' },
          { pattern: /(大腿围|大腿).*?(\d+\.?\d*)/, key: 'thigh' },
          { pattern: /(小腿围|小腿).*?(\d+\.?\d*)/, key: 'calf' }
        ];

        for (const { pattern, key } of allPatterns) {
          const m = text.match(pattern);
          if (m && m[2]) {
            const value = parseFloat(m[2]);
            if (!measurements[key as keyof typeof measurements] || measurements[key as keyof typeof measurements] !== value) {
              (measurements as any)[key] = value;
            }
          }
        }

        // 计算主要值（用于显示）
        const values = Object.values(measurements).filter(v => v !== undefined) as number[];
        const primaryValue = values.length > 0 ? values[0] : 0;

        return {
          metricType: 'measurements',
          value: primaryValue,
          unit: 'cm',
          measurements: measurements,
          measurementType: 'body',
          date: new Date()
        };
      }
    }
];

/**
 * Validate extracted data
 */
/**
 * 同一条用户消息解析出多指标时，列表/卡片展示顺序（数值类优先于情绪等）
 */
const METRIC_DISPLAY_PRIORITY: Record<string, number> = {
  blood_glucose: 100,
  water: 95,
  weight: 88,
  sleep: 82,
  food: 75,
  exercise: 70,
  steps: 65,
  supplement: 60,
  measurements: 55,
  emotion: 45,
};

export function sortDetectionResultsByPriority(results: DetectionResult[]): DetectionResult[] {
  return [...results].sort((a, b) => {
    const ta = a.data?.metricType ?? '';
    const tb = b.data?.metricType ?? '';
    return (METRIC_DISPLAY_PRIORITY[tb] ?? 0) - (METRIC_DISPLAY_PRIORITY[ta] ?? 0);
  });
}

function isValidData(data: Partial<QuickEntryData>): boolean {
  if (!data.metricType || data.value === undefined || data.value === null) {
    return false;
  }

  // Check reasonable value ranges
  switch (data.metricType) {
    case 'food':
      return data.calories !== undefined && data.calories > 0 && data.calories < 5000;
    case 'water':
      return data.value > 0 && data.value <= 10000; // Max 10L
    case 'exercise':
      return data.duration !== undefined && data.duration > 0 && data.duration <= 300; // Max 5 hours
    case 'steps':
      return data.value >= 0 && data.value <= 100000;
    case 'weight':
      return data.value > 20 && data.value < 300; // Reasonable weight range
    case 'sleep':
      return data.value > 0 && data.value <= 24;
    case 'blood_glucose':
      return data.value > 0 && data.value <= 30;
    case 'emotion':
      return data.emotionType !== undefined && ['happy', 'sad', 'neutral', 'excited', 'tired', 'worried', 'angry'].includes(data.emotionType);
    case 'measurements':
      return data.measurements !== undefined && Object.keys(data.measurements).length > 0;
    default:
      return true;
  }
}

export const healthMetricDetectionService = {
  /**
   * Detect health metrics from text message
   */
  detectMetrics(text: string): DetectionResult {
    if (!text || text.trim().length === 0) {
      return { detected: false, confidence: 0 };
    }

    // 第一步：将中文数字转换为阿拉伯数字
    const convertedText = replaceChineseNumbers(text);

    console.log('健康指标检测 - 原文本:', text);
    console.log('健康指标检测 - 转换后:', convertedText);

    // Check each pattern
    for (const pattern of detectionPatterns) {
      if (pattern.metricType === "food" && isFoodQuestionOnly(text)) {
        continue;
      }
      if (pattern.metricType === "food" && isDeliveryLogisticsQuestion(text)) {
        continue;
      }
      if (isHealthArchiveQueryQuestion(text)) {
        continue;
      }

      // First check if any keywords are present (使用原始文本检查关键词)
      const hasKeyword = pattern.keywords.some(keyword => text.includes(keyword));

      if (hasKeyword) {
        // Try each regex pattern (使用转换后的文本进行匹配)
        for (let pi = 0; pi < pattern.patterns.length; pi++) {
          const regex = pattern.patterns[pi];
          const match = convertedText.match(regex);

          if (match) {
            console.log('匹配成功 - 类型:', pattern.metricType, '匹配结果:', match);
            try {
              const extractedData = pattern.extractValue(match, convertedText);

              // Validate extracted data
              if (isValidData(extractedData)) {
                console.log('数据验证通过:', extractedData);
                return {
                  detected: true,
                  data: extractedData as QuickEntryData,
                  confidence: confidenceScoreForTier(pattern.patternConfidenceTiers?.[pi]),
                };
              } else {
                console.log('数据验证失败:', extractedData);
              }
            } catch (error) {
              console.error('Error extracting metric data:', error);
            }
          }
        }
      }
    }

    console.log('健康指标检测 - 未检测到任何指标');
    return { detected: false, confidence: 0 };
  },

  /**
   * 将包含多种指标类型的文本拆分为独立片段（如 "我吃两个包子和500毫升的水" → ["我吃两个包子", "500毫升的水"]）
   * 仅在 "和/还有/以及/，" 后跟 数字+单位（毫升/小时/分钟等）时拆分，避免误拆 "鱼和薯条"
   */
  _splitByConjunctionAndNumericUnit(text: string): string[] {
    const segments: string[] = [];
    const splitPattern = /(?:和|还有|以及|[,，、])\s*((?:\d+\.?\d*)\s*(?:毫升|ml|ML|小时|分钟|步|kg|公斤|千克|斤|克|g)(?:\s*的?\s*水)?)/gi;
    let lastEnd = 0;
    let match;

    while ((match = splitPattern.exec(text)) !== null) {
      const beforePart = text.slice(lastEnd, match.index).trim();
      const afterPart = match[1].trim();
      if (beforePart) segments.push(beforePart);
      if (afterPart) segments.push(afterPart);
      lastEnd = match.index + match[0].length;
    }
    const tail = text.slice(lastEnd).trim();
    if (tail) segments.push(tail);

    return segments.length > 0 ? segments : [text];
  },

  /** 叙事连接词后常为另一指标（运动/血糖/心情等），避免整句只生成一张饮食卡 */
  _splitNarrativeChunks(text: string): string[] {
    const parts = text
      .split(/\s*(?:然后|接着|之后|随后|并且|同时)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [text];
  },

  /** 在同一片段内再按血糖/血压、心情边界切开，便于分卡 */
  _splitGlucoseMoodTails(segments: string[]): string[] {
    const out: string[] = [];
    for (const seg of segments) {
      if (!seg) continue;
      const gParts = seg.split(/(?=血糖|血压)/).map((x) => x.trim()).filter(Boolean);
      for (const g of gParts) {
        const mParts = g.split(/(?=心情|情绪)/).map((x) => x.trim()).filter(Boolean);
        for (const m of mParts) {
          if (m) out.push(m);
        }
      }
    }
    return out.length > 0 ? out : segments;
  },

  _splitMultiMetricText(text: string): string[] {
    const narrative = this._splitNarrativeChunks(text);
    const merged: string[] = [];
    for (const n of narrative) {
      merged.push(...this._splitByConjunctionAndNumericUnit(n));
    }
    const refined = this._splitGlucoseMoodTails(merged.length > 0 ? merged : [text]);
    return refined.length > 0 ? refined : [text];
  },

  /**
   * Detect multiple metrics from text
   */
  detectMultipleMetrics(text: string): DetectionResult[] {
    const results: DetectionResult[] = [];
    const seenKeys = new Set<string>(); // 去重：同一类型+值只保留一个

    // 将中文数字转换为阿拉伯数字
    const convertedText = replaceChineseNumbers(text);

    // 🔥 拆分多指标文本：如 "我吃两个包子和500毫升的水" → 分别检测 "我吃两个包子" 和 "500毫升的水"
    const segments = this._splitMultiMetricText(convertedText);

    for (const segment of segments) {
      const segmentResults = this._detectMetricsInSegment(segment);
      for (const r of segmentResults) {
        if (r.detected && r.data) {
          const key = `${r.data.metricType}-${r.data.value}-${(r.data as any).foodName || (r.data as any).exerciseName || ''}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(r);
          }
        }
      }
    }

    return sortDetectionResultsByPriority(results);
  },

  /**
   * 在单个文本片段内检测指标（内部方法）
   */
  _detectMetricsInSegment(segmentText: string): DetectionResult[] {
    const results: DetectionResult[] = [];

    for (const pattern of detectionPatterns) {
      if (pattern.metricType === "food" && isFoodQuestionOnly(segmentText)) {
        continue;
      }
      if (pattern.metricType === "food" && isDeliveryLogisticsQuestion(segmentText)) {
        continue;
      }
      if (isHealthArchiveQueryQuestion(segmentText)) {
        continue;
      }

      const hasKeyword = pattern.keywords.some(keyword => segmentText.includes(keyword));

      if (hasKeyword) {
        for (let pi = 0; pi < pattern.patterns.length; pi++) {
          const regex = pattern.patterns[pi];
          const match = segmentText.match(regex);

          if (match) {
            try {
              const extractedData = pattern.extractValue(match, segmentText);

              if (isValidData(extractedData)) {
                results.push({
                  detected: true,
                  data: extractedData as QuickEntryData,
                  confidence: confidenceScoreForTier(pattern.patternConfidenceTiers?.[pi]),
                });
                break; // Only take first match per pattern type
              }
            } catch (error) {
              console.error('❌ [HealthMetricDetection] 提取数据时出错:', error);
            }
          }
        }
      }
    }
    
    return results;
  },

  /**
   * Get suggestions for ambiguous inputs
   */
  getSuggestions(text: string): string[] {
    const suggestions: string[] = [];

    // Check which keywords are mentioned
    const mentionedTypes = new Set<string>();

    for (const pattern of detectionPatterns) {
      if (pattern.keywords.some(keyword => text.includes(keyword))) {
        mentionedTypes.add(pattern.metricType);
      }
    }

    // Provide helpful suggestions
    if (mentionedTypes.has('food')) {
      suggestions.push('记得说明吃了什么和大概多少哦～');
    }
    if (mentionedTypes.has('exercise')) {
      suggestions.push('可以告诉我运动类型和时长～');
    }

    return suggestions;
  },
};
