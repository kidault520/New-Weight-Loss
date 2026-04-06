// 新用户配送计划测试工具
// 在浏览器控制台运行这些函数

// 1. 清空所有数据（模拟新用户）
function clearAllData() {
  const confirmed = confirm('⚠️ 确定要清空所有数据吗？这将模拟一个全新的用户状态。');
  if (!confirmed) return;

  localStorage.clear();
  sessionStorage.clear();

  console.log('✅ 所有数据已清空！现在是一个全新用户状态。');
  console.log('📝 下一步：运行 setupNewUser() 创建新用户数据');
}

// 2. 创建新用户数据
function setupNewUser() {
  try {
    // 创建用户资料
    const userId = 'test-new-user-' + Date.now();
    const userProfile = {
      user_id: userId,
      nickname: '新用户',
      gender: 'male',
      age: 28,
      height: 175,
      weight: 70,
      current_weight: 70,
      target_weight: 65,
      fitness_goal: 'weight_loss',
      activity_level: 'moderate',
      bmr: 1680,
      created_at: new Date().toISOString()
    };

    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    console.log('✅ 用户资料创建成功：', userProfile);

    // 创建默认地址
    const addressId = 'addr-default-' + Date.now();
    const defaultAddress = {
      id: addressId,
      user_id: userId,
      label: '家',
      tag: '家',
      address: '北京市朝阳区望京街道',
      door_number: '时代国际嘉园3号楼1单元303',
      contact_name: '张先生',
      phone: '13800138000',
      gender: 'male',
      is_default: true,
      created_at: new Date().toISOString()
    };

    const addresses = [defaultAddress];
    localStorage.setItem('delivery_addresses', JSON.stringify(addresses));
    console.log('✅ 默认地址创建成功：', defaultAddress);

    // 创建餐食计划配置
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 6); // 7天计划

    const mealPlanConfig = {
      userId: userId,
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      planDuration: 7,
      mealsPerDay: ['lunch', 'dinner'],
      selectedDates: [],
      defaultAddressId: addressId,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('mealPlanConfig', JSON.stringify(mealPlanConfig));
    console.log('✅ 餐食计划配置创建成功：', mealPlanConfig);

    console.log('\n🎉 新用户设置完成！');
    console.log('📝 下一步：刷新页面，然后在仪表盘点击"餐食计划"卡片');
    console.log('\n💡 提示：运行 checkData() 可以查看当前数据状态');

    return {
      userProfile,
      defaultAddress,
      mealPlanConfig
    };
  } catch (error) {
    console.error('❌ 设置失败：', error);
  }
}

// 3. 检查当前数据状态
function checkData() {
  console.log('=== 当前数据状态 ===\n');

  const userProfile = localStorage.getItem('userProfile');
  const addresses = localStorage.getItem('delivery_addresses');
  const mealPlanConfig = localStorage.getItem('mealPlanConfig');
  const mealAddresses = localStorage.getItem('mealAddresses');

  console.log('1. 用户资料 (userProfile):');
  if (userProfile) {
    console.log('✅ 存在');
    console.log(JSON.parse(userProfile));
  } else {
    console.log('❌ 不存在');
  }

  console.log('\n2. 配送地址 (delivery_addresses):');
  if (addresses) {
    console.log('✅ 存在');
    console.log(JSON.parse(addresses));
  } else {
    console.log('❌ 不存在');
  }

  console.log('\n3. 餐食计划配置 (mealPlanConfig):');
  if (mealPlanConfig) {
    console.log('✅ 存在');
    console.log(JSON.parse(mealPlanConfig));
  } else {
    console.log('❌ 不存在');
  }

  console.log('\n4. 餐次地址映射 (mealAddresses):');
  if (mealAddresses) {
    console.log('✅ 存在');
    console.log(JSON.parse(mealAddresses));
  } else {
    console.log('❌ 不存在（这是正常的，会在修改地址时创建）');
  }

  console.log('\n=== 完整的localStorage ===');
  console.log('总共有', Object.keys(localStorage).length, '个键');
}

// 4. 一键完成所有步骤
function quickSetup() {
  console.log('🚀 开始快速设置新用户...\n');
  clearAllData();
  setTimeout(() => {
    setupNewUser();
    console.log('\n✨ 快速设置完成！请刷新页面。');
  }, 500);
}

// 输出使用说明
console.log(`
╔════════════════════════════════════════════════════════════╗
║         🧪 新用户配送计划测试工具                            ║
╚════════════════════════════════════════════════════════════╝

📋 使用方法：

方式1 - 分步执行：
  1. clearAllData()     - 清空所有数据（模拟新用户）
  2. setupNewUser()     - 创建新用户数据
  3. 刷新页面
  4. 在仪表盘点击"餐食计划"

方式2 - 一键完成：
  quickSetup()          - 自动完成所有步骤，然后刷新页面

其他命令：
  checkData()           - 查看当前数据状态

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

示例：直接在控制台输入
  > quickSetup()
  然后刷新页面即可

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// 将函数暴露到全局
window.clearAllData = clearAllData;
window.setupNewUser = setupNewUser;
window.checkData = checkData;
window.quickSetup = quickSetup;
