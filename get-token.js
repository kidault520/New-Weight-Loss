// 在浏览器控制台中运行以下代码来获取 Access Token

// 方法1: 从 localStorage 中获取（最简单）
(function() {
  // 查找所有 localStorage 中的键
  const keys = Object.keys(localStorage);
  
  // 查找包含 auth 或 token 的键
  const authKeys = keys.filter(key => 
    key.includes('auth') || key.includes('token') || key.includes('supabase')
  );
  
  console.log('🔍 找到的认证相关键:', authKeys);
  
  // 尝试从常见的 Supabase localStorage 键中获取
  for (const key of authKeys) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        const parsed = JSON.parse(value);
        if (parsed.access_token) {
          console.log('✅ 找到 Access Token!');
          console.log('Key:', key);
          console.log('Access Token:', parsed.access_token);
          console.log('\n📋 复制这个值到测试界面:');
          console.log('Bearer ' + parsed.access_token);
          return parsed.access_token;
        }
      }
    } catch (e) {
      // 不是 JSON，跳过
    }
  }
  
  console.log('❌ 未找到 Access Token');
  console.log('\n💡 请尝试方法2: 从 Network 请求中获取');
})();

// 方法2: 监听网络请求获取 token（需要先发送一条消息）
// 在发送消息后，运行以下代码：
/*
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('ai-chat') || entry.name.includes('functions')) {
      console.log('找到请求:', entry.name);
    }
  }
});
observer.observe({ entryTypes: ['resource'] });
*/


















