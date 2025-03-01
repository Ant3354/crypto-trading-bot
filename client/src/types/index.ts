export interface SecurityCheck {
  score: number;
  warnings: string[];
  liquidityCheck: {
    hasLiquidity: boolean;
    liquidityUSD: number;
    pairs: number;
  };
  distributionCheck: {
    holderCount: number;
    topHolderPercentage: number;
    isDistributionHealthy: boolean;
  };
}

export interface Opportunity {
  symbol: string;
  score: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  change24h: number;
  volume: number;
  securityCheck: SecurityCheck;
} 