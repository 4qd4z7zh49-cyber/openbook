'use client';

import { useState } from 'react';
import TradeTabs from '@components/trade/TradeTabs';
import TradeChart from '@components/trade/TradeChart';
import TradePanel from '@components/trade/TradePanel';

export default function TradePage() {
  const [tab, setTab] = useState<'chart' | 'trade'>('chart');

  return (
    <div className="p-4 text-white space-y-3">
      <h1 className="text-2xl font-bold">Trade</h1>

      <TradeTabs tab={tab} setTab={setTab} />

      {tab === 'chart' ? (
        <TradeChart symbol="BITSTAMP:BTCUSD" />
      ) : (
        <TradePanel />
      )}
    </div>
  );
}