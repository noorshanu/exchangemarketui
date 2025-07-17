import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = 'http://localhost:4000/api';

async function testInstrumentsEndpoint() {
  try {
    console.log('🔍 Testing Instruments Endpoint...');
    console.log('URL:', `${API_BASE_URL}/instruments`);
    
    const response = await axios.get(`${API_BASE_URL}/instruments`, {
      timeout: 10000
    });

    console.log('✅ Response:');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Total Instruments:', response.data.data.instruments?.length || 0);
    
    // Show first few instruments
    const instruments = response.data.data.instruments || [];
    console.log('\n📋 Sample Instruments:');
    instruments.slice(0, 5).forEach((inst, index) => {
      console.log(`${index + 1}. ${inst.instrument} - Active: ${inst.active}, Enabled: ${inst.enabled}`);
    });
    
    if (instruments.length > 5) {
      console.log(`... and ${instruments.length - 5} more instruments`);
    }
    
    // Show stats
    const activeInstruments = instruments.filter(inst => inst.active && inst.enabled);
    const enabledInstruments = instruments.filter(inst => inst.enabled);
    
    console.log('\n📊 Statistics:');
    console.log(`Total: ${instruments.length}`);
    console.log(`Active: ${activeInstruments.length}`);
    console.log(`Enabled: ${enabledInstruments.length}`);
    console.log(`Disabled: ${instruments.length - enabledInstruments.length}`);
    
  } catch (error) {
    console.log('❌ Error:');
    console.log('Message:', error.message);
    console.log('Status:', error.response?.status);
    console.log('Response Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

// Test the endpoint
testInstrumentsEndpoint(); 