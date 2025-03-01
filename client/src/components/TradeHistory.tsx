import { useState, useEffect } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import io from 'socket.io-client';

interface Trade {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: string;
}

export const TradeHistory = () => {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const socket = io('http://localhost:5000');

    socket.on('trades', (newTrades: Trade[]) => {
      setTrades(prevTrades => [...newTrades, ...prevTrades].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Trade History
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Price</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell align="right">Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trades.map((trade, index) => (
              <TableRow key={index}>
                <TableCell sx={{ color: trade.side === 'buy' ? 'success.main' : 'error.main' }}>
                  {trade.price.toFixed(2)}
                </TableCell>
                <TableCell align="right">{trade.size.toFixed(8)}</TableCell>
                <TableCell align="right">
                  {new Date(trade.timestamp).toLocaleTimeString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}; 