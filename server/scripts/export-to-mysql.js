/**
 * 导出 Supabase (PostgreSQL) 数据库数据为 MySQL INSERT 语句
 * 
 * 使用方法:
 * cd server
 * node scripts/export-to-mysql.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 配置！');
  console.error('请确保 server/.env 文件中包含:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 需要导出的表列表（排除系统表）
const TABLES_TO_EXPORT = [
  'user_profiles',
  'health_records',
  'ai_conversations',
  'meal_plans',
  'admin_roles',
  'admin_users',
  'admin_audit_logs',
  'supplement_plans',
  'products',
  'orders',
  'order_items',
  'delivery_schedules',
  'delivery_addresses',
  'health_assessments',
  'nutrition_plans',
  'user_packages',
  'user_devices',
  'user_preferences',
  'chat_messages',
  'emotion_statistics',
  'custom_reports',
  'supplement_records',
  'meal_orders',
  'content_pages',
  'content_categories',
  'menus',
  'menu_items',
  'menu_categories',
  'meal_plan_templates',
  'supplement_packages',
  'food_library',
  'exercise_library',
  'food_categories',
  'exercise_categories',
];

/**
 * 转义 MySQL 字符串值
 */
function escapeMySQLString(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  if (typeof value === 'object') {
    // JSON/JSONB 对象
    return `'${JSON.stringify(value).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
  }
  
  // 字符串
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`;
}

/**
 * 格式化日期时间为 MySQL DATETIME 格式
 */
function formatMySQLDateTime(dateValue) {
  if (!dateValue) return 'NULL';
  
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return 'NULL';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `'${year}-${month}-${day} ${hours}:${minutes}:${seconds}'`;
}

/**
 * 格式化 UUID 为 MySQL 字符串
 */
function formatUUID(uuidValue) {
  if (!uuidValue) return 'NULL';
  return `'${String(uuidValue)}'`;
}

/**
 * 导出单个表的数据
 */
async function exportTable(tableName) {
  try {
    console.log(`📊 正在导出表: ${tableName}...`);
    
    // 获取表的所有数据
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(`  ❌ 错误: ${error.message}`);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log(`  ⚠️  表 ${tableName} 没有数据`);
      return { tableName, insertStatements: [], rowCount: 0 };
    }
    
    console.log(`  ✅ 找到 ${data.length} 条记录`);
    
    // 生成 INSERT 语句
    const insertStatements = [];
    
    // 获取列名
    const columns = Object.keys(data[0]);
    
    // 为每行数据生成 INSERT 语句
    for (const row of data) {
      const values = columns.map(col => {
        const value = row[col];
        
        // 处理不同类型的值
        if (value === null || value === undefined) {
          return 'NULL';
        }
        
        // UUID 类型
        if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          return formatUUID(value);
        }
        
        // 日期时间类型
        if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
          return formatMySQLDateTime(value);
        }
        
        // JSON/JSONB 类型
        if (typeof value === 'object' && !(value instanceof Date)) {
          return escapeMySQLString(JSON.stringify(value));
        }
        
        // 其他类型
        return escapeMySQLString(value);
      });
      
      const insertSQL = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});`;
      insertStatements.push(insertSQL);
    }
    
    return { tableName, insertStatements, rowCount: data.length };
    
  } catch (error) {
    console.error(`  ❌ 导出表 ${tableName} 时出错:`, error.message);
    return null;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始导出数据库数据为 MySQL INSERT 语句...\n');
  
  const outputDir = path.join(__dirname, '..', '..', 'mysql-export');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputFile = path.join(outputDir, `mysql-export-${timestamp}.sql`);
  
  let totalRows = 0;
  const results = [];
  
  // 导出所有表
  for (const tableName of TABLES_TO_EXPORT) {
    const result = await exportTable(tableName);
    if (result) {
      results.push(result);
      totalRows += result.rowCount || 0;
    }
    // 添加小延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 写入文件
  console.log(`\n📝 正在写入文件: ${outputFile}...`);
  
  const fileContent = [
    '-- MySQL 数据导出',
    `-- 导出时间: ${new Date().toISOString()}`,
    `-- 总记录数: ${totalRows}`,
    '-- ',
    '-- 注意:',
    '-- 1. 请确保目标 MySQL 数据库已创建相应的表结构',
    '-- 2. UUID 类型在 MySQL 中应使用 CHAR(36) 或 BINARY(16)',
    '-- 3. JSONB 类型在 MySQL 中应使用 JSON 或 TEXT',
    '-- 4. timestamptz 类型在 MySQL 中应使用 DATETIME',
    '-- 5. 建议在导入前禁用外键检查: SET FOREIGN_KEY_CHECKS = 0;',
    '-- 6. 导入后重新启用: SET FOREIGN_KEY_CHECKS = 1;',
    '',
    'SET FOREIGN_KEY_CHECKS = 0;',
    'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";',
    'SET AUTOCOMMIT = 0;',
    'START TRANSACTION;',
    '',
    ...results.flatMap(result => {
      if (result.insertStatements.length === 0) {
        return [`-- 表 ${result.tableName} 没有数据`, ''];
      }
      return [
        `-- ============================================`,
        `-- 表: ${result.tableName} (${result.rowCount} 条记录)`,
        `-- ============================================`,
        '',
        ...result.insertStatements,
        ''
      ];
    }),
    'COMMIT;',
    'SET FOREIGN_KEY_CHECKS = 1;',
    ''
  ].join('\n');
  
  fs.writeFileSync(outputFile, fileContent, 'utf8');
  
  console.log(`\n✅ 导出完成！`);
  console.log(`📁 文件位置: ${outputFile}`);
  console.log(`📊 总记录数: ${totalRows}`);
  console.log(`📋 导出表数: ${results.filter(r => r.rowCount > 0).length}`);
  
  // 生成统计信息
  const statsFile = path.join(outputDir, `export-stats-${timestamp}.txt`);
  const stats = results
    .filter(r => r.rowCount > 0)
    .map(r => `${r.tableName}: ${r.rowCount} 条记录`)
    .join('\n');
  
  fs.writeFileSync(statsFile, `导出统计信息\n${'='.repeat(50)}\n\n${stats}\n\n总计: ${totalRows} 条记录`, 'utf8');
  console.log(`📈 统计信息: ${statsFile}`);
}

// 运行主函数
main().catch(error => {
  console.error('❌ 导出失败:', error);
  process.exit(1);
});

