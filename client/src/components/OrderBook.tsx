import { useState, useEffect } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import io from 'socket.io-client';

interface Order {
  price: number;
  size: number;
}

export const OrderBook = () => {
  const [bids, setBids] = useState<Order[]>([]);
  const [asks, setAsks] = useState<Order[]>([]);

  useEffect(() => {
    const socket = io('http://localhost:5000');

    socket.on('orderbook', (data: { bids: Order[]; asks: Order[] }) => {
      setBids(data.bids);
      setAsks(data.asks);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Order Book
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Price</TableCell>
              <TableCell align="right">Size</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {asks.slice().reverse().map((ask, index) => (
              <TableRow key={`ask-${index}`} sx={{ backgroundColor: 'rgba(255, 0, 0, 0.05)' }}>
                <TableCell sx={{ color: 'error.main' }}>{ask.price.toFixed(2)}</TableCell>
                <TableCell align="right">{ask.size.toFixed(8)}</TableCell>
              </TableRow>
            ))}
            {bids.map((bid, index) => (
              <TableRow key={`bid-${index}`} sx={{ backgroundColor: 'rgba(0, 255, 0, 0.05)' }}>
                <TableCell sx={{ color: 'success.main' }}>{bid.price.toFixed(2)}</TableCell>
                <TableCell align="right">{bid.size.toFixed(8)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}; 