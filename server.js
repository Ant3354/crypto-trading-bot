require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const ccxt = require('ccxt');
const { Web3 } = require('web3');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS || "https://crypto-trading-bot.vercel.app",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || "https://crypto-trading-bot.vercel.app"
}));
app.use(express.json());

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, 'client/dist')));

// Initialize Web3
const web3 = new Web3(new Web3.providers.HttpProvider('https://bsc-dataseed1.binance.org'));

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
        baseAsset: market.base,
        quoteAsset: market.quote
      }));
    io.emit('marketOpportunities', opportunities);
    return opportunities;
  } catch (error) {
    console.error('Error analyzing market opportunities:', error);
    return [];
  }
};

// Trading improvement function
const improveTrading = async () => {
  try {
    await analyzeMarketOpportunities();
  } catch (error) {
    console.error('Error in trading improvement:', error);
  }
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  setInterval(improveTrading, process.env.UPDATE_INTERVAL || 60000);
});
