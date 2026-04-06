/**
 * 测试Supabase连接
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 检查Supabase配置...');
console.log('URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ 未设置');
console.log('Service Key:', supabaseServiceKey ? '✅ 已设置' : '❌ 未设置');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少Supabase配置！');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    console.log('\n🔗 测试Supabase连接...');
    
    // 测试1: 检查admin_users表
    const { data, error } = await supabase
      .from('admin_users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ 连接失败:', error.message);
      console.error('错误代码:', error.code);
      return false;
    }
    
    console.log('✅ Supabase连接成功！');
    console.log('✅ 可以访问admin_users表');
    
    // 测试2: 检查auth.users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.warn('⚠️  无法访问auth.users:', usersError.message);
    } else {
      console.log('✅ 可以访问auth.users');
      console.log(`   找到 ${users.users.length} 个用户`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ 连接测试失败:', error.message);
    if (error.cause) {
      console.error('原因:', error.cause.message || error.cause);
    }
    return false;
  }
}

testConnection()
  .then(success => {
    if (success) {
      console.log('\n✅ 所有测试通过！');
      process.exit(0);
    } else {
      console.log('\n❌ 测试失败，请检查配置');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ 发生错误:', error);
    process.exit(1);
  });











