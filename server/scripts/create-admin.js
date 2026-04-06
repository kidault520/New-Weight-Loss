/**
 * 创建第一个管理员账户的脚本
 * 
 * 使用方法：
 * node scripts/create-admin.js <email> <password>
 * 
 * 例如：
 * node scripts/create-admin.js admin@example.com mypassword123
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
  console.error('\n   当前.env文件路径:', path.join(__dirname, '..', '.env'));
  process.exit(1);
}

const { supabaseAdmin } = require('../config/supabase');

async function createAdmin(email, password) {
  try {
    console.log('🔐 正在创建/更新管理员账户...');
    console.log(`📧 邮箱: ${email}`);

    // 1. 检查用户是否已存在
    console.log('\n1️⃣ 检查用户是否已存在...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    let user = null;
    if (!listError && users) {
      user = users.find(u => u.email === email);
    }

    let userId;
    let isNewUser = false;

    if (user) {
      // 用户已存在
      console.log('✅ 用户已存在于 Supabase Auth 中');
      console.log(`   User ID: ${user.id}`);
      userId = user.id;
    } else {
      // 用户不存在，创建新用户
      console.log('📝 用户不存在，正在创建新用户...');
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // 自动确认邮箱，无需验证
      });

      if (authError) {
        console.error('❌ 创建用户失败:', authError.message);
        return;
      }

      if (!authData.user) {
        console.error('❌ 用户创建失败：未返回用户数据');
        return;
      }

      console.log('✅ 用户创建成功');
      console.log(`   User ID: ${authData.user.id}`);
      userId = authData.user.id;
      isNewUser = true;
    }

    // 2. 在admin_users表中添加管理员记录
    console.log('\n2️⃣ 添加管理员权限...');
    
    // 先检查是否已经是管理员
    const { data: existingAdmin, error: checkError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let adminData;
    
    if (existingAdmin) {
      // 用户已经是管理员，更新权限
      console.log('⚠️  用户已经是管理员，正在更新权限...');
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('admin_users')
        .update({
          role: 'super_admin',
          is_active: true,
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ 更新管理员权限失败:', updateError.message);
        return;
      }

      adminData = updateData;
      console.log('✅ 管理员权限更新成功');
    } else {
      // 用户不是管理员，添加管理员权限
      const { data: insertData, error: adminError } = await supabaseAdmin
        .from('admin_users')
        .insert({
          user_id: userId,
          role: 'super_admin',
          permissions: {},
          is_active: true,
        })
        .select()
        .single();

      if (adminError) {
        console.error('❌ 添加管理员权限失败:', adminError.message);
        console.error('   错误代码:', adminError.code);
        return;
      }

      adminData = insertData;
      console.log('✅ 管理员权限添加成功');
    }



    console.log(`   Admin ID: ${adminData.id}`);
    console.log(`   角色: ${adminData.role}`);

    // 3. 记录审计日志
    console.log('\n3️⃣ 记录操作日志...');
    await supabaseAdmin
      .from('admin_audit_logs')
      .insert({
        admin_id: adminData?.id || null,
        action: isNewUser ? 'CREATE_ADMIN' : 'UPDATE_ADMIN',
        resource_type: 'admin_user',
        resource_id: userId,
        details: {
          email,
          role: 'super_admin',
          created_by: 'script',
        },
      });

    console.log('\n🎉 管理员账户创建成功！');
    console.log('\n📋 登录信息：');
    console.log(`   邮箱: ${email}`);
    console.log(`   密码: ${password}`);
    console.log(`   角色: super_admin (超级管理员)`);
    console.log('\n🌐 现在可以访问管理后台：');
    console.log('   http://localhost:5174/admin/login');
    console.log('\n⚠️  请妥善保管登录凭据！');

  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    console.error(error);
  }
}

// 从命令行参数获取邮箱和密码
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('❌ 使用方法: node scripts/create-admin.js <email> <password>');
  console.error('   例如: node scripts/create-admin.js admin@example.com mypassword123');
  process.exit(1);
}

if (password.length < 6) {
  console.error('❌ 密码长度至少需要6个字符');
  process.exit(1);
}

// 环境变量检查已在文件开头完成

// 执行创建
createAdmin(email, password)
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });

