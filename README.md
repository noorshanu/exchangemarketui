# Crypto Arbitrage Dashboard Backend

A Node.js backend for a crypto trading arbitrage dashboard that fetches and compares live exchange rates from different fiat on-ramp providers.

## 🚀 Features

- **Real-time Rate Fetching**: Fetches live rates from Zodia API and mock data for other providers
- **Arbitrage Detection**: Automatically finds the best provider for buying/selling crypto
- **WebSocket Support**: Real-time updates via WebSocket connections
- **REST API**: Comprehensive REST endpoints for rate comparison and order placement
- **Comprehensive Logging**: Winston-based logging with file and console output
- **Health Monitoring**: Health check endpoints and provider status monitoring
- **Order Placement**: Mock order placement functionality (ready for real API integration)

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Zodia API credentials (for real rate fetching)

## 🛠️ Installation

1. **Clone and navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the backend directory:
   ```env
   ZODIA_API_KEY=your_zodia_api_key_here
   ZODIA_BASE_URL=https://trade-uk.sandbox.zodiamarkets.com
   TRANSFI_API_KEY=your_transfi_api_key_here
   RAMP_API_KEY=your_ramp_api_key_here
   PORT=5000
   ```

4. **Start the server:**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

## 🌐 API Endpoints

### Core Endpoints

#### GET `/api/rates`
Fetch rates from all enabled providers and find the best one.

**Query Parameters:**
- `pair` (optional): Currency pair (default: "USDT-INR")
- `type` (optional): "buy" or "sell" (default: "buy")

**Example:**
```bash
curl "http://localhost:5000/api/rates?pair=USDT-INR&type=buy"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "provider": "Zodia",
        "buyRate": 85.2,
        "sellRate": 85.0,
        "currency": "USDT-INR",
        "lastUpdated": "2024-01-15T10:30:00.000Z",
        "success": true
      }
    ],
    "bestProvider": {
      "provider": "Zodia",
      "buyRate": 85.2,
      "sellRate": 85.0,
      "currency": "USDT-INR",
      "lastUpdated": "2024-01-15T10:30:00.000Z",
      "success": true
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "currencyPair": "USDT-INR",
    "type": "buy"
  }
}
```

#### GET `/api/best`
Get the current best provider.

**Query Parameters:**
- `type` (optional): "buy" or "sell" (default: "buy")

#### POST `/api/order`
Place an order with the best provider.

**Request Body:**
```json
{
  "provider": "Zodia",
  "amount": 100,
  "currency": "USDT",
  "side": "buy"
}
```

#### GET `/api/health`
Health check endpoint.

### Price Routes

#### GET `/api/price/:pair`
Get specific currency pair price from Zodia.

**Parameters:**
- `pair`: Currency pair (e.g., "USDT-INR")

**Query Parameters:**
- `type` (optional): "buy" or "sell" (default: "buy")

#### GET `/api/price/pairs/available`
Get all available currency pairs.

#### GET `/api/price/:pair/history`
Get price history for a currency pair.

**Query Parameters:**
- `hours` (optional): Number of hours of history (default: 24)

#### GET `/api/price/:pair/compare`
Compare prices across providers for a specific pair.

## 🔌 WebSocket API

Connect to WebSocket endpoint for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:5000');

ws.onopen = () => {
  console.log('Connected to WebSocket');
  
  // Request rates update
  ws.send(JSON.stringify({
    type: 'fetch_rates',
    currencyPair: 'USDT-INR',
    type: 'buy'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'rates_update':
      console.log('New rates:', data.data);
      console.log('Best provider:', data.bestProvider);
      break;
    case 'error':
      console.error('Error:', data.error);
      break;
  }
};
```

## 📊 Provider Configuration

The backend supports multiple providers. Currently configured:

### Zodia (Active)
- **Base URL**: `https://trade-uk.sandbox.zodiamarkets.com`
- **Status**: ✅ Active with real API integration
- **Endpoints**: `/v1/prices`, `/v1/orders`

### TransFi (Mock)
- **Status**: 🟡 Mock data (ready for real API integration)
- **Endpoints**: `/v1/rates`, `/v1/orders`

### Ramp (Mock)
- **Status**: 🟡 Mock data (ready for real API integration)
- **Endpoints**: `/v1/rates`, `/v1/orders`

## 📝 Logging

Logs are stored in the `logs/` directory:
- `combined.log`: All logs
- `error.log`: Error logs only

Console output is also available for development.

## 🔄 Rate Updates

- **Automatic**: Every 30 seconds
- **Manual**: Via REST API or WebSocket
- **Real-time**: WebSocket broadcasts to all connected clients

## 🚨 Error Handling

The backend includes comprehensive error handling:
- API timeouts (10 seconds)
- Provider failures (graceful degradation)
- Invalid requests
- Network errors

## 🧪 Testing

Test the API endpoints:

```bash
# Health check
curl http://localhost:5000/api/health

# Get rates
curl http://localhost:5000/api/rates

# Get best provider
curl http://localhost:5000/api/best

# Get specific price
curl http://localhost:5000/api/price/USDT-INR
```

## 🔧 Development

### Project Structure
```
backend/
├── index.js          # Main server file
├── routes/
│   └── price.js      # Price-related routes
├── logs/             # Log files
├── package.json      # Dependencies
├── .env             # Environment variables
└── README.md        # This file
```

### Adding New Providers

1. Add provider configuration to the `providers` array in `index.js`
2. Implement fetch function (similar to `fetchZodiaRates`)
3. Update the `fetchAllRates` function to include the new provider
4. Add environment variables for API credentials

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ZODIA_API_KEY` | Zodia API key | Yes |
| `ZODIA_BASE_URL` | Zodia API base URL | No (has default) |
| `TRANSFI_API_KEY` | TransFi API key | No |
| `RAMP_API_KEY` | Ramp API key | No |
| `PORT` | Server port | No (default: 5000) |

## 🚀 Production Deployment

For production deployment:

1. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start index.js --name "crypto-arbitrage-api"
   pm2 save
   pm2 startup
   ```

2. **Set up reverse proxy (nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Use Redis for rate storage** (replace in-memory storage)
4. **Add SSL/TLS certificates**
5. **Set up monitoring and alerting**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details. 