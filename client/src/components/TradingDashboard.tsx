import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Grid
} from '@mui/material';
import { io } from 'socket.io-client';

interface Opportunity {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  volume: number;
  securityCheck: {
    liquidityCheck: {
      hasLiquidity: boolean;
    };
  };
}

export const TradingDashboard = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);

    socket.on('connect', () => {
      setIsLoading(false);
    });

    socket.on('connect_error', () => {
      setError('Failed to connect to server');
      setIsLoading(false);
    });

    socket.on('opportunities', (data: Opportunity[]) => {
      setOpportunities(data);
      setIsLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Trading Opportunities
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Volume (24h)</TableCell>
                    <TableCell>Security Check</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {opportunities.map((opportunity) => (
                    <TableRow key={opportunity.symbol}>
                      <TableCell>{opportunity.symbol}</TableCell>
                      <TableCell>
                        <Chip
                          label={opportunity.action}
                          color={opportunity.action === 'BUY' ? 'success' : opportunity.action === 'SELL' ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell>${opportunity.price.toFixed(2)}</TableCell>
                      <TableCell>${opportunity.volume.toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={opportunity.securityCheck.liquidityCheck.hasLiquidity ? 'Secure' : 'Warning'}
                          color={opportunity.securityCheck.liquidityCheck.hasLiquidity ? 'success' : 'warning'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}; 