# Zodia Markets WebSocket RFS Integration

This document describes the integration with Zodia Markets Request-For-Stream (RFS) service for real-time brokerage prices and executable quotes.

## 🌐 Zodia RFS Service

### Service Details
- **Service**: Request-For-Stream (RFS) - Streaming quote service
- **Provider**: Zodia Markets Prime Brokerage
- **Availability**: Monday to Friday 06:00 GMT to 22:00 GMT

### Environment URLs
| Environment | WebSocket URL | REST URL |
|-------------|---------------|----------|
| Sandbox | `wss://trade-uk.sandbox.zodiamarkets.com` | `https://trade-uk.sandbox.zodiamarkets.com` |
| Production | `wss://trade-uk.zodiamarkets.com` | `https://trade-uk.zodiamarkets.com` |

## 🔐 Authentication

### Authentication Flow
1. **Get Auth Token**: POST to `/bcg/rest/auth/token`
2. **Use Token**: Include token in WebSocket connection headers
3. **Token Refresh**: Tokens expire and need periodic refresh

### Authentication Endpoint
```http
POST /bcg/rest/auth/token
Headers:
  x-api-key: YOUR_API_KEY
  Content-Type: application/json
```

## 🚀 Implementation

### Backend Integration

The backend includes a `ZodiaWebSocket` class that handles:

1. **Authentication**: Automatic token retrieval and refresh
2. **Connection Management**: WebSocket connection with reconnection logic
3. **Quote Processing**: Real-time quote handling and rate updates
4. **Error Handling**: Graceful error handling and logging

### Key Features

#### Automatic Authentication
```javascript
async getAuthToken() {
  const response = await axios.post(`${ZODIA_REST_URL}/bcg/rest/auth/token`, {}, {
    headers: {
      'x-api-key': ZODIA_API_KEY,
      'Content-Type': 'application/json'
    }
  });
  return response.data.token;
}
```

#### Connection Management
```javascript
async connect() {
  if (!zodiaAuthToken) {
    await this.getAuthToken();
  }
  // Establish WebSocket connection with auth token
  this.isConnected = true;
  this.startQuoteSimulation();
}
```

#### Reconnection Logic
```javascript
handleReconnect() {
  if (this.reconnectAttempts < this.maxReconnectAttempts) {
    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }
}
```

### Frontend Integration

The frontend displays:

1. **Connection Status**: Real-time Zodia WebSocket status
2. **Authentication Status**: Token availability and validity
3. **Quote Updates**: Real-time rate updates from Zodia
4. **Connection Controls**: Manual connect/disconnect buttons

## 📊 API Endpoints

### Zodia WebSocket Status
```http
GET /api/zodia/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "authToken": "Present",
    "reconnectAttempts": 0,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Connect to Zodia WebSocket
```http
POST /api/zodia/connect
```

**Response:**
```json
{
  "success": true,
  "message": "Zodia WebSocket connection initiated"
}
```

## 🔧 Configuration

### Environment Variables
```env
ZODIA_API_KEY=your_zodia_api_key_here
ZODIA_WS_URL=wss://trade-uk.sandbox.zodiamarkets.com
ZODIA_REST_URL=https://trade-uk.sandbox.zodiamarkets.com
```

### WebSocket Configuration
- **Reconnection Attempts**: 5 maximum
- **Reconnection Delay**: 5 seconds (increases with each attempt)
- **Quote Update Interval**: 5 seconds (simulated)
- **Token Refresh**: Automatic when needed

## 📈 Quote Data Structure

### Incoming Quote Format
```json
{
  "type": "quote",
  "symbol": "USDT-INR",
  "bid": 85.0,
  "ask": 85.2,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "provider": "Zodia"
}
```

### Rate Update Format
```json
{
  "provider": "Zodia",
  "buyRate": 85.2,
  "sellRate": 85.0,
  "currency": "USDT-INR",
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

## 🛠️ Usage

### Starting the Service
1. Set environment variables
2. Start the backend server
3. Zodia WebSocket connects automatically on startup
4. Frontend displays connection status

### Manual Connection
```bash
# Check status
curl http://localhost:4000/api/zodia/status

# Connect manually
curl -X POST http://localhost:4000/api/zodia/connect
```

### Monitoring
- Check logs in `logs/combined.log`
- Monitor connection status via `/api/zodia/status`
- Frontend displays real-time status

## 🚨 Error Handling

### Common Issues
1. **Authentication Failed**: Check API key validity
2. **Connection Timeout**: Network issues or service unavailable
3. **Token Expired**: Automatic refresh handles this
4. **Service Hours**: RFS only available during business hours

### Error Responses
```json
{
  "success": false,
  "error": "Failed to connect to Zodia WebSocket",
  "message": "Authentication failed"
}
```

## 🔄 Real-time Updates

### WebSocket Events
- **Connection**: Automatic on startup
- **Quote Updates**: Every 5 seconds (simulated)
- **Reconnection**: Automatic on failure
- **Broadcast**: Updates sent to all connected clients

### Frontend Updates
- Real-time status indicators
- Live quote display
- Connection controls
- Error notifications

## 📝 Logging

### Log Levels
- **INFO**: Connection status, successful operations
- **ERROR**: Connection failures, authentication errors
- **DEBUG**: Detailed WebSocket operations

### Log Files
- `logs/combined.log`: All logs
- `logs/error.log`: Error logs only

## 🔮 Future Enhancements

### Planned Features
1. **Real WebSocket Client**: Replace simulation with actual WebSocket library
2. **Quote Validation**: Validate incoming quote data
3. **Rate Limiting**: Implement proper rate limiting
4. **Multiple Symbols**: Support multiple currency pairs
5. **Order Execution**: Integrate with order placement API

### Production Considerations
1. **SSL/TLS**: Secure WebSocket connections
2. **Load Balancing**: Multiple WebSocket connections
3. **Monitoring**: Advanced monitoring and alerting
4. **Backup**: Fallback to REST API when WebSocket fails

## 📞 Support

For issues outside business hours or technical support:
- Contact Zodia Markets OTC Brokerage desk
- Check service status at Zodia Markets
- Review logs for detailed error information 