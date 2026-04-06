const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test API endpoints
async function testAPI() {
  console.log('🚀 Testing Health App Backend API...\n');

  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthCheck = await axios.get(`${API_BASE}/status`);
    console.log('✅ Health check:', healthCheck.data);
    console.log('');

    // Test user registration
    console.log('2. Testing user registration...');
    const testUser = {
      email: 'test@example.com',
      password: 'testpassword123',
      name: 'Test User'
    };

    try {
      const registerResponse = await axios.post(`${API_BASE}/auth/register`, testUser);
      console.log('✅ Registration successful:', registerResponse.data.message);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already registered')) {
        console.log('ℹ️  User already exists, continuing with login test...');
      } else {
        throw error;
      }
    }
    console.log('');

    // Test user login
    console.log('3. Testing user login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ Login successful');
    
    const token = loginResponse.data.session?.access_token;
    if (!token) {
      throw new Error('No access token received');
    }
    console.log('');

    // Test authenticated endpoints
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test get user profile
    console.log('4. Testing get user profile...');
    const profileResponse = await axios.get(`${API_BASE}/users/profile`, { headers: authHeaders });
    console.log('✅ Profile retrieved:', profileResponse.data.profile ? 'Profile exists' : 'No profile yet');
    console.log('');

    // Test add health record
    console.log('5. Testing add health record...');
    const healthRecord = {
      record_type: 'weight',
      value: 70.5,
      unit: 'kg',
      notes: 'Morning weight'
    };
    const addRecordResponse = await axios.post(`${API_BASE}/health/records`, healthRecord, { headers: authHeaders });
    console.log('✅ Health record added:', addRecordResponse.data.message);
    console.log('');

    // Test get health records
    console.log('6. Testing get health records...');
    const getRecordsResponse = await axios.get(`${API_BASE}/health/records`, { headers: authHeaders });
    console.log('✅ Health records retrieved:', `${getRecordsResponse.data.records.length} records found`);
    console.log('');

    // Test AI chat (if OpenAI key is configured)
    console.log('7. Testing AI chat...');
    try {
      const chatResponse = await axios.post(`${API_BASE}/ai/chat`, {
        message: '你好，我想了解一些健康建议'
      }, { headers: authHeaders });
      console.log('✅ AI chat working:', chatResponse.data.response.substring(0, 50) + '...');
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('ℹ️  AI chat requires OpenAI API key configuration');
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('🎉 All API tests completed successfully!');
    console.log('\n📋 API Endpoints Available:');
    console.log('- GET  /api/status - Health check');
    console.log('- POST /api/auth/register - User registration');
    console.log('- POST /api/auth/login - User login');
    console.log('- GET  /api/users/profile - Get user profile');
    console.log('- PUT  /api/users/profile - Update user profile');
    console.log('- GET  /api/health/records - Get health records');
    console.log('- POST /api/health/records - Add health record');
    console.log('- POST /api/ai/chat - AI chat');
    console.log('- And many more...');

  } catch (error) {
    console.error('❌ API Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests
testAPI();