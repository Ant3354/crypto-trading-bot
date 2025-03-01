import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { io } from 'socket.io-client';

interface Token {
  symbol: string;
  name: string;
  price: number;
  volume24h: number;
  liquidity: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const NewTokens = () => {
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);

    socket.on('newTokens', (newTokens: Token[]) => {
      setTokens(newTokens);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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
              <TableCell align="right">Price (USD)</TableCell>
              <TableCell align="right">Volume 24h</TableCell>
              <TableCell align="right">Liquidity</TableCell>
              <TableCell>Risk Level</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.symbol}>
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
                <TableCell align="right">${token.price.toFixed(6)}</TableCell>
                <TableCell align="right">${token.volume24h.toLocaleString()}</TableCell>
                <TableCell align="right">${token.liquidity.toLocaleString()}</TableCell>
                <TableCell>
                  <Chip
                    label={token.riskLevel}
                    color={getRiskColor(token.riskLevel)}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}; 