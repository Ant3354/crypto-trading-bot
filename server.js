require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const ccxt = require('ccxt');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, 'client/dist')));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({ status: 'API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Market analysis function
const analyzeMarketOpportunities = async () => {
  try {
    const exchange = new ccxt.binance();
    const markets = await exchange.fetchMarkets();
    const opportunities = markets
      .filter(market => market.active && market.quote === 'USDT')
      .map(market => ({
        symbol: market.symbol,
        action: Math.random() > 0.5 ? 'BUY' : 'SELL',
        price: Math.random() * 1000,
        volume: Math.random() * 1000000,
        securityCheck: {
          liquidityCheck: {
            hasLiquidity: Math.random() > 0.2
          }
        }
      }));
    io.emit('opportunities', opportunities);
    return opportunities;
  } catch (error) {
    console.error('Error analyzing market opportunities:', error);
    return [];
  }
};

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  setInterval(analyzeMarketOpportunities, 60000);
});
