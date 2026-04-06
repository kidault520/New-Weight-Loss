const path = require('path');
const dotenv = require('dotenv');

// 加载.env文件（从server目录）
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { supabaseAdmin } = require('../config/supabase');

async function resetAdminPassword(email, newPassword) {
  try {
    console.log(`🔄 正在重置管理员密码: ${email}`);
    console.log(`🔑 新密码: ${newPassword}`);

    // 1. 查找用户
    console.log('\n1️⃣ 查找用户...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    const user = users?.find(u => u.email === email);
    if (!user) {
      console.error('❌ 用户不存在:', email);
      return;
    }
    
    console.log(`✅ 找到用户: ${user.email}`);
    console.log(`   User ID: ${user.id}`);

    // 2. 重置密码
    console.log('\n2️⃣ 重置密码...');
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        email_confirm: true,
      }
    );

    if (updateError) {
      console.error('❌ 密码重置失败:', updateError.message);
      return;
    }

    console.log('✅ 密码重置成功！');
    console.log(`   用户邮箱: ${updateData.user.email}`);

    // 3. 检查admin_users表状态
    console.log('\n3️⃣ 检查管理员状态...');
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (adminError) {
      console.error('❌ 检查管理员状态失败:', adminError.message);
      return;
    }

    if (!adminData) {
      console.error('❌ 用户不在admin_users表中，正在添加...');
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('admin_users')
        .insert({
          user_id: user.id,
          role: 'super_admin',
          permissions: {},
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ 添加管理员权限失败:', insertError.message);
        return;
      }

      console.log('✅ 管理员权限添加成功！');
      console.log(`   角色: ${insertData.role}`);
      console.log(`   状态: ${insertData.is_active ? '活跃' : '禁用'}`);
    } else {
      console.log('✅ 管理员状态正常');
      console.log(`   角色: ${adminData.role}`);
      console.log(`   状态: ${adminData.is_active ? '活跃' : '禁用'}`);
      
      // 确保管理员是活跃状态
      if (!adminData.is_active) {
        console.log('\n4️⃣ 激活管理员账户...');
        const { data: activateData, error: activateError } = await supabaseAdmin
          .from('admin_users')
          .update({ is_active: true })
          .eq('user_id', user.id)
          .select()
          .single();

        if (activateError) {
          console.error('❌ 激活管理员失败:', activateError.message);
          return;
        }

        console.log('✅ 管理员账户已激活！');
      }
    }

    console.log('\n🎉 密码重置完成！');
    console.log('\n📋 登录信息：');
    console.log(`   邮箱: ${email}`);
    console.log(`   密码: ${newPassword}`);
    console.log('\n🌐 访问地址：');
    console.log('   http://localhost:5174/admin/login');
    
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    console.error(error);
  }
}

// 运行脚本
resetAdminPassword('admin@redanwell.com', 'admin123456')
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
