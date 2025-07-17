import express from 'express';
import axios from 'axios';
import winston from 'winston';

const router = express.Router();

// Configure logger for this module
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const ZODIA_BASE_URL = process.env.ZODIA_BASE_URL || "https://trade-uk.sandbox.zodiamarkets.com";
const ZODIA_API_KEY = process.env.ZODIA_API_KEY;

// Get specific currency pair price from Zodia
router.get('/:pair', async (req, res) => {
  const { pair } = req.params;
  const { type = "buy" } = req.query;

  try {
    logger.info(`Fetching ${type} price for ${pair} from Zodia`);

    if (!ZODIA_API_KEY) {
      throw new Error('Zodia API key not configured');
    }

    const response = await axios.get(`${ZODIA_BASE_URL}/v1/prices/${pair}`, {
      headers: {
        'x-api-key': ZODIA_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    logger.info(`Zodia price response for ${pair}: ${JSON.stringify(response.data)}`);

    // Extract the relevant rate based on type
    const rate = type === "sell" ? response.data.sell : response.data.buy;

    res.json({
      success: true,
      data: {
        provider: "Zodia",
        currencyPair: pair,
        type,
        rate,
        timestamp: new Date().toISOString(),
        rawData: response.data
      }
    });
  } catch (error) {
    logger.error(`Zodia API error for ${pair}: ${error.message}`, { 
      error: error.response?.data,
      status: error.response?.status 
    });

    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch Zodia price',
      message: error.message,
      details: error.response?.data
    });
  }
});

// Get all available currency pairs (mock for now)
router.get('/pairs/available', async (req, res) => {
  try {
    // Mock available pairs - in production, fetch from Zodia API
    const availablePairs = [
      "USDT-INR",
      "USDC-INR", 
      "BTC-INR",
      "ETH-INR",
      "USDT-USD",
      "USDC-USD"
    ];

    res.json({
      success: true,
      data: {
        pairs: availablePairs,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Available pairs error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available pairs'
    });
  }
});

// Get price history (mock for now)
router.get('/:pair/history', async (req, res) => {
  const { pair } = req.params;
  const { hours = 24 } = req.query;

  try {
    logger.info(`Fetching price history for ${pair} (${hours} hours)`);

    // Mock historical data - in production, fetch from database or API
    const history = [];
    const now = new Date();
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const baseRate = 85.0 + (Math.random() - 0.5) * 2; // Random variation around 85
      
      history.push({
        timestamp: timestamp.toISOString(),
        buyRate: baseRate + 0.1,
        sellRate: baseRate - 0.1,
        provider: "Zodia"
      });
    }

    res.json({
      success: true,
      data: {
        currencyPair: pair,
        history,
        hours: parseInt(hours),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Price history error for ${pair}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price history'
    });
  }
});

// Compare prices across providers for a specific pair
router.get('/:pair/compare', async (req, res) => {
  const { pair } = req.params;
  const { type = "buy" } = req.query;

  try {
    logger.info(`Comparing ${type} prices for ${pair} across providers`);

    // Mock comparison data - in production, fetch from all enabled providers
    const comparison = [
      {
        provider: "Zodia",
        rate: 85.2,
        status: "active",
        lastUpdated: new Date().toISOString()
      },
      {
        provider: "TransFi",
        rate: 85.5,
        status: "active", 
        lastUpdated: new Date().toISOString()
      },
      {
        provider: "Ramp",
        rate: 85.8,
        status: "active",
        lastUpdated: new Date().toISOString()
      }
    ];

    // Find best provider
    const bestProvider = type === "buy" 
      ? comparison.reduce((best, current) => current.rate < best.rate ? current : best)
      : comparison.reduce((best, current) => current.rate > best.rate ? current : best);

    res.json({
      success: true,
      data: {
        currencyPair: pair,
        type,
        providers: comparison,
        bestProvider,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Price comparison error for ${pair}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to compare prices'
    });
  }
});

export default router;