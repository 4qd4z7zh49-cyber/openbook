// components/trade/useTradeAction.ts
import { useState } from 'react';

export type Side = 'BUY' | 'SELL';

export type Order = {
  id: string;
  side: Side;
  qty: number;
  price: number;
  time: string;
};

export function useTradeAction() {
  const [balance, setBalance] = useState(10000);
  const [orders, setOrders] = useState<Order[]>([]);

  function place(side: Side, qty: number, price: number) {
    const total = qty * price;
    if (side === 'BUY' && balance < total) return false;

    setBalance((b) => (side === 'BUY' ? b - total : b + total));
    setOrders((o) => [
      {
        id: crypto.randomUUID(),
        side,
        qty,
        price,
        time: new Date().toISOString(),
      },
      ...o,
    ]);

    return true;
  }

  const pnl = orders.reduce(
    (s, o) => s + (o.side === 'SELL' ? o.qty * o.price : -o.qty * o.price),
    0
  );

  return { balance, orders, pnl, place };
}