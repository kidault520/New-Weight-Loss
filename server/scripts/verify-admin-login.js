const path = require('path');
const dotenv = require('dotenv');

// 加载 .env（server 目录）
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { supabase, supabaseAdmin } = require('../config/supabase');

async function verify(email, password) {
  console.log(`🔎 正在验证管理员登录: ${email}`);

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ 环境变量不完整：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // 使用公开 anon key 验证密码登录
  console.log('\n1️⃣ 使用 Supabase 密码登录...');
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error('❌ 登录失败：', signInError.message);
    process.exit(1);
  }
  if (!sessionData.session || !sessionData.user) {
    console.error('❌ 登录未返回 session 或 user');
    process.exit(1);
  }

  console.log('✅ 登录成功');
  console.log(`   User ID: ${sessionData.user.id}`);
  console.log(`   Access Token: ${sessionData.session.access_token.slice(0, 12)}... (已截断)`);

  // 检查是否存在于 admin_users
  console.log('\n2️⃣ 检查管理员权限记录...');
  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('user_id', sessionData.user.id)
    .maybeSingle();

  if (adminError) {
    console.error('❌ 查询 admin_users 失败：', adminError.message);
    process.exit(1);
  }

  if (!adminRow) {
    console.error('❌ 该用户不在 admin_users 表中');
    process.exit(1);
  }

  console.log('✅ 管理员记录存在');
  console.log(`   角色: ${adminRow.role}`);
  console.log(`   状态: ${adminRow.is_active ? '活跃' : '禁用'}`);

  console.log('\n🎉 验证完成，管理员登录凭据有效');
}

const email = process.argv[2] || 'admin@redanwell.com';
const password = process.argv[3] || 'admin123456';

verify(email, password)
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 脚本执行失败', err);
    process.exit(1);
  });

