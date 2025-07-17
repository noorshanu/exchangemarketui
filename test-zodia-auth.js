import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ZODIA_REST_URL = process.env.ZODIA_REST_URL || "https://trade-uk.sandbox.zodiamarkets.com";
const ZODIA_API_KEY = process.env.ZODIA_API_KEY;
const ZODIA_SECRET_KEY = process.env.ZODIA_SECRET_KEY;

function generateTonce() {
  return Date.now() * 1000; // Current time in microseconds
}

function generateSignature(path, body, secretKey) {
  // Base64 decode the secret key
  const decodedSecret = Buffer.from(secretKey, 'base64');
  
  // Create the message: path + null byte + body
  const message = path + '\0' + body;
  
  // Sign with HMAC-SHA512
  const signature = crypto.createHmac('sha512', decodedSecret).update(message).digest();
  
  // Base64 encode the signature
  return signature.toString('base64');
}

async function testZodiaAuth() {
  try {
    console.log(`\n🔐 Testing Zodia Authentication (Correct Method)...`);
    
    const tonce = generateTonce();
    const path = '/api/3/zm/rest/auth/token';
    const body = JSON.stringify({ tonce: tonce });
    
    const signature = generateSignature(path, body, ZODIA_SECRET_KEY);
    
    const headers = {
      'Rest-Key': ZODIA_API_KEY,
      'Rest-Sign': signature,
      'Content-Type': 'application/json'
    };
    
    console.log('📤 Request Details:');
    console.log('URL:', `${ZODIA_REST_URL}${path}`);
    console.log('Path:', path);
    console.log('Body:', body);
    console.log('Tonce:', tonce);
    console.log('Signature:', signature);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    
    const response = await axios.post(`${ZODIA_REST_URL}${path}`, {
      tonce: tonce
    }, {
      headers: headers,
      timeout: 10000
    });

    console.log('✅ Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    console.log('Response Headers:', JSON.stringify(response.headers, null, 2));
    
    if (response.data && response.data.token && response.data.token !== "") {
      console.log('🎉 SUCCESS! Token obtained!');
      return true;
    } else {
      console.log('❌ No valid token in response');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error:');
    console.log('Message:', error.message);
    console.log('Status:', error.response?.status);
    console.log('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Request Headers Sent:', JSON.stringify(error.config?.headers, null, 2));
    return false;
  }
}

// Test with correct signature method
testZodiaAuth(); 