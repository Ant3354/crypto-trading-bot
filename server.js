const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const ccxt = require('ccxt');
const axios = require('axios');
const Web3 = require('web3');
const { Connection, PublicKey } = require('@solana/web3.js');
const { Token } = require('@solana/spl-token');
require('dotenv').config();

const app = express();

// Update port configuration for Heroku
const PORT = process.env.PORT || 5000;

// Update CORS configuration for production
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.PRODUCTION_CLIENT_URL,
  'https://crypto-trading-bot-client.vercel.app' // We'll deploy to Vercel
].filter(Boolean);

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST"]
}));

app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"]
  }
});

// API Keys and Configuration
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const COINCAP_API_KEY = process.env.COINCAP_API_KEY;
const COINCAP_API = 'https://api.coincap.io/v2';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1';

// Initialize Web3 providers
let bscProvider, ethProvider;
try {
  const bscProvider = new Web3.providers.HttpProvider('https://bsc-dataseed1.binance.org');
  const ethProvider = new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`);
  
  const bscWeb3 = new Web3(bscProvider);
  const ethWeb3 = new Web3(ethProvider);
  console.log('Web3 providers initialized successfully');
} catch (error) {
  console.error('Error initializing Web3:', error);
}

const solConnection = new Connection('https://api.mainnet-beta.solana.com');

// Trading Configuration
const TRADING_CONFIG = {
  initialInvestment: 10, // in USD
  profitTarget: 50, // percentage
  maxProfitTarget: 100, // percentage
  stopLoss: 25, // percentage
  tradingEnabled: false, // Set to true when Trust Wallet API is configured
  minLiquidityUSD: 50000,
  minHolders: 100,
  maxOwnershipPercent: 5,
  securityThreshold: 80,
  updateInterval: 60000
};

// Portfolio tracking
let activePositions = new Map();

// Initialize market data cache with shorter TTL
let marketDataCache = {
  coinmarketcap: new Map(),
  coingecko: new Map(),
  dexscreener: new Map(),
  lastUpdate: null,
  ttl: 60000 // 1 minute cache TTL for real-time data
};

// Trust Wallet API Configuration
const TRUST_WALLET_CONFIG = {
  apiKey: process.env.TRUST_WALLET_API_KEY || '',
  apiSecret: process.env.TRUST_WALLET_API_SECRET || '',
  walletAddress: process.env.TRUST_WALLET_ADDRESS || '',
  networks: {
    bsc: 'bsc',
    eth: 'ethereum',
    sol: 'solana'
  }
};

// Advanced Security Configuration
const SECURITY_CONFIG = {
  minLiquidityUSD: 50000,
  minHolderCount: 200,
  maxTopHolderPercentage: 50,
  minCodeVerified: true,
  minLiquidityLockMonths: 6,
  maxBuyTax: 10,
  maxSellTax: 10,
  minMarketCap: 100000,
  requiredAudits: ['Certik', 'Hacken', 'PeckShield'],
  blacklistedAddresses: new Set(), // Known scammer addresses
  suspiciousPatterns: [
    'reflection',
    'rebase',
    'elastic',
    'safe',
    'moon',
    'elon',
    'inu',
    'shib'
  ]
};

// Cross-chain Bridge Configuration
const BRIDGE_CONFIG = {
  providers: {
    'bsc-sol': {
      url: 'https://api.wormhole.com/v1/bridge',
      fee: 0.001,
      minAmount: 0.1
    },
    'eth-sol': {
      url: 'https://api.allbridge.io/v1/bridge',
      fee: 0.002,
      minAmount: 0.05
    }
  },
  gasBuffer: 1.2 // 20% extra for gas fees
};

// Performance Analytics
let tradingPerformance = {
  allTimeProfit: 0,
  allTimeLoss: 0,
  successfulTrades: 0,
  failedTrades: 0,
  avgProfitPerTrade: 0,
  avgHoldingTime: 0,
  bestPerformer: null,
  worstPerformer: null,
  chainPerformance: {
    bsc: { profit: 0, loss: 0 },
    sol: { profit: 0, loss: 0 },
    eth: { profit: 0, loss: 0 }
  }
};

// AI Trading Configuration
const AI_TRADING_CONFIG = {
  sentiment: {
    enabled: true,
    sources: ['twitter', 'reddit', 'telegram'],
    minConfidence: 0.75,
    updateInterval: 5 * 60 * 1000 // 5 minutes
  },
  technicalAnalysis: {
    enabled: true,
    indicators: {
      rsi: { period: 14, overbought: 70, oversold: 30 },
      macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      bollingerBands: { period: 20, stdDev: 2 },
      movingAverages: [
        { type: 'sma', periods: [20, 50, 200] },
        { type: 'ema', periods: [12, 26, 50] }
      ]
    }
  },
  machineLeaning: {
    enabled: true,
    models: {
      pricePredictor: {
        algorithm: 'lstm',
        timeframe: '1h',
        predictionHorizon: 24,
        minAccuracy: 0.8
      },
      patternRecognition: {
        algorithm: 'cnn',
        patterns: ['head_shoulders', 'double_top', 'triangle', 'flag'],
        minConfidence: 0.85
      }
    },
    retrainInterval: 24 * 60 * 60 * 1000 // 24 hours
  },
  riskManagement: {
    maxDrawdown: 15, // percentage
    positionSizing: {
      method: 'kelly_criterion',
      maxRisk: 2 // percentage per trade
    },
    volatilityAdjustment: {
      enabled: true,
      metric: 'atr', // Average True Range
      period: 14,
      adjustmentFactor: 1.5
    }
  }
};

// Advanced Trading Strategies
const TRADING_STRATEGIES = {
  GRID: {
    enabled: true,
    gridLevels: 10,
    gridSpacing: 2, // percentage between grid levels
    totalInvestment: 1000, // USD
    priceRange: {
      upper: 5, // percentage above current price
      lower: 5  // percentage below current price
    }
  },
  DCA: {
    enabled: true,
    baseAmount: 100, // USD
    interval: 24 * 60 * 60 * 1000, // 24 hours
    priceDropMultiplier: 1.5, // Increase buy amount by 1.5x on price drops
    maxDCALevels: 5
  },
  MARKET_MAKING: {
    enabled: true,
    spreadPercentage: 0.2,
    orderSize: 0.01, // BTC
    maxOrders: 5,
    rebalanceInterval: 5 * 60 * 1000 // 5 minutes
  }
};

// Enhanced Security Checks
const ENHANCED_SECURITY = {
  ...SECURITY_CONFIG,
  smartContractAudit: {
    required: true,
    minScore: 85,
    trustedAuditors: ['Certik', 'Hacken', 'PeckShield', 'SlowMist']
  },
  socialMetrics: {
    minFollowers: 10000,
    minTelegramMembers: 5000,
    requiredSocials: ['Twitter', 'Telegram', 'Discord']
  },
  liquidityAnalysis: {
    minLockPeriod: 180, // days
    minLPTokensBurned: 20, // percentage
    maxWalletConcentration: 2 // percentage
  },
  tradingPatterns: {
    minUniqueWallets: 1000,
    maxBuyTxPerWallet: 5,
    maxSellTxPerWallet: 5,
    suspiciousPatterns: [
      'sandwich_attack',
      'wash_trading',
      'pump_dump',
      'flash_loan_attack'
    ]
  }
};

// Constants for liquidity analysis
const LP_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getReserves",
    "outputs": [
      {"name": "_reserve0", "type": "uint112"},
      {"name": "_reserve1", "type": "uint112"},
      {"name": "_blockTimestampLast", "type": "uint32"}
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

const LOCKER_ADDRESS = {
  eth: '0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214',
  bsc: '0x407993575c91ce7643a4d4cCACc9A98c36eE1BBE',
  sol: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
};

// Crypto.com API Configuration
const CRYPTOCOM_CONFIG = {
  apiKey: '',
  apiSecret: '',
  networks: ['BNB', 'SOL'],
  securityThreshold: 80,
  minLiquidityUSD: 50000,
  minHolders: 100,
  maxOwnershipPercent: 5,
  updateInterval: 60000
};

// AI Configuration
const AI_CONFIG = {
  updateInterval: 300000, // 5 minutes
  minDataPoints: 100,
  confidenceThreshold: 0.8,
  volatilityThreshold: 0.05
};

// Rate limiting setup
const rateLimiter = {
  tokens: 10,
  lastRefill: Date.now(),
  refillRate: 1000, // 1 token per second
  maxTokens: 10,
  
  async getToken() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + timePassed * (this.refillRate / 1000));
    this.lastRefill = now;
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (1000 / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.getToken();
    }
    
    this.tokens -= 1;
    return true;
  }
};

// Helper function for rate-limited API calls
async function rateLimitedRequest(fn) {
  await rateLimiter.getToken();
  try {
    return await fn();
  } catch (error) {
    if (error.response && error.response.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return rateLimitedRequest(fn);
    }
    throw error;
  }
}

async function fetchCandles(symbol, timeframe = '1h') {
  try {
    const exchange = new ccxt.binance();
    const candles = await exchange.fetchOHLCV(symbol, timeframe);
    return candles.map(candle => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5]
    }));
  } catch (error) {
    console.error('Error fetching candles:', error);
    return null;
  }
}

async function fetchTwitterSentiment(symbol) {
  // Mock sentiment analysis since we don't have Twitter API access
  const mockSentiments = ['positive', 'neutral', 'negative'];
  const randomSentiment = mockSentiments[Math.floor(Math.random() * mockSentiments.length)];
  return {
    sentiment: randomSentiment,
    score: Math.random()
  };
}

async function improveTrading() {
  try {
    const opportunities = await analyzeMarketOpportunities();
    const predictions = await Promise.all(
      opportunities.map(async (opp) => {
        const technicalAnalysis = await performTechnicalAnalysis(opp.symbol);
        const sentiment = await analyzeSentiment(opp.symbol);
        return {
          symbol: opp.symbol,
          score: calculateOpportunityScore({
            ...opp,
            technicalAnalysis,
            sentiment
          })
        };
      })
    );
    
    return predictions.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Error in improveTrading:', error);
    return [];
  }
}

// Utility functions
async function getLPAddress(tokenAddress, chain) {
  const factoryAddress = {
    eth: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap V2
    bsc: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap V2
    sol: '' // Not needed for Solana
  }[chain];

  if (chain === 'sol') {
    return new PublicKey(tokenAddress);
  }

  const factoryABI = [{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"getPair","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];
  const provider = chain === 'bsc' ? bscWeb3 : ethWeb3;
  const factory = new provider.eth.Contract(factoryABI, factoryAddress);
  
  const weth = {
    eth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
  }[chain];

  return await factory.methods.getPair(tokenAddress, weth).call();
}

async function checkLPTokensBurned(address, chain) {
  try {
    const deadAddresses = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000'
    ];
    
    const lpAddress = await getLPAddress(address, chain);
    const provider = chain === 'bsc' ? bscWeb3 : ethWeb3;
    const lpContract = new provider.eth.Contract(LP_ABI, lpAddress);
    
    const [totalSupply, ...burnedBalances] = await Promise.all([
      lpContract.methods.totalSupply().call(),
      ...deadAddresses.map(addr => 
        lpContract.methods.balanceOf(addr).call()
      )
    ]);
    
    const totalBurned = burnedBalances.reduce((a, b) => a + BigInt(b), BigInt(0));
    return Number((totalBurned * BigInt(100)) / BigInt(totalSupply));
  } catch (error) {
    console.error('Error checking LP tokens burned:', error);
    return 0;
  }
}

function calculateLiquidityUSD(reserves) {
  // Assuming reserve1 is the token and reserve0 is WETH/WBNB
  const ethPrice = 3000; // Should be fetched from an oracle
  return (Number(reserves._reserve0) * ethPrice * 2) / 1e18;
}

async function fetchTokenTransactions(address, chain, limit = 1000) {
  try {
    const endpoint = chain === 'bsc' 
      ? `https://api.bscscan.com/api`
      : `https://api.etherscan.io/api`;
    
    const response = await axios.get(endpoint, {
      params: {
        module: 'account',
        action: 'tokentx',
        contractaddress: address,
        page: 1,
        offset: limit,
        sort: 'desc',
        apikey: chain === 'bsc' ? process.env.BSCSCAN_API_KEY : process.env.ETHERSCAN_API_KEY
      }
    });

    return response.data.result;
  } catch (error) {
    console.error('Error fetching token transactions:', error);
    return [];
  }
}

function incrementWalletTxCount(walletTxCount, tx) {
  const count = walletTxCount.get(tx.from) || { buy: 0, sell: 0 };
  if (tx.to === LOCKER_ADDRESS[tx.chainId]) {
    count.sell++;
  } else {
    count.buy++;
  }
  walletTxCount.set(tx.from, count);
}

function detectSuspiciousPatterns(tx, patterns) {
  // Detect sandwich attacks
  if (tx.gasPrice > tx.maxFeePerGas * 1.5) {
    patterns.sandwichAttacks++;
  }

  // Detect wash trading
  if (tx.from === tx.to || tx.value === '0') {
    patterns.washTrading++;
  }

  // Detect pump and dump
  if (tx.value > tx.gasPrice * 1000000) {
    patterns.pumpAndDump++;
  }

  // Detect flash loans
  if (tx.input.includes('flashloan')) {
    patterns.flashLoans++;
  }
}

function calculateTradingRiskScore(patterns, uniqueWallets) {
  const weights = {
    sandwichAttacks: 30,
    washTrading: 25,
    pumpAndDump: 25,
    flashLoans: 20
  };

  let riskScore = 0;
  
  // Calculate weighted risk from each pattern
  for (const [pattern, count] of Object.entries(patterns)) {
    const normalizedCount = count / uniqueWallets * 100;
    riskScore += normalizedCount * weights[pattern] / 100;
  }

  return Math.min(100, riskScore);
}

function calculateSocialScore(metrics) {
  let score = 0;
  
  // Twitter score (0-40 points)
  if (metrics.twitter.followers >= ENHANCED_SECURITY.socialMetrics.minFollowers) {
    score += 40;
  } else {
    score += (metrics.twitter.followers / ENHANCED_SECURITY.socialMetrics.minFollowers) * 40;
  }
  
  // Telegram score (0-30 points)
  if (metrics.telegram.members >= ENHANCED_SECURITY.socialMetrics.minTelegramMembers) {
    score += 30;
  } else {
    score += (metrics.telegram.members / ENHANCED_SECURITY.socialMetrics.minTelegramMembers) * 30;
  }
  
  // Discord score (0-30 points)
  const minDiscordMembers = 1000;
  if (metrics.discord.members >= minDiscordMembers) {
    score += 30;
  } else {
    score += (metrics.discord.members / minDiscordMembers) * 30;
  }
  
  return Math.round(score);
}

function calculateLiquidityScore(liquidity) {
  let score = 0;
  
  // Locked percentage score (0-40 points)
  if (liquidity.lockedPercentage >= ENHANCED_SECURITY.liquidityAnalysis.minLPTokensBurned) {
    score += 40;
  } else {
    score += (liquidity.lockedPercentage / ENHANCED_SECURITY.liquidityAnalysis.minLPTokensBurned) * 40;
  }
  
  // Lock duration score (0-40 points)
  if (liquidity.lockDuration >= ENHANCED_SECURITY.liquidityAnalysis.minLockPeriod) {
    score += 40;
  } else {
    score += (liquidity.lockDuration / ENHANCED_SECURITY.liquidityAnalysis.minLockPeriod) * 40;
  }
  
  // LP tokens burned score (0-20 points)
  if (liquidity.lpTokensBurned >= 20) {
    score += 20;
  } else {
    score += (liquidity.lpTokensBurned / 20) * 20;
  }
  
  return Math.round(score);
}

// Market data fetching functions
async function fetchCoinCapData() {
  try {
    return await rateLimitedRequest(async () => {
      const response = await axios.get('https://api.coincap.io/v2/assets', {
        headers: {
          'Authorization': `Bearer ${process.env.COINCAP_API_KEY}`
        },
        params: {
          limit: 100
        }
      });

      if (response.data && response.data.data) {
        return response.data.data;
      }
      return null;
    });
  } catch (error) {
    console.error('CoinCap API error:', error);
    return null;
  }
}

async function fetchCoinMarketCapData() {
  try {
    return await rateLimitedRequest(async () => {
      const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY
        },
        params: {
          start: 1,
          limit: 100,
          convert: 'USD',
          aux: 'num_market_pairs,cmc_rank,circulating_supply,total_supply'
        }
      });

      if (response.data && response.data.data) {
        return response.data.data.map(token => ({
          id: token.id,
          symbol: token.symbol,
          name: token.name,
          quote: token.quote
        }));
      }
      return null;
    });
  } catch (error) {
    console.error('CoinMarketCap API error:', error.response ? error.response.data : error);
    return null;
  }
}

// Trading functions
async function executeTrade(token, chain, action, amount) {
  if (!TRADING_CONFIG.tradingEnabled) {
    console.log('Trading is disabled. Enable after Trust Wallet API configuration.');
    return null;
  }

  try {
    // Perform security check before trade
    const securityCheck = await performEnhancedSecurityCheck(token, chain);
    if (!securityCheck.isSecure) {
      console.log(`Security check failed for ${token.symbol}: ${securityCheck.warnings.join(', ')}`);
      return null;
    }

    // Handle cross-chain trading if needed
    const userChain = await getCurrentChain();
    if (userChain !== chain) {
      return executeCrossChainTrade(userChain, chain, amount, token);
    }

    const transaction = await executeTrustWalletTransaction(token, chain, action, amount);
    
    if (transaction.success) {
      if (action === 'buy') {
        const position = {
          token,
          chain,
          amount,
          entryPrice: await getCurrentPrice(token),
          timestamp: Date.now(),
          transactionHash: transaction.transactionHash
        };
        activePositions.set(`${chain}-${token.symbol}`, position);
        return position;
      } else {
        const position = activePositions.get(`${chain}-${token.symbol}`);
        if (position) {
          activePositions.delete(`${chain}-${token.symbol}`);
          
          // Update performance metrics
          const exitPrice = await getCurrentPrice(token);
          const profitLoss = ((exitPrice - position.entryPrice) / position.entryPrice) * amount;
          
          if (profitLoss > 0) {
            tradingPerformance.allTimeProfit += profitLoss;
            tradingPerformance.successfulTrades++;
            tradingPerformance.chainPerformance[chain].profit += profitLoss;
          } else {
            tradingPerformance.allTimeLoss += profitLoss;
            tradingPerformance.failedTrades++;
            tradingPerformance.chainPerformance[chain].loss += profitLoss;
          }

          console.log(`Closed position with ${profitLoss.toFixed(2)}% P/L`);
        }
        return position;
      }
    }
    return null;
  } catch (error) {
    console.error('Trade execution error:', error);
    return null;
  }
}

async function monitorPosition(position) {
  const currentPrice = await getCurrentPrice(position.token);
  const profitLoss = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

  if (profitLoss >= TRADING_CONFIG.profitTarget) {
    // Sell initial investment
    const initialAmount = (TRADING_CONFIG.initialInvestment / position.entryPrice);
    await executeTrade(position.token, position.chain, 'sell', initialAmount);
    
    // Update position with remaining amount
    position.amount -= initialAmount;
    activePositions.set(`${position.chain}-${position.token}`, position);
  } else if (profitLoss <= -TRADING_CONFIG.stopLoss) {
    // Sell entire position
    await executeTrade(position.token, position.chain, 'sell', position.amount);
  }
}

// Enhanced market analysis
async function analyzeMarketOpportunities() {
  try {
    const [coinCapData, coinMarketCapData] = await Promise.all([
      fetchCoinCapData(),
      fetchCoinMarketCapData()
    ]);

    const marketData = [
      ...(coinCapData || []),
      ...(coinMarketCapData || [])
    ];

    if (!marketData || marketData.length === 0) {
      console.error('No market data available');
      return [];
    }

    const opportunities = await Promise.all(
      marketData.map(async (token) => {
        try {
          const chain = detectChain(token.id || token.symbol);
          if (!chain) return null;

          const securityChecks = await performEnhancedSecurityCheck(token.id || token.symbol, chain);
          const technicalAnalysis = await performTechnicalAnalysis(token.symbol);
          const sentiment = await analyzeSentiment(token.symbol);

          return {
            symbol: token.symbol,
            source: token.id ? 'CoinCap' : 'CoinMarketCap',
            chain,
            price: token.quote?.USD?.price || parseFloat(token.priceUsd) || 0,
            change24h: token.quote?.USD?.percent_change_24h || parseFloat(token.changePercent24Hr) || 0,
            volume: token.quote?.USD?.volume_24h || parseFloat(token.volumeUsd24Hr) || 0,
            score: calculateOpportunityScore({
              price: token.quote?.USD?.price || parseFloat(token.priceUsd) || 0,
              change24h: token.quote?.USD?.percent_change_24h || parseFloat(token.changePercent24Hr) || 0,
              volume: token.quote?.USD?.volume_24h || parseFloat(token.volumeUsd24Hr) || 0,
              securityChecks,
              technicalAnalysis,
              sentiment
            }),
            securityChecks: securityChecks || {
              liquidityLocked: false,
              ownershipRenounced: false,
              honeypotTest: false,
              sourceCodeVerified: false,
              rugPullRisk: 'HIGH'
            },
            technicalIndicators: technicalAnalysis || {
              rsi: 50,
              macd: 0,
              volume24hChange: 0,
              holders: 0,
              holderDistribution: {
                top10Percent: 100,
                top50Percent: 100
              }
            }
          };
        } catch (error) {
          console.error(`Error analyzing token ${token.symbol}:`, error);
          return null;
        }
      })
    );

    return opportunities.filter(Boolean);
  } catch (error) {
    console.error('Market analysis error:', error);
    return [];
  }
}

function calculateOpportunityScore(token) {
  let score = 0;
  
  // Volume score (0-40 points)
  if (token.volume > 1000000) score += 40;
  else if (token.volume > 500000) score += 30;
  else if (token.volume > 100000) score += 20;
  else score += 10;

  // Price change score (0-30 points)
  const change = Math.abs(token.change24h);
  if (change > 50) score += 30;
  else if (change > 30) score += 20;
  else if (change > 10) score += 10;

  // Security score (0-30 points)
  if (token.securityChecks.liquidityLocked) {
    score += 30;
  } else if (token.securityChecks.rugPullRisk === 'HIGH') {
    score += 15;
  }

  return score;
}

// Automated trading loop
async function startTradingLoop() {
  console.log('Starting trading loop...');
  
  try {
    // Initial market analysis
    const opportunities = await analyzeMarketOpportunities();
    if (!opportunities || opportunities.length === 0) {
      console.log('No trading opportunities found');
      return;
    }

    // Sort opportunities by score
    const sortedOpportunities = opportunities.sort((a, b) => b.score - a.score);
    
    // Take top opportunities that meet minimum criteria
    const qualifiedOpportunities = sortedOpportunities.filter(opp => 
      opp.score >= TRADING_CONFIG.securityThreshold &&
      opp.securityCheck.score >= 80 &&
      opp.volume >= TRADING_CONFIG.minLiquidityUSD
    );

    console.log(`Found ${qualifiedOpportunities.length} qualified trading opportunities`);

    // Execute trades for qualified opportunities
    for (const opportunity of qualifiedOpportunities) {
      try {
        // Perform technical analysis
        const analysis = await performTechnicalAnalysis(opportunity.symbol);
        
        // Get AI prediction
        const prediction = await predictPriceMovement(opportunity.symbol);
        
        // Calculate position size based on risk management
        const positionSize = calculatePositionSize(
          TRADING_CONFIG.maxPositionSize,
          TRADING_CONFIG.riskPerTrade,
          analysis.volatility
        );

        // Execute trade if conditions are met
        if (prediction.confidence >= AI_CONFIG.confidenceThreshold) {
          const trade = await executeTrade(
            opportunity.symbol,
            opportunity.chain,
            prediction.action,
            positionSize
          );

          if (trade.success) {
            console.log(`Successfully executed ${prediction.action} trade for ${opportunity.symbol}`);
            
            // Monitor position
            monitorPosition({
              symbol: opportunity.symbol,
              chain: opportunity.chain,
              amount: positionSize,
              entryPrice: trade.price,
              stopLoss: trade.price * (1 - TRADING_CONFIG.stopLoss / 100),
              takeProfit: trade.price * (1 + TRADING_CONFIG.takeProfit / 100)
            });
          }
        }
      } catch (error) {
        console.error(`Error executing trade for ${opportunity.symbol}:`, error);
      }
    }

    // Improve trading parameters based on market conditions
    await improveTrading();

  } catch (error) {
    console.error('Error in trading loop:', error);
  }

  // Schedule next iteration
  setTimeout(startTradingLoop, TRADING_CONFIG.updateInterval);
}

// Initialize exchanges
const exchange = new ccxt.binance({
  'enableRateLimit': true,
  options: {
    defaultType: 'spot'
  }
});

// Contract ABIs
const honeypotCheckerABI = [
  {"inputs":[{"internalType":"address","name":"_token","type":"address"},{"internalType":"address","name":"_router","type":"address"}],"name":"check","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}
];

// Security check functions
async function checkHoneypot(tokenAddress, chain) {
  try {
    let provider = chain === 'bsc' ? bscWeb3 : ethWeb3;
    let response;

    // Check using Honeypot API
    try {
      response = await axios.get(`https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}&chainID=${chain === 'bsc' ? 56 : 1}`);
      return {
        isHoneypot: response.data.isHoneypot,
        buyTax: response.data.simulationResult.buyTax,
        sellTax: response.data.simulationResult.sellTax,
        error: null
      };
    } catch (error) {
      console.error('Honeypot API error:', error);
    }

    // Fallback to on-chain check
    const honeypotChecker = new provider.eth.Contract(
      honeypotCheckerABI,
      chain === 'bsc' ? 'BSC_CHECKER_ADDRESS' : 'ETH_CHECKER_ADDRESS'
    );

    const isHoneypot = await honeypotChecker.methods.check(tokenAddress).call();
    return {
      isHoneypot,
      buyTax: null,
      sellTax: null,
      error: null
    };
  } catch (error) {
    console.error('Honeypot check error:', error);
    return {
      isHoneypot: null,
      buyTax: null,
      sellTax: null,
      error: error.message
    };
  }
}

async function checkLiquidity(tokenAddress, chain) {
  try {
    return await rateLimitedRequest(async () => {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        const liquidityUSD = response.data.pairs.reduce((total, pair) => total + parseFloat(pair.liquidity.usd || 0), 0);
        return {
          hasLiquidity: liquidityUSD > TRADING_CONFIG.minLiquidityUSD,
          liquidityUSD,
          pairs: response.data.pairs.length
        };
      }
      return { hasLiquidity: false, liquidityUSD: 0, pairs: 0 };
    });
  } catch (error) {
    console.error('Error checking liquidity:', error);
    return { hasLiquidity: false, liquidityUSD: 0, pairs: 0 };
  }
}

async function checkTokenDistribution(tokenAddress, chain) {
  try {
    const response = await axios.get(`${ETHERSCAN_API}/token/${tokenAddress}/holders`);
    if (response.data && response.data.holders) {
      const holders = response.data.holders;
      const totalSupply = response.data.totalSupply;
      
      const topHolder = holders[0];
      const topHolderPercentage = (topHolder.balance / totalSupply) * 100;
      
      return {
        holderCount: holders.length,
        topHolderPercentage,
        isDistributionHealthy: holders.length >= TRADING_CONFIG.minHolders && 
          topHolderPercentage <= TRADING_CONFIG.maxOwnershipPercent
      };
    }
    return {
      holderCount: 0,
      topHolderPercentage: 100,
      isDistributionHealthy: false
    };
  } catch (error) {
    console.error('Error checking token distribution:', error);
    return {
      holderCount: 0,
      topHolderPercentage: 100,
      isDistributionHealthy: false
    };
  }
}

// Enhanced token fetching with security checks
async function fetchNewTokensWithSecurity() {
  try {
    const cmcData = await fetchCoinCapData();
    if (!cmcData) {
      console.log('No data received from CoinCap API');
      return [];
    }
    
    const tokens = await Promise.all(cmcData.map(async (token) => {
      const chain = detectChain(token.id);
      if (!chain) return null;

      const [honeypotCheck, liquidityCheck, distributionCheck] = await Promise.all([
        checkHoneypot(token.platform?.token_address, chain),
        checkLiquidity(token.platform?.token_address, chain),
        checkTokenDistribution(token.platform?.token_address, chain)
      ]);

      return {
        symbol: token.symbol,
        name: token.name,
        chain,
        address: token.platform?.token_address,
        price: token.quote.USD.price,
        volume24h: token.quote.USD.volume_24h,
        marketCap: token.quote.USD.market_cap,
        securityChecks: {
          honeypot: honeypotCheck,
          liquidity: liquidityCheck,
          distribution: distributionCheck
        },
        riskLevel: calculateRiskLevel(honeypotCheck, liquidityCheck, distributionCheck)
      };
    }));

    return tokens.filter(token => token !== null);
  } catch (error) {
    console.error('Error fetching new tokens with security:', error);
    return [];
  }
}

function calculateRiskLevel(honeypotCheck, liquidityCheck, distributionCheck) {
  let riskScore = 0;
  
  // Honeypot risks
  if (honeypotCheck.isHoneypot) riskScore += 5;
  if (honeypotCheck.buyTax > 10) riskScore += 2;
  if (honeypotCheck.sellTax > 10) riskScore += 3;
  
  // Liquidity risks
  if (!liquidityCheck.hasLiquidity) riskScore += 2;
  if (liquidityCheck.liquidityUSD < 10000) riskScore += 2;
  
  // Distribution risks
  if (distributionCheck.topHolderPercentage > 80) riskScore += 3;
  if (distributionCheck.holderCount < 100) riskScore += 2;
  
  // Risk levels
  if (riskScore >= 10) return 'HIGH';
  if (riskScore >= 5) return 'MEDIUM';
  return 'LOW';
}

// Function to fetch order book
async function fetchOrderBook(symbol = 'BTC/USDT') {
  try {
    const orderbook = await exchange.fetchOrderBook(symbol);
    return {
      bids: orderbook.bids.slice(0, 10).map(([price, size]) => ({ price, size })),
      asks: orderbook.asks.slice(0, 10).map(([price, size]) => ({ price, size }))
    };
  } catch (error) {
    console.error('Error fetching order book:', error);
    return { bids: [], asks: [] };
  }
}

// Function to fetch recent trades
async function fetchTrades(symbol = 'BTC/USDT') {
  try {
    const trades = await exchange.fetchTrades(symbol);
    return trades.slice(0, 20).map(trade => ({
      price: trade.price,
      size: trade.amount,
      side: trade.side,
      timestamp: trade.datetime
    }));
  } catch (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
}

// Function to fetch ticker
async function fetchTicker(symbol = 'BTC/USDT') {
  try {
    const ticker = await exchange.fetchTicker(symbol);
    return ticker;
  } catch (error) {
    console.error('Error fetching ticker:', error);
    return null;
  }
}

// Simulate portfolio data (since we can't access real balance without API keys)
function getSimulatedPortfolio(btcPrice, ethPrice) {
  return {
    positions: [
      { asset: 'BTC', amount: 1.5, value: btcPrice * 1.5 },
      { asset: 'ETH', amount: 15, value: ethPrice * 15 },
      { asset: 'USDT', amount: 50000, value: 50000 }
    ],
    totalValue: btcPrice * 1.5 + ethPrice * 15 + 50000
  };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send initial data
  sendMarketData(socket);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Function to send market data to clients
async function sendMarketData(socket) {
  try {
    const [coinCapData, coinMarketCapData] = await Promise.all([
      fetchCoinCapData(),
      fetchCoinMarketCapData()
    ]);

    const marketData = [
      ...(coinCapData || []),
      ...(coinMarketCapData || [])
    ].filter(Boolean);

    if (marketData.length > 0) {
      const opportunities = await analyzeMarketOpportunities();
      socket.emit('marketData', marketData);
      socket.emit('opportunities', opportunities);
    }
  } catch (error) {
    console.error('Error sending market data:', error);
  }
}

// Set up periodic data updates
setInterval(async () => {
  io.emit('ping', { timestamp: Date.now() });
  
  try {
    const [coinCapData, coinMarketCapData] = await Promise.all([
      fetchCoinCapData(),
      fetchCoinMarketCapData()
    ]);

    const marketData = [
      ...(coinCapData || []),
      ...(coinMarketCapData || [])
    ].filter(Boolean);

    if (marketData.length > 0) {
      const opportunities = await analyzeMarketOpportunities();
      io.emit('marketData', marketData);
      io.emit('opportunities', opportunities);
    }
  } catch (error) {
    console.error('Error broadcasting market data:', error);
  }
}, 10000); // Update every 10 seconds

// API Routes
app.post('/api/trading/enable', (req, res) => {
  TRADING_CONFIG.tradingEnabled = true;
  res.json({ success: true, message: 'Trading enabled' });
});

app.post('/api/trading/disable', (req, res) => {
  TRADING_CONFIG.tradingEnabled = false;
  res.json({ success: true, message: 'Trading disabled' });
});

app.get('/api/opportunities', async (req, res) => {
  try {
    const opportunities = await analyzeMarketOpportunities();
    res.json(opportunities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/positions', (req, res) => {
  res.json(Array.from(activePositions.values()));
});

// Secure transaction handling
async function executeTrustWalletTransaction(token, chain, action, amount) {
  if (!TRUST_WALLET_CONFIG.apiKey || !TRUST_WALLET_CONFIG.apiSecret) {
    throw new Error('Trust Wallet API credentials not configured');
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': TRUST_WALLET_CONFIG.apiKey,
      'X-API-Secret': TRUST_WALLET_CONFIG.apiSecret
    };

    const transactionData = {
      walletAddress: TRUST_WALLET_CONFIG.walletAddress,
      network: TRUST_WALLET_CONFIG.networks[chain],
      tokenAddress: token,
      amount: amount.toString(),
      action: action // 'buy' or 'sell'
    };

    const response = await axios.post(
      'https://api.trustwallet.com/v1/transactions',
      transactionData,
      { headers }
    );

    return {
      success: true,
      transactionHash: response.data.hash,
      status: response.data.status
    };
  } catch (error) {
    console.error('Trust Wallet transaction error:', error);
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

// Add API endpoint for Trust Wallet configuration
app.post('/api/config/trustwallet', (req, res) => {
  const { apiKey, apiSecret, walletAddress } = req.body;
  
  if (!apiKey || !apiSecret || !walletAddress) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required Trust Wallet configuration' 
    });
  }

  // Update configuration
  TRUST_WALLET_CONFIG.apiKey = apiKey;
  TRUST_WALLET_CONFIG.apiSecret = apiSecret;
  TRUST_WALLET_CONFIG.walletAddress = walletAddress;

  // Enable trading if configuration is valid
  TRADING_CONFIG.tradingEnabled = true;

  res.json({ 
    success: true, 
    message: 'Trust Wallet configuration updated successfully' 
  });
});

// Add performance endpoints
app.get('/api/performance', (req, res) => {
  res.json(tradingPerformance);
});

app.get('/api/ai/improvements', (req, res) => {
  res.json({
    lastUpdate: AI_TRADING_CONFIG.machineLeaning.models.pricePredictor.lastUpdate,
    adjustments: AI_TRADING_CONFIG.machineLeaning.models.patternRecognition.patterns
  });
});

// AI-powered trading functions
async function analyzeSentiment(symbol) {
  try {
    const [twitterData, redditData, telegramData] = await Promise.all([
      fetchTwitterSentiment(symbol),
      fetchRedditSentiment(symbol),
      fetchTelegramSentiment(symbol)
    ]);

    // Weight the sentiment sources
    const weights = { twitter: 0.4, reddit: 0.3, telegram: 0.3 };
    const weightedSentiment = {
      score: (
        twitterData.score * weights.twitter +
        redditData.score * weights.reddit +
        telegramData.score * weights.telegram
      ),
      confidence: Math.min(
        twitterData.confidence,
        redditData.confidence,
        telegramData.confidence
      )
    };

    return weightedSentiment;
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return { score: 0, confidence: 0 };
  }
}

async function performTechnicalAnalysis(symbol, timeframe = '1h') {
  try {
    const candles = await fetchCandles(symbol, timeframe, 200);
    const indicators = AI_TRADING_CONFIG.technicalAnalysis.indicators;
    
    // Calculate technical indicators
    const analysis = {
      rsi: calculateRSI(candles, indicators.rsi.period),
      macd: calculateMACD(candles, indicators.macd),
      bollingerBands: calculateBollingerBands(candles, indicators.bollingerBands),
      movingAverages: calculateMovingAverages(candles, indicators.movingAverages)
    };

    // Generate signals
    const signals = {
      rsi: getRSISignal(analysis.rsi, indicators.rsi),
      macd: getMACDSignal(analysis.macd),
      bollingerBands: getBollingerSignal(analysis.bollingerBands, candles),
      movingAverages: getMASignals(analysis.movingAverages, candles)
    };

    return {
      analysis,
      signals,
      recommendation: generateRecommendation(signals)
    };
  } catch (error) {
    console.error('Error performing technical analysis:', error);
    return null;
  }
}

async function predictPriceMovement(symbol, timeframe = '1h') {
  try {
    const model = AI_TRADING_CONFIG.machineLeaning.models.pricePredictor;
    const historicalData = await fetchCandles(symbol, timeframe, 1000);
    
    // Prepare data for LSTM model
    const preprocessedData = preprocessDataForLSTM(historicalData);
    
    // Load or train LSTM model
    const lstmModel = await loadOrTrainLSTM(preprocessedData, model);
    
    // Make prediction
    const prediction = await lstmModel.predict(preprocessedData.slice(-model.predictionHorizon));
    
    // Calculate prediction accuracy
    const accuracy = calculatePredictionAccuracy(prediction, historicalData);
    
    return {
      prediction,
      accuracy,
      isReliable: accuracy >= model.minAccuracy
    };
  } catch (error) {
    console.error('Error predicting price movement:', error);
    return null;
  }
}

async function detectPatterns(symbol, timeframe = '1h') {
  try {
    const model = AI_TRADING_CONFIG.machineLeaning.models.patternRecognition;
    const candles = await fetchCandles(symbol, timeframe, 100);
    
    // Prepare data for CNN model
    const preprocessedData = preprocessDataForCNN(candles);
    
    // Load CNN model
    const cnnModel = await loadCNNModel();
    
    // Detect patterns
    const patterns = await cnnModel.detect(preprocessedData);
    
    return patterns.filter(p => p.confidence >= model.minConfidence);
  } catch (error) {
    console.error('Error detecting patterns:', error);
    return [];
  }
}

function calculatePositionSize(capital, risk, volatility) {
  const riskConfig = AI_TRADING_CONFIG.riskManagement;
  
  // Kelly Criterion calculation
  const winRate = tradingPerformance.successfulTrades / 
    (tradingPerformance.successfulTrades + tradingPerformance.failedTrades);
  const avgWin = tradingPerformance.allTimeProfit / tradingPerformance.successfulTrades;
  const avgLoss = Math.abs(tradingPerformance.allTimeLoss) / tradingPerformance.failedTrades;
  
  let kellyFraction = winRate - ((1 - winRate) / (avgWin / avgLoss));
  kellyFraction = Math.min(kellyFraction, riskConfig.positionSizing.maxRisk / 100);
  
  // Adjust position size based on volatility
  if (riskConfig.volatilityAdjustment.enabled) {
    const volatilityFactor = volatility / riskConfig.volatilityAdjustment.adjustmentFactor;
    kellyFraction = kellyFraction / volatilityFactor;
  }
  
  return capital * kellyFraction;
}

// Grid Trading Implementation
async function executeGridStrategy(token, chain) {
  const currentPrice = await getCurrentPrice(token);
  const gridSize = TRADING_STRATEGIES.GRID.gridLevels;
  const investment = TRADING_STRATEGIES.GRID.totalInvestment / gridSize;
  
  // Calculate grid levels
  const upperLimit = currentPrice * (1 + TRADING_STRATEGIES.GRID.priceRange.upper / 100);
  const lowerLimit = currentPrice * (1 - TRADING_STRATEGIES.GRID.priceRange.lower / 100);
  const gridStep = (upperLimit - lowerLimit) / (gridSize - 1);
  
  // Place grid orders
  for (let i = 0; i < gridSize; i++) {
    const gridPrice = lowerLimit + (i * gridStep);
    const amount = investment / gridPrice;
    
    if (gridPrice < currentPrice) {
      await executeTrade(token, chain, 'buy', amount, gridPrice);
    } else {
      await executeTrade(token, chain, 'sell', amount, gridPrice);
    }
  }
}

// Advanced DCA Implementation
async function executeDCAStrategy(token, chain) {
  const priceHistory = await getPriceHistory(token, chain);
  const averagePrice = calculateMovingAverage(priceHistory, 24); // 24-hour MA
  const currentPrice = await getCurrentPrice(token);
  
  let dcaAmount = TRADING_STRATEGIES.DCA.baseAmount;
  
  // Adjust DCA amount based on price action
  if (currentPrice < averagePrice) {
    const dropPercentage = ((averagePrice - currentPrice) / averagePrice) * 100;
    dcaAmount *= Math.min(
      TRADING_STRATEGIES.DCA.priceDropMultiplier * (dropPercentage / 10),
      TRADING_STRATEGIES.DCA.maxDCALevels
    );
  }
  
  await executeTrade(token, chain, 'buy', dcaAmount);
}

// Market Making Implementation
async function executeMarketMaking(token, chain) {
  const orderbook = await fetchOrderBook(`${token.symbol}/USDT`);
  const spread = (orderbook.asks[0].price - orderbook.bids[0].price) / orderbook.bids[0].price;
  
  if (spread > TRADING_STRATEGIES.MARKET_MAKING.spreadPercentage / 100) {
    const midPrice = (orderbook.asks[0].price + orderbook.bids[0].price) / 2;
    const orderSize = TRADING_STRATEGIES.MARKET_MAKING.orderSize;
    
    // Place orders on both sides of the book
    await executeTrade(token, chain, 'buy', orderSize, midPrice * (1 - spread/4));
    await executeTrade(token, chain, 'sell', orderSize, midPrice * (1 + spread/4));
  }
}

// Enhanced Security Check Implementation
async function performEnhancedSecurityCheck(token, chain) {
  try {
    const [liquidityCheck, distributionCheck] = await Promise.all([
      checkLiquidity(token.address, chain),
      checkTokenDistribution(token.address, chain)
    ]);

    const securityScore = calculateSecurityScore({
      liquidity: liquidityCheck,
      distribution: distributionCheck,
      volume24h: token.quote.USD.volume_24h,
      marketCap: token.quote.USD.market_cap
    });

    const warnings = generateSecurityWarnings({
      liquidity: liquidityCheck,
      distribution: distributionCheck,
      volume24h: token.quote.USD.volume_24h,
      marketCap: token.quote.USD.market_cap
    });

    return {
      score: securityScore,
      warnings,
      liquidityCheck,
      distributionCheck
    };
  } catch (error) {
    console.error('Error in security check:', error);
    return {
      score: 0,
      warnings: ['Unable to perform security check'],
      liquidityCheck: null,
      distributionCheck: null
    };
  }
}

// Helper functions for enhanced trading strategies
async function getPriceHistory(token, chain, period = '24h') {
  try {
    const response = await axios.get(
      `${COINCAP_API}/assets/${token.id}/history`,
      {
        headers: {
          'Authorization': `Bearer ${COINCAP_API_KEY}`
        },
        params: {
          interval: period === '24h' ? 'h1' : 'd1',
          start: Date.now() - (period === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000),
          end: Date.now()
        }
      }
    );
    return response.data.data.map(point => [point.time, parseFloat(point.priceUsd)]);
  } catch (error) {
    console.error('Error fetching price history:', error);
    return [];
  }
}

function calculateMovingAverage(prices, periods) {
  if (prices.length < periods) return null;
  const sum = prices.slice(-periods).reduce((acc, price) => acc + price[1], 0);
  return sum / periods;
}

async function getTopTokensByVolume(limit = 5) {
  try {
    const response = await axios.get(
      `${COINCAP_API}/assets`,
      {
        headers: {
          'Authorization': `Bearer ${COINCAP_API_KEY}`
        },
        params: {
          limit,
          sort: 'volumeUsd24Hr',
          direction: 'desc'
        }
      }
    );
    return response.data.data.map(token => ({
      symbol: token.symbol.toUpperCase(),
      chain: detectChain(token.id),
      id: token.id
    }));
  } catch (error) {
    console.error('Error fetching top tokens:', error);
    return [];
  }
}

function detectChain(tokenId) {
  // Default to ethereum for most tokens
  if (!tokenId) return 'eth';
  
  // Check common patterns in token ID
  if (tokenId.toLowerCase().includes('bsc')) return 'bsc';
  if (tokenId.toLowerCase().includes('binance')) return 'bsc';
  if (tokenId.toLowerCase().includes('sol')) return 'sol';
  if (tokenId.toLowerCase().includes('matic')) return 'polygon';
  
  return 'eth';
}

async function checkContractAudit(address) {
  try {
    // Check multiple audit platforms
    const [certikAudit, hackenAudit, peckshieldAudit] = await Promise.all([
      axios.get(`https://api.certik.com/projects/${address}`),
      axios.get(`https://hacken.io/api/audits/${address}`),
      axios.get(`https://peckshield.com/api/audits/${address}`)
    ]);

    return {
      hasAudit: true,
      score: Math.max(
        certikAudit.data.score || 0,
        hackenAudit.data.score || 0,
        peckshieldAudit.data.score || 0
      ),
      auditors: [
        certikAudit.data.score ? 'Certik' : null,
        hackenAudit.data.score ? 'Hacken' : null,
        peckshieldAudit.data.score ? 'PeckShield' : null
      ].filter(Boolean)
    };
  } catch (error) {
    console.error('Error checking contract audit:', error);
    return { hasAudit: false, score: 0, auditors: [] };
  }
}

async function checkSocialMetrics(symbol) {
  try {
    // Check social media presence and metrics
    const [twitter, telegram, discord] = await Promise.all([
      axios.get(`https://api.twitter.com/2/users/by/username/${symbol}`),
      axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getChatMembersCount?chat_id=@${symbol}`),
      axios.get(`https://discord.com/api/v9/guilds/${symbol}/preview`)
    ]);

    return {
      twitter: {
        followers: twitter.data.public_metrics?.followers_count || 0,
        verified: twitter.data.verified || false
      },
      telegram: {
        members: telegram.data.result || 0
      },
      discord: {
        members: discord.data.approximate_member_count || 0
      }
    };
  } catch (error) {
    console.error('Error checking social metrics:', error);
    return {
      twitter: { followers: 0, verified: false },
      telegram: { members: 0 },
      discord: { members: 0 }
    };
  }
}

async function analyzeLiquidity(address, chain) {
  try {
    let provider = chain === 'bsc' ? bscWeb3 : ethWeb3;
    
    // Get liquidity pool info
    const lpContract = new provider.eth.Contract(
      LP_ABI,
      await getLPAddress(address, chain)
    );

    const [
      totalSupply,
      lockedAmount,
      lockEndTime,
      reserves
    ] = await Promise.all([
      lpContract.methods.totalSupply().call(),
      lpContract.methods.balanceOf(LOCKER_ADDRESS).call(),
      lpContract.methods.lockEndTime().call(),
      lpContract.methods.getReserves().call()
    ]);

    return {
      liquidityUSD: calculateLiquidityUSD(reserves),
      lockedPercentage: (lockedAmount / totalSupply) * 100,
      lockDuration: Math.max(0, lockEndTime - Date.now() / 1000) / (24 * 3600), // days
      lpTokensBurned: await checkLPTokensBurned(address, chain)
    };
  } catch (error) {
    console.error('Error analyzing liquidity:', error);
    return {
      liquidityUSD: 0,
      lockedPercentage: 0,
      lockDuration: 0,
      lpTokensBurned: 0
    };
  }
}

async function analyzeTradingPatterns(address, chain) {
  try {
    // Fetch recent transactions
    const transactions = await fetchTokenTransactions(address, chain);
    
    // Analyze trading patterns
    const uniqueWallets = new Set();
    const walletTxCount = new Map();
    const patterns = {
      sandwichAttacks: 0,
      washTrading: 0,
      pumpAndDump: 0,
      flashLoans: 0
    };

    for (const tx of transactions) {
      uniqueWallets.add(tx.from).add(tx.to);
      incrementWalletTxCount(walletTxCount, tx);
      detectSuspiciousPatterns(tx, patterns);
    }

    return {
      uniqueWallets: uniqueWallets.size,
      averageTxPerWallet: transactions.length / uniqueWallets.size,
      suspiciousPatterns: patterns,
      riskScore: calculateTradingRiskScore(patterns, uniqueWallets.size)
    };
  } catch (error) {
    console.error('Error analyzing trading patterns:', error);
    return {
      uniqueWallets: 0,
      averageTxPerWallet: 0,
      suspiciousPatterns: {
        sandwichAttacks: 0,
        washTrading: 0,
        pumpAndDump: 0,
        flashLoans: 0
      },
      riskScore: 100 // High risk when analysis fails
    };
  }
}

function calculateSecurityScore(checks) {
  let score = 0;
  const weights = {
    liquidity: 40,
    distribution: 20,
    volume24h: 20,
    marketCap: 20
  };

  // Liquidity score (0-40 points)
  if (checks.liquidity.hasLiquidity) {
    score += checks.liquidity.liquidityUSD * weights.liquidity / 100;
  }

  // Distribution score (0-20 points)
  if (checks.distribution.isDistributionHealthy) {
    score += checks.distribution.topHolderPercentage * weights.distribution / 100;
  }

  // Volume score (0-20 points)
  if (checks.volume24h > 1000000) score += 20;
  else if (checks.volume24h > 500000) score += 10;
  else if (checks.volume24h > 100000) score += 5;

  // Market cap score (0-20 points)
  if (checks.marketCap > 1000000) score += 20;
  else if (checks.marketCap > 500000) score += 10;
  else if (checks.marketCap > 100000) score += 5;

  return Math.round(score);
}

function generateSecurityWarnings(checks) {
  const warnings = [];

  // Liquidity warnings
  if (!checks.liquidity.hasLiquidity) {
    warnings.push('Insufficient liquidity');
  }

  // Distribution warnings
  if (!checks.distribution.isDistributionHealthy) {
    warnings.push('Unhealthy token distribution');
  }

  // Volume warnings
  if (checks.volume24h < 100000) {
    warnings.push('Low trading volume');
  }

  // Market cap warnings
  if (checks.marketCap < 100000) {
    warnings.push('Low market capitalization');
  }

  return warnings;
}

// Health check endpoint for UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startTradingLoop();
  setInterval(improveTrading, AI_CONFIG.updateInterval);
}); 