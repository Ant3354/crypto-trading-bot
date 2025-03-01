import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Tooltip, IconButton } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import io from 'socket.io-client';

interface PriceChange {
  h1: number;
  h5: number;
  h12: number;
  h24: number;
}

interface SecurityCheck {
  honeypot: {
    isHoneypot: boolean | null;
    buyTax: number | null;
    sellTax: number | null;
    error: string | null;
  };
  liquidity: {
    isLocked: boolean | null;
    liquidityUSD: number | null;
    error: string | null;
  };
  distribution: {
    top10Percentage: number | null;
    holderCount: number | null;
    error: string | null;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface Token {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: number;
  priceChange: PriceChange;
  volume24h: number;
  liquidity: number;
  createdAt: string;
  security: SecurityCheck;
}

export const NewTokens = () => {
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    const socketUrl = import.meta.env.MODE === 'production'
      ? 'https://crypto-trading-bot-server.herokuapp.com'
      : 'http://localhost:5000';
    const socket = io(socketUrl);

    socket.on('newTokens', (newTokens: Token[]) => {
      setTokens(newTokens);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const formatPercent = (value: number) => {
    if (!value) return '0.00%';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getPercentColor = (value: number) => {
    if (!value) return 'text.primary';
    return value > 0 ? 'success.main' : 'error.main';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return 'success';
      case 'MEDIUM':
        return 'warning';
      case 'HIGH':
        return 'error';
      default:
        return 'default';
    }
  };

  const SecurityInfo = ({ security }: { security: SecurityCheck }) => {
    const issues = [];
    
    if (security.honeypot.isHoneypot) {
      issues.push('Honeypot detected');
    }
    if (security.honeypot.buyTax && security.honeypot.buyTax > 10) {
      issues.push(`High buy tax: ${security.honeypot.buyTax}%`);
    }
    if (security.honeypot.sellTax && security.honeypot.sellTax > 10) {
      issues.push(`High sell tax: ${security.honeypot.sellTax}%`);
    }
    if (!security.liquidity.isLocked) {
      issues.push('Liquidity not locked');
    }
    if (security.liquidity.liquidityUSD && security.liquidity.liquidityUSD < 10000) {
      issues.push('Low liquidity');
    }
    if (security.distribution.top10Percentage && security.distribution.top10Percentage > 80) {
      issues.push('High token concentration');
    }
    if (security.distribution.holderCount && security.distribution.holderCount < 100) {
      issues.push('Low holder count');
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={security.riskLevel}
          color={getRiskColor(security.riskLevel)}
          size="small"
        />
        {security.liquidity.isLocked ? (
          <Tooltip title="Liquidity Locked">
            <LockIcon color="success" fontSize="small" />
          </Tooltip>
        ) : (
          <Tooltip title="Liquidity Not Locked">
            <LockOpenIcon color="error" fontSize="small" />
          </Tooltip>
        )}
        {issues.length > 0 && (
          <Tooltip title={issues.join('\n')}>
            <IconButton size="small" color="warning">
              <WarningIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        New Tokens
      </Typography>
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Token</TableCell>
              <TableCell>Chain</TableCell>
              <TableCell align="right">Price (USD)</TableCell>
              <TableCell align="right">1h</TableCell>
              <TableCell align="right">5h</TableCell>
              <TableCell align="right">12h</TableCell>
              <TableCell align="right">24h</TableCell>
              <TableCell align="right">Volume 24h</TableCell>
              <TableCell align="right">Liquidity</TableCell>
              <TableCell>Security</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tokens.map((token) => (
              <TableRow 
                key={`${token.chain}-${token.address}`} 
                hover
                sx={{
                  opacity: token.security.riskLevel === 'HIGH' ? 0.7 : 1,
                  backgroundColor: token.security.honeypot.isHoneypot ? 'rgba(255, 0, 0, 0.05)' : 'inherit'
                }}
              >
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {token.symbol}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {token.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{token.chain}</TableCell>
                <TableCell align="right">${token.price.toFixed(6)}</TableCell>
                <TableCell align="right" sx={{ color: getPercentColor(token.priceChange.h1) }}>
                  {formatPercent(token.priceChange.h1)}
                </TableCell>
                <TableCell align="right" sx={{ color: getPercentColor(token.priceChange.h5) }}>
                  {formatPercent(token.priceChange.h5)}
                </TableCell>
                <TableCell align="right" sx={{ color: getPercentColor(token.priceChange.h12) }}>
                  {formatPercent(token.priceChange.h12)}
                </TableCell>
                <TableCell align="right" sx={{ color: getPercentColor(token.priceChange.h24) }}>
                  {formatPercent(token.priceChange.h24)}
                </TableCell>
                <TableCell align="right">${token.volume24h.toLocaleString()}</TableCell>
                <TableCell align="right">${token.liquidity.toLocaleString()}</TableCell>
                <TableCell>
                  <SecurityInfo security={token.security} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}; 