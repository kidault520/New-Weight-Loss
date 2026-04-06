/**
 * 中文数字转换工具
 * 将中文数字转换为阿拉伯数字，支持健康指标检测
 */

// 中文数字映射表
const CHINESE_NUMBER_MAP: { [key: string]: number } = {
  '零': 0, '〇': 0,
  '一': 1, '壹': 1,
  '二': 2, '贰': 2, '两': 2, '俩': 2,
  '三': 3, '叁': 3,
  '四': 4, '肆': 4,
  '五': 5, '伍': 5,
  '六': 6, '陆': 6,
  '七': 7, '柒': 7,
  '八': 8, '捌': 8,
  '九': 9, '玖': 9,
  '十': 10, '拾': 10
};

/**
 * 将单个中文数字字符转换为阿拉伯数字
 */
function chineseCharToNumber(char: string): number | null {
  return CHINESE_NUMBER_MAP[char] ?? null;
}

/**
 * 将简单的中文数字转换为阿拉伯数字
 * 支持：一、二、三...十、十一、二十、三十...九十九
 */
function convertSimpleChineseNumber(text: string): number | null {
  // 处理单个数字
  if (text.length === 1) {
    return chineseCharToNumber(text);
  }

  // 处理"十"开头的数字（十、十一、十二...）
  if (text.startsWith('十') || text.startsWith('拾')) {
    if (text.length === 1) {
      return 10;
    }
    const remaining = text.slice(1);
    const digit = chineseCharToNumber(remaining);
    return digit !== null ? 10 + digit : null;
  }

  // 处理两位数（二十、三十...九十九）
  if (text.length === 2) {
    const first = chineseCharToNumber(text[0]);

    if (first !== null && text[1] === '十') {
      return first * 10;
    }
  }

  // 处理三位中文数字（二十一、三十五...）
  if (text.length === 3) {
    const first = chineseCharToNumber(text[0]);
    const third = chineseCharToNumber(text[2]);

    if (first !== null && (text[1] === '十' || text[1] === '拾') && third !== null) {
      return first * 10 + third;
    }
  }

  return null;
}

/**
 * 在文本中查找并替换中文数字
 * @param text 原始文本
 * @returns 替换后的文本
 */
export function replaceChineseNumbers(text: string): string {
  if (!text) return text;

  let result = text;

  // 匹配模式：中文数字 + 可选的量词/单位
  // 例如：两个、三杯、五十分钟、一百毫升
  const patterns = [
    // 匹配：数字+量词（如"两个"、"三杯"、"五十分钟"）
    /([零〇一壹二贰两俩三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟]+)([个杯碗盘份瓶袋包盒只条块片粒颗枚张把支根本斤克公斤千克毫升升小时分钟步里米])/g,
    // 匹配：纯数字（单独的中文数字）
    /([零〇一壹二贰两俩三叁四肆五伍六陆七柒八捌九玖十拾百佰]+)(?=[^个杯碗盘份瓶袋包盒只条块片粒颗枚张把支根本斤克公斤千克毫升升小时分钟步里米0-9]|$)/g
  ];

  patterns.forEach(pattern => {
    result = result.replace(pattern, (match, numberPart, unit = '') => {
      const arabicNumber = convertSimpleChineseNumber(numberPart);

      if (arabicNumber !== null) {
        return arabicNumber + unit;
      }

      return match; // 如果转换失败，保持原样
    });
  });

  return result;
}

/**
 * 从文本中提取数字（包括中文数字和阿拉伯数字）
 * @param text 文本
 * @returns 提取到的数字数组
 */
export function extractNumbers(text: string): number[] {
  const numbers: number[] = [];

  // 转换中文数字后再提取
  const converted = replaceChineseNumbers(text);

  // 提取阿拉伯数字
  const matches = converted.match(/\d+\.?\d*/g);
  if (matches) {
    numbers.push(...matches.map(m => parseFloat(m)));
  }

  return numbers;
}

/**
 * 测试函数：验证中文数字转换是否正确
 */
export function testChineseNumberConverter() {
  const testCases = [
    { input: '吃了两个包子', expected: '吃了2个包子' },
    { input: '喝了三杯水', expected: '喝了3杯水' },
    { input: '跑步三十分钟', expected: '跑步30分钟' },
    { input: '走了一万步', expected: '走了1万步' },
    { input: '睡了八小时', expected: '睡了8小时' },
    { input: '体重六十五公斤', expected: '体重65公斤' },
    { input: '喝了五百毫升', expected: '喝了500毫升' },
    { input: '吃了一碗面', expected: '吃了1碗面' },
    { input: '十个饺子', expected: '10个饺子' },
    { input: '二十三步', expected: '23步' }
  ];

  console.log('=== 中文数字转换测试 ===');
  testCases.forEach(({ input, expected }) => {
    const result = replaceChineseNumbers(input);
    const pass = result === expected;
    console.log(`${pass ? '✓' : '✗'} ${input} => ${result} ${!pass ? `(期望: ${expected})` : ''}`);
  });
}
