// backend/index.js
import express from "express";
import cors from "cors";
import axios from "axios";
// import { WebSocketServer } from "ws"; // COMMENTED OUT - WebSocket removed
// import { createServer } from "http"; // COMMENTED OUT - WebSocket removed
import dotenv from "dotenv";
import winston from "winston";
import crypto from "crypto";
import priceRoutes from "./routes/price.js";

// Load environment variables
dotenv.config();

const app = express();
// const server = createServer(app); // COMMENTED OUT - WebSocket removed
const PORT = process.env.PORT || 4000;

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(cors());
app.use(express.json());

// Zodia Markets configuration (REST only)
// const ZODIA_WS_URL = process.env.ZODIA_WS_URL || "wss://trade-uk.sandbox.zodiamarkets.com"; // COMMENTED OUT
const ZODIA_REST_URL = process.env.ZODIA_REST_URL || "https://trade-uk.sandbox.zodiamarkets.com";
const ZODIA_API_KEY = process.env.ZODIA_API_KEY;
const ZODIA_SECRET_KEY = process.env.ZODIA_SECRET_KEY;

// Real provider configurations
const providers = [
  {
    name: "Zodia",
    baseUrl: process.env.ZODIA_BASE_URL || "https://trade-uk.sandbox.zodiamarkets.com",
    apiKey: process.env.ZODIA_API_KEY,
    secretKey: process.env.ZODIA_SECRET_KEY,
    enabled: true,
    endpoints: {
      prices: "/v1/prices",
      order: "/v1/orders",
      auth: "/api/3/zm/rest/auth/token",
      instruments: "/zm/rest/available-instruments",
      account: "/api/3/account",
      limits: "/api/3/user/limit"
    }
  },
  {
    name: "TransFi",
    baseUrl: "https://api.transfi.com", // Replace with actual TransFi API URL
    apiKey: process.env.TRANSFI_API_KEY,
    enabled: false, // Disabled until real API is available
    endpoints: {
      prices: "/v1/rates",
      order: "/v1/orders"
    }
  },
  {
    name: "Ramp",
    baseUrl: "https://api.ramp.network", // Replace with actual Ramp API URL
    apiKey: process.env.RAMP_API_KEY,
    enabled: false, // Disabled until real API is available
    endpoints: {
      prices: "/v1/rates",
      order: "/v1/orders"
    }
  }
];

// In-memory storage for rates (in production, use Redis or database)
let currentRates = [];
let bestProvider = null;
// let zodiaWsConnection = null; // COMMENTED OUT - WebSocket removed
// let zodiaAuthToken = null; // COMMENTED OUT - WebSocket removed

// Zodia API helper functions
function generateTonce() {
  return Date.now() * 1000; // Current time in microseconds
}

function generateSignature(tonce, secretKey) {
  // Convert tonce to string and ensure proper encoding
  const message = tonce.toString();
  
  // Try different signature methods
  // Method 1: Standard HMAC SHA256
  const signature1 = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  
  // Method 2: Try with base64 encoding
  const signature2 = crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  
  // Method 3: Try with raw buffer
  const signature3 = crypto.createHmac('sha256', secretKey).update(message).digest();
  
  logger.info(`Signature generation test:`, {
    message: message,
    signature1: signature1.substring(0, 20) + '...',
    signature2: signature2.substring(0, 20) + '...',
    signature3: signature3.toString('hex').substring(0, 20) + '...'
  });
  
  // For now, use the standard hex method
  return signature1;
}

// NEW: Zodia API authentication helper
async function makeZodiaRequest(endpoint, method = 'GET', body = null) {
  try {
    const tonce = generateTonce();
    const signature = generateSignature(tonce, ZODIA_SECRET_KEY);
    
    const config = {
      method: method,
      url: `${ZODIA_REST_URL}${endpoint}`,
      headers: {
        'Rest-Key': ZODIA_API_KEY,
        'Rest-Sign': signature,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    if (body) {
      config.data = body;
    }

    logger.info(`Making Zodia API request: ${method} ${endpoint}`);
    const response = await axios(config);
    
    logger.info(`Zodia API response: ${response.status}`);
    return response.data;
  } catch (error) {
    logger.error(`Zodia API error for ${endpoint}: ${error.message}`);
    throw error;
  }
}

// COMMENTED OUT - Zodia WebSocket class removed
/*
class ZodiaWebSocket {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.isConnected = false;
  }

  async getAuthToken() {
    try {
      logger.info('Getting Zodia authentication token...');
      
      const tonce = generateTonce();
      const signature = generateSignature(tonce, ZODIA_SECRET_KEY);
      
      logger.info(`Auth request details:`, {
        url: `${ZODIA_REST_URL}/api/3/zm/rest/auth/token`,
        tonce: tonce,
        signature: signature.substring(0, 10) + '...',
        apiKey: ZODIA_API_KEY.substring(0, 10) + '...'
      });
      
      const response = await axios.post(`${ZODIA_REST_URL}/api/3/zm/rest/auth/token`, {
        tonce: tonce
      }, {
        headers: {
          'Rest-Key': ZODIA_API_KEY,
          'Rest-Sign': signature,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      logger.info(`Zodia auth response:`, {
        status: response.status,
        data: response.data,
        headers: response.headers
      });

      if (response.data && response.data.token) {
        zodiaAuthToken = response.data.token;
        logger.info('Zodia authentication token obtained successfully');
        return response.data.token;
      } else {
        logger.error('Invalid auth response structure:', response.data);
        throw new Error('Invalid authentication response - no token field');
      }
    } catch (error) {
      logger.error(`Failed to get Zodia auth token: ${error.message}`, { 
        error: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers
      });
      throw error;
    }
  }

  async getAvailableInstruments() {
    try {
      logger.info('Getting available instruments from Zodia...');
      
      const response = await axios.get(`${ZODIA_REST_URL}/zm/rest/available-instruments`, {
        timeout: 10000
      });

      logger.info(`Available instruments: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get available instruments: ${error.message}`);
      throw error;
    }
  }

  async connect() {
    try {
      if (!zodiaAuthToken) {
        await this.getAuthToken();
      }

      logger.info(`Connecting to Zodia WebSocket: ${ZODIA_WS_URL}/zm/ws/ws-client?token=${zodiaAuthToken}`);
      
      // Note: In a real implementation, you would use a WebSocket client library
      // that supports authentication headers. For now, we'll simulate the connection
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      logger.info('Zodia WebSocket connected successfully');
      
      // Simulate receiving streaming quotes
      this.startQuoteSimulation();
      
    } catch (error) {
      logger.error(`Zodia WebSocket connection failed: ${error.message}`);
      this.handleReconnect();
    }
  }

  startQuoteSimulation() {
    // Simulate real-time quotes from Zodia
    setInterval(() => {
      if (this.isConnected) {
        const mockQuote = {
          type: 'quote',
          symbol: 'USDT.INR',
          bid: 85.0 + (Math.random() - 0.5) * 2,
          ask: 85.2 + (Math.random() - 0.5) * 2,
          timestamp: new Date().toISOString(),
          provider: 'Zodia'
        };

        // Update rates with new quote
        this.updateRatesFromQuote(mockQuote);
        
        // Broadcast to connected clients
        this.broadcastQuote(mockQuote);
      }
    }, 5000); // Update every 5 seconds
  }

  updateRatesFromQuote(quote) {
    const existingRateIndex = currentRates.findIndex(rate => rate.provider === 'Zodia');
    
    const newRate = {
      provider: 'Zodia',
      buyRate: quote.ask,
      sellRate: quote.bid,
      currency: quote.symbol,
      lastUpdated: quote.timestamp,
      source: 'websocket'
    };

    if (existingRateIndex >= 0) {
      currentRates[existingRateIndex] = newRate;
    } else {
      currentRates.push(newRate);
    }

    // Update best provider
    bestProvider = findBestProvider(currentRates, 'buy');
  }

  broadcastQuote(quote) {
    // This would broadcast to connected WebSocket clients
    // For now, just log the quote
    logger.info(`Broadcasting quote: ${JSON.stringify(quote)}`);
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      logger.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    this.isConnected = false;
    if (this.ws) {
      this.ws.close();
    }
    logger.info('Zodia WebSocket disconnected');
  }
}
*/

// COMMENTED OUT - WebSocket initialization removed
// zodiaWsConnection = new ZodiaWebSocket();

async function fetchZodiaRates(currencyPair = "USDT-INR") {
  try {
    logger.info(`Fetching Zodia rates for ${currencyPair}...`);
    
    // For now, return mock data since we don't have real Zodia API access
    // In production, this would make actual API calls to Zodia
    const mockRate = {
      provider: "Zodia",
      buyRate: 85.0 + (Math.random() - 0.5) * 2,
      sellRate: 84.8 + (Math.random() - 0.5) * 2,
      currency: currencyPair,
      lastUpdated: new Date().toISOString(),
      source: 'rest'
    };

    logger.info(`Zodia rate: ${JSON.stringify(mockRate)}`);
    return mockRate;
  } catch (error) {
    logger.error(`Failed to fetch Zodia rates: ${error.message}`);
    throw error;
  }
}

async function fetchMockRates(provider, currencyPair = "USDT-INR") {
  try {
    logger.info(`Fetching ${provider} rates for ${currencyPair}...`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    const mockRate = {
      provider: provider,
      buyRate: 85.0 + (Math.random() - 0.5) * 3,
      sellRate: 84.8 + (Math.random() - 0.5) * 3,
      currency: currencyPair,
      lastUpdated: new Date().toISOString(),
      source: 'rest'
    };

    logger.info(`${provider} rate: ${JSON.stringify(mockRate)}`);
    return mockRate;
  } catch (error) {
    logger.error(`Failed to fetch ${provider} rates: ${error.message}`);
    throw error;
  }
}

async function fetchAllRates(currencyPair = "USDT-INR") {
  try {
    logger.info(`Fetching all rates for ${currencyPair}...`);
    
    const ratePromises = [];
    
    // Add enabled providers
    providers.forEach(provider => {
      if (provider.enabled) {
        if (provider.name === "Zodia") {
          ratePromises.push(fetchZodiaRates(currencyPair));
        } else {
          ratePromises.push(fetchMockRates(provider.name, currencyPair));
        }
      }
    });
    
    const rates = await Promise.allSettled(ratePromises);
    
    const validRates = rates
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    logger.info(`Fetched ${validRates.length} valid rates out of ${ratePromises.length} providers`);
    return validRates;
  } catch (error) {
    logger.error(`Failed to fetch all rates: ${error.message}`);
    throw error;
  }
}

function findBestProvider(rates, type = "buy") {
  const validRates = rates.filter(rate => 
    rate && rate[`${type}Rate`] && !isNaN(rate[`${type}Rate`])
  );

  if (validRates.length === 0) {
    return null;
  }

  let bestRate = validRates[0];
  
  if (type === "buy") {
    // For buying, we want the lowest price
    bestRate = validRates.reduce((best, current) => 
      current.buyRate < best.buyRate ? current : best
    );
  } else {
    // For selling, we want the highest price
    bestRate = validRates.reduce((best, current) => 
      current.sellRate > best.sellRate ? current : best
    );
  }

  return bestRate;
}

// Main rates endpoint
app.get("/api/rates", async (req, res) => {
  try {
    const { pair = "USDT-INR", type = "buy" } = req.query;
    
    logger.info(`Rates request: pair=${pair}, type=${type}`);
    
    const rates = await fetchAllRates(pair);
    const best = findBestProvider(rates, type);
    
    // Update global state
    currentRates = rates;
    bestProvider = best;
    
    // Log the results
    logger.info(`Best ${type} provider: ${best?.provider} at ${best?.[`${type}Rate`]}`);
    rates.forEach(rate => {
      logger.info(`${rate.provider}: ${type} rate = ${rate[`${type}Rate`]}`);
    });

    res.json({
      success: true,
      data: {
        rates,
        bestProvider: best,
        timestamp: new Date().toISOString(),
        currencyPair: pair,
        type
      }
    });
  } catch (error) {
    logger.error(`Rates endpoint error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to fetch rates",
      message: error.message
    });
  }
});

// Get current best provider
app.get("/api/best", async (req, res) => {
  try {
    const { type = "buy" } = req.query;
    
    if (!bestProvider) {
      return res.status(404).json({
        success: false,
        error: "No rates available. Please fetch rates first."
      });
    }

    res.json({
      success: true,
      data: {
        bestProvider,
        type,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Best provider endpoint error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to get best provider"
    });
  }
});

// COMMENTED OUT - Zodia WebSocket status endpoint removed
/*
app.get("/api/zodia/status", (req, res) => {
  res.json({
    success: true,
    data: {
      connected: zodiaWsConnection?.isConnected || false,
      authToken: zodiaAuthToken ? 'Present' : 'Not available',
      reconnectAttempts: zodiaWsConnection?.reconnectAttempts || 0,
      timestamp: new Date().toISOString()
    }
  });
});
*/

// COMMENTED OUT - Connect to Zodia WebSocket endpoint removed
/*
app.post("/api/zodia/connect", async (req, res) => {
  try {
    await zodiaWsConnection.connect();
    res.json({
      success: true,
      message: "Zodia WebSocket connection initiated"
    });
  } catch (error) {
    logger.error(`Zodia connection error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to connect to Zodia WebSocket",
      message: error.message
    });
  }
});
*/

// COMMENTED OUT - Get available instruments endpoint removed
/*
app.get("/api/zodia/instruments", async (req, res) => {
  try {
    const instruments = await zodiaWsConnection.getAvailableInstruments();
    res.json({
      success: true,
      data: instruments
    });
  } catch (error) {
    logger.error(`Failed to get instruments: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to get available instruments"
    });
  }
});
*/

// Place order endpoint (for Zodia)
app.post("/api/order", async (req, res) => {
  try {
    const { provider = "Zodia", amount, currency = "USDT", side = "buy" } = req.body;
    
    if (!bestProvider || bestProvider.provider !== provider) {
      return res.status(400).json({
        success: false,
        error: "Invalid provider or no rates available"
      });
    }

    logger.info(`Placing ${side} order: ${amount} ${currency} via ${provider}`);

    // For now, return a mock order response
    // In production, integrate with actual provider APIs
    const orderResponse = {
      orderId: `ORD_${Date.now()}`,
      provider,
      amount,
      currency,
      side,
      rate: bestProvider[`${side}Rate`],
      status: "pending",
      timestamp: new Date().toISOString()
    };

    logger.info(`Order placed successfully: ${orderResponse.orderId}`);

    res.json({
      success: true,
      data: orderResponse
    });
  } catch (error) {
    logger.error(`Order placement error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to place order"
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    providers: providers.map(p => ({
      name: p.name,
      enabled: p.enabled
    })),
    // COMMENTED OUT - WebSocket status removed
    // zodiaWs: {
    //   connected: zodiaWsConnection?.isConnected || false,
    //   authToken: zodiaAuthToken ? 'Present' : 'Not available'
    // }
  });
});

// Use price routes
app.use("/api/price", priceRoutes);

// Get available instruments endpoint (REST API)
app.get("/api/instruments", async (req, res) => {
  try {
    logger.info('Fetching available instruments from Zodia...');
    
    const response = await axios.get(`${ZODIA_REST_URL}/zm/rest/available-instruments`, {
      headers: {
        'accept': 'application/json'
      },
      timeout: 10000
    });

    logger.info(`Available instruments fetched: ${response.data.instruments?.length || 0} instruments`);
    
    res.json({
      success: true,
      data: {
        instruments: response.data.instruments || []
      }
    });
  } catch (error) {
    logger.error(`Failed to get available instruments: ${error.message}`);
    
    // Return fallback instruments if API fails
    const fallbackInstruments = [
      { instrument: 'USDT.INR', active: true, enabled: true },
      { instrument: 'USDT.USD', active: true, enabled: true },
      { instrument: 'USDT.EUR', active: true, enabled: true },
      { instrument: 'USDT.GBP', active: true, enabled: true },
      { instrument: 'USDT.CAD', active: true, enabled: true },
      { instrument: 'USDT.AUD', active: true, enabled: true }
    ];
    
    res.json({
      success: true,
      data: {
        instruments: fallbackInstruments
      }
    });
  }
});

// NEW: Get account information endpoint
app.get("/api/account", async (req, res) => {
  try {
    logger.info('Fetching account information from Zodia...');
    
    const tonce = generateTonce();
    const body = { tonce: tonce };
    
    const accountData = await makeZodiaRequest('/api/3/account', 'POST', body);
    
    logger.info('Account information fetched successfully');
    
    res.json({
      success: true,
      data: accountData
    });
  } catch (error) {
    logger.error(`Failed to get account info: ${error.message}`);
    
    // Return mock account data if API fails
    const mockAccountData = {
      account: {
        primary: {
          available: 10000.00,
          balance: 10000.00,
          currency: 'USD'
        },
        brokerage: {
          available: 5000.00,
          balance: 5000.00,
          currency: 'USD'
        },
        tradeAheadBalance: 1000.00,
        availableBalance: 15000.00,
        balance: 15000.00
      }
    };
    
    res.json({
      success: true,
      data: mockAccountData,
      note: 'Using mock data due to API error'
    });
  }
});

// NEW: Get trading limits endpoint
app.get("/api/limits", async (req, res) => {
  try {
    logger.info('Fetching trading limits from Zodia...');
    
    const tonce = generateTonce();
    const body = { tonce: tonce };
    
    const limitsData = await makeZodiaRequest('/api/3/user/limit', 'POST', body);
    
    logger.info('Trading limits fetched successfully');
    
    res.json({
      success: true,
      data: limitsData
    });
  } catch (error) {
    logger.error(`Failed to get trading limits: ${error.message}`);
    
    // Return mock limits data if API fails
    const mockLimitsData = {
      limits: {
        daily: 100000.00,
        monthly: 1000000.00,
        currency: 'USD',
        remaining: {
          daily: 75000.00,
          monthly: 850000.00
        }
      }
    };
    
    res.json({
      success: true,
      data: mockLimitsData,
      note: 'Using mock data due to API error'
    });
  }
});

// NEW: Get transaction history endpoint
app.get("/api/transactions", async (req, res) => {
  try {
    const { 
      ccy, 
      transactionState, 
      from, 
      to, 
      max = 50, 
      offset = 0,
      transactionClass,
      transactionType 
    } = req.query;
    
    logger.info('Fetching transaction history from Zodia...');
    
    const tonce = generateTonce();
    const body = { 
      tonce: tonce,
      max: parseInt(max),
      offset: parseInt(offset)
    };
    
    // Add optional filters
    if (ccy) body.ccy = ccy;
    if (transactionState) body.transactionState = transactionState;
    if (from) body.from = parseInt(from);
    if (to) body.to = parseInt(to);
    if (transactionClass) body.transactionClass = transactionClass;
    if (transactionType) body.transactionType = transactionType;
    
    const transactionsData = await makeZodiaRequest('/api/3/transaction/list', 'POST', body);
    
    logger.info(`Transaction history fetched: ${transactionsData.transactions?.length || 0} transactions`);
    
    res.json({
      success: true,
      data: transactionsData
    });
  } catch (error) {
    logger.error(`Failed to get transaction history: ${error.message}`);
    
    // Return mock transaction data if API fails
    const mockTransactionsData = {
      transactions: [
        {
          id: 'TXN_001',
          transactionClass: 'RFSTRADE',
          transactionState: 'PROCESSED',
          transactionType: 'TRADE_CREDIT',
          amount: 1000.00,
          currency: 'USD',
          timestamp: new Date().toISOString(),
          description: 'BTC purchase'
        },
        {
          id: 'TXN_002',
          transactionClass: 'COIN',
          transactionState: 'PROCESSED',
          transactionType: 'DEPOSIT',
          amount: 0.05,
          currency: 'BTC',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          description: 'BTC deposit'
        }
      ]
    };
    
    res.json({
      success: true,
      data: mockTransactionsData,
      note: 'Using mock data due to API error'
    });
  }
});

// NEW: Get transfer history endpoint
app.get("/api/transfers", async (req, res) => {
  try {
    const { ccy, from, to } = req.query;
    
    logger.info('Fetching transfer history from Zodia...');
    
    const tonce = generateTonce();
    const body = { tonce: tonce };
    
    // Add optional filters
    if (ccy) body.ccy = ccy;
    if (from) body.from = parseInt(from);
    if (to) body.to = parseInt(to);
    
    const transfersData = await makeZodiaRequest('/api/3/transfer/list', 'POST', body);
    
    logger.info(`Transfer history fetched: ${transfersData.transfers?.length || 0} transfers`);
    
    res.json({
      success: true,
      data: transfersData
    });
  } catch (error) {
    logger.error(`Failed to get transfer history: ${error.message}`);
    
    // Return mock transfer data if API fails
    const mockTransfersData = {
      transfers: [
        {
          id: 'TRF_001',
          fromType: 'AVAILABLE',
          toType: 'BROKERAGE',
          amount: 5000.00,
          currency: 'USD',
          timestamp: new Date().toISOString(),
          status: 'COMPLETED'
        },
        {
          id: 'TRF_002',
          fromType: 'BROKERAGE',
          toType: 'AVAILABLE',
          amount: 1000.00,
          currency: 'USD',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          status: 'COMPLETED'
        }
      ]
    };
    
    res.json({
      success: true,
      data: mockTransfersData,
      note: 'Using mock data due to API error'
    });
  }
});

// NEW: Execute transfer endpoint
app.post("/api/transfer", async (req, res) => {
  try {
    const { from, to, amount, ccy, accountGroupUuid } = req.body;
    
    if (!from || !to || !amount || !ccy || !accountGroupUuid) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: from, to, amount, ccy, accountGroupUuid"
      });
    }
    
    logger.info(`Executing transfer: ${amount} ${ccy} from ${from} to ${to}`);
    
    const tonce = generateTonce();
    const body = {
      tonce: tonce,
      from: from,
      to: to,
      amount: parseFloat(amount),
      ccy: ccy,
      accountGroupUuid: accountGroupUuid
    };
    
    const transferResult = await makeZodiaRequest('/api/3/transfer', 'POST', body);
    
    logger.info('Transfer executed successfully');
    
    res.json({
      success: true,
      data: transferResult
    });
  } catch (error) {
    logger.error(`Failed to execute transfer: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to execute transfer",
      message: error.message
    });
  }
});

// NEW: Get available instruments endpoint (REST API)
app.get("/api/instruments", async (req, res) => {
  try {
    logger.info('Fetching available instruments from Zodia...');
    
    const response = await axios.get(`${ZODIA_REST_URL}/zm/rest/available-instruments`, {
      headers: {
        'accept': 'application/json'
      },
      timeout: 10000
    });

    logger.info(`Available instruments fetched: ${response.data.instruments?.length || 0} instruments`);
    
    res.json({
      success: true,
      data: {
        instruments: response.data.instruments || []
      }
    });
  } catch (error) {
    logger.error(`Failed to get available instruments: ${error.message}`);
    
    // Return fallback instruments if API fails
    const fallbackInstruments = [
      { instrument: 'USDT.INR', active: true, enabled: true },
      { instrument: 'USDT.USD', active: true, enabled: true },
      { instrument: 'USDT.EUR', active: true, enabled: true },
      { instrument: 'USDT.GBP', active: true, enabled: true },
      { instrument: 'USDT.CAD', active: true, enabled: true },
      { instrument: 'USDT.AUD', active: true, enabled: true }
    ];
    
    res.json({
      success: true,
      data: {
        instruments: fallbackInstruments
      }
    });
  }
});

// NEW: Get all coins data from multiple providers
app.get("/api/coins", async (req, res) => {
  try {
    const { providers = 'Zodia,TransFi,Ramp', assetType = 'all' } = req.query;
    const selectedProviders = providers.split(',');
    
    logger.info(`Fetching coins data for providers: ${selectedProviders.join(', ')}`);
    
    // Mock coins data structure
    const mockCoins = [
      { symbol: 'USDT', name: 'Tether', type: 'stablecoin', basePrice: 1.00 },
      { symbol: 'USDC', name: 'USD Coin', type: 'stablecoin', basePrice: 1.00 },
      { symbol: 'USDE', name: 'USD Digital', type: 'stablecoin', basePrice: 0.99 },
      { symbol: 'FDUSD', name: 'First Digital USD', type: 'stablecoin', basePrice: 1.00 },
      { symbol: 'USDS', name: 'USD Stablecoin', type: 'stablecoin', basePrice: 1.00 },
      { symbol: 'DAI', name: 'Multi-Collateral Dai', type: 'stablecoin', basePrice: 1.00 },
      { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', basePrice: 45000 },
      { symbol: 'ETH', name: 'Ethereum', type: 'crypto', basePrice: 2800 },
      { symbol: 'BNB', name: 'Binance Coin', type: 'crypto', basePrice: 320 },
      { symbol: 'SOL', name: 'Solana', type: 'crypto', basePrice: 95 }
    ];

    // Provider configurations
    const providerConfigs = {
      'Zodia': { name: 'Zodia', color: 'bg-blue-500', enabled: true },
      'TransFi': { name: 'TransFi', color: 'bg-green-500', enabled: true },
      'Ramp': { name: 'Ramp', color: 'bg-purple-500', enabled: true }
    };

    const allData = [];
    
    // Generate data for each coin from each selected provider
    for (const coin of mockCoins) {
      // Filter by asset type if specified
      if (assetType !== 'all' && coin.type !== assetType) {
        continue;
      }
      
      for (const providerId of selectedProviders) {
        const provider = providerConfigs[providerId];
        if (provider && provider.enabled) {
          try {
            // Generate mock price with some variation
            const basePrice = coin.basePrice;
            const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
            const price = basePrice * (1 + variation);
            
            // Generate exchange rate (for stablecoins, it's usually close to 1)
            const exchangeRate = coin.type === 'stablecoin' ? 
              (0.99 + Math.random() * 0.02) : // 0.99-1.01 for stablecoins
              (price * (0.95 + Math.random() * 0.1)); // More variation for crypto
            
            // Generate change rate
            const changeRate = (Math.random() - 0.5) * 2; // -1% to +1%
            
            allData.push({
              id: `${coin.symbol}-${providerId}`,
              symbol: coin.symbol,
              name: coin.name,
              type: coin.type,
              price: price.toFixed(6),
              exchangeRate: exchangeRate.toFixed(4),
              changeRate: changeRate.toFixed(2),
              provider: providerId,
              providerName: provider.name,
              providerColor: provider.color,
              lastUpdated: new Date().toISOString()
            });
          } catch (error) {
            logger.error(`Error generating data for ${coin.symbol} from ${providerId}: ${error.message}`);
            // Add fallback data with "00" prices
            allData.push({
              id: `${coin.symbol}-${providerId}`,
              symbol: coin.symbol,
              name: coin.name,
              type: coin.type,
              price: '0.000000',
              exchangeRate: '0.0000',
              changeRate: '0.00',
              provider: providerId,
              providerName: provider.name,
              providerColor: provider.color,
              lastUpdated: new Date().toISOString(),
              error: 'Price data unavailable'
            });
          }
        }
      }
    }
    
    logger.info(`Generated ${allData.length} coin entries for ${selectedProviders.length} providers`);
    
    res.json({
      success: true,
      data: {
        coins: allData,
        providers: selectedProviders,
        assetType: assetType,
        timestamp: new Date().toISOString(),
        totalCoins: allData.length
      }
    });
  } catch (error) {
    logger.error(`Failed to get coins data: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to fetch coins data",
      message: error.message
    });
  }
});

// COMMENTED OUT - WebSocket setup for real-time updates removed
/*
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  
  // Send current rates immediately
  if (currentRates.length > 0) {
    ws.send(JSON.stringify({
      type: 'rates',
      data: currentRates,
      bestProvider,
      timestamp: new Date().toISOString()
    }));
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      logger.info(`WebSocket message received: ${JSON.stringify(data)}`);
      
      // Handle different message types
      if (data.type === 'fetch_rates') {
        fetchAllRates(data.currencyPair || "USDT-INR")
          .then(rates => {
            const best = findBestProvider(rates, data.type || "buy");
            currentRates = rates;
            bestProvider = best;
            
            ws.send(JSON.stringify({
              type: 'rates_update',
              data: rates,
              bestProvider,
              timestamp: new Date().toISOString()
            }));
          })
          .catch(error => {
            logger.error(`WebSocket rates fetch error: ${error.message}`);
            ws.send(JSON.stringify({
              type: 'error',
              error: error.message
            }));
          });
      }
    } catch (error) {
      logger.error(`WebSocket message parsing error: ${error.message}`);
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
});
*/

// COMMENTED OUT - Periodic rate updates removed (WebSocket related)
/*
setInterval(async () => {
  try {
    const rates = await fetchAllRates("USDT-INR");
    const best = findBestProvider(rates, "buy");
    
    currentRates = rates;
    bestProvider = best;
    
    // Broadcast to all WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'rates_update',
          data: rates,
          bestProvider,
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    logger.info(`Periodic update: Best provider is ${best?.provider} at ${best?.buyRate}`);
  } catch (error) {
    logger.error(`Periodic update error: ${error.message}`);
  }
}, 30000);
*/

// COMMENTED OUT - Initialize Zodia WebSocket connection on startup removed
/*
setTimeout(async () => {
  try {
    await zodiaWsConnection.connect();
  } catch (error) {
    logger.error(`Failed to initialize Zodia WebSocket: ${error.message}`);
  }
}, 2000);
*/

// Start server (REST only)
app.listen(PORT, () => {
  logger.info(`✅ Server running on http://localhost:${PORT}`);
  // logger.info(`📡 WebSocket server ready on ws://localhost:${PORT}`); // COMMENTED OUT
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`💰 Rates endpoint: http://localhost:${PORT}/api/rates`);
  // logger.info(`🌐 Zodia WebSocket: ${ZODIA_WS_URL}`); // COMMENTED OUT
});