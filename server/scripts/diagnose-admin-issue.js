/**
 * 诊断管理员权限问题的脚本
 * 
 * 使用方法：
 * node scripts/diagnose-admin-issue.js <email>
 * 
 * 例如：
 * node scripts/diagnose-admin-issue.js admin@redanwell.com
 */

const path = require('path');
const dotenv = require('dotenv');

// 加载.env文件（从server目录）
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 检查环境变量
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 缺少Supabase配置！');
  console.error('   请确保在 server/.env 文件中设置了：');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const { supabaseAdmin } = require('../config/supabase');

async function diagnoseAdminIssue(email) {
  try {
    console.log('🔍 开始诊断管理员权限问题...\n');
    console.log(`📧 检查邮箱: ${email}\n`);

    // 1. 检查用户是否在 auth.users 表中
    console.log('1️⃣ 检查用户是否在 Supabase Auth 中...');
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ 无法访问 Supabase Auth:', authError.message);
      return;
    }

    const user = authUsers.users.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ 用户不在 Supabase Auth 中！');
      console.log('\n💡 解决方案：');
      console.log('   1. 用户需要先注册/登录一次');
      console.log('   2. 或者使用 create-admin.js 脚本创建管理员账户');
      return;
    }

    console.log('✅ 用户存在于 Supabase Auth 中');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Email Confirmed: ${user.email_confirmed_at ? '是' : '否'}`);
    console.log(`   Created At: ${user.created_at}\n`);

    // 2. 检查用户是否在 admin_users 表中
    console.log('2️⃣ 检查用户是否在 admin_users 表中...');
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('❌ 查询 admin_users 表时出错:', adminError.message);
      console.error('   错误代码:', adminError.code);
      console.error('   详细信息:', adminError);
      return;
    }

    if (!adminUser) {
      console.log('❌ 用户不在 admin_users 表中！');
      console.log('\n💡 解决方案：');
      console.log('   执行以下命令创建管理员账户：');
      console.log(`   node scripts/create-admin.js ${email} <password>`);
      return;
    }

    console.log('✅ 用户存在于 admin_users 表中');
    console.log(`   Admin ID: ${adminUser.id}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Is Active: ${adminUser.is_active ? '是 ✅' : '否 ❌'}`);
    console.log(`   Created At: ${adminUser.created_at}`);
    console.log(`   Last Login: ${adminUser.last_login_at || '从未登录'}\n`);

    // 3. 检查 is_active 状态
    if (!adminUser.is_active) {
      console.log('⚠️  问题发现：管理员账户被设置为非活跃状态！');
      console.log('\n💡 解决方案：');
      console.log('   在 Supabase SQL Editor 中执行：');
      console.log(`   UPDATE admin_users SET is_active = true WHERE user_id = '${user.id}';`);
      return;
    }

    // 4. 检查角色
    console.log('3️⃣ 检查管理员角色...');
    if (adminUser.role) {
      console.log(`✅ 角色: ${adminUser.role}`);
      
      // 检查角色是否在 admin_roles 表中定义
      const { data: roleData } = await supabaseAdmin
        .from('admin_roles')
        .select('*')
        .eq('role_name', adminUser.role)
        .maybeSingle();

      if (roleData) {
        console.log(`✅ 角色定义存在`);
        console.log(`   描述: ${roleData.description || '无'}`);
      } else {
        console.log(`⚠️  角色定义不存在（但这通常不是问题）`);
      }
    } else {
      console.log('⚠️  用户没有设置角色');
    }

    console.log('\n✅ 诊断完成！');
    console.log('\n📋 总结：');
    console.log('   - 用户存在于 Supabase Auth: ✅');
    console.log('   - 用户存在于 admin_users 表: ✅');
    console.log('   - 账户状态: ' + (adminUser.is_active ? '活跃 ✅' : '非活跃 ❌'));
    console.log('   - 角色: ' + (adminUser.role || '未设置'));
    
    if (adminUser.is_active) {
      console.log('\n🎉 所有检查都通过了！');
      console.log('   如果仍然遇到 "Access denied" 错误，请检查：');
      console.log('   1. 服务器日志中的详细错误信息');
      console.log('   2. 网络连接是否正常');
      console.log('   3. Supabase 服务是否正常运行');
    }

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error.message);
    console.error(error);
  }
}

// 从命令行参数获取邮箱
const email = process.argv[2];

if (!email) {
  console.error('❌ 使用方法: node scripts/diagnose-admin-issue.js <email>');
  console.error('   例如: node scripts/diagnose-admin-issue.js admin@redanwell.com');
  process.exit(1);
}

// 执行诊断
diagnoseAdminIssue(email)
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });




