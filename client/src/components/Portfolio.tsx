import { useState, useEffect } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import io from 'socket.io-client';

interface Position {
  asset: string;
  amount: number;
  value: number;
}

export const Portfolio = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    const socket = io('http://localhost:5000');

    socket.on('portfolio', (data: { positions: Position[]; totalValue: number }) => {
      setPositions(data.positions);
      setTotalValue(data.totalValue);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Portfolio
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Total Value: ${totalValue.toFixed(2)}
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Asset</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Value (USD)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={position.asset}>
                <TableCell>{position.asset}</TableCell>
                <TableCell align="right">{position.amount.toFixed(8)}</TableCell>
                <TableCell align="right">${position.value.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}; 