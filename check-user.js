/**
 * 检查当前登录用户的脚本
 * 在浏览器控制台中运行此代码
 */

// 方法1: 直接从 localStorage 检查 Supabase 会话
function checkCurrentUser() {
  console.log('🔍 开始检查当前登录用户...\n');
  
  // 1. 检查 Supabase 会话
  console.log('1️⃣ 检查 Supabase 会话数据:');
  const supabaseKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-')) {
      supabaseKeys.push(key);
    }
  }
  
  if (supabaseKeys.length === 0) {
    console.log('   ❌ 未找到 Supabase 会话（用户可能未登录）');
  } else {
    console.log(`   ✓ 找到 ${supabaseKeys.length} 个 Supabase 会话键`);
    
    // 尝试解析会话
    const authKey = supabaseKeys.find(k => k.includes('auth-token')) || supabaseKeys[0];
    try {
      const sessionData = localStorage.getItem(authKey);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed.currentSession) {
          const session = parsed.currentSession;
          const user = session.user;
          
          console.log('   📋 用户信息:');
          console.log('      - 用户ID:', user?.id || '未找到');
          console.log('      - 邮箱:', user?.email || '未找到');
          console.log('      - 手机号:', user?.user_metadata?.phone || '未找到');
          console.log('      - 创建时间:', user?.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '未找到');
          console.log('      - 会话过期:', session.expires_at ? new Date(session.expires_at * 1000).toLocaleString('zh-CN') : '未找到');
          
          return {
            userId: user?.id,
            email: user?.email,
            phone: user?.user_metadata?.phone,
            session: session
          };
        }
      }
    } catch (e) {
      console.log('   ⚠ 无法解析会话数据:', e.message);
    }
  }
  
  // 2. 检查 localStorage 中的用户数据
  console.log('\n2️⃣ 检查 localStorage 中的用户数据:');
  const userDataKeys = [];
  const userIds = new Set();
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes(':user:') || key.includes('userProfile'))) {
      userDataKeys.push(key);
      const match = key.match(/:user:([^:]+)/);
      if (match) {
        userIds.add(match[1]);
      }
    }
  }
  
  if (userDataKeys.length > 0) {
    console.log(`   ✓ 找到 ${userDataKeys.length} 个用户相关的数据键`);
    console.log('   📋 发现的用户ID:', Array.from(userIds).join(', ') || '无');
  } else {
    console.log('   ⚠ 未找到用户相关的 localStorage 数据');
  }
  
  // 3. 尝试使用 Supabase API（如果可用）
  console.log('\n3️⃣ 尝试使用 Supabase API 查询:');
  if (typeof supabase !== 'undefined') {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        console.log('   ❌ 获取用户失败:', error.message);
      } else if (user) {
        console.log('   ✓ 成功获取用户信息:');
        console.log('      - 用户ID:', user.id);
        console.log('      - 邮箱:', user.email || '未设置');
        console.log('      - 手机号:', user.user_metadata?.phone || '未设置');
        return user;
      } else {
        console.log('   ❌ 未找到登录用户');
      }
    });
  } else {
    console.log('   ⚠ supabase 对象不可用（需要在应用页面中运行）');
  }
  
  console.log('\n✅ 检查完成');
}

// 导出函数
if (typeof window !== 'undefined') {
  window.checkCurrentUser = checkCurrentUser;
}

// 如果直接运行，执行检查
if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
  checkCurrentUser();
}





