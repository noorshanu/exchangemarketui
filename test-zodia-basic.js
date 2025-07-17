import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ZODIA_REST_URL = process.env.ZODIA_REST_URL || "https://trade-uk.sandbox.zodiamarkets.com";
const ZODIA_API_KEY = process.env.ZODIA_API_KEY;

async function testBasicEndpoints() {
  console.log('🧪 Testing basic Zodia endpoints...');
  
  // Test 1: Available instruments (no auth required)
  try {
    console.log('\n1️⃣ Testing available instruments...');
    const instrumentsResponse = await axios.get(`${ZODIA_REST_URL}/zm/rest/available-instruments`);
    console.log('✅ Instruments endpoint works!');
    console.log('Status:', instrumentsResponse.status);
    console.log('Instruments count:', instrumentsResponse.data.instruments?.length || 0);
  } catch (error) {
    console.log('❌ Instruments endpoint failed:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.message);
  }
  
  // Test 2: Try auth with minimal headers
  try {
    console.log('\n2️⃣ Testing auth with minimal headers...');
    const tonce = Date.now() * 1000;
    const response = await axios.post(`${ZODIA_REST_URL}/api/3/zm/rest/auth/token`, {
      tonce: tonce
    }, {
      headers: {
        'Rest-Key': ZODIA_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Auth with minimal headers works!');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('❌ Auth with minimal headers failed:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.message);
  }
  
  // Test 3: Check if API key is valid format
  console.log('\n3️⃣ API Key Analysis:');
  console.log('API Key length:', ZODIA_API_KEY?.length || 0);
  console.log('API Key format:', ZODIA_API_KEY?.includes('-') ? 'UUID format' : 'Other format');
  console.log('API Key starts with:', ZODIA_API_KEY?.substring(0, 8) || 'N/A');
}

testBasicEndpoints(); 